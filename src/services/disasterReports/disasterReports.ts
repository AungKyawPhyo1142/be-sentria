import { ENV } from '@/env';
import { getMongoDB } from '@/libs/mongo';
import prisma from '@/libs/prisma';
import { publishToQueue } from '@/libs/rabbitmqClient';
import logger from '@/logger';
import { AppError, InternalServerError } from '@/utils/errors';
import { ReportStatus, ReportType, User } from '@prisma/client';
import { Collection } from 'mongodb';

export interface ValidatedDisasterPayload {
  title: string;
  description: string;
  incidentType: 'EARTHQUAKE' | 'FLOOD' | 'FIRE' | 'STORM' | 'OTHER';
  severity: 'UNKNOWN' | 'MINOR' | 'MODERATE' | 'SEVERE';
  incidentTimestamp: Date;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: {
    street?: string;
    district?: string;
    city?: string;
    country?: string;
    fullAddress?: string;
  };
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
}

// this is for the job to be dispatched to GO service
interface DisasterReportJobPayload {
  postgresReportId: string;
  mongoDbDocId: string;
  title: string;
  incidentType: string;
  description: string;
  severity: string;
  incidentTimestamp: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  address?: string; // combined address
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
  reporterUserId: number;
}

// mongo db collection name
export const DISASTER_COLLECTION_NAME = 'disasters_incidents';

export async function createDisasterReport(
  payload: ValidatedDisasterPayload,
  pgReportName: string,
  requestingUser: User,
) {
  const requestingUserId = requestingUser.id;
  let pgReportId: string | null = null;
  let mongoDocIDAsString: string | null = null;

  try {
    logger.info(`Creating PG metadata for ${pgReportName}`);
    const pgReport = await prisma.report.create({
      data: {
        reportType: ReportType.DISASTER_INCIDENT,
        name: pgReportName,
        parameters: {
          incidentType: payload.incidentType,
          severity: payload.severity,
          locationSummary: `${payload.address?.city}, ${payload.address?.country}`,
          titleSummary: payload.title,
        },
        status: ReportStatus.AWAITING_DETAILS,
        generatedById: requestingUserId,
        // initial counts are 0 by default by prisma
      },
    });

    pgReportId = pgReport.id;
    logger.info(
      `PG Report metadata ID: ${pgReportId} created for ${pgReportName}`,
    );

    const db = await getMongoDB();
    const disasterCollection: Collection = db.collection(
      DISASTER_COLLECTION_NAME,
    );
    const now = new Date();

    const mongoDisasterDocument = {
      postgresReportId: pgReportId,
      reporterUserId: requestingUserId,
      title: payload.title,
      description: payload.description,
      incidentType: payload.incidentType,
      severity: payload.severity,
      incidentTimestamp: payload.incidentTimestamp,
      location: payload.location,
      address: payload.address,
      media: payload.media,
      factCheck: {
        // initial factCheck object
        communityScore: { upvotes: 0, downvotes: 0 },
        goService: {
          status: 'PENDING_VERIFICATION',
          confidenceScore: null,
          lastCheckedAt: null,
        },
        overallPercentage: 0,
        lastCalculatedAt: now,
      },
      reportTimestamp: now,
      systemCreatedAt: now,
      systemUpdatedAt: now,
    };

    const mongoResult = await disasterCollection.insertOne(
      mongoDisasterDocument,
    );

    if (!mongoResult.insertedId) {
      throw new InternalServerError(
        'Error creating disaster report in mongoDB',
      );
    }

    mongoDocIDAsString = mongoResult.insertedId.toHexString();
    logger.info(
      `MongoDB Disaster Report ID: ${mongoDocIDAsString} created for ${pgReportName}`,
    );

    await prisma.report.update({
      where: {
        id: pgReportId,
      },
      data: {
        status: ReportStatus.COMPLETED,
        externalStorageId: mongoDocIDAsString,
        completed_at: now,
      },
    });
    logger.info(
      `PG Report ${pgReportId} for "${pgReportName}" updated to COMPLETED with MongoDB ref ${mongoDocIDAsString}.`,
    );

    const disasterReportJobPayload: DisasterReportJobPayload = {
      postgresReportId: pgReportId,
      mongoDbDocId: mongoDocIDAsString,
      title: payload.title,
      incidentType: payload.incidentType,
      description: payload.description,
      severity: payload.severity,
      incidentTimestamp: payload.incidentTimestamp.toISOString(),
      latitude: payload.location.coordinates[1],
      longitude: payload.location.coordinates[0],
      city: payload.address?.city || '',
      country: payload.address?.country || '',
      address: payload.address?.fullAddress || `${payload.address?.street ? payload.address.street + ', ' : ''}${payload.address?.district ? payload.address.district + ', ' : ''}${payload.address?.city ? payload.address.city + ', ' : ''}${payload.address?.country || ''}`,
      media: payload.media?.map((media) => ({ type: media.type, url: media.url, caption: media.caption })),
      reporterUserId: requestingUserId,
    }

    // set the queue name from env, and publish the job to RabbitMQ
    const queueName = ENV.RABBITMQ_FACTCHECK_QUEUE_NAME;
    const published = await publishToQueue(queueName, disasterReportJobPayload)
    let finalReportStatus: ReportStatus
    let statusUpdateMessage: string

    if (published) {
      finalReportStatus = ReportStatus.FACTCHECK_PENDING
      statusUpdateMessage = `[NodeService] Disaster report job published to ${queueName} queue. Report ID: ${pgReportId}`
      logger.info(statusUpdateMessage);
    } else {
      finalReportStatus = ReportStatus.PUBLISHED_FAILED
      statusUpdateMessage = `[NodeService] Failed to publish disaster report job to ${queueName} queue. Report ID: ${pgReportId}`
      logger.error(statusUpdateMessage);
    }

    // update the PG report status based on the publish result
    await prisma.report.update({
      where: { id: pgReportId },
      data: {
        status: finalReportStatus,
        errorMessage: published ? null : 'Failed to publish to RabbitMQ',
      }
    })

    return {
      postgresReportId: pgReportId,
      mongoDbReportId: mongoDocIDAsString,
      message: `Disaster report "${pgReportName}" (details: "${payload.title}") created successfully and submitted for fact-checking. Job Dispatch Status: ${finalReportStatus}`,
      currentStatus: finalReportStatus,
      // return other info if Frontend needs it
    };
  } catch (error: any) {
    logger.error(`Error creating disaster report for ${pgReportId}`);
    if (pgReportId && !mongoDocIDAsString) {
      // pg is created but mongo or subsequent is failed
      try {
        await prisma.report.update({
          where: {
            id: pgReportId,
          },
          data: {
            status: ReportStatus.FAILED,
            errorMessage: `Report creation failed before dispatch: ${error.message.substring(0, 250)}`,
          },
        });
      } catch (rollBackError: any) {
        logger.error(
          `Failed to mark PG report ${pgReportId} as FAILED. Rollback error: ${rollBackError.message}`,
        );
      }
    }
    if (error instanceof AppError) throw error;
    throw new InternalServerError('Error creating disaster report');
  }
}
