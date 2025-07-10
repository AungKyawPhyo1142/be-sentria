import logger from '@/logger';
import * as commentService from '@/services/comments/comments';
import { uploadToSupabase } from '@/services/comments/upload';
import { deleteFromSupabase } from '@/services/disasterReports/upload';
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

const CreateCommentSchema = object({
  post_id: string(),
  comment: string()
    .min(1, 'Comment is too short')
    .max(400, 'Comment is too long'),
  media: object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: string().url({ message: 'Invalid URL' }),
    caption: string().max(250).optional(),
  })
  .optional(),
});

const UpdateCommentSchema = object({
  post_id: string(),
  comment: string()
    .min(1, 'Comment is too short')
    .max(400, 'Comment is too long'),
  media: object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: string().url({ message: 'Invalid URL' }),
    caption: string().max(250).optional(),
  })
  .optional(),
});

export async function CreateComment(
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
        return next(new BadRequestError('Invalid parameters JSON'));
      }
    }

    const validatedRequestBody = CreateCommentSchema.parse(req.body);

    const servicePayload: commentService.ValidatedCommentPayload = {
      post_id: validatedRequestBody.post_id,
      comment: validatedRequestBody.comment,
      media: validatedRequestBody.media?.url || null,
    };

    if (req.file) {
      try {
        const uploadResponse = await uploadToSupabase(req.file, user.id);
        servicePayload.media = uploadResponse.url;
      } catch (uploadError) {
        console.error('Error uploading comment image:', uploadError);
        throw new Error('Failed to upload comment image');
      }
    }

    let result = await commentService.createComment(servicePayload, user);
    return res.status(201).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error creating comment: ${error}`);
    return next(error);
  }
}

export async function UpdateComment(
  req: Request,
  res: Response,
  next: NextFunction,
){
  try{
    const user = req.user;
    if (!user){
      throw new AuthenticationError('User not authenticated');
    }

    const commentId = req.params.id;
    if(!commentId){
      throw new NotFoundError('Comment ID is required');
    }

    if (typeof req.body.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (e) {
        return next(new BadRequestError(`Invalid parameters JSON: ${e}`));
      }
    }

    const validatedRequestBody = UpdateCommentSchema.parse(req.body);
    const servicePayload: commentService.ValidatedCommentPayload = {
      post_id: validatedRequestBody.post_id,
      comment: validatedRequestBody.comment,
      media: validatedRequestBody.media?.url || null,
    };

    if (req.file) {
      try {
        if(servicePayload.media){
          const filename = servicePayload?.media?.split('/')?.pop();
          if (filename) {
            await deleteFromSupabase(filename);
          }
        }
        const uploadResponse = await uploadToSupabase(req.file, user.id);
        servicePayload.media = uploadResponse.url;
      } catch (uploadError) {
        console.error('Error updating comment image:', uploadError);
        throw new Error('Failed to update comment image');
      }
    }

    let result = await commentService.updateComment(commentId, servicePayload, user);
    return res.status(200).json({ result });
  }catch(error){
    if(error instanceof z.ZodError){
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error updating comment: ${error}`);
    return next(error);
  }
}

export async function GetComments(
  req: Request,
  res: Response,
  next: NextFunction,
){
try{
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

  const result = await commentService.getComments(limit, skip);
  return res.status(200).json(result);
}catch(error){
  logger.error(`Error getting comments: ${error}`);
  return next(error);
}
}
