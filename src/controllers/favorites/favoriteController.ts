import logger from '@/logger';
import * as favouriteService from '@/services/favorites/favorites';
import {
  AuthenticationError,
  BadRequestError,
  ValidationError,
} from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

const CreateFavoriteSchema = object({
  post_id: string(),
  post_type: z.enum(['FEED', 'RESOURCE']),
});

export async function ToggleFavorite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (typeof req.body.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (error) {
        return next(new BadRequestError(`Invalid parameters JSON: ${error}`));
      }
    }
    const validatedRequestBody = CreateFavoriteSchema.parse(req.body);
    const servicePayload: favouriteService.ValidatedFavoritePayload = {
      post_id: validatedRequestBody.post_id,
      post_type: validatedRequestBody.post_type as favouriteService.PostType,
    };

    const result = await favouriteService.toggleFavorite(servicePayload, user);
    return res.status(200).json({ result });
  } catch (error) {
    logger.error(`Error toggling favourite: ${error}`);
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    return next(error);
  }
}

export async function GetFavorites(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User is not Authenticated');
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await favouriteService.getFavorites(user, limit, skip);
    return res.status(200).json({ result });
  } catch (error) {
    logger.error(`Error Getting Favorite Lists`);
    throw next(error);
  }
}

export async function GetFavoritesByPostType(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const postType = req.params.postType;
    const PostTypeSchema = z.enum(['FEED', 'RESOURCE']);

    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User is not Authenticated');
    }

    const validationResult = PostTypeSchema.safeParse(postType);

    if (!validationResult.success) {
      return next(new ValidationError(validationResult.error.issues));
    }

    const validatedPostType = validationResult.data;

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await favouriteService.getFavoritesByPostType(
      user,
      validatedPostType,
      limit,
      skip,
    );

    return res.status(200).json({ result });
  } catch (error) {
    logger.error('Error in Fetching favorites based on the post types');
    throw next(error);
  }
}
