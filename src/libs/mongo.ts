import { ENV } from '@/env';
import logger from '@/logger';
import { DatabaseError } from '@/utils/errors';
import { Db, MongoClient } from 'mongodb';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function connectToMongoDB(): Promise<Db> {
  if (dbInstance) {
    logger.debug('Reusing existing MongoDB connection');
    return dbInstance;
  }

  if (!ENV.MONGO_URI) {
    logger.error('MONGO_URI is not defined');
    throw new DatabaseError('MONGO_URI is not defined');
  }

  try {
    client = new MongoClient(ENV.MONGO_URI);
    logger.info('Trying to connect MongoDB...');
    await client.connect();

    dbInstance = client.db();
    logger.info('Connected to MongoDB');
    return dbInstance;
  } catch (error) {
    logger.error('Error connecting to MongoDB', error);
    throw new DatabaseError('Error connecting to MongoDB');
  }
}

export function getMongoDB(): Db {
  if (!dbInstance) {
    logger.error('MongoDB connection not established');
    throw new DatabaseError('MongoDB is not connected');
  }
  return dbInstance;
}

export async function closeMongoDBConnection(): Promise<void> {
  if (client) {
    try {
      await client.close();
      logger.info('MongoDB connection closed');
      // Reset the dbInstance and client to allow for a new connection
      dbInstance = null;
      // Reset the client to allow for a new connection
      client = null;
    } catch (error) {
      logger.error('Error closing MongoDB connection', error);
      throw new DatabaseError('Error closing MongoDB connection');
    }
  }
}
