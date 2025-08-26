import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import { InternalServerError } from '@/utils/errors';
import { User } from '@prisma/client';
import { Collection } from 'mongodb';

export enum PostType {
  FEED = 'FEED',
  RESOURCE = 'RESOURCE',
}

export interface ValidatedFavoritePayload {
  post_id: string;
  post_type: PostType;
}

export const FAVOIRTE_COLLECTION_NAME = 'favorites';

export async function toggleFavorite(
  payload: ValidatedFavoritePayload,
  user: User,
) {
  logger.info(`Toggling favorite for user: ${user.id}`);
  const userId = user.id;

  try {
    const db = await getMongoDB();
    const favoriteCollection: Collection = db.collection(
      FAVOIRTE_COLLECTION_NAME,
    );

    const existingFavorite = await favoriteCollection.findOne({
      userId: userId,
      postId: payload.post_id,
      postType: payload.post_type,
    });

    if (existingFavorite) {
      // Remove the favorite
      const result = await favoriteCollection.deleteOne({
        _id: existingFavorite._id,
      });

      if (result.deletedCount === 0) {
        throw new InternalServerError(
          'Failed to remove the post from favorites',
        );
      }

      return {
        action: 'removed',
        message: `Post type ${payload.post_type}, ID ${payload.post_id} has been removed from favorites`,
        isFavorited: false,
      };
    } else {
      // Add the favorite
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
        action: 'added',
        message: `Post type ${payload.post_type}, ID ${payload.post_id} has been added to favorites`,
        isFavorited: true,
      };
    }
  } catch (error) {
    logger.error(`Error toggling favorite in mongoDB`);
    throw error;
  }
}

export async function getFavorites(user: User, limit: number, skip: number) {
  try {
    const db = await getMongoDB();
    const favoriteCollection: Collection = db.collection(
      FAVOIRTE_COLLECTION_NAME,
    );

    const totalCount = await favoriteCollection.countDocuments({
      userId: user.id,
    });
    const favorites = await favoriteCollection
      .find({ userId: user.id })
      .sort({ systemCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      favorites,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + favorites.length < totalCount,
      },
    };
  } catch (error) {
    logger.error(`Error Getting Favorite Lists`);
    throw error;
  }
}

export async function getFavoritesByPostType(
  user: User,
  validatedPostType: string,
  limit: number,
  skip: number,
) {
  try {
    const db = await getMongoDB();
    const favoriteCollection: Collection = db.collection(
      FAVOIRTE_COLLECTION_NAME,
    );

    const totalCount = await favoriteCollection.countDocuments({
      userId: user.id,
      postType: validatedPostType,
    });
    const favorites = await favoriteCollection
      .find({ userId: user.id, postType: validatedPostType })
      .sort({ systemCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      favorites,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + favorites.length < totalCount,
      },
    };
  } catch (error) {
    logger.error(`Error Getting Favorite Lists By Post Type`);
    throw error;
  }
}
