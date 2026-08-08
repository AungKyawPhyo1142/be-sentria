import axios from 'axios';
import prisma from '@/libs/prisma';
import {
  createDisasterReport,
  ValidatedDisasterPayload,
} from '@/services/disasterReports/disasterReports';
import { DISASTER_INCIDENT_TYPE } from '@/types/reports';
import { User } from '@prisma/client';

export interface DisasterLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

// --- ReliefWeb API types ---
interface ReliefWebDisaster {
  fields: {
    name: string;
    description?: string;
    type?: Array<{ name: string }>;
    country?: Array<{ name: string }>;
    date?: { created: string };
    glide?: string;
  };
}

interface ReliefWebResponse {
  data: ReliefWebDisaster[];
}

// --- NASA EONET types ---
interface EONETEvent {
  title: string;
  description?: string | null;
  categories: Array<{ title: string }>;
  geometry: Array<{ coordinates: [number, number]; date: string }>;
}

interface EONETResponse {
  events: EONETEvent[];
}

function mapDisasterType(typeStr: string): DISASTER_INCIDENT_TYPE {
  const normalized = typeStr.toLowerCase();
  if (normalized.includes('earthquake')) return 'EARTHQUAKE';
  if (normalized.includes('flood')) return 'FLOOD';
  if (
    normalized.includes('cyclone') ||
    normalized.includes('storm') ||
    normalized.includes('hurricane') ||
    normalized.includes('typhoon')
  )
    return 'STORM';
  if (
    normalized.includes('wildfire') ||
    normalized.includes('fire') ||
    normalized.includes('volcano')
  )
    return 'FIRE';
  return 'OTHER';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeQuery(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const { data } = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { format: 'json', q: query, limit: 1 },
        headers: { 'User-Agent': 'Sentria/1.0 (system@sentria.app)' },
      },
    );
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ city: string; country: string }> {
  try {
    const { data } = await axios.get(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: { format: 'json', lat, lon: lng, zoom: 10 },
        headers: { 'User-Agent': 'Sentria/1.0 (system@sentria.app)' },
      },
    );
    const address = data.address || {};
    return {
      city:
        address.city ||
        address.town ||
        address.village ||
        address.state ||
        'Unknown',
      country: address.country || 'Unknown',
    };
  } catch {
    return { city: 'Unknown', country: 'Unknown' };
  }
}

async function reportExists(name: string): Promise<boolean> {
  const existing = await prisma.report.findFirst({ where: { name } });
  return existing !== null;
}

export async function seedDisasterReports(
  systemUser: User,
): Promise<DisasterLocation[]> {
  console.log('--- Seeding Disaster Reports ---');
  const locations: DisasterLocation[] = [];

  // --- Fetch from ReliefWeb ---
  let reliefWebDisasters: ReliefWebDisaster[] = [];
  try {
    console.log('  Fetching from ReliefWeb API...');
    const { data } = await axios.get<ReliefWebResponse>(
      'https://api.reliefweb.int/v1/disasters',
      {
        params: {
          appname: 'sentria',
          limit: 10,
          'filter[field]': 'status',
          'filter[value]': 'current',
          'sort[]': 'date:desc',
          'fields[include][]': [
            'name',
            'description',
            'type',
            'country',
            'date',
            'glide',
          ],
        },
      },
    );
    reliefWebDisasters = data.data || [];
    console.log(
      `  Fetched ${reliefWebDisasters.length} disasters from ReliefWeb`,
    );
  } catch (error) {
    console.error('  Failed to fetch from ReliefWeb:', error);
  }

  // --- Fetch from NASA EONET ---
  let eonetEvents: EONETEvent[] = [];
  try {
    console.log('  Fetching from NASA EONET API...');
    const { data } = await axios.get<EONETResponse>(
      'https://eonet.gsfc.nasa.gov/api/v3/events',
      { params: { status: 'open', limit: 5 } },
    );
    eonetEvents = data.events || [];
    console.log(`  Fetched ${eonetEvents.length} events from NASA EONET`);
  } catch (error) {
    console.error('  Failed to fetch from NASA EONET:', error);
  }

  // --- Process ReliefWeb disasters ---
  for (const disaster of reliefWebDisasters) {
    const name = disaster.fields.name;

    if (await reportExists(name)) {
      console.log(`  Skipping "${name}" - already exists`);
      continue;
    }

    const typeStr = disaster.fields.type?.[0]?.name || 'Other';
    const incidentType = mapDisasterType(typeStr);
    const countryName = disaster.fields.country?.[0]?.name || 'Unknown';
    const dateStr = disaster.fields.date?.created || new Date().toISOString();
    const rawDescription = disaster.fields.description || '';
    const description =
      rawDescription.length >= 10
        ? rawDescription.substring(0, 5000)
        : `${name} - ${typeStr} disaster reported in ${countryName}. Ongoing situation requiring monitoring and response.`;

    let lat = 0;
    let lng = 0;
    let city = countryName;

    // Geocode country name to get approximate coordinates
    const geoResult = await geocodeQuery(countryName);
    if (geoResult) {
      lat = geoResult.lat;
      lng = geoResult.lng;
      await delay(1100); // Nominatim rate limit: 1 req/sec
      const reverseResult = await reverseGeocode(lat, lng);
      city = reverseResult.city;
    }
    await delay(1100);

    const payload: ValidatedDisasterPayload = {
      reportName: name,
      description,
      incidentType,
      severity: 'MODERATE',
      incidentTimestamp: new Date(dateStr),
      location: { type: 'Point', coordinates: [lng, lat] },
      country: countryName,
      city,
      media: [],
    };

    try {
      console.log(`  Creating report: "${name}"`);
      await createDisasterReport(payload, name, systemUser);
      locations.push({ latitude: lat, longitude: lng, city, country: countryName });
    } catch (error) {
      console.error(`  Failed to create report "${name}":`, error);
    }
  }

  // --- Process EONET events ---
  for (const event of eonetEvents) {
    const name = event.title;

    if (await reportExists(name)) {
      console.log(`  Skipping EONET "${name}" - already exists`);
      continue;
    }

    const categoryTitle = event.categories?.[0]?.title || 'Other';
    const incidentType = mapDisasterType(categoryTitle);
    const geometry = event.geometry?.[0];

    if (!geometry) {
      console.warn(`  Skipping EONET "${name}" - no geometry data`);
      continue;
    }

    const [lng, lat] = geometry.coordinates;
    const dateStr = geometry.date || new Date().toISOString();

    let city = 'Unknown';
    let country = 'Unknown';
    try {
      await delay(1100);
      const result = await reverseGeocode(lat, lng);
      city = result.city;
      country = result.country;
    } catch {
      console.warn(`  Could not reverse geocode for "${name}"`);
    }

    const description =
      event.description && event.description.length >= 10
        ? event.description.substring(0, 5000)
        : `${name} - ${categoryTitle} event detected by NASA EONET near ${city}, ${country}. Active monitoring in progress.`;

    const payload: ValidatedDisasterPayload = {
      reportName: name,
      description,
      incidentType,
      severity: 'MODERATE',
      incidentTimestamp: new Date(dateStr),
      location: { type: 'Point', coordinates: [lng, lat] },
      country,
      city,
      media: [],
    };

    try {
      console.log(`  Creating EONET report: "${name}"`);
      await createDisasterReport(payload, name, systemUser);
      locations.push({ latitude: lat, longitude: lng, city, country });
    } catch (error) {
      console.error(`  Failed to create EONET report "${name}":`, error);
    }
  }

  console.log(`  Created ${locations.length} disaster reports\n`);
  return locations;
}
