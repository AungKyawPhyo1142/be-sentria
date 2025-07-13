import { getMongoDB } from "@/libs/mongo";
import logger from "@/logger";
import { User } from "@prisma/client";
import { Collection } from "mongodb";
import { InternalServerError } from "@/utils/errors";

export interface ValidatedCommentReplyPayload{
    post_id: string;
    comment_id: string;
    reply: string;
    media?: string | null;
}

export const COMMENT_REPLY_COLLECTION_NAME = 'commentReplies';

export async function createCommentReply(payload: ValidatedCommentReplyPayload, user: User){
    try{
        const db = await getMongoDB();
        const commentReplyCollection: Collection = db.collection(
            COMMENT_REPLY_COLLECTION_NAME,
        );

        const userId = user.id;
        
        const mongoCommentReplyDocument = {
            userId: userId,
            postId : payload.post_id,
            commentId : payload.comment_id,
            reply : payload.reply,
            media: payload.media,
            commentReplyTimestamp: new Date(),
            systemCreatedAt: new Date(),
            systemUpdatedAt: new Date(),
          };

          const result = await commentReplyCollection.insertOne(
            mongoCommentReplyDocument,
          );

          if (!result.insertedId) {
            throw new InternalServerError(
              'Error creating comment reply in mongoDB',
            );
          }

          return {
            message: `Comment reply for post ID of ${payload.post_id} and comment ID of ${payload.comment_id} created successfully`,
          };

    }catch(error){
        logger.error(`Error creating comment reply: ${error}`);
        throw error;
    }
}

export async function getCommentReplies(commentId: string){
  try{
    const db = await getMongoDB();
    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const result = await commentReplyCollection.find({
      commentId: commentId,
    }).toArray();

    return result;
  }catch(error){
    logger.error(`Error getting comment replies: ${error}`);
    throw error;
  }
}