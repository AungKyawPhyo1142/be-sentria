import logger from '@/logger';
import * as favouriteService from '@/services/favorites/favorites';
import { AuthenticationError, BadRequestError, NotFoundError, ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

const CreateFavoriteSchema = object({
  post_id: string(),
  post_type: z.enum(['FEED', 'RESOURCE']),
});

export async function CreateFavorite(
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

    const result = await favouriteService.createFavorite(servicePayload, user);
    return res.status(200).json({ result });
  } catch (error) {
    logger.error(`Error creating favourite: ${error}`);
    if(error instanceof z.ZodError){
        return next(new ValidationError(error.issues));
    }
    return next(error);
  }
}

export async function RemoveFavorite(
    req: Request,
    res: Response,
    next: NextFunction
){
    try{
        const user = req.user;
        const favoriteId = req.params.id;

        if(!user){
            throw new AuthenticationError('User not authenticated');
        }

        if(!favoriteId){
            throw new NotFoundError('Favorite MongoDB ID is required');   
        }

        const result = await favouriteService.removeFavorite(favoriteId, user);

        return res.status(200).json({result});
    }catch(error){
        logger.error(`Error removing favourite: ${error}`)
        if(error instanceof z.ZodError){
            return next(new ValidationError(error.issues))
        }
        return next(error);
    }
}