import { ENV } from '@/env';
import logger from '@/logger';
import { InternalServerError } from '@/utils/errors';
import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';

let connection: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;

const RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 5;

async function connectToRabbitMQ(attempt = 1): Promise<void> {
  if (connection && channel) {
    logger.info('[RabbitMQ] Already connected to RabbitMQ Server');
    return;
  }

  if (connection) {
    connection.removeAllListeners('error');
    connection.removeAllListeners('close');
  }

  try {
    if (!ENV.RABBITMQ_URL) {
      logger.error('RABBITMQ_URL is not defined');
      throw new InternalServerError('RABBITMQ_URL is not defined');
    }

    connection = await amqp.connect(ENV.RABBITMQ_URL);

    logger.info('[RabbitMQ] Connected to RabbitMQ Server');

    connection?.on('error', (err) => {
      logger.error('[RabbitMQ] Connection error:', err);
      connection = null;
      channel = null;
      // simple retry logic
      if (attempt <= MAX_RETRIES) {
        setTimeout(() => {
          logger.info(`[RabbitMQ] Retrying connection (attempt ${attempt})...`);
          connectToRabbitMQ(attempt + 1);
        }, RETRY_DELAY);
      } else {
        logger.error(
          `[RabbitMQ] Maximum retry attempts reached. Unable to connect.`,
        );
      }
    });

    connection?.on('close', () => {
      logger.error('[RabbitMQ] Connection closed, attempting to reconnect...');
      connection = null;
      channel = null;
      // simple retry logic
      if (attempt <= MAX_RETRIES) {
        setTimeout(() => {
          logger.info(`[RabbitMQ] Retrying connection (attempt ${attempt})...`);
          connectToRabbitMQ(attempt + 1);
        }, RETRY_DELAY);
      } else {
        logger.error(
          `[RabbitMQ] Maximum retry attempts reached. Unable to connect.`,
        );
      }
    });

    channel = await connection.createConfirmChannel();
    logger.info('[RabbitMQ] Channel created');

    await channel.assertQueue(ENV.RABBITMQ_FACTCHECK_QUEUE_NAME, {
      durable: true,
    });
    logger.info(
      `[RabbitMQ] Queue ${ENV.RABBITMQ_FACTCHECK_QUEUE_NAME} asserted & ready`,
    );
  } catch (error: any) {
    logger.error(
      `[RabbitMQ] Failed to connect or create channel (attempt ${attempt}/${MAX_RETRIES}):`,
      error.message,
    );
    // Nullify connection and channel on failure
    if (connection) connection.removeAllListeners(); // ensure listeners are off the failed connection
    connection = null;
    channel = null;

    if (attempt < MAX_RETRIES) {
      logger.info(
        `[RabbitMQ] Retrying connection in ${(RETRY_DELAY * attempt) / 1000} seconds...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY * attempt),
      );
      return connectToRabbitMQ(attempt + 1); // Recursive call for retry
    } else {
      logger.error(
        '[RabbitMQ] Max connection retries reached. Failed to connect to RabbitMQ.',
      );
      throw new InternalServerError(
        `Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts: ${error.message}`,
      );
    }
  }
}

// -- getter for the channel
export async function getRabbitMQChannel(): Promise<ConfirmChannel> {
  if (!channel || !connection) {
    logger.warn('[RabbitMQ] Channel not initialized, attempting to connect...');
    await connectToRabbitMQ(1);
    if (!channel) {
      logger.error(
        '[RabbitMQ] CRITICAL: Failed to establish RabbitMQ channel after explicit (re)connect attempt.',
      );
      throw new InternalServerError('Failed to establish RabbitMQ channel.');
    }
  }
  return channel;
}

// -- publish a message to the queue with confirmChannel
export async function publishToQueue(
  queueName: string,
  messageContent: object | string | Buffer,
  persistent = true,
): Promise<boolean> {
  let messageBuffer: Buffer;

  if (Buffer.isBuffer(messageContent)) {
    messageBuffer = messageContent;
  } else if (typeof messageContent === 'string') {
    messageBuffer = Buffer.from(messageContent);
  } else {
    messageBuffer = Buffer.from(JSON.stringify(messageContent));
  }

  try {
    const ch = await getRabbitMQChannel();

    return new Promise<boolean>((resolve) => {
      const options = { persistent: persistent };
      // for confirmChannel, sendToQueue has a callback for broker acknowledgement/nacknowledgement
      ch.sendToQueue(
        queueName,
        messageBuffer,
        options,
        (err: any, _ok: any) => {
          if (err !== null) {
            logger.error(
              `[RabbitMQ] Message NACKed or failed to publish message: ${err.message}`,
            );
            resolve(false);
          } else {
            logger.info(
              `[RabbitMQ] Message ACKed, message published to queue ${queueName} | size: ${messageBuffer.length} bytes`,
            );
            resolve(true);
          }
        },
      );
    });
  } catch (error: any) {
    logger.error(
      `[RabbitMQ] Failed to publish message to queue ${queueName}: ${error.message}`,
    );
    return false;
  }
}

// -- close the connection
export async function closeRabbitMQConnection(): Promise<void> {
  if (channel) {
    try {
      await channel.close();
      logger.info('[RabbitMQ] Channel closed');
    } catch (error: any) {
      logger.error('[RabbitMQ] Failed to close channel:', error.message);
    }
    channel = null; // clean up the channel reference
  }

  if (connection) {
    try {
      connection.removeAllListeners('error');
      connection.removeAllListeners('close');
      await connection.close();
      logger.info('[RabbitMQ] Connection closed');
    } catch (error: any) {
      logger.error('[RabbitMQ] Failed to close connection:', error.message);
    }
    connection = null; // clean up the connection reference
  }
}

// -- init the connection
export async function initRabbitMQConnection(): Promise<void> {
  await connectToRabbitMQ(1);
}
