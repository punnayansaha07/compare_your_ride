const { geocodeAddress, getDistanceMatrix } = require('./geocoding.service');
const { getUberPriceEstimates } = require('./uber.service');
const { getOlaPriceEstimates } = require('./ola.service');
const { getRapidoPriceEstimates } = require('./rapido.service');
const logger = require('../utils/logger');

/**
 * Compare prices across all ride services
 * @param {Object} rawPickup - Raw pickup data (address string or coordinates)
 * @param {Object} rawDestination - Raw destination data (address string or coordinates)
 * @returns {Promise<Object>} Aggregated price comparison data
 */
const compareAllPrices = async (rawPickup, rawDestination) => {
  try {
    // Process the pickup and destination data
    const pickup = await processLocation(rawPickup);
    const destination = await processLocation(rawDestination);

    // Fetch the distance and duration information
    const pickupLatLng = {
      lat: pickup.coordinates.coordinates[1],
      lng: pickup.coordinates.coordinates[0]
    };
    
    const destinationLatLng = {
      lat: destination.coordinates.coordinates[1],
      lng: destination.coordinates.coordinates[0]
    };
    
    const distanceMatrix = await getDistanceMatrix(pickupLatLng, destinationLatLng);
    
    // Add distance info to the locations
    pickup.distanceInfo = distanceMatrix;
    destination.distanceInfo = distanceMatrix;

    // Fetch prices from all services in parallel
    const [uberPrices, olaPrices, rapidoPrices] = await Promise.all([
      getUberPriceEstimates(pickup, destination),
      getOlaPriceEstimates(pickup, destination),
      getRapidoPriceEstimates(pickup, destination)
    ]);

    return {
      pickup,
      destination,
      distanceInfo: distanceMatrix,
      results: {
        uber: uberPrices,
        ola: olaPrices,
        rapido: rapidoPrices
      }
    };
  } catch (error) {
    logger.error(`Price comparison error: ${error.message}`);
    throw error;
  }
};

/**
 * Process location data (handle either address string or coordinates or Google Places data)
 * @param {Object|string} locationData - Location data
 * @returns {Promise<Object>} Processed location with coordinates
 */
const processLocation = async (locationData) => {
  // If it's just a string address, geocode it
  if (typeof locationData === 'string') {
    return await geocodeAddress(locationData);
  }
  
  // If it's Google Places data with placeId, use that format
  if (locationData.placeId) {
    return {
      address: locationData.address || 'Unknown Location',
      placeId: locationData.placeId,
      name: locationData.name,
      coordinates: {
        type: 'Point',
        coordinates: [
          locationData.coordinates.lng, // MongoDB uses [longitude, latitude]
          locationData.coordinates.lat
        ]
      }
    };
  }
  
  // If it has an address but no coordinates, geocode it
  if (locationData.address && !locationData.coordinates) {
    return await geocodeAddress(locationData.address);
  }
  
  // If it already has coordinates, make sure they're in the right format
  if (locationData.coordinates) {
    // If coordinates are [lat, lng] format, convert to [lng, lat] for MongoDB
    if (Array.isArray(locationData.coordinates) && locationData.coordinates.length === 2) {
      return {
        address: locationData.address || 'Unknown Location',
        coordinates: {
          type: 'Point',
          coordinates: [
            locationData.coordinates[1], // lng
            locationData.coordinates[0]  // lat
          ]
        }
      };
    }
    
    // If it has lat/lng properties
    if (locationData.coordinates.lat && locationData.coordinates.lng) {
      return {
        address: locationData.address || 'Unknown Location',
        coordinates: {
          type: 'Point',
          coordinates: [
            locationData.coordinates.lng,
            locationData.coordinates.lat
          ]
        }
      };
    }
    
    // If it's already in GeoJSON format, return as is
    if (locationData.coordinates.type === 'Point' && 
        Array.isArray(locationData.coordinates.coordinates) && 
        locationData.coordinates.coordinates.length === 2) {
      return locationData;
    }
  }
  
  throw new Error('Invalid location data format');
};

module.exports = {
  compareAllPrices
}; 