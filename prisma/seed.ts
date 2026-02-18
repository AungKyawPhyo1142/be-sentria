import bcrypt from 'bcryptjs';
import prisma from '@/libs/prisma';
import { connectToMongoDB, closeMongoDBConnection } from '@/libs/mongo';
import {
  initRabbitMQConnection,
  closeRabbitMQConnection,
} from '@/libs/rabbitmqClient';
import { ENV } from '@/env';
import { seedDisasterReports } from '@/seed/seedDisasterReports';
import { seedActivityPosts } from '@/seed/seedActivityPosts';
import { seedResources } from '@/seed/seedResources';

async function main() {
  console.log('Starting Sentria seed...\n');

  // 1. Initialize external connections (required by createDisasterReport which publishes to RabbitMQ)
  console.log('Connecting to MongoDB...');
  await connectToMongoDB();
  console.log('MongoDB connected.\n');

  console.log('Connecting to RabbitMQ...');
  await initRabbitMQConnection();
  console.log('RabbitMQ connected.\n');

  // 2. Upsert system bot user (idempotent)
  console.log('Upserting system bot user...');
  const hashedPassword = await bcrypt.hash(ENV.SYSTEM_BOT_PASSWORD, 10);

  const systemUser = await prisma.user.upsert({
    where: { email: ENV.SYSTEM_BOT_EMAIL },
    update: {
      username: ENV.SYSTEM_BOT_USERNAME,
      firstName: ENV.SYSTEM_BOT_FIRST_NAME,
      lastName: ENV.SYSTEM_BOT_LAST_NAME,
      password: hashedPassword,
      email_verified: true,
      verified_profile: true,
    },
    create: {
      email: ENV.SYSTEM_BOT_EMAIL,
      username: ENV.SYSTEM_BOT_USERNAME,
      firstName: ENV.SYSTEM_BOT_FIRST_NAME,
      lastName: ENV.SYSTEM_BOT_LAST_NAME,
      password: hashedPassword,
      birthday: new Date('2000-01-01'),
      country: 'Global',
      email_verified: true,
      verified_profile: true,
    },
  });

  console.log(
    `System bot user ready: ${systemUser.id} (${systemUser.email})\n`,
  );

  // 3. Seed disaster reports (fetches from ReliefWeb + EONET, publishes to RabbitMQ)
  const disasterLocations = await seedDisasterReports(systemUser);

  // 4. Seed activity posts near disaster epicenters
  await seedActivityPosts(systemUser.id, disasterLocations);

  // 5. Seed emergency resources
  await seedResources(systemUser);

  // --- Summary ---
  console.log('=== Seed Summary ===');
  console.log(`  Disaster locations seeded: ${disasterLocations.length}`);
  console.log('  Activity posts: up to 10 (5 REQUEST + 5 OFFER)');
  console.log('  Resources: up to 9 (4 HOTLINE + 3 SURVIVAL + 2 FIRST_AID)');
  console.log('\nSeed completed successfully!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeRabbitMQConnection();
    await closeMongoDBConnection();
    await prisma.$disconnect();
  });
