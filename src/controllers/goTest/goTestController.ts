import * as goTestService from '@/services/goServiceTest/goServiceTest';
import { NextFunction, Request, Response } from 'express';

const sendBulkTestDisasterReportsToQueue = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await goTestService.sendBulkTestDisasterReportsToQueue();

    if (result.errors.length > 0) {
      return res.status(207).json({
        message: 'Attempted to send all test reports, but some failed',
        succssfullySent: result.successfullySent,
        totalAttempted: result.totalAttempted,
        errors: result.errors,
      });
    }

    return res.status(200).json({
      message: 'All test reports sent successfully to rabbitMQ queue',
      succssfullySent: result.successfullySent,
      totalAttempted: result.totalAttempted,
      errors: result.errors,
    });
  } catch (error) {
    return next(error);
  }
};

export { sendBulkTestDisasterReportsToQueue };
