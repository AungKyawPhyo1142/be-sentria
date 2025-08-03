import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import { InternalServerError, NotFoundError } from '@/utils/errors';
import { User } from '@prisma/client';
import { Collection, ObjectId } from 'mongodb';

export enum PostType {
  FEED = 'FEED',
  RESOURCE = 'RESOURCE',
}

export interface ValidatedFavoritePayload {
  post_id: string;
  post_type: PostType;
}

export const FAVOIRTE_COLLECTION_NAME = 'favorites';

export async function createFavorite(
  payload: ValidatedFavoritePayload,
  user: User,
) {
  logger.info(`Creating favorite list for user: ${user.id}`);
  const userId = user.id;

  try {
    const db = await getMongoDB();
    const favoriteCollection: Collection = db.collection(
      FAVOIRTE_COLLECTION_NAME,
    );

    const now = new Date();
    const mongoFavDocument = {
      userId: userId,
      postId: payload.post_id,
      postType: payload.post_type,
      favoriteTimestamp: now,
      systemCreatedAt: now,
      systemUpdatedAt: now,
    };

    const result = await favoriteCollection.insertOne(mongoFavDocument);
    if (!result.insertedId) {
      throw new InternalServerError('Error creating favorite in mongoDB');
    }

    return {
      message: `Post type ${payload.post_type} , ID ${payload.post_id} is successfully added to favorites`,
    };
  } catch (error) {
    logger.error(`Error creating favorite in mongoDB`);
    throw error;
  }
}

export async function removeFavorite(favoriteId: string, user: User) {
  try {
    const db = await getMongoDB();
    const favoriteCollection: Collection = db.collection(
      FAVOIRTE_COLLECTION_NAME,
    );

    const favoriteItem = await favoriteCollection.findOne({
      _id: new ObjectId(favoriteId),
    });

    if (!favoriteItem) {
      throw new NotFoundError('Favorite ID not found');
    }

    const isOwner = favoriteItem.userId === user.id;
    if (!isOwner) {
      throw new Error(
        'Unauthorized: Only comment owner or post owner can delete this comment',
      );
    }

    const result = await favoriteCollection.deleteOne({
      _id: new ObjectId(favoriteId),
    });

    if (result.deletedCount === 0) {
      throw new InternalServerError('Failed to remove the post from favorites');
    }

    return {
      message: 'The post is removed from the favorites successfully',
    };
  } catch (error) {
    logger.error(`Error removin favorite in mongoDB`);
    throw error;
  }
}
