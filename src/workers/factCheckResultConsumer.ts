import { ENV } from '@/env';
import { getMongoDB } from '@/libs/mongo';
import prisma from '@/libs/prisma';
// import { emitFactCheckUpdateToRoom } from '@/libs/socketManager';
import logger from '@/logger';
import {
  DISASTER_COLLECTION_NAME,
  calculateAndUpdateTotalScore,
} from '@/services/disasterReports/disasterReports';
import { InternalServerError } from '@/utils/errors';
import { ReportStatus } from '@prisma/client';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { Db } from 'mongodb';

// DISASTER_COLLECTION_NAME is used in your service, ensure it's defined or imported if needed here
// For now, hardcoding it as it was in your service.
const DISASTER_DETAILS_COLLECTION_NAME = DISASTER_COLLECTION_NAME;
//

// Payload structure from Go's FactCheckResult
interface FactCheckResultPayload {
  postgresReportId: string;
  mongoDocId: string; // Key sent by Go
  overallConfidence: number; // float
  calculatedScore: number; // float
  status: string;
  narrative: string;
  evidence?: Array<{
    source: string;
    url?: string;
    summary: string;
    confidence: number;
    timestamp?: string; // ISO string
  }>;
  serviceProvider: string;
  processingError?: string;
  checkedAt: string; // ISO string
}

// --- Connection variables specific to this consumer ---
let resultsConsumerConnection: ChannelModel | null = null; // Use Connection type from amqplib
let resultsConsumerChannel: Channel | null = null;
const MAX_CONSUMER_RETRIES = 5;
const CONSUMER_RETRY_DELAY = 5000; // 5 seconds
let isResultsConsumerStopping = false; // Flag for graceful shutdown

