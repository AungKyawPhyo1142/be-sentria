import { getMongoDB } from '@/libs/mongo';
import logger from '@/logger';
import { InternalServerError, NotFoundError } from '@/utils/errors';
import { User } from '@prisma/client';
import { Collection, ObjectId } from 'mongodb';
import { DISASTER_COLLECTION_NAME } from '../disasterReports/disasterReports';
import { deleteFromSupabase } from './upload';

export interface ValidatedCommentReplyPayload {
  post_id: string;
  comment_id: string;
  reply: string;
  media?: string | null;
}

export const COMMENT_REPLY_COLLECTION_NAME = 'commentReplies';

export async function createCommentReply(
  payload: ValidatedCommentReplyPayload,
  user: User,
) {
  try {
    const db = await getMongoDB();
    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const userId = user.id;

    const mongoCommentReplyDocument = {
      userId: userId,
      postId: payload.post_id,
      commentId: payload.comment_id,
      reply: payload.reply,
      media: payload.media,
      commentReplyTimestamp: new Date(),
      systemCreatedAt: new Date(),
      systemUpdatedAt: new Date(),
    };

    const result = await commentReplyCollection.insertOne(
      mongoCommentReplyDocument,
    );

    if (!result.insertedId) {
      throw new InternalServerError('Error creating comment reply in mongoDB');
    }

    return {
      message: `Comment reply for post ID of ${payload.post_id} and comment ID of ${payload.comment_id} created successfully`,
    };
  } catch (error) {
    logger.error(`Error creating comment reply: ${error}`);
    throw error;
  }
}

export async function getCommentReplies(commentId: string) {
  try {
    const db = await getMongoDB();
    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const result = await commentReplyCollection
      .find({
        commentId: commentId,
      })
      .toArray();

    return result;
  } catch (error) {
    logger.error(`Error getting comment replies: ${error}`);
    throw error;
  }
}

export async function updateCommentReply(
  commentId: string,
  payload: ValidatedCommentReplyPayload,
  user: User,
) {
  try {
    const db = await getMongoDB();

    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const commentReply = await commentReplyCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!commentReply) {
      throw new NotFoundError('Comment reply not found in mongoDB');
    }

    if (commentReply.userId !== user.id) {
      throw new Error(
        'Unauthorized: Only comment reply owner can update this comment reply',
      );
    }

    const result = await commentReplyCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          userId: user.id,
          postId: payload.post_id,
          commentId: payload.comment_id,
          reply: payload.reply,
          media: payload.media,
          systemUpdatedAt: new Date(),
          commentReplyTimestamp: new Date(),
          systemCreatedAt: new Date(),
        },
      },
    );

    if (!result.modifiedCount) {
      throw new InternalServerError('Error updating comment reply in mongoDB');
    }

    return {
      message: `Comment reply for post ID of ${payload.post_id} and comment ID of ${payload.comment_id} updated successfully`,
    };
  } catch (error) {
    logger.error(`Error updating comment reply: ${error}`);
    throw error;
  }
}

export async function deleteCommentReply(commentId: string, user: User) {
  try {
    const db = await getMongoDB();

    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const commentReply = await commentReplyCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!commentReply) {
      throw new NotFoundError(
        `Comment reply with ID of ${commentId} not found in mongoDB`,
      );
    }

    const isCommentReplyOwner = commentReply.userId === user.id;

    let isPostOwner = false;
    if (!isCommentReplyOwner) {
      const postCollection: Collection = db.collection(
        DISASTER_COLLECTION_NAME,
      );
      const post = await postCollection.findOne({
        _id: new ObjectId(commentReply.postId),
      });

      if (post) {
        isPostOwner = post.userId === user.id;
      }
    }

    if (!isCommentReplyOwner && !isPostOwner) {
      throw new Error(
        'Unauthorized: Only comment reply owner or post owner can delete this comment reply',
      );
    }

    if (commentReply.media) {
      try {
        const filename = commentReply.media?.split('/')?.pop();
        if (filename) {
          await deleteFromSupabase(filename);
        }
      } catch (error) {
        logger.error(`Error deleting comment reply media: ${error}`);
      }
    }

    const result = await commentReplyCollection.deleteOne({
      _id: new ObjectId(commentId),
    });

    if (!result.deletedCount) {
      throw new InternalServerError('Failed to delete comment reply');
    }

    return {
      message: `Comment reply for post ID of ${commentReply.postId} - comment ID of ${commentReply.commentId} deleted successfully`,
    };
  } catch (error) {
    logger.error(`Error deleting comment reply: ${error}`);
    throw error;
  }
}

export async function getCommentReplyById(commentReplyId: string) {
  try {
    const db = await getMongoDB();
    const commentReplyCollection: Collection = db.collection(
      COMMENT_REPLY_COLLECTION_NAME,
    );

    const result = await commentReplyCollection.findOne({
      _id: new ObjectId(commentReplyId),
    });

    if (!result) {
      throw new NotFoundError('Comment reply not found in mongoDB');
    }

    return result;
  } catch (error) {
    logger.error(`Error getting comment reply: ${error}`);
    throw error;
  }
}
