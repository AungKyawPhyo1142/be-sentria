import logger from '@/logger';
import { getLocationDetails } from '@/services/location/locationService';
import { ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

const reverseGeoCodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function reverseGeoCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { lat, lng } = reverseGeoCodeSchema.parse(req.body);
    const lcoationDetails = await getLocationDetails(lat, lng);
    return res.status(200).json(lcoationDetails);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ValidationError(err.issues));
    }
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Error Reverse Geocoding:', error);
    return next(error);
  }
}
