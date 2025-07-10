import { getMongoDB } from "@/libs/mongo";
import logger from "@/logger";
import { InternalServerError, NotFoundError } from "@/utils/errors";
import { User } from "@prisma/client";
import { Collection, ObjectId } from "mongodb";
import { DISASTER_COLLECTION_NAME } from "../disasterReports/disasterReports";
export interface ValidatedCommentPayload{
    post_id: string;
    comment: string;
    media?: string | null;
}

export const COMMENT_COLLECTION_NAME = 'comments';

export async function createComment(
  payload: ValidatedCommentPayload,
  user: User,
) {
    logger.info(`Creating comment for post: ${user.id}`);
    const requestingUserId = user.id;
  
    try {    
    const db = await getMongoDB();
    const commentCollection: Collection = db.collection(
      COMMENT_COLLECTION_NAME,
    );
    const now = new Date();

    const mongoCommentDocument = {
      userId: requestingUserId,
      postId : payload.post_id,
      comment: payload.comment,
      media: payload.media,
      commentTimestamp: now,
      systemCreatedAt: now,
      systemUpdatedAt: now,
    };

    const result = await commentCollection.insertOne(
      mongoCommentDocument,
    )
    
    if (!result.insertedId) {
      throw new InternalServerError(
        'Error creating resource in mongoDB',
      );
    }

    return {
      message: `Comment for ${payload.post_id} created successfully`,
    };
    
  } catch (error) {
    logger.error(`Error creating comments: ${error}`);
    throw error;
  }
}

export async function getComments(limit: number, skip: number){
  try{
    const db = await getMongoDB();
    const commentCollection: Collection = db.collection(
      COMMENT_COLLECTION_NAME,
    );

    const totalCount = await commentCollection.countDocuments();

    const comments = await commentCollection
      .find({})
      .sort({ systemCreatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      comments,
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + comments.length < totalCount,
      },
    };
  }catch(error){
    logger.error(`Error getting comments: ${error}`);
    throw error;
  }
}

export async function updateComment(commentId: string, payload: ValidatedCommentPayload, user: User){
  try{
    const db = await getMongoDB();
    const commentCollection: Collection = db.collection(
      COMMENT_COLLECTION_NAME,
    );

    const result = await commentCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          userId: user.id,
          postId: payload.post_id,
          comment: payload.comment,
          media: payload.media,
          systemUpdatedAt: new Date(),
          commentTimestamp: new Date(),
          systemCreatedAt: new Date(),
        },
      }
    );

    if(!result.modifiedCount){
      throw new InternalServerError(
        'Error updating comment in mongoDB',
      );
    }

    return {
      message: `Comment for ${commentId} updated successfully`,
    };

  }catch(error){
    logger.error(`Error updating comment: ${error}`);
    throw error;
  }
}

export async function getCommentById(commentId: string){
  try{
    const db = await getMongoDB();
    const commentCollection: Collection = db.collection(
      COMMENT_COLLECTION_NAME,
    );

    const result = await commentCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if(!result){
      throw new NotFoundError('Comment not found in mongoDB');
    }

    return result;
  }catch(error){
    logger.error(`Error getting comment by id: ${error}`);
    throw error;
  }
}

export async function deleteComment(commentId: string, user: User) {
  try {
    const db = await getMongoDB();
    const commentCollection: Collection = db.collection(
      COMMENT_COLLECTION_NAME,
    );

    const comment = await commentCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // user is comment owner or post owner
    const isCommentOwner = comment.userId === user.id;
    
    let isPostOwner = false;
    if (!isCommentOwner) {
      const postCollection: Collection = db.collection(DISASTER_COLLECTION_NAME);
      const post = await postCollection.findOne({
        _id: new ObjectId(comment.postId),
      });
      
      // check it is post owner or not
      if (post) {
        isPostOwner = post.userId === user.id;
      }
    }

    if (!isCommentOwner && !isPostOwner) {
      throw new Error('Unauthorized: Only comment owner or post owner can delete this comment');
    }

    const result = await commentCollection.deleteOne({
      _id: new ObjectId(commentId),
    });

    if (result.deletedCount === 0) {
      throw new InternalServerError('Failed to delete comment');
    }

    return {
      message: 'Comment deleted successfully',
    };
  } catch (error) {
    logger.error(`Error deleting comment: ${error}`);
    throw error;
  }
}