const { Client } = require('@googlemaps/google-maps-services-js');
const logger = require('../utils/logger');

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Check if Google Maps API key is configured
if (!process.env.GOOGLE_MAPS_API_KEY) {
  logger.warn('Google Maps API key is not set. Geocoding functionality will be limited to mock data.');
}

/**
 * Geocode using a Place ID from Google Places API
 * @param {string} placeId - The Google Place ID
 * @returns {Promise<Object>} The geocoded result with coordinates
 */
const geocodeByPlaceId = async (placeId) => {
  try {
    // Log the geocoding request
    logger.info(`Geocoding by Place ID: ${placeId}`);
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      logger.warn('No Google Maps API key found. Cannot geocode by Place ID.');
      throw new Error('Google Maps API key is required for Place ID geocoding');
    }

    const response = await googleMapsClient.geocode({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      logger.error(`Geocoding by Place ID failed: ${response.data.status}`);
      throw new Error(`Geocoding failed for Place ID: ${placeId}. Status: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const coordinates = result.geometry.location;
    
    logger.info(`Successfully geocoded Place ID. Result: ${result.formatted_address}`);
    
    return {
      address: result.formatted_address,
      placeId: placeId,
      coordinates: {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat] // MongoDB uses [longitude, latitude] format
      }
    };
  } catch (error) {
    logger.error(`Place ID geocoding error: ${error.message}`);
    throw error;
  }
};

/**
 * Geocode an address to get coordinates
 * @param {string|Object} address - The address to geocode or object with placeId
 * @returns {Promise<Object>} The geocoded result with coordinates
 */
const geocodeAddress = async (address) => {
  try {
    // If an object with placeId is provided, use that instead
    if (typeof address === 'object' && address.placeId) {
      logger.info(`Using Place ID for geocoding: ${address.placeId}`);
      return await geocodeByPlaceId(address.placeId);
    }
    
    // Log the geocoding request
    const addressString = typeof address === 'string' ? address : address.address;
    logger.info(`Geocoding address: ${addressString}`);
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      logger.warn('No Google Maps API key found. Using mock geocoding response.');
      return getMockGeocodingResponse(addressString);
    }

    const response = await googleMapsClient.geocode({
      params: {
        address: addressString,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      logger.error(`Geocoding failed: ${response.data.status} for address: ${addressString}`);
      throw new Error(`Geocoding failed for address: ${addressString}. Status: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const coordinates = result.geometry.location;
    
    logger.info(`Successfully geocoded address. Result: ${result.formatted_address}`);
    
    return {
      address: result.formatted_address,
      placeId: result.place_id,
      coordinates: {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat] // MongoDB uses [longitude, latitude] format
      }
    };
  } catch (error) {
    logger.error(`Geocoding error: ${error.message}`);
    // Return mock data as fallback
    logger.info('Using mock geocoding data as fallback');
    const addressString = typeof address === 'string' ? address : (address.address || 'Unknown');
    return getMockGeocodingResponse(addressString);
  }
};

/**
 * Get distance and duration between two points
 * @param {Object} origin - Origin coordinates { lat, lng } or object with placeId
 * @param {Object} destination - Destination coordinates { lat, lng } or object with placeId
 * @returns {Promise<Object>} The distance and duration information
 */
const getDistanceMatrix = async (origin, destination) => {
  try {
    logger.info(`Getting distance matrix between ${JSON.stringify(origin)} and ${JSON.stringify(destination)}`);
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      logger.warn('No Google Maps API key found. Using mock distance matrix response.');
      return getMockDistanceMatrix();
    }

    // Prepare origins and destinations - can use placeId if available
    const origins = origin.placeId ? { placeId: origin.placeId } : origin;
    const destinations = destination.placeId ? { placeId: destination.placeId } : destination;

    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [origins],
        destinations: [destinations],
        mode: 'driving',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status !== 'OK') {
      logger.error(`Distance Matrix API failed. Status: ${response.data.status}`);
      throw new Error(`Distance Matrix API failed. Status: ${response.data.status}`);
    }

    const result = response.data.rows[0].elements[0];
    
    if (result.status !== 'OK') {
      logger.error(`Cannot calculate distance. Status: ${result.status}`);
      throw new Error(`Cannot calculate distance. Status: ${result.status}`);
    }

    logger.info(`Successfully got distance: ${result.distance.text}, duration: ${result.duration.text}`);
    
    return {
      distance: {
        value: result.distance.value, // in meters
        text: result.distance.text
      },
      duration: {
        value: result.duration.value, // in seconds
        text: result.duration.text
      }
    };
  } catch (error) {
    logger.error(`Distance Matrix error: ${error.message}`);
    // Return mock data as fallback
    logger.info('Using mock distance matrix data as fallback');
    return getMockDistanceMatrix();
  }
};

/**
 * Get mock geocoding response for fallback
 * @param {string} address - Original address
 * @returns {Object} Mock geocoding response
 */
const getMockGeocodingResponse = (address) => {
  // Use different coordinates based on the address to simulate different locations
  const addressHash = address.length % 10; // Simple hash for demo
  const baseLat = 28.6139;
  const baseLng = 77.2090;
  
  return {
    address: address,
    coordinates: {
      type: 'Point',
      coordinates: [baseLng + (addressHash * 0.01), baseLat + (addressHash * 0.01)]
    }
  };
};

/**
 * Get mock distance matrix for fallback
 * @returns {Object} Mock distance matrix response
 */
const getMockDistanceMatrix = () => {
  const distance = 5 + (Math.random() * 10); // Random distance between 5-15 km
  const duration = distance * 3 * 60; // Approx 3 min per km
  
  return {
    distance: {
      value: distance * 1000, // Convert to meters
      text: `${distance.toFixed(1)} km`
    },
    duration: {
      value: duration,
      text: `${Math.round(duration / 60)} mins`
    }
  };
};

module.exports = {
  geocodeAddress,
  geocodeByPlaceId,
  getDistanceMatrix
}; 