import logger from '@/logger';
import * as commentService from '@/services/comments/comments';
import { uploadToSupabase } from '@/services/comments/upload';
import {
  AuthenticationError,
  BadRequestError,
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
