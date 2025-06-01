// Responsible for receiving & returning data to routes
import { ENV } from '@/env';
import { publishToQueue } from '@/libs/rabbitmqClient';
import { emitFactCheckUpdateToRoom } from '@/libs/socketManager';
import logger from '@/logger';
import { InternalServerError, ValidationError } from '@/utils/errors';
import * as exampleService from '@services/example';
import { NextFunction, Request, Response } from 'express';
import { ZodError, number, object, record, string, unknown } from 'zod';

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

// * Simple test for websocket
const testWebSocketSchema = object({
  reportId: string(),
  factCheckOverallPercentage: number(),
  status: string(),
  narrative: string(),
  lastCalculatedAt: string(),
});
const testWebSocketMessage = (req: Request, res: Response) => {
  const { reportId, factCheckOverallPercentage, status, narrative, lastCalculatedAt } =
    testWebSocketSchema.parse(req.body);
  emitFactCheckUpdateToRoom(reportId, {
    factCheckOverallPercentage,
    status,
    narrative,
    lastCalculatedAt,
  });
  res.status(200).json({ message: 'Message sent to room' });
};

// * Simple test message payload for RabbitMQ
const testRabbitMQMessageSchema = object({
  message: string().optional().default('Hello from Sentria Node.js!'),
  data: record(unknown())
    .optional()
    .default({ timestamp: new Date().toISOString() }), // allows for any data to be passed into the message
});

const sendTestRabbitMQMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsedBody = testRabbitMQMessageSchema.parse(req.body);
    let messagePayload;

    if (parsedBody.data) {
      messagePayload = parsedBody.data;
    } else {
      logger.warn('[TestRabbitMQMessage] No data passed in, using default');
      messagePayload = {
        message: `Test message from Sentria Node.js at ${new Date().toISOString()}`,
        type: 'SIMPLE_TEST',
        source: 'NodeJS_Example_Endpoint',
      };
    }

    const queueName = ENV.RABBITMQ_FACTCHECK_QUEUE_NAME;
    logger.info(`[TestRabbitMQMessage] Sending message to queue ${queueName}`);

    const success = await publishToQueue(queueName, messagePayload);

    if (success) {
      return res.status(200).json({
        message: 'Message sent to queue',
        queue: queueName,
        payloadSent: messagePayload,
      });
    } else {
      throw new InternalServerError('Failed to send message to queue');
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(new InternalServerError());
    }
  }
};

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

export {
  getRandom,
  sumQuery,
  sum,
  updateNumber,
  patchNumber,
  sendTestRabbitMQMessage,
  testWebSocketMessage,
};
