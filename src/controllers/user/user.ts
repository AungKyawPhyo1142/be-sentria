import * as userService from '@/services/user/user';
import { ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { ZodError, boolean, date, object, string } from 'zod';

const userDetailSchema = object({
  firstName: string().optional(),
  lastName: string().optional(),
  profile_image: string().nullable().optional(),
  email: string().email().optional(),
  email_verified: boolean().optional(),
  password: string().min(8).optional(),
  verified_profile: boolean().optional(),
  birthday: date().nullable().optional(),
  country: string().optional(),
});

const details = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({
        code: 'INVALID_USER_ID',
        message: 'User ID must be a valid number',
        status: 'ERROR',
      });
    }

    const response = await userService.details(userId);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const updateData = userDetailSchema.parse(req.body);

    const response = await userService.update(userId, updateData);

    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(error);
    }
  }
};

const softDelete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({
        code: 'INVALID_USER_ID',
        message: 'User ID must be a valid number',
        status: 'ERROR',
      });
    }
    const response = await userService.softDelete(userId);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const recover = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({
        code: 'INVALID_USER_ID',
        message: 'User ID must be a valid number',
        status: 'ERROR',
      });
    }

    const response = await userService.recover(userId);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

export { details, update, softDelete, recover };
