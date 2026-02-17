import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import expressListRoutes from 'express-list-routes';
import helmet from 'helmet';
import http from 'http';
import { ENV } from './env';
import { closeMongoDBConnection, connectToMongoDB } from './libs/mongo';
import prisma from './libs/prisma';
import {
  closeRabbitMQConnection,
  initRabbitMQConnection,
} from './libs/rabbitmqClient';
import { initRedisConnection } from './libs/redisClient';
import { getIOInstance, initSocketIOServer } from './libs/socketManager';
import logger from './logger';
import errorHandler from './middlewares/error-handler';
import jsonResponse from './middlewares/json-response';
import networkLog from './middlewares/network-log';
import gateway from './routes/gateway';
import { InternalServerError, NotFoundError } from './utils/errors';
import { startDiasterNotificationConsumer } from './workers/disasterNotificationConsumer';
import {
  startFactCheckResultConsumer,
  stopFactCheckResultConsumer,
} from './workers/factCheckResultConsumer';

async function startServer() {
  try {
    // connect to mongodb
    if (ENV.MONGO_URI) {
      await connectToMongoDB();
    } else {
      logger.error('MONGO_URI is not defined');
      throw new Error('MONGO_URI is not defined');
    }

    // connect to redis
    if (ENV.REDIS_URL) {
      await initRedisConnection();
    } else {
      logger.error('REDIS_URL is not defined');
      throw new Error('REDIS_URL is not defined');
    }

    // connect to rabbitmq
    if (ENV.RABBITMQ_URL) {
      await initRabbitMQConnection().catch((initRabbitMQError) => {
        logger.error('Failed to connect to RabbitMQ:', initRabbitMQError);
        throw new InternalServerError('Failed to connect to RabbitMQ');
      });

      // start fact check result consumer
      await startFactCheckResultConsumer().catch(
        (startFactCheckResultError) => {
          logger.error(
            'Failed to start fact check result consumer:',
            startFactCheckResultError,
          );
          throw new InternalServerError(
            'Failed to start fact check result consumer',
          );
        },
      );

      // start diaster notification consumer
      await startDiasterNotificationConsumer().catch(
        (startDiasterNotificationError) => {
          logger.error(
            `Failed to start DiasterNotificationConsumer`,
            startDiasterNotificationError,
          );
          throw new InternalServerError(
            'Failed to start Diaster Notification Consumer',
          );
        },
      );
    } else {
      logger.error('RABBITMQ_URL is not defined');
      throw new InternalServerError('RABBITMQ_URL is not defined');
    }

    const app = express();
    const httpServer = http.createServer(app);

    // init socketIO server and attach it to the http server
    initSocketIOServer(httpServer);

    app.use(
      cors({
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        origin: ENV.CORS_ORIGIN,
        preflightContinue: true,
      }),
    );

    app.use(helmet());
    app.use(compression());
    app.use(json());
    app.use(urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(jsonResponse);
    app.use(networkLog);

    app.get('/', (_req, res) => {
      return res.json({ message: 'Hello from Sentria!' });
    });

    app.use(gateway);

    app.use((_req, _res, next) => {
      return next(new NotFoundError('Endpoint Not Found.'));
    });

    app.use(errorHandler);

    httpServer.listen(ENV.PORT, () => {
      const {
        // DATABASE_URL,
        // JWT_SECRET,
        // REFRESH_TOKEN_SECRET,
        // RESET_PASSWORD_SENDER_PASSWORD,
        // MONGO_URI,
        // RABBITMQ_URL,
        // REDIS_URL,
        ...safeEnv
      } = ENV;
      logger.verbose(
        `ENV is pointing to ${
          ENV.NODE_ENV !== 'production'
            ? JSON.stringify(safeEnv, undefined, 2)
            : ENV.NODE_ENV
        }`,
      );
      expressListRoutes(gateway, { logger: false }).forEach((route) => {
        logger.verbose(`${route.method} ${route.path.replaceAll('\\', '/')}`);
      });
      logger.info(
        `Sentria Server (with Socket.IO) is running on http://localhost:${ENV.PORT}`,
      );
    });

    // const server = app.listen(ENV.PORT, () => {
    //   logger.verbose(
    //     `ENV is pointing to ${
    //       ENV.NODE_ENV !== 'production'
    //         ? JSON.stringify(ENV, undefined, 2)
    //         : ENV.NODE_ENV
    //     }`,
    //   );
    //   expressListRoutes(gateway, { logger: false }).forEach((route) => {
    //     logger.verbose(`${route.method} ${route.path.replaceAll('\\', '/')}`);
    //   });

    //   logger.info(`Application is running on Port :${ENV.PORT}`);
    // });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        const ioServer = getIOInstance();
        if (ioServer) {
          ioServer.close(() => {
            logger.info('[SocketIO] Socket.IO server closed.');
          });
        }

        await stopFactCheckResultConsumer();
        await closeRabbitMQConnection();

        httpServer.close(async () => {
          logger.info('HTTP server closed.');
          await closeMongoDBConnection(); // Close MongoDB connection
          await prisma.$disconnect(); // If you also want to explicitly disconnect Prisma
          process.exit(0);
        });
        // Set a timeout to force exit if the server doesn't close in time
        setTimeout(() => {
          logger.error('Forcing exit due to timeout.');
          process.exit(1);
        }, 5000); // 5 seconds timeout
      });
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();
