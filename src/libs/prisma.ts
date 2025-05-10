import { ENV } from '@/env';
import { PrismaClient } from '@prisma/client';

/*
    PrismaClient is attached to `global` object in development mode
    to prevent initializing multiple instances of PrismaClient 
    which might exhaust the database connection limit.
*/

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (ENV.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
