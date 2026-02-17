import logger from '@/logger';
import { NotFoundError } from '@/utils/errors';
import axios from 'axios';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';

export async function getLocationDetails(lat: number, lng: number) {
  try {
    logger.info(
      `[LocationService] Performing reverse geocoding for lat: ${lat}, lng: ${lng}`,
    );
    const response = await axios.get(NOMINATIM_BASE_URL, {
      params: {
        format: 'json',
        lat: lat,
        lon: lng,
        'accept-language': 'en',
      },
      headers: {
        'User-Agent':
          'SentriaDisasterPlatform/1.0 (sentria.platform@gmail.com)',
      },
    });

    const { address } = response.data;
    if (!address) {
      throw new NotFoundError(
        'Could not determine the location details for the given coordinates',
      );
    }

    const city = address.city || address.town || address.village || 'Unknown';
    const country = address.country || 'Unknown';

    const locationDetails = {
      lat,
      lng,
      city,
      country,
    };

    logger.info(
      `[LocationService] Successfully performed reverse geocoding for lat: ${lat}, lng: ${lng}`,
    );
    return locationDetails;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;

    logger.info(
      `[LocationService] Error performing reverse geocoding for lat: ${lat}, lng: ${lng}`,
    );
    throw new Error('Error performing reverse geocoding: ');
  }
}
