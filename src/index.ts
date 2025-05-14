import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import expressListRoutes from 'express-list-routes';
import helmet from 'helmet';
import { ENV } from './env';
import logger from './logger';
import errorHandler from './middlewares/error-handler';
import jsonResponse from './middlewares/json-response';
import networkLog from './middlewares/network-log';
import gateway from './routes/gateway';
import { NotFoundError } from './utils/errors';
import { closeMongoDBConnection, connectToMongoDB } from './libs/mongo';
import prisma from './libs/prisma';

async function startServer() {
  try {

    // connect to mongodb
    if (ENV.MONGO_URI) {
      await connectToMongoDB();
    } else {
      logger.error('MONGO_URI is not defined');
      throw new Error('MONGO_URI is not defined');
    }

    const app = express();

    app.use(
      cors({
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

    const server = app.listen(ENV.PORT, () => {
      logger.verbose(
        `ENV is pointing to ${ENV.NODE_ENV !== 'production'
          ? JSON.stringify(ENV, undefined, 2)
          : ENV.NODE_ENV
        }`,
      );
      expressListRoutes(gateway, { logger: false }).forEach((route) => {
        logger.verbose(`${route.method} ${route.path.replaceAll('\\', '/')}`);
      });

      logger.info(`Application is running on Port :${ENV.PORT}`);
    });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        server.close(async () => {
          logger.info('HTTP server closed.');
          await closeMongoDBConnection(); // Close MongoDB connection
          await prisma.$disconnect(); // If you also want to explicitly disconnect Prisma
          process.exit(0);
        });
      });
    });

  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();