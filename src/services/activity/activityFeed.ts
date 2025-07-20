import {
  CreateActivityFeedPostSchema,
  UpdateActivityFeedPostSchema,
} from '@/controllers/activity/activityController';
import prisma from '@/libs/prisma';
import logger from '@/logger';
import { AuthenticationError, NotFoundError } from '@/utils/errors';
import { z } from 'zod';

type CreatePostPayload = z.infer<typeof CreateActivityFeedPostSchema>;

export async function CreatePost(userId: number, payload: CreatePostPayload) {
  const { activityType, description, location, helpItems } = payload;

  const newPost = await prisma.$transaction(async (tx) => {
    const post = await tx.activityFeedPost.create({
      data: {
        activityType,
        description,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        postedById: userId,
      },
    });
    logger.info(`Created post with id: ${post.id}`);

    const helpItemsData = helpItems.map((item) => ({
      helpType: item.helpType,
      quantity: item.quantity,
      activityFeedPostId: post.id,
    }));

    // create all helpitems in a single query
    await tx.helpItem.createMany({
      data: helpItemsData,
    });

    logger.info(
      `Created ${helpItems.length} help items for post with id: ${post.id}`,
    );

    return tx.activityFeedPost.findUnique({
      where: { id: post.id },
      include: {
        helpItems: true,
        postedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile_image: true,
            username: true,
          },
        },
      },
    });
  });
  return newPost;
}

export async function getPostById(postId: string) {
  const post = await prisma.activityFeedPost.findUnique({
    where: { id: postId },
    include: {
      helpItems: true, // Include the associated help items
      postedBy: {
        // Include details of the user who posted
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile_image: true,
        },
      },
    },
  });

  if (!post) {
    throw new NotFoundError(`Activity feed post with ID ${postId} not found.`);
  }

  return post;
}

type UpdatePostPayload = z.infer<typeof UpdateActivityFeedPostSchema>;

export async function updatePost(
  postId: string,
  userId: number,
  payload: UpdatePostPayload,
) {
  // 1. First, verify the post exists and the user is the owner
  const existingPost = await prisma.activityFeedPost.findUnique({
    where: { id: postId },
  });

  if (!existingPost) {
    throw new NotFoundError(`Post with ID ${postId} not found.`);
  }

  if (existingPost.postedById !== userId) {
    throw new AuthenticationError(
      'You are not authorized to update this post.',
    );
  }

  // 2. Use a transaction to perform the updates
  const updatedPost = await prisma.$transaction(async (tx) => {
    // 2a. Update the main post's scalar fields if they are provided
    const { helpItems, location, ...postData } = payload;
    if (Object.keys(postData).length > 0 || location) {
      await tx.activityFeedPost.update({
        where: { id: postId },
        data: {
          ...postData,
          // Update location fields if provided
          ...(location && {
            city: location.city,
            country: location.country,
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        },
      });
    }

    // 2b. If new helpItems are provided, replace the old ones
    if (helpItems && helpItems.length > 0) {
      // Delete all existing help items for this post
      await tx.helpItem.deleteMany({
        where: { activityFeedPostId: postId },
      });

      // Create the new help items
      await tx.helpItem.createMany({
        data: helpItems.map((item) => ({
          ...item,
          activityFeedPostId: postId,
        })),
      });
    }

    // 3. Return the fully updated post with its relations
    return tx.activityFeedPost.findUniqueOrThrow({
      where: { id: postId },
      include: {
        helpItems: true,
        postedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile_image: true,
          },
        },
      },
    });
  });

  return updatedPost;
}

export async function deletePost(postId: string, userId: number) {
  // 1. Verify the post exists and the user is the owner
  const post = await prisma.activityFeedPost.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError(`Post with ID ${postId} not found.`);
  }

  if (post.postedById !== userId) {
    throw new AuthenticationError(
      'You are not authorized to delete this post.',
    );
  }

  // 2. Delete the post. Prisma will automatically handle deleting the related HelpItems
  // because of the `onDelete: Cascade` rule in the schema.
  await prisma.activityFeedPost.delete({
    where: { id: postId },
  });

  logger.info(`Post ${postId} deleted by user ${userId}.`);
  return;
}

interface GetAllPostsParams {
  cursor?: string;
  limit?: string;
}

export async function getAllPosts({ cursor, limit }: GetAllPostsParams) {
  // 1. Set a default limit and parse the provided one.
  const take = limit ? parseInt(limit, 10) : 10; // Default to 10 items per page

  // 2. Build the Prisma query
  const posts = await prisma.activityFeedPost.findMany({
    // 3. Fetch one more item than the limit to check if there's a next page
    take: take + 1,
    // 4. If a cursor is provided, start fetching from that item
    ...(cursor && {
      skip: 1, // Skip the cursor item itself to avoid duplicates
      cursor: {
        id: cursor,
      },
    }),
    // 5. Order consistently to ensure stable pagination
    orderBy: {
      created_at: 'desc',
    },
    // 6. Include related data so the frontend has everything it needs
    include: {
      helpItems: true,
      postedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile_image: true,
        },
      },
    },
    where: {
      isActive: true, // Only show active posts
      isDeleted: false,
    },
  });

  // 7. Determine if there is a next page
  const hasNextPage = posts.length > take;
  // 8. If there is, remove the extra item we fetched
  const paginatedPosts = hasNextPage ? posts.slice(0, take) : posts;

  // 9. Set the next cursor to the ID of the last item in the list
  const nextCursor = hasNextPage
    ? paginatedPosts[paginatedPosts.length - 1].id
    : null;

  // 10. Return the data in a format perfect for useInfiniteQuery
  return {
    data: paginatedPosts,
    nextCursor,
    hasNextPage,
  };
}
