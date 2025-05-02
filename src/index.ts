import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import expressListRoutes from 'express-list-routes';
import helmet from 'helmet';
import { ENV } from './env';
import logger from './logger';
import gateway from './routes/gateway';
import { NotFoundError } from './utils/errors';
import jsonResponse from './middlewares/json-response';
import networkLog from './middlewares/network-log';
import errorHandler from './middlewares/error-handler';

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
app.use(helmet());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());
app.use(jsonResponse)
app.use(networkLog);

app.get('/', (_req, res) => {
  return res.json({ message: 'Hello from Sentria!' });
});

app.use(gateway);

app.use((_req, _res, next) => {
  return next(new NotFoundError('Endpoint Not Found.'));
});

app.use(errorHandler);

app.listen(ENV.PORT, () => {
  logger.verbose(
    `ENV is pointing to ${
      ENV.NODE_ENV !== 'production'
        ? JSON.stringify(ENV, undefined, 2)
        : ENV.NODE_ENV
    }`,
  );
  expressListRoutes(gateway, { logger: false }).forEach((route) => {
    logger.verbose(`${route.method} ${route.path.replaceAll('\\', '/')}`);
  });

  logger.info(`Application is running on Port :${ENV.PORT}`);
});
