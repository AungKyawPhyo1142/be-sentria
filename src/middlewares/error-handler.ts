import { ENV } from '@/env';
import logger from '@/logger';
import { AppError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';

const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }
  res.locals.isErrorResponse = true;
  logger.error(
    `Error Code: ${err.code}, Message: ${err.message}, Stack: ${err.stack}`,
  );
  return res.status(err.statusCode || 500).json({
    code: err.code,
    error: err.error,
    message: err.userMessage,
    'stack[FOR_LOCAL_USE_ONLY]':
      ENV.NODE_ENV === 'local' ? err.stack : undefined,
    status: 'ERROR',
  });
};

export default errorHandler;
