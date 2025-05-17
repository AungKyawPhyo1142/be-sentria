import { DatabaseError } from './utils/errors';

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
