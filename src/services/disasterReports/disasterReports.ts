import { ENV } from '@/env';
import { getMongoDB } from '@/libs/mongo';
import prisma from '@/libs/prisma';
import { publishToQueue } from '@/libs/rabbitmqClient';
import logger from '@/logger';
import {
  DISASTER_INCIDENT_TYPE,
  DISASTER_SEVERITY,
  DisasterReportJobPayload,
  MongoDBReportSchema,
} from '@/types/reports';
import {
  AppError,
  AuthenticationError,
  InternalServerError,
  NotFoundError,
} from '@/utils/errors';
import { ReportDBStatus, ReportStatus, ReportType, User } from '@prisma/client';
import { Collection, Document, Filter, ObjectId } from 'mongodb';
import { deleteFromSupabase } from './upload';
import { COMMENT_COLLECTION_NAME } from '../comments/comments';
import { COMMENT_REPLY_COLLECTION_NAME } from '../commentReplies/commentReplies';

export interface ValidatedDisasterPayload {
  reportName: string;
  description: string;
  incidentType: DISASTER_INCIDENT_TYPE;
  severity: DISASTER_SEVERITY;
  incidentTimestamp: Date;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  country: string;
  city: string;
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
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
        },
        country: payload.country,
        city: payload.city,
        status: ReportStatus.FACTCHECK_PENDING,
        dbStatus: ReportDBStatus.PENDING_FOR_MONGODB_CREATION,
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

    const mongoDisasterDocument = MongoDBReportSchema.parse({
      description: payload.description,
      incidentType: payload.incidentType,
      severity: payload.severity,
      reportName: payload.reportName,
      location: {
        city: payload.city,
        country: payload.country,
        latitude: payload.location.coordinates[1],
        longitude: payload.location.coordinates[0],
      },

      incidentTimestamp: payload.incidentTimestamp.toISOString(),
      media:
        payload.media?.map((media) => ({
          type: media.type,
          url: media.url,
          caption: media.caption,
        })) || [],
      postgresReportId: pgReportId,
      reporterUserId: requestingUserId,
      factCheck: {
        communityScore: { upvotes: 0, downvotes: 0 },
        goService: {
          status: 'PENDING_VERIFICATION',
          confidenceScore: null,
          lastCheckedAt: null,
        },
        overallPercentage: 0,
        lastCalculatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });

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
        status: ReportStatus.FACTCHECK_PENDING,
        dbStatus: ReportDBStatus.PUBLISHED_IN_MONGODB,
        externalStorageId: mongoDocIDAsString,
        completed_at: now,
      },
    });
    logger.info(
      `PG Report ${pgReportId} for "${pgReportName}" updated to COMPLETED with MongoDB ref ${mongoDocIDAsString}.`,
    );

    const disasterReportJobPayload: DisasterReportJobPayload = {
      reportName: payload.reportName,
      postgresReportId: pgReportId,
      mongoDbDocId: mongoDocIDAsString,
      incidentType: payload.incidentType,
      description: payload.description,
      severity: payload.severity,
      incidentTimestamp: payload.incidentTimestamp.toISOString(),
      latitude: payload.location.coordinates[1],
      longitude: payload.location.coordinates[0],
      city: payload.city,
      country: payload.country,
      media: payload.media?.map((media) => ({
        type: media.type,
        url: media.url,
        caption: media.caption,
      })),
      reporterUserId: requestingUserId,
    };

    // set the queue name from env, and publish the job to RabbitMQ
    const queueName = ENV.RABBITMQ_FACTCHECK_QUEUE_NAME;
    const published = await publishToQueue(queueName, disasterReportJobPayload);
    let finalReportStatus: ReportStatus;
    let statusUpdateMessage: string;

    if (published) {
      finalReportStatus = ReportStatus.FACTCHECK_PENDING;
      statusUpdateMessage = `[NodeService] Disaster report job published to ${queueName} queue. Report ID: ${pgReportId}`;
      logger.info(statusUpdateMessage);
    } else {
      finalReportStatus = ReportStatus.PUBLISHED_FAILED;
      statusUpdateMessage = `[NodeService] Failed to publish disaster report job to ${queueName} queue. Report ID: ${pgReportId}`;
      logger.error(statusUpdateMessage);
    }

    // update the PG report status based on the publish result
    await prisma.report.update({
      where: { id: pgReportId },
      data: {
        status: finalReportStatus,
        errorMessage: published ? null : 'Failed to publish to RabbitMQ',
      },
    });

    return {
      postgresReportId: pgReportId,
      mongoDbReportId: mongoDocIDAsString,
      message: `Disaster report "${pgReportName}" created successfully and submitted for fact-checking. Job Dispatch Status: ${finalReportStatus}`,
      currentStatus: finalReportStatus,
      // return other info if Frontend needs it
    };
  } catch (error: unknown) {
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
            errorMessage: `Report creation failed before dispatch: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      } catch (rollBackError: unknown) {
        logger.error(
          `Failed to mark PG report ${pgReportId} as FAILED. Rollback error: ${rollBackError instanceof Error ? rollBackError.message : String(rollBackError)}`,
        );
      }
    }
    if (error instanceof AppError) throw error;
    throw new InternalServerError('Error creating disaster report');
  }
}

export async function getAllDisasterReports(cursor?: string, limit?: string) {
  const take = parseInt(limit as string, 10) || 10;

  try {
    const db = await getMongoDB();
    const disasterReportCollection: Collection = db.collection(
      DISASTER_COLLECTION_NAME,
    );
    const query: Filter<Document> = {};
    if (cursor) {
      query._id = { $gt: new ObjectId(cursor) };
    }

    const disasterReports = await disasterReportCollection
      .find(query)
      .sort({ _id: -1 }) // sort by _id in descending order
      .limit(take + 1) // fetch one extra to check for next page
      .toArray();
    const hasNextPage = disasterReports.length > take;
    const paginatedReports = hasNextPage
      ? disasterReports.slice(0, take)
      : disasterReports;
    const nextCursor = hasNextPage
      ? disasterReports[take]._id.toHexString()
      : null;

    if (paginatedReports.length === 0) {
      return {
        data: [],
        nextCursor: null,
        hasNextPage: false,
      };
    }

    const UserIds = [
      ...new Set(
        paginatedReports
          .map((report) => report.reporterUserId)
          .filter((id) => id != null),
      ),
    ];

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: UserIds,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile_image: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));

    const formattedReports = paginatedReports.map((report) => {
      const user = userMap.get(report.reporterUserId);
      return {
        ...report,
        generatedBy: user || {
          id: null,
          firstName: 'Unknown',
          lastName: '',
          profile_image: null,
        },
      };
    });

    return {
      data: formattedReports,
      nextCursor,
      hasNextPage,
    };

    // const reports = await prisma.report.findMany({
    //   take: take + 1,
    //   ...(cursor && {
    //     skip: 1, // skip the cursor item
    //     cursor: {
    //       id: cursor,
    //     },
    //   }),
    //   orderBy: {
    //     created_at: 'desc',
    //   },
    //   include: {
    //     generatedBy: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         profile_image: true,
    //       },
    //     },
    //   },
    //   where: {
    //     reportType: ReportType.DISASTER_INCIDENT,
    //   },
    // });

    // const hasNextPage = reports.length > take;
    // const paginatedReports = hasNextPage ? reports.slice(0, take) : reports;

    // return {
    //   data: paginatedReports,
    //   nextCursor: hasNextPage ? reports[take].id : null,
    //   hasNextPage,
    // };
  } catch (error) {
    logger.error(`Error fetching disaster reports: ${error}`);
    throw new InternalServerError('Error fetching disaster reports');
  }
}

export async function getDisasterReportById(reportId: string) {
  try {
    logger.info(`Getting disaster report by id: ${reportId}`);
    const db = await getMongoDB();
    const disasterReportCollection: Collection = db.collection(
      DISASTER_COLLECTION_NAME,
    );
    const disasterReport = await disasterReportCollection.findOne({
      _id: new ObjectId(reportId),
    });

    if (!disasterReport) {
      throw new NotFoundError('Disaster report not found');
    }

    const userId = disasterReport.reporterUserId;
    if (!userId) {
      logger.warn(`Disaster report ${reportId} has no reporter user ID`);
      throw new InternalServerError(
        'Invalid disaster report data: missing reporter user ID',
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profile_image: true,
      },
    });

    const formattedReport = {
      ...disasterReport,
      generatedBy: user || {
        id: null,
        firstName: 'Unknown',
        lastName: '',
        profile_image: null,
      },
    };

    return {
      data: formattedReport,
      message: 'Disaster report fetched successfully',
    };
  } catch (error) {
    logger.error(`Error fetching disaster report by id: ${error}`);
    throw error;
  }
}

export async function deleteDisasterReport(reportId: string, user: User) {
  try {
    logger.info(
      `Deleting disaster report with MongoDB ID ${reportId} for user: ${user.id}`,
    );
    const requestingUserId = user.id;

    const db = await getMongoDB();
    const disasterReportCollection: Collection = db.collection(
      DISASTER_COLLECTION_NAME,
    );

    const reportDocument = await disasterReportCollection.findOne({
      _id: new ObjectId(reportId),
    });

    if (!reportDocument) {
      logger.warn(`MongoDB disaster report with ID ${reportId} not found`);
      throw new NotFoundError('Disaster report not found in MongoDB');
    }

    const postgresReportId = reportDocument.postgresReportId;
    
    logger.info(`MongoDB disaster report ${reportId} has PostgreSQL ID: ${postgresReportId}`);
    logger.info(`PostgreSQL ID type: ${typeof postgresReportId}`);

    if (!postgresReportId) {
      logger.warn(
        `MongoDB disaster report ${reportId} has no PostgreSQL ID reference`,
      );
      throw new InternalServerError(
        'Invalid disaster report data: missing PostgreSQL reference',
      );
    }

    const existingReport = await prisma.report.findUnique({
      where: {
        id: postgresReportId,
      },
    });

    if (!existingReport) {
      logger.warn(`PostgreSQL report with ID ${postgresReportId} not found`);
      throw new NotFoundError(
        'Disaster report not found in PostgreSQL database',
      );
    }

    if (existingReport.generatedById !== requestingUserId) {
      throw new AuthenticationError(
        'You are not authorized to delete this disaster report',
      );
    }

    const mediaItems = reportDocument.media || [];
    const imageFilenames = [];

    logger.info(`Deleting comments and replies for disaster report: ${reportId}`);
    
    const commentCollection: Collection = db.collection(COMMENT_COLLECTION_NAME);
    const commentReplyCollection: Collection = db.collection(COMMENT_REPLY_COLLECTION_NAME);
    
    const comments = await commentCollection.find({ postId: reportId }).toArray();
    const commentIds = comments.map(comment => comment._id.toString());
    
    logger.info(`Found ${comments.length} comments to delete for disaster report: ${reportId}`);
    
    for (const comment of comments) {
      if (comment.media) {
        try {
          const commentFilename = comment.media.split('/').pop();
          if (commentFilename) {
            logger.info(`Deleting comment media: ${commentFilename}`);
            await deleteFromSupabase(commentFilename);
          }
        } catch (deleteError) {
          logger.error(`Error deleting comment media: ${deleteError}`);
        }
      }
    }
    
    if (commentIds.length > 0) {
      const replies = await commentReplyCollection.find({
        commentId: { $in: commentIds }
      }).toArray();
      
      logger.info(`Found ${replies.length} comment replies to delete`);
      
      for (const reply of replies) {
        if (reply.media) {
          try {
            const replyFilename = reply.media.split('/').pop();
            if (replyFilename) {
              logger.info(`Deleting comment reply media: ${replyFilename}`);
              await deleteFromSupabase(replyFilename);
            }
          } catch (deleteError) {
            logger.error(`Error deleting reply media: ${deleteError}`);
          }
        }
      }
      
      const deleteRepliesResult = await commentReplyCollection.deleteMany({
        commentId: { $in: commentIds }
      });
      
      logger.info(`Deleted ${deleteRepliesResult.deletedCount} comment replies`);
    }
    
    const deleteCommentsResult = await commentCollection.deleteMany({ postId: reportId });
    logger.info(`Deleted ${deleteCommentsResult.deletedCount} comments`);

    const mongoDeleteResult = await disasterReportCollection.deleteOne({
      _id: new ObjectId(reportId),
    });

    if (mongoDeleteResult.deletedCount === 0) {
      logger.warn(
        `Failed to delete MongoDB disaster report with ID ${reportId}`,
      );
      throw new InternalServerError(
        'Failed to delete disaster report from MongoDB',
      );
    } else {
      logger.info(
        `MongoDB disaster report with ID ${reportId} deleted successfully`,
      );
    }

    await prisma.report.delete({
      where: {
        id: postgresReportId,
      },
    });

    logger.info(`PostgreSQL report ${postgresReportId} deleted successfully`);

    for (const mediaItem of mediaItems) {
      if (mediaItem.type === 'IMAGE' && mediaItem.url) {
        try {
          const urlParts = mediaItem.url.split('/');
          const filename = urlParts[urlParts.length - 1];

          if (filename) {
            logger.info(`Deleting image ${filename} from storage`);
            await deleteFromSupabase(filename);
            imageFilenames.push(filename);
          }
        } catch (deleteError) {
          logger.error(`Error deleting image from storage: ${deleteError}`);
        }
      }
    }

    return {
      mongoResourceId: reportId,
      postgresResourceId: postgresReportId,
      message: `Disaster report "${existingReport?.name}" and all related comments deleted successfully`,
      deletedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error deleting disaster report by id: ${error}`);
    throw error;
  }
}

