import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import {
  AuthenticationError,
  InternalServerError,
  NotFoundError,
} from '@/utils/errors';
import { PrismaClient, User } from '@prisma/client';
import { Collection, ObjectId } from 'mongodb';
import { deleteFromSupabase } from './upload';

enum ResourceType {
  SURVIVAL = 'SURVIVAL',
  HOTLINE = 'HOTLINE',
  FIRST_AID = 'FIRST_AID',
}

enum ResourceStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AWAITING_DETAILS = 'AWAITING_DETAILS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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

    const pgResource = await prisma.resource.create({
      data: {
        generatedBy: {
          connect: { id: requestingUserId },
        },
        name: pgResourceName,
        resourceType: payload.resourceType,
        status: ResourceStatus.AWAITING_DETAILS,
        description: payload.description,
        location: payload.location,
      },
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
      postgresResourceId: pgResourceId,
      userId: requestingUserId,
      description: payload.description,
      resourceType: payload.resourceType,
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
      throw new InternalServerError('Error creating resource in mongoDB');
    }

    mongoDocIDAsString = mongoResult.insertedId.toHexString();
    logger.info(
      `MongoDB Resource ID: ${mongoDocIDAsString} created for ${pgResourceName}`,
    );

    if (pgResourceId) {
      await prisma.resource.update({
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
      postgresResourceId: pgResourceId,
      mongoDbResourceId: mongoDocIDAsString,
      message: `Resource "${pgResourceName}" created successfully`,
    };
  } catch (error) {
    logger.error(`Error creating resource: ${error}`);
    throw error;
  }
}

export async function updateResource(
  resourceId: string,
  payload: ValidatedResourcePayload,
  pgResourceName: string,
  user: User,
) {
  logger.info(`Updating resource for user: ${user.id}`);
  const requestingUserId = user.id;

  try {
    const existingResource = await prisma.resource.findUnique({
      where: {
        id: resourceId,
      },
    });

    if (!existingResource) {
      throw new NotFoundError('Resource not found');
    }

    if (existingResource.generatedById !== requestingUserId) {
      throw new AuthenticationError(
        'You are not authorized to update this resource',
      );
    }

    logger.info(`Updating PG resource ${resourceId} for user: ${user.id}`);

    const updatedResource = await prisma.resource.update({
      where: {
        id: resourceId,
      },
      data: {
        name: pgResourceName,
        resourceType: payload.resourceType,
        status: ResourceStatus.AWAITING_DETAILS,
        description: payload.description,
        location: payload.location,
        updated_at: new Date(),
      },
    });

    if (!updatedResource) {
      throw new NotFoundError('Resource not found in PG');
    }

    const db = await getMongoDB();
    const resourceCollection: Collection = db.collection(
      RESOURCE_COLLECTION_NAME,
    );

    //update mongoDB document
    const updatedMongoResource = await resourceCollection.updateOne(
      {
        postgresResourceId: resourceId,
      },
      {
        $set: {
          name: pgResourceName,
          resourceType: payload.resourceType,
          status: ResourceStatus.AWAITING_DETAILS,
          description: payload.description,
          location: payload.location,
          address: payload.address,
          media: payload.media,
          systemUpdatedAt: new Date(),
        },
      },
    );

    if (updatedMongoResource.matchedCount === 0) {
      throw new NotFoundError('Resource not found in mongoDB');
    }

    if (updatedMongoResource.modifiedCount === 0) {
      logger.warn(
        `Failed to update mongoDB resource ${resourceId} for user: ${user.id}`,
      );
    }

    return {
      resourceId,
      message: `Resource "${pgResourceName}" updated successfully`,
      updatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error updating resource: ${error}`);
    throw error;
  }
}

export async function getResources(limit: number = 10, skip: number = 0) {
  try {
    logger.info(`Getting resources with limit: ${limit}, skip: ${skip}`);

    const db = await getMongoDB();
    const resourceCollection: Collection = db.collection(
      RESOURCE_COLLECTION_NAME,
    );

    const totalCount = await resourceCollection.countDocuments();

    const resources = await resourceCollection
      .find({})
      .sort({ systemCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    logger.info(`Found ${resources.length} resources`);

    return {
      resources,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + resources.length < totalCount,
      },
    };
  } catch (error) {
    logger.error(`Error getting resources: ${error}`);
    throw error;
  }
}

export async function getResourceById(resourceId: string) {
  try {
    logger.info(`Getting resource by id: ${resourceId}`);
    const db = await getMongoDB();
    const resourceCollection: Collection = db.collection(
      RESOURCE_COLLECTION_NAME,
    );
    const resource = await resourceCollection.findOne({
      _id: new ObjectId(resourceId),
    });

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    return resource;
  } catch (error) {
    logger.error(`Error getting resource by id: ${error}`);
    throw error;
  }
}

export async function deleteResource(resourceId: string, user: User) {
  logger.info(
    `Deleting resource with MongoDB ID ${resourceId} for user: ${user.id}`,
  );
  const requestingUserId = user.id;

  try {
    const db = await getMongoDB();
    const resourceCollection: Collection = db.collection(
      RESOURCE_COLLECTION_NAME,
    );

    const resourceDocument = await resourceCollection.findOne({
      _id: new ObjectId(resourceId),
    });

    if (!resourceDocument) {
      logger.warn(`MongoDB resource with ID ${resourceId} not found`);
      throw new NotFoundError('Resource not found in MongoDB');
    }

    // PostgreSQL resource ID from the MongoDB
    const postgresResourceId = resourceDocument.postgresResourceId;

    if (!postgresResourceId) {
      logger.warn(
        `MongoDB resource ${resourceId} has no PostgreSQL ID reference`,
      );
      throw new InternalServerError(
        'Invalid resource data: missing PostgreSQL reference',
      );
    }

    const existingResource = await prisma.resource.findUnique({
      where: {
        id: postgresResourceId,
      },
    });

    if (!existingResource) {
      logger.warn(
        `PostgreSQL resource with ID ${postgresResourceId} not found`,
      );
      throw new NotFoundError('Resource not found in PostgreSQL database');
    }

    if (existingResource.generatedById !== requestingUserId) {
      throw new AuthenticationError(
        'You are not authorized to delete this resource',
      );
    }

    const mediaItems = resourceDocument.media || [];
    const imageFilenames = [];

    // delete from MongoDB
    const mongoDeleteResult = await resourceCollection.deleteOne({
      _id: new ObjectId(resourceId),
    });

    if (mongoDeleteResult.deletedCount === 0) {
      logger.warn(`Failed to delete MongoDB resource with ID ${resourceId}`);
      throw new InternalServerError('Failed to delete resource from MongoDB');
    } else {
      logger.info(
        `MongoDB resource with ID ${resourceId} deleted successfully`,
      );
    }

    // delete from PostgreSQL
    await prisma.resource.delete({
      where: {
        id: postgresResourceId,
      },
    });

    logger.info(
      `PostgreSQL resource ${postgresResourceId} deleted successfully`,
    );

    for (const mediaItem of mediaItems) {
      if (mediaItem.type === 'IMAGE' && mediaItem.url) {
        try {
          const urlParts = mediaItem.url.split('/');
          const filename = urlParts[urlParts.length - 1];

          if (filename) {
            logger.info(`Deleting image ${filename} from Supabase`);
            await deleteFromSupabase(filename);
            imageFilenames.push(filename);
          }
        } catch (deleteError) {
          logger.error(`Error deleting image from Supabase: ${deleteError}`);
        }
      }
    }

    return {
      mongoDbResourceId: resourceId,
      postgresResourceId: postgresResourceId,
      message: `Resource "${existingResource.name}" deleted successfully`,
      deletedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error deleting resource: ${error}`);
    throw error;
  }
}
