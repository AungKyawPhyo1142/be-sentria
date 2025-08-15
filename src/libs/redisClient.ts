import { ENV } from '@/env';
import logger from '@/logger';
import { InternalServerError } from '@/utils/errors';
import { RedisClientType, createClient } from 'redis';

let redisClient: RedisClientType | null = null;

export async function initRedisConnection(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    logger.info('[RedisClient] Redis is already connected!');
    return redisClient;
  }

  logger.info(
    `[RedisClient] Attempting to connect to redis at ${ENV.REDIS_URL}...`,
  );
  const client = createClient({ url: ENV.REDIS_URL });

  client.on('error', (err) => {
    logger.error('[RedisClient] Client error: ', err);
    redisClient = null;
  });

  client.on('reconnecting', () => {
    logger.warn('[RedisClient] Reconnecting to redis...');
  });

  client.on('ready', () => {
    logger.info('[RedisClient] RedisClient is ready...');
  });

  await client.connect();
  redisClient = client as RedisClientType;
  logger.info('[RedisClient] Redis is connected successfully...');
  return redisClient;
}

export function getRedisClient(): RedisClientType {
  if (!redisClient || !redisClient.isOpen) {
    logger.error('[RedisClient] RedisClient is not connected or available');
    throw new InternalServerError('Redis client is not avaialble');
  }
  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    logger.info('[RedisClient] Closing redis connection...');
    await redisClient.quit();
    redisClient = null;
  }
}
