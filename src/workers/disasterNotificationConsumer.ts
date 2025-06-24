import { ENV } from "@/env"
import { emitDisasterNotificationToRoom } from "@/libs/socketManager"
import logger from "@/logger"
import { InternalServerError } from "@/utils/errors"
import amqp, { ChannelModel, Channel, ConsumeMessage } from "amqplib"
import { error } from "console"


export interface DisasterNotificationJobPayload {
    socketId: string,
    eventName: string,
    data: {
        id: string,
        title: string,
        body: string,
        url: string,
        magnitude: number,
        latitude: number,
        longitude: number,
        time: string
    }

}

let disasterNotificationConsumerConnection: ChannelModel | null = null
let disasterNotificationConsumerChannel: Channel | null = null
const MAX_CONSUMER_RETRIES = 5;
const CONSUMER_RETRY_DELAY = 5000;
let isDisasterNotificationConsumerStopping = false;


async function connectAndConsumeNotifications(attempt = 1): Promise<void> {
    if (isDisasterNotificationConsumerStopping) {
        logger.info(
            '[DisasterNotificationConsumer] Stopping, will not attempt to connect'
        )
        return
    }
    try {
        logger.info(
            `[DisasterNotificationConsumer] Attempting to connect to rabbtMQ (attempt: ${attempt})`
        )

        if (!ENV.RABBITMQ_URL) {
            throw new InternalServerError('RabbitMQ_URL is not set for disaster notification consumer')
        }

        disasterNotificationConsumerConnection = await amqp.connect(ENV.RABBITMQ_URL)

        disasterNotificationConsumerChannel = await disasterNotificationConsumerConnection.createChannel()
        logger.info(
            `[DisasterNotificationConsumer] Connected to RabbitMQ and channel created`
        )

        disasterNotificationConsumerConnection.on('error', (error: Error) => {
            logger.error('[DisasterNotificationConsumer] Connection error:', error.message); //
            if (disasterNotificationConsumerConnection)
                disasterNotificationConsumerConnection.removeAllListeners();
            disasterNotificationConsumerConnection = null;
            disasterNotificationConsumerChannel = null;
            if (!isDisasterNotificationConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
                setTimeout(
                    () => connectAndConsumeNotifications(attempt + 1),
                    CONSUMER_RETRY_DELAY * attempt,
                );
            } else if (!isDisasterNotificationConsumerStopping) {
                logger.error(
                    '[DisasterNotificationConsumer] Max retries reached for connection error.',
                ); //
            }
        })

        disasterNotificationConsumerConnection.on('close', () => {
            logger.warn(
                `[DisasterNotificationConsumer] Connection closed`
            )
            if (disasterNotificationConsumerConnection) {
                disasterNotificationConsumerConnection.removeAllListeners()
            }
            disasterNotificationConsumerConnection = null
            disasterNotificationConsumerChannel = null
            if (!isDisasterNotificationConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
                logger.info(
                    `[DisasterNotificationConsumer] Attempting to reconnect notification consumer...`
                )
                setTimeout(() => connectAndConsumeNotifications(attempt + 1), CONSUMER_RETRY_DELAY)
            } else if (!isDisasterNotificationConsumerStopping) {
                logger.error(
                    `[DisasterNotificationConsumer] Max retries reached after connection closed...`
                )
            }
        })

        const queueName = ENV.RABBITMQ_NOTIFICATION_QUEUE_NAME
        if (!disasterNotificationConsumerChannel) {
            throw new InternalServerError('Channel became null unexpectedly')
        }

        await disasterNotificationConsumerChannel.assertQueue(queueName, { durable: true })
        logger.info(
            `[DisasterNotificationConsumer] Queue '${queueName}' asserted...`
        )
        disasterNotificationConsumerChannel.prefetch(1)

        logger.info(
            `[DisasterNotificationConsumer] Starting to consume the notifications... `
        )

        disasterNotificationConsumerChannel.consume(
            queueName,
            async (msg: ConsumeMessage | null) => {
                if (msg) {
                    const deliveryTag = msg.fields.deliveryTag
                    let notiPlayload: DisasterNotificationJobPayload | null = null
                    try {
                        logger.info(
                            `[DisasterNotificationConsumer] Received diaster notification. DeliveryTag: ${deliveryTag}`
                        )
                        notiPlayload = JSON.parse(
                            msg.content.toString()
                        ) as DisasterNotificationJobPayload
                        logger.info(
                            `[DisasterNotificationConsumer] Parsed results for socketID: ${notiPlayload.socketId}, Lat/Lng: ${notiPlayload.data.latitude}/${notiPlayload.data.longitude} `
                        )
                        logger.info(
                            `[DisasterNotificationConsumer] Full payload: ${JSON.stringify(notiPlayload, null, 2)}`
                        )

                        // validate the esstential id (socketID)
                        if (!notiPlayload.socketId) {
                            logger.error(
                                `[DisasterNotificationConsumer] Received notification with missing socketID:`, error
                            )
                            disasterNotificationConsumerChannel?.nack(msg, false, false)
                            return
                        }
                        emitDisasterNotificationToRoom(notiPlayload.socketId, notiPlayload)
                        // const socket = getIOInstance()
                        // // emit it to the specific socketID
                        // socket?.to(notiPlayload.socketId).emit("earthquake_alert", notiPlayload)
                        disasterNotificationConsumerChannel?.ack(msg)
                        logger.info(
                            `[DisasterNotificationConsumer] Notification for socketID: ${notiPlayload.socketId} is emitted and Acked`
                        )


                    } catch (processingError: any) {
                        logger.error(
                            `[DisasterNotificationConsumer] Error processing fact-check result message (DeliveryTag ${deliveryTag}): ${processingError.message}`,
                            { error: processingError, payloadString: msg.content.toString() },
                        ); //
                        disasterNotificationConsumerChannel?.nack(msg, false, false); // Nack, don't requeue for persistent errors
                    }
                } else {
                    logger.warn(
                        '[DisasterNotificationConsumer] Received NULL message from queue, possibly channel/connection closed during consumption.',
                    ); //
                }
            },
            { noAck: false }
        )

    } catch (error: any) {
        logger.error(
            `[DisasterNotificationConsumer] Failed to connect/start consuming results queue: ${error.message}. Retrying...`,
            error,
        ); //
        if (disasterNotificationConsumerConnection) {
            // Attempt to clean up listeners on the potentially problematic connection
            try {
                disasterNotificationConsumerConnection.removeAllListeners();
            } catch (e) {
                /* ignore */
            }
        }
        disasterNotificationConsumerConnection = null;
        disasterNotificationConsumerChannel = null; // Ensure reset
        if (!isDisasterNotificationConsumerStopping && attempt < MAX_CONSUMER_RETRIES) {
            // Only retry if not intentionally stopping
            setTimeout(
                () => connectAndConsumeNotifications(attempt + 1),
                CONSUMER_RETRY_DELAY * attempt,
            );
        } else if (!isDisasterNotificationConsumerStopping) {
            logger.error(
                '[DisasterNotificationConsumer] Max retries for initial connection to results queue. Consumer will not start.',
            ); //
        }

    }
}

