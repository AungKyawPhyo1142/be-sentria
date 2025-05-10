export const ENV = {
  APP: process.env.APP || 'be-sentria',
  CORS_ORIGIN: process.env.CORS_ORIGIN || true,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'sentria',
  NODE_ENV: (process.env.NODE_ENV || 'dev') as 'local' | 'dev' | 'production',
  PORT: process.env.PORT || 3000,
  REFRESH_TOKEN_SECRET: process.env.RERESH_TOKEN_SECRET || 'sentria',
};

if (ENV.NODE_ENV === 'local' && !process.env.CORS_ORIGIN) {
  ENV.CORS_ORIGIN = 'http://localhost:8080';
}

if (ENV.NODE_ENV === 'dev' && process.env.DEV_DATABASE_URL) {
  ENV.DATABASE_URL = process.env.DEV_DATABASE_URL;
}
