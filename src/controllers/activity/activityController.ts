import logger from '@/logger';
import * as activityService from '@/services/activity/activity';
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

enum ActivityType {
  SHELTER = 'SHELTER',
  WATER = 'WATER',
  FOOD = 'FOOD',
  WIFI = 'WIFI',
}

const CreateActivitySchema = object({
  name: string().min(3, 'Activity name is too short').max(150),
});

const ActivityParametersSchema = object({
  location: object({
    city: string().min(1),
    country: string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  address: object({
    street: string().optional(),
    district: string().optional(),
    fullAddress: string().optional(),
  }).optional(),
  description: string().min(10).max(5000),
});

const CreateActivityRequestSchema = z.discriminatedUnion('activityType', [
  CreateActivitySchema.extend({
    activityType: z.literal(ActivityType.SHELTER),
    parameters: ActivityParametersSchema,
  }),
  CreateActivitySchema.extend({
    activityType: z.literal(ActivityType.WATER),
    parameters: ActivityParametersSchema,
  }),
  CreateActivitySchema.extend({
    activityType: z.literal(ActivityType.FOOD),
    parameters: ActivityParametersSchema,
  }),
  CreateActivitySchema.extend({
    activityType: z.literal(ActivityType.WIFI),
    parameters: ActivityParametersSchema,
  }),
]);

const UpdateActivitySchema = CreateActivityRequestSchema;

export async function CreateActivity(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) throw new AuthenticationError('User not authenticated');
    if (!user.verified_profile)
      throw new AuthenticationError('User is not verified');

    if (typeof req.body?.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch {
        return next(new BadRequestError('Invalid parameters JSON'));
      }
    }

    const validatedRequestBody = CreateActivityRequestSchema.parse(req.body);
    const { activityType, name } = validatedRequestBody;
    const parameters = validatedRequestBody.parameters;

    const payload: activityService.ValidatedActivityPayload = {
      description: parameters.description,
      activityType: activityType,
      location: {
        type: 'Point',
        coordinates: [
          parameters.location.longitude,
          parameters.location.latitude,
        ],
      },
      address: {
        street: parameters.address?.street,
        district: parameters.address?.district,
        city: parameters.location.city,
        country: parameters.location.country,
        fullAddress: parameters.address?.fullAddress,
      },
    };

    const result = await activityService.createActivity(payload, name, user);
    return res.status(201).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error creating activity: ${error}`);
    return next(error);
  }
}

export async function UpdateActivity(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) throw new AuthenticationError('User not authenticated');
    if (!user.verified_profile)
      throw new AuthenticationError('User is not verified');

    const activityId = req.params.id;
    if (!activityId) throw new NotFoundError('Activity ID is required');

    if (typeof req.body?.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch {
        return next(new BadRequestError('Invalid parameters JSON'));
      }
    }

    const validated = UpdateActivitySchema.parse(req.body);
    const { activityType, name, parameters } = validated;

    const payload: activityService.ValidatedActivityPayload = {
      description: parameters.description,
      activityType,
      location: {
        type: 'Point',
        coordinates: [
          parameters.location.longitude,
          parameters.location.latitude,
        ],
      },
      address: {
        street: parameters.address?.street,
        district: parameters.address?.district,
        city: parameters.location.city,
        country: parameters.location.country,
        fullAddress: parameters.address?.fullAddress,
      },
    };

    const result = await activityService.updateActivity(
      activityId,
      payload,
      name,
      user,
    );
    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error updating activity: ${error}`);
    return next(error);
  }
}

export async function GetActivities(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await activityService.getActivities(limit, skip);
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error fetching activities: ${error}`);
    return next(error);
  }
}

export async function GetActivityById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const activityId = req.params.id;
    if (!activityId) {
      throw new NotFoundError('Activity ID is required');
    }

    const result = await activityService.getActivityById(activityId);
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error getting activity by id: ${error}`);
    return next(error);
  }
}

export async function DeleteActivity(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) throw new AuthenticationError('User not authenticated');

    const mongoActivityId = req.params.id;
    if (!mongoActivityId)
      throw new NotFoundError('Activity MongoDB ID is required');

    const result = await activityService.deleteActivity(mongoActivityId, user);
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error deleting activity: ${error}`);
    return next(error);
  }
}
