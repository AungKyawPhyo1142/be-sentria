import { getMongoDB } from '@/libs/mongo';
import prisma from '@/libs/prisma';
import logger from '@/logger';
import { DisasterIncidentDocument, ValidatedDisasterPayload } from '@/types/disasterReports';
import { AppError, InternalServerError, NotFoundError } from '@/utils/errors';
import { ReportStatus, ReportType, User } from '@prisma/client';
import { Collection, ObjectId, WithId } from 'mongodb';

// mongo db collection name
const DISASTER_COLLECTION_NAME = 'disasters_incidents';

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

    // TODO: dispatch job to GO fact check service
    logger.info(
      `Placeholder: Job for fact-checking ${pgReportName} dispatched to GO service.`,
    );

    return {
      postgresReportId: pgReportId,
      mongoDbReportId: mongoDocIDAsString,
      message: `Disaster report "${pgReportName}" (details: "${payload.title}") created successfully and submitted for fact-checking.`,
      // return other info if Frontend needs it
    };
  } catch (error: any) {
    logger.error(`Error creating disaster report for ${pgReportId}`);
    if (pgReportId && !mongoDocIDAsString) {
      // pg is created but mongo is not
      try {
        await prisma.report.update({
          where: {
            id: pgReportId,
          },
          data: {
            status: ReportStatus.FAILED,
            errorMessage: `MongoDB creation failed: ${error.message}`,
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

export async function getDisasterReportDetailsByMongoId(
  mongoDocId: string
): Promise<WithId<DisasterIncidentDocument> | null> {
  try {
    const objectId = new ObjectId(mongoDocId)
    const db = await getMongoDB();
    const disasterCollection: Collection<DisasterIncidentDocument> = db.collection(DISASTER_COLLECTION_NAME);
    const document = await disasterCollection.findOne({ _id: objectId })
    return document
  } catch (error) {
    logger.error(`Error getting disaster report by id ${mongoDocId}`)
    throw new InternalServerError('Error getting disaster report by id')
  }
}

// to orchestrate getting full report from postgres
export async function getFullDisasterReportById(reportId: string) {
  logger.info(`Getting full disaster report for ${reportId}`)

  const reportMetadata = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      generatedBy: { // include the user who generated the report
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profile_image: true,
        }

      }
    }
  })

  if (!reportMetadata) {
    throw new NotFoundError(`Report ${reportId} not found`)
  }

  if (reportMetadata.reportType !== ReportType.DISASTER_INCIDENT) {
    logger.warn(`Report ${reportId} is not a disaster report, but type is ${reportMetadata.reportType}`)
    throw new NotFoundError(`Report ${reportId} not found`)
  }

  let disasterDetails: WithId<DisasterIncidentDocument> | null = null
  if (reportMetadata.externalStorageId) {
    disasterDetails = await getDisasterReportDetailsByMongoId(reportMetadata.externalStorageId)
    if (!disasterDetails) {
      logger.error(`Data inconsistency: report ${reportId} has externalStorageId ${reportMetadata.externalStorageId} but no data in mongoDB`)
      throw new InternalServerError(`Data inconsistency: report ${reportId} has externalStorageId ${reportMetadata.externalStorageId} but no data in mongoDB`)
    }
  }
  else if (reportMetadata.reportType === ReportType.DISASTER_INCIDENT) {
    logger.error(`Report ${reportId} has no externalStorageId but type is ${reportMetadata.reportType}`)
    throw new InternalServerError(`Report ${reportId} has no externalStorageId but type is ${reportMetadata.reportType}`)
  }

  // TODO: fetch current user's vote on this report
  // TODO: fetch comments for this report

  return {
    ...reportMetadata,
    details: disasterDetails
  }

}