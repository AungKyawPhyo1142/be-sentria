import logger from '@/logger';
import { AuthenticationError, NotFoundError, ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';
import * as commentReplyService from '@/services/commentReplies/commentReplies';
import { uploadToSupabase } from '@/services/commentReplies/upload';

const CreateCommentReplySchema = object({
    comment_id: string(),
    post_id: string(),
    reply: string()
      .min(1, 'Reply is too short')
      .max(400, 'Reply is too long'),
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

    const result = await commentReplyService.createCommentReply(servicePayload, user);
    return res.status(201).json({ result });
  } catch (error) {
    logger.error(`Error creating comment reply: ${error}`);
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    return next(error);
  }
}

export async function GetCommentReplies(
  req: Request,
  res: Response,
  next: NextFunction,
){
  try{
    const commentId = req.params.commentId;
    if(!commentId){
      throw new NotFoundError('Comment ID is required')
    }
    const result = await commentReplyService.getCommentReplies(commentId);
    return res.status(200).json({ result });
  }catch(error){
    logger.error(`Error getting comment replies: ${error}`);
    return next(error);
  }
}