export async function startDiasterNotificationConsumer() {
    isDisasterNotificationConsumerStopping = false
    if (ENV.RABBITMQ_URL && ENV.RABBITMQ_NOTIFICATION_QUEUE_NAME) {
        logger.info(`[DiasterNotificationConsumer] Initializing consumer...`)
        await connectAndConsumeNotifications(1)
    } else {
        logger.warn(`[DiasterNotificationConsumer] RabbitMQ_URL or NotifcationQueueName is not configured. Consumer will NOT start...`)
    }
}

export async function stopDisasterNotificationConsumer() {
    isDisasterNotificationConsumerStopping = true
    logger.info(`[DiasterNotificationConsumer] Stopping consumer...`)

    const ch = disasterNotificationConsumerChannel
    const conn = disasterNotificationConsumerConnection

    disasterNotificationConsumerChannel = null
    disasterNotificationConsumerConnection = null

    if (ch) {
        try {
            await ch.close()
        } catch (e) {
            logger.error(`[DiasterNotificationConsumer] Erorr closing channel: `, error)
        }
    }
    if (conn) {
        try {
            conn.removeAllListeners()
            await conn.close()
        } catch (e) {
            logger.info(`[DiasterNotificationConsumer] Error closing connection:`, error)
        }
    }
    logger.info(`[DiasterNotificationConsumer] Consumer stopped and connections attempted to close`)
}