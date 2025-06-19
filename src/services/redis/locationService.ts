import { getRedisClient } from "@/libs/redisClient"
import logger from "@/logger"

const USER_LOCATIONS_KEY = 'sentria:user_locations' // key for geoindexing in Redis

/*
    * Add or update the user's locations in Redis geospatial index
    * @param socketId the uniqueID of the user's socket connection
    * @param longitude user's longitude
    * @param latitude user's latitude
*/

export async function updateUserLocation(socketId: string, longitude: number, latitude: number): Promise<void> {
    try {

        const redis = getRedisClient()
        await redis.geoAdd(USER_LOCATIONS_KEY, {
            longitude: longitude,
            latitude: latitude,
            member: socketId
        })

        logger.info(`[LocationService] Updated location for socketID: ${socketId}`)

    } catch (error) {
        logger.error(`[LocationService] Error updating user location for socketID: ${socketId}: `, error)
    }
}

export async function removeUserLocation(socketId: string): Promise<void> {
    try {
        const redis = getRedisClient()
        await redis.zRem(USER_LOCATIONS_KEY, socketId); // GEO commands use sorted sets under the hood
        logger.info(`[LocationService] Removed location for disconnected socketID: ${socketId}`)
    } catch (error) {
        logger.error(`[LocationService] Error removing user location for socketID: ${socketId}: `, error)
    }
}