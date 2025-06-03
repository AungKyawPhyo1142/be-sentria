import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import { InternalServerError } from '@/utils/errors';
import { PrismaClient, User } from '@prisma/client';
import { Collection } from 'mongodb';

enum ResourceType {
  SURVIVAL = 'SURVIVAL',
  HOTLINE = 'HOTLINE',
  FIRST_AID = 'FIRST_AID'
}

enum ResourceStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  AWAITING_DETAILS = "AWAITING_DETAILS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

const prisma = new PrismaClient();

export interface ValidatedResourcePayload {
  description: string;
  resourceType: ResourceType;
  location: {
    type: string;
    coordinates: [number, number];
  };
  address?: {
    street?: string;
    district?: string;
    city?: string;
    country?: string;
    fullAddress?: string;
  };
  media?: Array<{
    type: 'IMAGE' | 'VIDEO';
    url: string;
    caption?: string;
  }>;
}

const RESOURCE_COLLECTION_NAME = 'resources';

export async function createResource(
  payload: ValidatedResourcePayload,
  pgResourceName: string, 
  user: User,
) {
    logger.info(`Creating resource for user: ${user.id}`);
    const requestingUserId = user.id;
    let pgResourceId: string | undefined = undefined;
    let mongoDocIDAsString: string | null = null;

  
    try {
      logger.info(`Creating PG metadata for ${pgResourceName}`);
  
      const pgResource = await (prisma as any).resource.create({
        data: {
          generatedBy: {
            connect: { id: requestingUserId }
          },
          name: pgResourceName,
          resourceType: payload.resourceType,
          status: ResourceStatus.AWAITING_DETAILS,
          description: payload.description,
          location: payload.location,
        }
      });   

    pgResourceId = pgResource.id;
    logger.info(
      `PG Resource metadata ID: ${pgResourceId} created for ${pgResourceName}`,
    );
    
    const db = await getMongoDB();
    const resourceCollection: Collection = db.collection(
      RESOURCE_COLLECTION_NAME,
    );
    const now = new Date();

    const mongoResourceDocument = {
      postgresReportId: pgResourceId,
      userId: requestingUserId,
      description: payload.description,
      incidentType: payload.resourceType,
      location: payload.location,
      address: payload.address,
      media: payload.media,
      resourceTimestamp: now,
      systemCreatedAt: now,
      systemUpdatedAt: now,
    };

    const mongoResult = await resourceCollection.insertOne(
      mongoResourceDocument,
    );

    if (!mongoResult.insertedId) {
      throw new InternalServerError(
        'Error creating resource in mongoDB',
      );
    }

    mongoDocIDAsString = mongoResult.insertedId.toHexString();
    logger.info(
      `MongoDB Resource ID: ${mongoDocIDAsString} created for ${pgResourceName}`,
    );

    if (pgResourceId) {
      await (prisma as any).resource.update({
        where: {
          id: pgResourceId,
        },
      data: {
        status: ResourceStatus.COMPLETED, 
        externalStorageId: mongoDocIDAsString,
        completed_at: now,
      },
    });
    logger.info(
      `PG Resource ${pgResourceId} for "${pgResourceName}" updated to COMPLETED with MongoDB ref ${mongoDocIDAsString}.`,
    );
    }

    return {
      postgresReportId: pgResourceId,
      mongoDbReportId: mongoDocIDAsString,
      message: `Disaster report "${pgResourceName}" created successfully`,
    };

  } catch (error) {
    logger.error(`Error creating resource: ${error}`);
    throw error;
  }
}
