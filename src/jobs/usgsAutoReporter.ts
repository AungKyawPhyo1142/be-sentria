import { ENV } from '@/env';
import prisma from '@/libs/prisma';
import { connectToMongoDB, closeMongoDBConnection } from '@/libs/mongo';
import {
  closeRabbitMQConnection,
  initRabbitMQConnection,
} from '@/libs/rabbitmqClient';
import { getRedisClient, initRedisConnection } from '@/libs/redisClient';
import logger from '@/logger';
import {
  createDisasterReport,
  ValidatedDisasterPayload,
} from '@/services/disasterReports/disasterReports';
import axios from 'axios';
import cron from 'node-cron';
import { User } from '@prisma/client';

const USGS_SIGNIFICANT_EQ_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
const AUTO_REPORT_KEY_PREFIX = 'sentria:auto-report:';
const DEDUP_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const POLLING_INTERVAL_MINUTES = 10;
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';

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

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  display_name?: string;
}

function mapSeverity(magnitude: number): 'MINOR' | 'MODERATE' | 'SEVERE' {
  if (magnitude < 5.0) return 'MINOR';
  if (magnitude <= 6.0) return 'MODERATE';
  return 'SEVERE';
}

function buildDescription(
  mag: number,
  place: string,
  depthKm: number,
  time: number,
  url: string,
): string {
  const utcTime = new Date(time).toISOString();
  return (
    `A magnitude ${mag.toFixed(1)} earthquake was recorded ${place} at a depth of ${depthKm.toFixed(1)} km.\n` +
    `This event was detected at ${utcTime} by the USGS earthquake monitoring system.\n\n` +
    `Source: USGS (${url})`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse city/country from the USGS `place` string as a fallback.
 * Examples:
 *   "115 km ESE of Petropavlovsk-Kamchatsky, Russia" → { city: "Petropavlovsk-Kamchatsky", country: "Russia" }
 *   "South Sandwich Islands region" → { city: "South Sandwich Islands region", country: "South Sandwich Islands region" }
 */
function parseUsgsPlace(place: string): { city: string; country: string } {
  // Pattern: "X km DIR of City, Country"
  const ofMatch = place.match(/of\s+(.+),\s+(.+)$/);
  if (ofMatch) {
    return { city: ofMatch[1].trim(), country: ofMatch[2].trim() };
  }
  // Pattern: "City, Country" (no distance prefix)
  const commaMatch = place.match(/^(.+),\s+(.+)$/);
  if (commaMatch) {
    return { city: commaMatch[1].trim(), country: commaMatch[2].trim() };
  }
  // Fallback: use the entire place string for both
  return { city: place, country: place };
}

async function reverseGeocode(
  lat: number,
  lon: number,
  usgsPlace: string,
): Promise<{ city: string; country: string }> {
  const fallback = parseUsgsPlace(usgsPlace);

  try {
    const response = await axios.get<NominatimResponse>(NOMINATIM_BASE_URL, {
      params: {
        lat,
        lon,
        format: 'json',
      },
      headers: {
        'User-Agent': 'Sentria-DisasterPlatform/1.0 (system@sentria.app)',
      },
      timeout: 10000,
    });

    const address = response.data?.address;
    const city =
      address?.city ||
      address?.town ||
      address?.village ||
      address?.county ||
      address?.state ||
      fallback.city;
    const country = address?.country || fallback.country;

    return { city, country };
  } catch (error) {
    logger.warn(
      `[USGSAutoReporter] Nominatim reverse geocode failed for ${lat},${lon}, using USGS place fallback: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}

let systemBotUser: User | null = null;

async function getSystemBotUser(): Promise<User> {
  if (systemBotUser) return systemBotUser;

  const user = await prisma.user.findUnique({
    where: { email: ENV.SYSTEM_BOT_EMAIL },
  });

  if (!user) {
    throw new Error(
      `[USGSAutoReporter] System bot user not found for email: ${ENV.SYSTEM_BOT_EMAIL}. Ensure seed has run.`,
    );
  }

  systemBotUser = user;
  logger.info(
    `[USGSAutoReporter] System bot user loaded: ${user.id} (${user.email})`,
  );
  return user;
}

async function processNewEarthquakes() {
  logger.info(`[USGSAutoReporter] Starting a new polling cycle...`);
  try {
    const redis = getRedisClient();

    const response =
      await axios.get<UsgsFeatureCollection>(USGS_SIGNIFICANT_EQ_URL);
    const earthquakes = response.data.features;

    if (!earthquakes || earthquakes.length === 0) {
      logger.info(
        `[USGSAutoReporter] No M4.5+ earthquakes from last 24 hours`,
      );
      return;
    }

    logger.info(
      `[USGSAutoReporter] Fetched ${earthquakes.length} M4.5+ events from USGS`,
    );

    const botUser = await getSystemBotUser();
    let newReportsCreated = 0;

    for (const earthquake of earthquakes) {
      const eventId = earthquake.id;
      const eventKey = `${AUTO_REPORT_KEY_PREFIX}${eventId}`;

      const alreadyProcessed = await redis.get(eventKey);
      if (alreadyProcessed) {
        continue;
      }

      const props = earthquake.properties;
      const [lon, lat, depthKm] = earthquake.geometry.coordinates;
      const magnitude = props.mag;

      logger.info(
        `[USGSAutoReporter] Processing new event: M${magnitude.toFixed(1)} - ${props.place}`,
      );

      // Reverse geocode with Nominatim (1 req/sec rate limit), falls back to USGS place string
      const { city, country } = await reverseGeocode(lat, lon, props.place);
      await sleep(1000); // respect Nominatim rate limit

      const severity = mapSeverity(magnitude);
      const description = buildDescription(
        magnitude,
        props.place,
        depthKm,
        props.time,
        props.url,
      );
      const reportName = `M${magnitude.toFixed(1)} Earthquake - ${props.place}`;

      const payload: ValidatedDisasterPayload = {
        reportName,
        description,
        incidentType: 'EARTHQUAKE',
        severity,
        incidentTimestamp: new Date(props.time),
        location: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        country,
        city,
        media: [],
      };

      try {
        await createDisasterReport(payload, reportName, botUser);
        logger.info(
          `[USGSAutoReporter] Successfully created report for event ${eventId}: ${reportName}`,
        );
        newReportsCreated++;
      } catch (reportError) {
        logger.error(
          `[USGSAutoReporter] Failed to create report for event ${eventId}: ${reportError instanceof Error ? reportError.message : String(reportError)}`,
        );
      }

      // Mark as processed regardless of report creation success to avoid retrying bad data
      await redis.set(eventKey, 'processed', { EX: DEDUP_TTL_SECONDS });
    }

    if (newReportsCreated > 0) {
      logger.info(
        `[USGSAutoReporter] Created ${newReportsCreated} new disaster report(s) this cycle`,
      );
    }
  } catch (error) {
    logger.error(
      '[USGSAutoReporter] Error during polling cycle: ',
      error,
    );
  } finally {
    logger.info('[USGSAutoReporter] Polling cycle finished');
  }
}

async function startAutoReporterService() {
  logger.info(`[USGSAutoReporter] Initializing service...`);
  try {
    await initRedisConnection();
    await initRabbitMQConnection();
    await connectToMongoDB();
    logger.info(`[USGSAutoReporter] Dependencies initialized...`);

    cron.schedule(
      `*/${POLLING_INTERVAL_MINUTES} * * * *`,
      processNewEarthquakes,
    );

    logger.info(
      `[USGSAutoReporter] Service started. CRON job scheduled to run every ${POLLING_INTERVAL_MINUTES} minute(s).`,
    );

    // Run once immediately on startup
    logger.info(`[USGSAutoReporter] Running initial check on startup...`);
    processNewEarthquakes();
  } catch (error) {
    logger.error(
      `[USGSAutoReporter] CRITICAL: Failed to init dependencies. Service will not start: `,
      error,
    );
    process.exit(1);
  }
}

// Handle graceful shutdown for this separate process
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`[USGSAutoReporter] Received ${signal}. Shutting down...`);
    await closeRabbitMQConnection();
    const redis = getRedisClient();
    if (redis.isOpen) await redis.quit();
    await closeMongoDBConnection();
    await prisma.$disconnect();
    logger.info('[USGSAutoReporter] All connections closed. Exiting.');
    process.exit(0);
  });
});

startAutoReporterService();
