import { CreateActivityFeedPostSchema } from '@/controllers/activity/activityController';
import prisma from '@/libs/prisma';
import logger from '@/logger';
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
