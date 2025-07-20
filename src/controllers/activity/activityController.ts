import logger from '@/logger';
import { CreatePost } from '@/services/activity/activityFeed';
import { AuthenticationError, ValidationError } from '@/utils/errors';
import { ActivityType, HelpType } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

const HelpItemSchema = z
  .object({
    helpType: z.nativeEnum(HelpType),
    quantity: z.number().int().min(1).optional(),
  })
  .refine(
    (data) => {
      // if HelpType is not WIFI, qty is required
      return data.helpType === 'WIFI' ? true : data.quantity !== undefined;
    },
    {
      message: 'Quantity is required for FOOD, WATER, and SHELTER types',
      path: ['quantity'],
    },
  );

export const CreateActivityFeedPostSchema = z.object({
  activityType: z.nativeEnum(ActivityType),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters long'),
  location: z.object({
    city: z.string().min(2, 'City must be at least 2 characters long'),
    country: z.string().min(2, 'Country must be at least 2 characters long'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  helpItems: z
    .array(HelpItemSchema)
    .min(1, 'At least one help item is required'),
});

export async function createActivityFeedPost(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const validatedBody = CreateActivityFeedPostSchema.parse(req.body);

    const newPost = await CreatePost(user.id, validatedBody);

    return res.status(201).json({ newPost });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error creating report:', err);
    return next(err);
  }
}
