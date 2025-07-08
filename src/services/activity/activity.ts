import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import { AuthenticationError, InternalServerError, NotFoundError } from '@/utils/errors';
import { PrismaClient, User } from '@prisma/client';
import { Collection, ObjectId } from 'mongodb';

const prisma = new PrismaClient();

export enum ActivityType {
  SHELTER = 'SHELTER',
  WATER = 'WATER',
  FOOD = 'FOOD',
  WIFI = 'WIFI'
}

export enum ActivityStatus {
  NEED_HELP = 'NEED_HELP',
  OFFERING_HELP = 'OFFERING_HELP'
}

export interface ValidatedActivityPayload {
  description: string;
  activityType: ActivityType;
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
}

const ACTIVITY_COLLECTION_NAME = 'activities';

export async function createActivity(
  payload: ValidatedActivityPayload,
  pgActivityName: string,
  user: User
) {
  logger.info(`Creating activity for user: ${user.id}`);
  const requestingUserId = user.id;
  let pgActivityId: string | undefined = undefined;
  let mongoDocIDAsString: string | null = null;

  try {
    const pgActivity = await prisma.activity.create({
      data: {
        generatedBy: {
          connect: { id: requestingUserId }
        },
        name: pgActivityName,
        activityType: payload.activityType,
        status: ActivityStatus.NEED_HELP,
        description: payload.description,
        location: payload.location,
      }
    });

    pgActivityId = pgActivity.id;

    const db = await getMongoDB();
    const activityCollection: Collection = db.collection(ACTIVITY_COLLECTION_NAME);
    const now = new Date();

    const mongoActivityDocument = {
      postgresActivityId: pgActivityId,
      userId: requestingUserId,
      description: payload.description,
      activityType: payload.activityType,
      location: payload.location,
      address: payload.address,
      activityTimestamp: now,
      systemCreatedAt: now,
      systemUpdatedAt: now,
    };

    const mongoResult = await activityCollection.insertOne(mongoActivityDocument);

    if (!mongoResult.insertedId) {
      throw new InternalServerError('Error creating activity in mongoDB');
    }

    mongoDocIDAsString = mongoResult.insertedId.toHexString();

    await prisma.activity.update({
      where: { id: pgActivityId },
      data: {
        status: ActivityStatus.OFFERING_HELP,
        externalStorageId: mongoDocIDAsString,
        completed_at: now,
      }
    });

    return {
      postgresActivityId: pgActivityId,
      mongoDbActivityId: mongoDocIDAsString,
      message: `Activity "${pgActivityName}" created successfully`,
    };

  } catch (error) {
    logger.error(`Error creating activity: ${error}`);
    throw error;
  }
}

export async function updateActivity(
  activityId: string,
  payload: ValidatedActivityPayload,
  pgActivityName: string,
  user: User,
) {
  logger.info(`Updating activity for user: ${user.id}`);
  const requestingUserId = user.id;

  try {
    const existingActivity = await prisma.activity.findUnique({
      where: {
        id: activityId,
      },
    });

    if (!existingActivity) {
      throw new NotFoundError('Activity not found');
    }

    if (existingActivity.generatedById !== requestingUserId) {
      throw new AuthenticationError('You are not authorized to update this activity');
    }

    const updatedActivity = await (prisma as any).activity.update({
      where: {
        id: activityId,
      },
      data: {
        name: pgActivityName,
        activityType: payload.activityType,
        status: ActivityStatus.OFFERING_HELP,
        description: payload.description,
        location: payload.location,
        updated_at: new Date(),
      },
    });

    logger.info(`Activity updated: ${updatedActivity.id}`);

    const db = await getMongoDB();
    const activityCollection: Collection = db.collection(ACTIVITY_COLLECTION_NAME);

    const updatedMongoActivity = await activityCollection.updateOne(
      {
        postgresActivityId: activityId,
      },
      {
        $set: {
          name: pgActivityName,
          activityType: payload.activityType,
          status: ActivityStatus.OFFERING_HELP,
          description: payload.description,
          location: payload.location,
          address: payload.address,
          systemUpdatedAt: new Date(),
        },
      }
    );

    if (updatedMongoActivity.matchedCount === 0) {
      throw new NotFoundError('Activity not found in mongoDB');
    }

    return {
      activityId,
      message: `Activity "${pgActivityName}" updated successfully`,
      updatedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error updating activity: ${error}`);
    throw error;
  }
}

export async function getActivities(limit: number = 10, skip: number = 0) {
  try {
    const db = await getMongoDB();
    const activityCollection: Collection = db.collection(ACTIVITY_COLLECTION_NAME);

    const totalCount = await activityCollection.countDocuments();

    const activities = await activityCollection
      .find({})
      .sort({ systemCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      activities,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + activities.length < totalCount
      }
    };
  } catch (error) {
    logger.error(`Error getting activities: ${error}`);
    throw error;
  }
}

export async function getActivityById(activityId: string) {
  try {
    const db = await getMongoDB();
    const activityCollection: Collection = db.collection(ACTIVITY_COLLECTION_NAME);

    const activity = await activityCollection.findOne({
      _id: new ObjectId(activityId)
    });

    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    return activity;
  } catch (error) {
    logger.error(`Error getting activity by id: ${error}`);
    throw error;
  }
}

export async function deleteActivity(activityId: string, user: User) {
  logger.info(`Deleting activity with MongoDB ID ${activityId} for user: ${user.id}`);
  const requestingUserId = user.id;

  try {
    const db = await getMongoDB();
    const activityCollection: Collection = db.collection(ACTIVITY_COLLECTION_NAME);

    const activityDocument = await activityCollection.findOne({
      _id: new ObjectId(activityId)
    });

    if (!activityDocument) {
      logger.warn(`MongoDB activity with ID ${activityId} not found`);
      throw new NotFoundError('Activity not found in MongoDB');
    }

    const postgresActivityId = activityDocument.postgresActivityId;

    if (!postgresActivityId) {
      logger.warn(`MongoDB activity ${activityId} has no PostgreSQL ID reference`);
      throw new InternalServerError('Invalid activity data: missing PostgreSQL reference');
    }

    const existingActivity = await prisma.activity.findUnique({
      where: {
        id: postgresActivityId
      }
    });

    if (!existingActivity) {
      logger.warn(`PostgreSQL activity with ID ${postgresActivityId} not found`);
      throw new NotFoundError('Activity not found in PostgreSQL database');
    }

    if (existingActivity.generatedById !== requestingUserId) {
      throw new AuthenticationError('You are not authorized to delete this activity');
    }

    // delete from MongoDB
    const mongoDeleteResult = await activityCollection.deleteOne({
      _id: new ObjectId(activityId)
    });

    if (mongoDeleteResult.deletedCount === 0) {
      logger.warn(`Failed to delete MongoDB activity with ID ${activityId}`);
      throw new InternalServerError('Failed to delete activity from MongoDB');
    } else {
      logger.info(`MongoDB activity with ID ${activityId} deleted successfully`);
    }

    // delete from PostgreSQL
    await prisma.activity.delete({
      where: {
        id: postgresActivityId
      }
    });

    logger.info(`PostgreSQL activity ${postgresActivityId} deleted successfully`);

    return {
      mongoDbActivityId: activityId,
      postgresActivityId,
      message: `Activity "${existingActivity.name}" deleted successfully`,
      deletedAt: new Date(),
    };
  } catch (error) {
    logger.error(`Error deleting activity: ${error}`);
    throw error;
  }
}

