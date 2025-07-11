import logger from '@/logger';
import * as resourceService from '@/services/resources/resources';
import { uploadToSupabase } from '@/services/resources/upload';
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

enum ResourceType {
  SURVIVAL = 'SURVIVAL',
  HOTLINE = 'HOTLINE',
  FIRST_AID = 'FIRST_AID',
}

const CreateResourceSchema = object({
  name: string()
    .min(3, 'Resource name is too short')
    .max(150, 'Resource name is too long'),
});

const ResourceParametersSchema = object({
  location: object({
    city: string().min(1, 'City is required'),
    country: string().min(1, 'Country is required'),
    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
  }),
  address: object({
    street: string().optional(),
    district: string().optional(),
    fullAddress: string().optional(),
  }).optional(),
  description: string().min(10, 'Resource description is too short').max(5000),
  media: z
    .array(
      object({
        type: z.enum(['IMAGE', 'VIDEO']),
        url: string().url({ message: 'Invalid URL' }),
        caption: string().max(250).optional(),
      }),
    )
    .max(5, 'Maximum 5 media items allowed')
    .optional()
    .default([]),
});

const CreateResourceRequestSchema = z.discriminatedUnion('resourceType', [
  CreateResourceSchema.extend({
    resourceType: z.literal(ResourceType.SURVIVAL),
    parameters: ResourceParametersSchema,
  }),
  CreateResourceSchema.extend({
    resourceType: z.literal(ResourceType.HOTLINE),
    parameters: ResourceParametersSchema,
  }),
  CreateResourceSchema.extend({
    resourceType: z.literal(ResourceType.FIRST_AID),
    parameters: ResourceParametersSchema,
  }),
]);

const UpdateResourceSchema = object({
  name: string()
    .min(3, 'Resource name is too short')
    .max(150, 'Resource name is too long'),
  resourceType: z.enum([
    ResourceType.SURVIVAL,
    ResourceType.HOTLINE,
    ResourceType.FIRST_AID,
  ]),
  parameters: ResourceParametersSchema,
});

export async function CreateResource(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    logger.info(`got a request to create resource for user: ${user.username}`);

    if (!user.verified_profile) {
      logger.info(`User is not verified user: ${user.username}`);
      throw new AuthenticationError('User is not verified');
    }

    if (typeof req.body?.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (e) {
        return next(new BadRequestError(`Invalid parameters JSON: ${e}`));
      }
    }

    const validatedRequestBody = CreateResourceRequestSchema.parse(req.body);
    const { resourceType, name } = validatedRequestBody;

    const resourceParams = validatedRequestBody.parameters;

    const servicePayload: resourceService.ValidatedResourcePayload = {
      description: resourceParams.description,
      resourceType: resourceType,
      location: {
        type: 'Point',
        coordinates: [
          resourceParams.location.longitude,
          resourceParams.location.latitude,
        ],
      },
      address: {
        street: resourceParams.address?.street,
        district: resourceParams.address?.district,
        city: resourceParams.location.city,
        country: resourceParams.location.country,
        fullAddress: resourceParams.address?.fullAddress,
      },
      media: resourceParams.media || [],
    };

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        logger.info(
          `Uploading ${req.files.length} resource images for user: ${user.id}`,
        );

        // Process each uploaded file
        const uploadPromises = req.files.map(async (file, index) => {
          const uploadResponse = await uploadToSupabase(file, user.id);

          return {
            type: 'IMAGE' as const,
            url: uploadResponse.url,
            caption:
              Array.isArray(req.body.imageCaptions) &&
              req.body.imageCaptions[index]
                ? req.body.imageCaptions[index]
                : `Resource image ${index + 1}`,
          };
        });

        const mediaItems = await Promise.all(uploadPromises);

        servicePayload.media = [...mediaItems, ...(servicePayload.media || [])];

        logger.info(
          `Successfully uploaded ${mediaItems.length} resource images`,
        );
      } catch (uploadError) {
        logger.error(`Error uploading resource images: ${uploadError}`);
      }
    }

    logger.info(`Creating resource: ${JSON.stringify(servicePayload)}`);
    const result = await resourceService.createResource(
      servicePayload,
      name,
      user,
    );
    return res.status(201).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error creating resource: ${error}`);
    return next(error);
  }
}

export async function UpdateResource(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!user.verified_profile) {
      logger.info(`User is not verified user: ${user.username}`);
      throw new AuthenticationError('User is not verified');
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      throw new NotFoundError('Resource ID is required');
    }

    if (typeof req.body.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (e) {
        return next(new BadRequestError(`Invalid parameters JSON: ${e}`));
      }
    }

    const validatedRequestBody = UpdateResourceSchema.parse(req.body);
    const { resourceType, name, parameters } = validatedRequestBody;

    const servicePayload: resourceService.ValidatedResourcePayload = {
      description: parameters.description,
      resourceType: resourceType,
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
      media: parameters.media || [],
    };

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        logger.info(
          `Uploading ${req.files.length} resource images for user: ${user.id}`,
        );

        const uploadPromises = req.files.map(async (file, index) => {
          const uploadResponse = await uploadToSupabase(file, user.id);

          return {
            type: 'IMAGE' as const,
            url: uploadResponse.url,
            caption:
              Array.isArray(req.body.imageCaptions) &&
              req.body.imageCaptions[index]
                ? req.body.imageCaptions[index]
                : `Resource image ${index + 1}`,
          };
        });

        const mediaItems = await Promise.all(uploadPromises);

        servicePayload.media = [...mediaItems, ...(servicePayload.media || [])];

        logger.info(
          `Successfully uploaded ${mediaItems.length} resource images`,
        );
      } catch (uploadError) {
        logger.error(`Error uploading resource images: ${uploadError}`);
      }
    }

    logger.info(`Updating resource: ${JSON.stringify(servicePayload)}`);
    const result = await resourceService.updateResource(
      resourceId,
      servicePayload,
      name,
      user,
    );
    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }

    logger.error(`Error updating resource: ${error}`);
    return next(error);
  }
}

export async function GetResources(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;

    const result = await resourceService.getResources(limit, skip);
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error getting resources: ${error}`);
    return next(error);
  }
}

export async function GetResourceById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const resourceId = req.params.id;
    if (!resourceId) {
      throw new NotFoundError('Resource ID is required');
    }

    const result = await resourceService.getResourceById(resourceId);
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error getting resource by id: ${error}`);
    return next(error);
  }
}

export async function DeleteResource(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const mongoResourceId = req.params.id;
    if (!mongoResourceId) {
      throw new NotFoundError('Resource MongoDB ID is required');
    }

    const result = await resourceService.deleteResource(mongoResourceId, user);

    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error deleting resource: ${error}`);
    return next(error);
  }
}
