import { ENV } from '@/env';
import { publishToQueue } from '@/libs/rabbitmqClient';
import logger from '@/logger';
import { sampleTestJobs } from './testPosts';

// Define the structure for the job payload (match Go's DisasterReportData)
export interface TestDisasterReportJobPayload {
  postgresReportId: string;
  mongoDocId: string; // Consistent with Go's expected JSON key
  title: string;
  description: string;
  incidentType: string;
  severity: string;
  incidentTimestamp: string; // ISO 8601 string
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  address?: string;
  media?: Array<{ type: string; url: string; caption?: string }>;
  reporterUserId: number;
}

export async function sendBulkTestDisasterReportsToQueue(
  count?: number,
): Promise<{
  successfullySent: number;
  totalAttempted: number;
  errors: string[];
}> {
  const queueName = ENV.RABBITMQ_FACTCHECK_QUEUE_NAME; //
  if (!queueName) {
    logger.error(`[TestGoService] Queue name is not defined.`);
    return {
      successfullySent: 0,
      totalAttempted: 0,
      errors: ['Queue name is not defined.'],
    };
  }

  let jobToSend = sampleTestJobs;
  if (count && count > 0 && count < sampleTestJobs.length) {
    jobToSend = sampleTestJobs.slice(0, count);
  }

  let successfullySent = 0;
  const errors: string[] = [];

  for (const jobPayload of jobToSend) {
    // Simulate unique IDs for each test run if desired, or use fixed test IDs
    jobPayload.postgresReportId = `test_pg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    jobPayload.mongoDocId = `test_mongo_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    logger.info(
      `[TestService] Publishing test job to queue '${queueName}': ${jobPayload.title}`,
    ); //
    const published = await publishToQueue(queueName, jobPayload); // publishToQueue from your rabbitmqClient.ts
    if (published) {
      successfullySent++;
    } else {
      const errorMsg = `[TestService] Failed to publish test job: ${jobPayload.title}`;
      logger.error(errorMsg); //
      errors.push(errorMsg);
    }
    // Optional: Add a small delay between messages if sending many, to avoid overwhelming anything
    // await new Promise(resolve => setTimeout(resolve, 100));
  }
  logger.info(
    `[TestService] Bulk job sending complete. Sent: ${successfullySent}/${jobToSend.length}`,
  ); //
  return { successfullySent, totalAttempted: jobToSend.length, errors };
}
