import * as followersService from '@/services/followers/followers';
import { User } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError, object, string } from 'zod';

const followSchema = object({
  followingId: string(),
});

const followUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { followingId } = followSchema.parse(req.body);
    const follower = req.user as User;

    if (follower.id === followingId) {
      return res.status(400).json({
        code: 'INVALID_FOLLOW',
        message: "You can't follow yourself",
        status: 'ERROR',
      });
    }

    const result = await followersService.followUser(follower, followingId);

    return res.status(201).json({
      message: result.message,
      followerId: result.followerId,
      followingId: result.followingId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.errors,
        status: 'ERROR',
      });
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return next(err);
  }
};

const unfollowUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { followingId } = followSchema.parse(req.body);
    const follower = req.user as User;

    const result = await followersService.unfollowUser(follower, followingId);

    return res.status(200).json({
      message: result.message,
      followerId: result.followerId,
      followingId: result.followingId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.errors,
        status: 'ERROR',
      });
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return next(err);
  }
};

export { followUser, unfollowUser };