export async function updateDisasterReport(
  mongoReportId: string,
  payload: ValidatedDisasterPayload,
  pgReportName: string,
  user: User,
) {
  try {
    logger.info(
      `Updating disaster report with MongoDB ID ${mongoReportId} for user: ${user.id}`,
    );
    const requestingUserId = user.id;

    const db = await getMongoDB();
    const disasterReportCollection: Collection = db.collection(
      DISASTER_COLLECTION_NAME,
    );

    const reportDocument = await disasterReportCollection.findOne({
      _id: new ObjectId(mongoReportId),
    });

    if (!reportDocument) {
      logger.warn(`MongoDB disaster report with ID ${mongoReportId} not found`);
      throw new NotFoundError('Disaster report not found in MongoDB');
    }

    const postgresReportId = reportDocument.postgresReportId;

    if (!postgresReportId) {
      logger.warn(
        `MongoDB disaster report ${mongoReportId} has no PostgreSQL ID reference`,
      );
      throw new InternalServerError(
        'Invalid disaster report data: missing PostgreSQL reference',
      );
    }

    const existingReport = await prisma.report.findUnique({
      where: {
        id: postgresReportId,
      },
    });

    if (!existingReport) {
      logger.warn(`PostgreSQL report with ID ${postgresReportId} not found`);
      throw new NotFoundError(
        'Disaster report not found in PostgreSQL database',
      );
    }

    if (existingReport.generatedById !== requestingUserId) {
      throw new AuthenticationError(
        'You are not authorized to update this disaster report',
      );
    }

    logger.info(
      `Updating PostgreSQL report ${postgresReportId} for user: ${user.id}`,
    );

    const updatedReport = await prisma.report.update({
      where: {
        id: postgresReportId,
      },
      data: {
        name: pgReportName,
        parameters: {
          description: payload.description,
          incidentType: payload.incidentType,
          severity: payload.severity,
          incidentTimestamp: payload.incidentTimestamp,
          location: payload.location,
        },
        country: payload.country,
        city: payload.city,
        updated_at: new Date(),
      },
    });

    if (!updatedReport) {
      throw new NotFoundError('Failed to update disaster report in PostgreSQL');
    }

    const updatedMongoReport = await disasterReportCollection.updateOne(
      {
        _id: new ObjectId(mongoReportId),
      },
      {
        $set: {
          name: pgReportName,
          description: payload.description,
          incidentType: payload.incidentType,
          severity: payload.severity,
          incidentTimestamp: payload.incidentTimestamp,
          location: payload.location,
          country: payload.country,
          city: payload.city,
          media: payload.media,
          systemUpdatedAt: new Date(),
        },
      },
    );

    if (updatedMongoReport.matchedCount === 0) {
      throw new NotFoundError('Disaster report not found in MongoDB');
    }

    if (updatedMongoReport.modifiedCount === 0) {
      logger.warn(
        `Failed to update MongoDB disaster report ${mongoReportId} for user: ${user.id}`,
      );
    }

    return {
      mongoReportId,
      postgresReportId,
      message: `Disaster report "${pgReportName}" updated successfully`,
      updatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error updating disaster report: ${error}`);
    throw error;
  }
}
