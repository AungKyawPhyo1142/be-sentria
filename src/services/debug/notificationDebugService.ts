import { getRedisClient } from '@/libs/redisClient';
import { publishToQueue } from '@/libs/rabbitmqClient';
import { ENV } from '@/env';
import logger from '@/logger';

const USER_LOCATIONS_KEY = 'sentria:user_locations';
const NOTIFICATION_RADIUS_KM = 200;

// This function simulates what the usgsPoller does for a single earthquake event.
export async function triggerTestNotificationForLocation(quakeLat: number, quakeLon: number, quakeMagnitude: number, quakePlace: string) {
    logger.info(`[DebugNotiService] Triggering test notification for quake at ${quakeLat}, ${quakeLon}`);
    const redis = getRedisClient();

    // 1. Find nearby users using Redis GEORADIUS
    const nearbySocketIds = await redis.geoRadius(
        USER_LOCATIONS_KEY,
        { longitude: quakeLon, latitude: quakeLat },
        NOTIFICATION_RADIUS_KM,
        'km'
    );

    if (nearbySocketIds.length === 0) {
        const message = "[DebugNotiService] No active users found within the 200km radius.";
        logger.info(message);
        return { message, notifiedCount: 0 };
    }

    logger.info(`[DebugNotiService] Found ${nearbySocketIds.length} user(s) to notify.`);

    // 2. For each nearby user, publish a notification job to RabbitMQ
    for (const socketId of nearbySocketIds) {
        const notificationJobPayload = {
            socketId: socketId,
            eventName: 'earthquake_alert', // The event the frontend listens for
            data: {
                title: `Test Alert: M${quakeMagnitude.toFixed(1)} Earthquake`,
                body: `Location: ${quakePlace}`,
                magnitude: quakeMagnitude,
                latitude: quakeLat,
                longitude: quakeLon,
                time: new Date()
            },
        };

        await publishToQueue(ENV.RABBITMQ_NOTIFICATION_QUEUE_NAME, notificationJobPayload);
    }

    const message = `Successfully published ${nearbySocketIds.length} notification job(s).`;
    logger.info(message);
    return { message, notifiedCount: nearbySocketIds.length, notifiedSocketIds: nearbySocketIds };
}