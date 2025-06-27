import prisma from '@/libs/prisma';
import logger from '@/logger';
import { AuthenticationError, InternalServerError } from '@/utils/errors';
import { User } from '@prisma/client';

export async function followUser(follower: User, followingId: number) {
  const followerId = follower.id;

  if (followerId === followingId) {
    throw new AuthenticationError("Users cannot follow themselves");
  }

  try {
    logger.info(`User ${followerId} is attempting to follow user ${followingId}`);

    await prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    logger.info(`User ${followerId} successfully followed user ${followingId}`);

    return {
      message: 'Followed successfully',
      followerId,
      followingId,
    };
  } catch (error: any) {
    if (error.code === 'P2002') {
      logger.warn(`User ${followerId} already follows user ${followingId}`);
      return {
        message: 'Already following',
        followerId,
        followingId,
      };
    }

    logger.error(`Error following user: ${error}`);
    throw new InternalServerError('Error following user');
  }
}

export async function unfollowUser(follower: User, followingId: number) {
  const followerId = follower.id;

  try {
    logger.info(`User ${followerId} is attempting to unfollow user ${followingId}`);

    const result = await prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    if (result.count === 0) {
      logger.warn(`User ${followerId} was not following user ${followingId}`);
      return {
        message: 'Was not following',
        followerId,
        followingId,
      };
    }

    logger.info(`User ${followerId} successfully unfollowed user ${followingId}`);

    return {
      message: 'Unfollowed successfully',
      followerId,
      followingId,
    };
  } catch (error) {
    logger.error(`Error unfollowing user: ${error}`);
    throw new InternalServerError('Error unfollowing user');
  }
}

export async function getFollowers(userId: number) {
  try {
    logger.info(`Fetching followers for user ${userId}`);

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: true },
    });

    return followers.map(f => f.follower);
  } catch (error) {
    logger.error(`Error fetching followers: ${error}`);
    throw new InternalServerError('Error fetching followers');
  }
}

export async function getFollowing(userId: number) {
  try {
    logger.info(`Fetching followings for user ${userId}`);

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: true },
    });

    return following.map(f => f.following);
  } catch (error) {
    logger.error(`Error fetching followings: ${error}`);
    throw new InternalServerError('Error fetching followings');
  }
}