async function connectAndConsumeResults(attempt = 1): Promise<void> {
  if (isResultsConsumerStopping) {
    logger.info(
      '[FactCheckResultConsumer] Stopping, will not attempt to connect.',
    ); //
    return;
  }
  try {
    logger.info(
      `[FactCheckResultConsumer] Attempting to connect to RabbitMQ (attempt ${attempt}/${MAX_CONSUMER_RETRIES})...`,
    ); //
    if (!ENV.RABBITMQ_URL) {
      //
      throw new InternalServerError(
        'RABBITMQ_URL not set for results consumer',
      ); //
    }
    // Type assertion to Connection if `amqp.connect` is typed as ChannelModel
    const newConn = await amqp.connect(ENV.RABBITMQ_URL); //
    resultsConsumerConnection = newConn;

    resultsConsumerChannel = await resultsConsumerConnection.createChannel();
    logger.info(
      '[FactCheckResultConsumer] Connected to RabbitMQ and channel created for results.',
    ); //

    // --- Robust Connection Error Handling ---
    resultsConsumerConnection.on('error', (err: Error) => {
      logger.error('[FactCheckResultConsumer] Connection error:', err.message); //
      if (resultsConsumerConnection)
        resultsConsumerConnection.removeAllListeners();
      resultsConsumerConnection = null;
      resultsConsumerChannel = null;
      if (!isResultsConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
        setTimeout(
          () => connectAndConsumeResults(attempt + 1),
          CONSUMER_RETRY_DELAY * attempt,
        );
      } else if (!isResultsConsumerStopping) {
        logger.error(
          '[FactCheckResultConsumer] Max retries reached for connection error.',
        ); //
      }
    });
    resultsConsumerConnection.on('close', () => {
      logger.warn('[FactCheckResultConsumer] Connection closed.'); //
      if (resultsConsumerConnection)
        resultsConsumerConnection.removeAllListeners();
      resultsConsumerConnection = null;
      resultsConsumerChannel = null;
      if (!isResultsConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
        // Only retry if not intentionally stopping
        logger.info(
          '[FactCheckResultConsumer] Attempting to reconnect results consumer...',
        ); //
        setTimeout(
          () => connectAndConsumeResults(attempt + 1),
          CONSUMER_RETRY_DELAY,
        );
      } else if (!isResultsConsumerStopping) {
        logger.error(
          '[FactCheckResultConsumer] Max retries reached after connection close or stopping.',
        ); //
      }
    });
    // --- End Connection Error Handling ---

    const queueName = ENV.RABBITMQ_FACTCHECK_RESULT_QUEUE_NAME; //
    if (!resultsConsumerChannel)
      throw new InternalServerError('Channel became null unexpectedly'); //

    await resultsConsumerChannel.assertQueue(queueName, { durable: true });
    logger.info(
      `[FactCheckResultConsumer] Results queue '${queueName}' asserted.`,
    ); //

    resultsConsumerChannel.prefetch(1); // Process one result at a time

    logger.info(
      `[FactCheckResultConsumer] Starting to consume from results queue '${queueName}'...`,
    ); //
    resultsConsumerChannel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (msg) {
          const deliveryTag = msg.fields.deliveryTag;
          let resultPayload: FactCheckResultPayload | null = null;
          try {
            logger.info(
              `[FactCheckResultConsumer] Received fact-check result. DeliveryTag: ${deliveryTag}`,
            ); //
            resultPayload = JSON.parse(
              msg.content.toString(),
            ) as FactCheckResultPayload;
            logger.info(
              `[FactCheckResultConsumer] Parsed result for PG_ID ${resultPayload.postgresReportId}: Status - ${resultPayload.status}, Confidence - ${resultPayload.overallConfidence}`,
            );

            logger.debug(
              `[FactCheckResultConsumer] Full result payload: ${JSON.stringify(
                resultPayload,
                null,
                2,
              )}`,
            );

            // Validate essential IDs
            if (!resultPayload.postgresReportId || !resultPayload.mongoDocId) {
              logger.error(
                '[FactCheckResultConsumer] Received result with missing postgresReportId or mongoDocId. Discarding.',
                resultPayload,
              ); //
              resultsConsumerChannel?.nack(msg, false, false); // Do not requeue bad data
              return;
            }

            // 1. Get MongoDB connection
            const db: Db = await getMongoDB(); // uses getMongoDB
            const disasterCollection = db.collection(
              DISASTER_DETAILS_COLLECTION_NAME,
            ); //

            // 2. Prepare the update for the factCheck object in MongoDB
            // We will update the 'factCheck' field, specifically its 'goService' sub-document,
            // and also the top-level 'overallPercentage' and 'lastCalculatedAt' within 'factCheck'.
            const updatePayload = {
              $set: {
                'factCheck.goService.status': resultPayload.status,
                'factCheck.goService.confidenceScore':
                  resultPayload.overallConfidence,
                'factCheck.goService.narrative': resultPayload.narrative,
                'factCheck.goService.evidence': resultPayload.evidence || [],
                'factCheck.goService.lastCheckedAt': resultPayload.checkedAt
                  ? new Date(resultPayload.checkedAt)
                  : new Date(),
                'factCheck.goService.serviceProvider':
                  resultPayload.serviceProvider,
                'factCheck.goService.processingError':
                  resultPayload.processingError,
                // Also update the overall percentage at the same time
                'factCheck.overallPercentage': resultPayload.overallConfidence,
                'factCheck.lastCalculatedAt': new Date(resultPayload.checkedAt),
                // Keep existing communityScore, don't overwrite it unless Go service aggregates it
                // "communityScore": { upvotes: existingUpvotes, downvotes: existingDownvotes }
              },
            };

            logger.debug(
              `[FactCheckResultConsumer] Updating MongoDB document with ID: ${resultPayload.postgresReportId}`,
            );

            const updateResult = await disasterCollection.updateOne(
              {
                postgresReportId: resultPayload.postgresReportId,
              },
              updatePayload, // This will set the entire factCheck object, or use dot notation for subfields.

              // Be careful if communityScore should be preserved.
              // A safer update for sub-fields of factCheck:
              // { $set: {
              //     "factCheck.goService": { /* goService fields */ },
              //     "factCheck.overallPercentage": resultPayload.overallConfidence,
              //     "factCheck.lastCalculatedAt": new Date(resultPayload.checkedAt)
              //   }
              // }
              // For now, let's assume we are setting the full 'factCheck' based on Go's comprehensive result.
              // This means the 'factCheck' object in MongoDB should be structured to receive this.
              // My initial Mongo save in Node.js's disasterReportService did:
              // factCheck: { communityScore: {...}, goService: {...}, overallPercentage: 0, lastCalculatedAt: new Date() }
              // So, we need to set specific fields of factCheck.
            );

            if (updateResult.matchedCount === 0) {
              logger.error(
                `[FactCheckResultConsumer] MongoDB document not found for mongoDocId ${resultPayload.mongoDocId} (PG_ID: ${resultPayload.postgresReportId}). Result not saved to Mongo. Discarding message.`,
              ); //
              resultsConsumerChannel?.nack(msg, false, false);
              return;
            }
            logger.info(
              `[FactCheckResultConsumer] MongoDB document ${resultPayload.mongoDocId} updated with fact-check results.`,
            ); //

            // 3. Update PostgreSQL Report status and denormalized fields
            let pgReportStatusUpdate: ReportStatus =
              ReportStatus.FACTCHECK_COMPLETE; // Define this in your Prisma enum
            if (
              resultPayload.status?.toUpperCase().includes('ERROR') ||
              resultPayload.processingError
            ) {
              pgReportStatusUpdate = ReportStatus.FAILED; // Or a specific FACTCHECK_PROCESSING_ERROR
            } else if (resultPayload.overallConfidence < 0.3) {
              // Example threshold for UNVERIFIABLE
              // pgReportStatusUpdate = ReportStatus.FACTCHECK_UNVERIFIABLE; // Add this to Prisma enum
            } else if (resultPayload.overallConfidence >= 0.7) {
              // pgReportStatusUpdate = ReportStatus.FACTCHECK_VERIFIED; // Add this to Prisma enum
            }

            await prisma.report.update({
              //
              where: { id: resultPayload.postgresReportId },
              data: {
                factCheckStatus: resultPayload.status,
                factCheckOverallPercentage: resultPayload.overallConfidence, // Ensure this field is Float in Prisma
                factCheckLastUpdatedAt: new Date(resultPayload.checkedAt),
                status: pgReportStatusUpdate, // Update main lifecycle status
                errorMessage: resultPayload.processingError || null,
              },
            });
            logger.info(
              `[FactCheckResultConsumer] PostgreSQL report ${resultPayload.postgresReportId} updated (Status: ${pgReportStatusUpdate}, FactCheck%: ${resultPayload.overallConfidence}).`,
            ); //

            calculateAndUpdateTotalScore(resultPayload.postgresReportId);

            // we dont need to emit here since we did that inside calculate function
            // 4. Broadcast update to connected WebSocket clients via Socket.IO
            // emitFactCheckUpdateToRoom(resultPayload.postgresReportId, {
            //   //
            //   overallPercentage: resultPayload.overallConfidence,
            //   status: resultPayload.status,
            //   narrative: resultPayload.narrative,
            //   lastCalculatedAt: resultPayload.checkedAt,
            //   // You might want to send the whole resultPayload.factCheck or parts of it
            // });

            resultsConsumerChannel?.ack(msg);
            logger.info(
              `[FactCheckResultConsumer] Result for PG_ID ${resultPayload.postgresReportId} fully processed and ACKed.`,
            ); //
          } catch (processingError: unknown) {
            logger.error(
              `[FactCheckResultConsumer] Error processing fact-check result message (DeliveryTag ${deliveryTag}): ${processingError instanceof Error ? processingError.message : 'Unknown error'}`,
              { error: processingError, payloadString: msg.content.toString() },
            ); //
            resultsConsumerChannel?.nack(msg, false, false); // Nack, don't requeue for persistent errors
          }
        } else {
          logger.warn(
            '[FactCheckResultConsumer] Received NULL message from queue, possibly channel/connection closed during consumption.',
          ); //
        }
      },
      { noAck: false },
    ); // Manual acknowledgment is crucial
  } catch (error: unknown) {
    logger.error(
      `[FactCheckResultConsumer] Failed to connect/start consuming results queue: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying...`,
      error,
    ); //
    if (resultsConsumerConnection) {
      // Attempt to clean up listeners on the potentially problematic connection
      try {
        resultsConsumerConnection.removeAllListeners();
      } catch (e) {
        /* ignore */
        logger.error(
          '[FactCheckResultConsumer] Error removing listeners from connection:',
          e,
        ); //
      }
    }
    resultsConsumerConnection = null;
    resultsConsumerChannel = null; // Ensure reset
    if (!isResultsConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
      // Only retry if not intentionally stopping
      setTimeout(
        () => connectAndConsumeResults(attempt + 1),
        CONSUMER_RETRY_DELAY * attempt,
      );
    } else if (!isResultsConsumerStopping) {
      logger.error(
        '[FactCheckResultConsumer] Max retries for initial connection to results queue. Consumer will not start.',
      ); //
    }
  }
}

