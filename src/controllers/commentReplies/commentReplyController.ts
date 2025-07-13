import logger from '@/logger';
import * as commentReplyService from '@/services/commentReplies/commentReplies';
import {
  deleteFromSupabase,
  uploadToSupabase,
} from '@/services/commentReplies/upload';
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

const CreateCommentReplySchema = object({
  comment_id: string(),
  post_id: string(),
  reply: string().min(1, 'Reply is too short').max(400, 'Reply is too long'),
  media: object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: string().url({ message: 'Invalid URL' }),
    caption: string().max(250).optional(),
  }).optional(),
});

const UpdateCommentReplySchema = object({
  comment_id: string(),
  post_id: string(),
  reply: string().min(1, 'Reply is too short').max(400, 'Reply is too long'),
  media: object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: string().url({ message: 'Invalid URL' }),
    caption: string().max(250).optional(),
  }).optional(),
});

export async function createCommentReply(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User is not authenticated');
    }

    const validatedRequestBody = CreateCommentReplySchema.parse(req.body);

    let media = null;
    if (req.file) {
      const uploadResult = await uploadToSupabase(req.file, user.id);
      if (uploadResult) {
        media = {
          type: 'IMAGE',
          url: uploadResult.url,
        };
      }
    }

    const servicePayload: commentReplyService.ValidatedCommentReplyPayload = {
      post_id: validatedRequestBody.post_id,
      comment_id: validatedRequestBody.comment_id,
      reply: validatedRequestBody.reply,
      media: media ? media.url : null,
    };

    const result = await commentReplyService.createCommentReply(
      servicePayload,
      user,
    );
    return res.status(201).json({ result });
  } catch (error) {
    logger.error(`Error creating comment reply: ${error}`);
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    return next(error);
  }
}

export async function getCommentRepliesByCommentId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const commentId = req.params.commentId;
    if (!commentId) {
      throw new NotFoundError('Comment ID is required');
    }
    const result = await commentReplyService.getCommentReplies(commentId);
    return res.status(200).json({ result });
  } catch (error) {
    logger.error(`Error getting comment replies: ${error}`);
    return next(error);
  }
}

export async function updateCommentReply(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User is not authenticated');
    }

    const commentId = req.params.id;
    if (!commentId) {
      throw new NotFoundError('Comment ID is required');
    }

    if (typeof req.body.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (e) {
        return next(new BadRequestError(`Invalid parameters JSON: ${e}`));
      }
    }

    const validatedRequestBody = UpdateCommentReplySchema.parse(req.body);

    const servicePayload: commentReplyService.ValidatedCommentReplyPayload = {
      post_id: validatedRequestBody.post_id,
      comment_id: validatedRequestBody.comment_id,
      reply: validatedRequestBody.reply,
      media: validatedRequestBody.media?.url || null,
    };

    if (req.file) {
      try {
        if (servicePayload.media) {
          const filename = servicePayload?.media?.split('/')?.pop();
          if (filename) {
            await deleteFromSupabase(filename);
          }
        }
        const uploadResponse = await uploadToSupabase(req.file, user.id);
        servicePayload.media = uploadResponse.url;
      } catch (uploadError) {
        console.error('Error updating comment reply image:', uploadError);
        throw new Error('Failed to update comment reply image');
      }
    }

    const result = await commentReplyService.updateCommentReply(
      commentId,
      servicePayload,
      user,
    );
    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error updating comment reply: ${error}`);
    return next(error);
  }
}
