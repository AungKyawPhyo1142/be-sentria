import { DatabaseError, InternalServerError } from './utils/errors';

export const ENV = {
  APP: process.env.APP || 'be-sentria',
  CORS_ORIGIN: process.env.CORS_ORIGIN || true,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'sentria',
  NODE_ENV: (process.env.NODE_ENV || 'dev') as 'local' | 'dev' | 'production',
  PORT: process.env.PORT || 3000,
  REFRESH_TOKEN_SECRET: process.env.RERESH_TOKEN_SECRET || 'sentria',
  RESET_PASSWORD_SENDER_EMAIL:
    process.env.RESET_PASSWORD_SENDER_EMAIL || 'sentria.platform@gmail.com',
  FRONTEND_URL: process.env.FRONTEND_URL || 'localhost:8080',
  MONGO_URI: process.env.MONGO_URI,
  RABBITMQ_URL: process.env.RABBITMQ_URL,
  RABBITMQ_FACTCHECK_QUEUE_NAME:
    process.env.RABBITMQ_FACTCHECK_QUEUE_NAME || 'sentria_factcheck_jobs',
  RABBITMQ_FACTCHECK_RESULT_QUEUE_NAME:
    process.env.RABBITMQ_FACTCHECK_RESULT_QUEUE_NAME ||
    'sentria_factcheck_results',
  RABBITMQ_NOTIFICATION_QUEUE_NAME: process.env.RABBITMQ_NOTIFICATION_QUEUE_NAME || 'sentria_send_notification_jobs',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};

if (ENV.NODE_ENV === 'local' && !process.env.CORS_ORIGIN) {
  ENV.CORS_ORIGIN = 'http://localhost:8080';
}

if (ENV.NODE_ENV === 'dev' && process.env.DEV_DATABASE_URL) {
  ENV.DATABASE_URL = process.env.DEV_DATABASE_URL;
}

if (!ENV.MONGO_URI) {
  throw new DatabaseError('MONGO_URI is not defined');
}

if (
  !ENV.RABBITMQ_URL ||
  !ENV.RABBITMQ_FACTCHECK_QUEUE_NAME ||
  !ENV.RABBITMQ_FACTCHECK_RESULT_QUEUE_NAME ||
  !ENV.RABBITMQ_NOTIFICATION_QUEUE_NAME
) {
  throw new InternalServerError(
    'RABBITMQ_URL | RABBITMQ_FACTCHECK_QUEUE | RABBITMQ_FACTCHECK_RESULT_QUEUE | RABBITMQ_NOTIFICATION_QUEUE_NAME is not defined',
  );
}

if (!ENV.REDIS_URL) {
  throw new InternalServerError('REDIS URL is not defined')
}