export async function startFactCheckResultConsumer() {
  isResultsConsumerStopping = false; // Reset flag on start
  if (ENV.RABBITMQ_URL && ENV.RABBITMQ_FACTCHECK_RESULT_QUEUE_NAME) {
    //
    logger.info('[FactCheckResultConsumer] Initializing results consumer...'); //
    await connectAndConsumeResults(1); // Start with attempt 1
  } else {
    logger.warn(
      '[FactCheckResultConsumer] RabbitMQ URL or Results Queue Name not configured. Results consumer will NOT start.',
    ); //
  }
}

export async function stopFactCheckResultConsumer() {
  isResultsConsumerStopping = true; // Signal that we are intentionally stopping
  logger.info('[FactCheckResultConsumer] Stopping results consumer...'); //

  const ch = resultsConsumerChannel; // Capture current channel
  const conn = resultsConsumerConnection; // Capture current connection

  resultsConsumerChannel = null; // Nullify global vars immediately to prevent reuse by retries
  resultsConsumerConnection = null;

  if (ch) {
    try {
      await ch.close();
    } catch (e) {
      logger.error(
        '[FactCheckResultConsumer] Error closing results channel:',
        e,
      );
    } //
  }
  if (conn) {
    try {
      conn.removeAllListeners(); // Remove listeners before closing
      await conn.close();
    } catch (e) {
      logger.error(
        '[FactCheckResultConsumer] Error closing results connection:',
        e,
      );
    } //
  }
  logger.info(
    '[FactCheckResultConsumer] Results consumer stopped and connections attempted to close.',
  ); //
}
