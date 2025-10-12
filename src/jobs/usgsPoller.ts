import { ENV } from '@/env';
import prisma from '@/libs/prisma';
import {
  closeRabbitMQConnection,
  initRabbitMQConnection,
  publishToQueue,
} from '@/libs/rabbitmqClient';
import { getRedisClient, initRedisConnection } from '@/libs/redisClient';
import logger from '@/logger';
import axios from 'axios';
import cron from 'node-cron';

const USGS_PAST_HOUR_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const USER_LOCATIONS_KEY = 'sentria:user_locations'; // Must match the key used in locationService.ts
const PROCESSED_EVENT_KEY_PREFIX = 'earthquake:processed:';
const POLLING_INTERVAL_MINUTES = 1;
const NOTIFICATION_RADIUS_KM = 200;

interface UsgsFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [longitude, latitude, depth]
  };
}

interface UsgsFeatureCollection {
  features: UsgsFeature[];
}

async function checkForNewEarthquakes() {
  logger.info(`[USGSPoller] Starting a new polling cycle...`);
  try {
    const redis = getRedisClient();

    // fetch latest earthquake from usgs
    const response = await axios.get<UsgsFeatureCollection>(USGS_PAST_HOUR_URL);
    const earthquakes = response.data.features;

    if (!earthquakes || earthquakes.length === 0) {
      logger.info(`[USGSPoller] No recent earthquakes from last 1hr`);
      return;
    }

    logger.info(`[USGSPoller] Fetched ${earthquakes.length} events from USGS`);

    // loop through earthquakes and check if they are new`
    for (const earthquake of earthquakes) {
      const eventID: string = earthquake.id;
      const eventKey = `${PROCESSED_EVENT_KEY_PREFIX}${eventID}`;

      // check in redis
      const alreadyProcessed = await redis.get(eventKey);
      if (alreadyProcessed) {
        continue;
      }

      const props = earthquake.properties;
      const [lon, lat] = earthquake.geometry.coordinates;
      const magnitude = props.mag;

      logger.info(
        `[USGSPoller] Processing new event: M${magnitude} - ${props.place} - ${lon}/${lat}`,
      );

      // find nearby user using Redis GEORADIUS
      // GEORADIUS returns an array of memebers (in our case socketIDs) within the radius
      const nearbySocketIds = await redis.geoRadius(
        USER_LOCATIONS_KEY,
        { longitude: lon, latitude: lat },
        NOTIFICATION_RADIUS_KM,
        'km',
      );

      if (nearbySocketIds.length > 0) {
        logger.info(
          `[USGSPoller] Found ${nearbySocketIds.length} potentially affected user(s) nearby`,
        );
        // for nearby users, publish a notification job to rabbitMQ
        for (const socketId of nearbySocketIds) {
          // TODO: might need to add user-specific notification here, eg: when user only when EQ Mag > 5
          // for now we will notify everyone

          const notificationJobPayload = {
            socketId: socketId,
            eventName: 'earthquake_alert',
            data: {
              id: eventID,
              title: `Earthquake Alert: M${magnitude.toFixed(1)}`,
              body: props.place,
              url: props.url,
              magnitude: magnitude,
              latitude: lat,
              longitude: lon,
              time: new Date(props.time).toISOString(),
            },
          };

          const payloadAsString = JSON.stringify(notificationJobPayload);
          logger.info(
            `[USGSPoller] Publishing STRING payload to RabbitMQ: ${payloadAsString}`,
          );

          await publishToQueue(
            ENV.RABBITMQ_NOTIFICATION_QUEUE_NAME,
            notificationJobPayload,
          );
        }
      }
      // mark this event as processed in redis with a TTL (24hr) to prevent re-processing
      await redis.set(eventKey, 'processed', { EX: 24 * 60 * 60 });
    }
  } catch (error) {
    logger.error('[USGSPoller] Error during polling cycle: ', error);
  } finally {
    logger.info('[USGSPoller] Polling cycle finished');
  }
}

async function startPollingService() {
  logger.info(`[USGSPoller] Initializing service...`);
  try {
    // connect to all necessary services: Redis, rabbitMQ
    await initRedisConnection();
    await initRabbitMQConnection();
    logger.info(`[USGSPoller] Dependencies initialized...`);

    cron.schedule(
      `*/${POLLING_INTERVAL_MINUTES} * * * *`,
      checkForNewEarthquakes,
    );

    logger.info(
      `[USGSPoller] Severice started. CRON job scheduled to run every ${POLLING_INTERVAL_MINUTES} minute(s).`,
    );

    // run once immediately on startup or quick test
    logger.info(`[USGSPoller] Running initial check on startup...`);
    checkForNewEarthquakes();
  } catch (error) {
    logger.error(
      `[USGSPoller] CRITICAL: Failed to init dependencies. Poller will not start: `,
      error,
    );
    process.exit(1);
  }
}

// Handle graceful shutdown for this separate process
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`[USGSPoller] Received ${signal}. Shutting down...`);
    await closeRabbitMQConnection();
    const redis = getRedisClient();
    if (redis.isOpen) await redis.quit();
    await prisma.$disconnect();
    logger.info('[USGSPoller] All connections closed. Exiting.');
    process.exit(0);
  });
});

startPollingService();
