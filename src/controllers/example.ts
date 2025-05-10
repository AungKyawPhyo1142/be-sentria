// Responsible for receiving & returning data to routes
import { InternalServerError, ValidationError } from '@/utils/errors';
import * as exampleService from '@services/example';
import { NextFunction, Request, Response } from 'express';
import { ZodError, number, object, string } from 'zod';

const sumQuerySchema = object({
  a: string().transform(Number),
  b: string().transform(Number),
});

const sumSchema = object({
  a: number(),
  b: number(),
});

const updateSchema = object({
  number: number(),
});

const getRandom = (_req: Request, res: Response) => {
  const random = exampleService.getRandom();
  return res.status(200).json({ random });
};

const sumQuery = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { a, b } = sumQuerySchema.parse(req.query);
    const result = exampleService.sum(a, b);
    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(new InternalServerError());
    }
  }
};

const sum = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { a, b } = sumSchema.parse(req.body);
    const result = exampleService.sum(a, b);
    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(new InternalServerError());
    }
  }
};

const updateNumber = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { number } = updateSchema.parse(req.body);
    const updatedNumber = exampleService.updateNumber(number);
    return res.status(200).json({ updatedNumber });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(new InternalServerError());
    }
  }
};

const patchNumber = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { number } = updateSchema.parse(req.body);
    const patchedNumber = exampleService.patchNumber(number);
    return res.status(200).json({ patchedNumber });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(new InternalServerError());
    }
  }
};

export { getRandom, sumQuery, sum, updateNumber, patchNumber };
