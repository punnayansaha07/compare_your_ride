const axios = require('axios');
const logger = require('../utils/logger');

// Ola API endpoints
const OLA_API_URL = 'https://devapi.olacabs.com/v1';

// Check if Ola API credentials are configured
const hasOlaCredentials = () => {
  return !!(process.env.OLA_API_KEY && process.env.OLA_USER_ID && process.env.OLA_PASSWORD);
};

/**
 * Authenticate with Ola API
 * @returns {Promise<string>} Auth token
 */
const getOlaAuthToken = async () => {
  try {
    if (!hasOlaCredentials()) {
      logger.warn('Ola API credentials missing. Authentication skipped.');
      throw new Error('Ola API credentials not configured');
    }

    const response = await axios.post(`${OLA_API_URL}/auth`, {
      userId: process.env.OLA_USER_ID,
      password: process.env.OLA_PASSWORD
    }, {
      headers: {
        'X-APP-TOKEN': process.env.OLA_API_KEY
      }
    });

    if (response.data.status !== 'SUCCESS') {
      throw new Error(`Ola auth failed: ${response.data.message}`);
    }

    return response.data.token;
  } catch (error) {
    logger.error(`Ola Auth error: ${error.message}`);
    throw new Error(`Failed to authenticate with Ola: ${error.message}`);
  }
};

/**
 * Get price estimates from Ola API
 * @param {Object} pickup - Pickup coordinates object
 * @param {Object} destination - Destination coordinates object
 * @returns {Promise<Object>} Price estimates for different Ola services
 */
const getOlaPriceEstimates = async (pickup, destination) => {
  try {
    logger.info('Getting Ola price estimates...');

    // Skip API call if credentials are missing
    if (!hasOlaCredentials()) {
      logger.warn('Ola API credentials missing. Using mock data.');
      return fallbackToMockData(pickup, destination, 'ola');
    }

    // Get Ola Auth token
    const token = await getOlaAuthToken();

    // Extract coordinates
    const [pickupLng, pickupLat] = pickup.coordinates.coordinates;
    const [destLng, destLat] = destination.coordinates.coordinates;

    // Make API request to Ola
    const response = await axios.get(`${OLA_API_URL}/products`, {
      headers: {
        'X-APP-TOKEN': process.env.OLA_API_KEY,
        'Authorization': `Bearer ${token}`
      },
      params: {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        drop_lat: destLat,
        drop_lng: destLng
      }
    });

    if (response.data.status !== 'SUCCESS') {
      throw new Error(`Ola API failed: ${response.data.message}`);
    }

    // Format the response
    const olaOptions = response.data.categories.map(category => {
      return category.products.map(product => ({
        name: product.name,
        price: product.fare.min_fare,
        currency: 'INR', // Ola typically uses INR
        eta: product.eta,
        distance: product.distance.value,
        surge_multiplier: product.surge_multiplier || 1.0,
        estimate: `₹${product.fare.min_fare} - ₹${product.fare.max_fare}`
      }));
    }).flat();

    logger.info(`Successfully retrieved ${olaOptions.length} Ola options`);

    return {
      service: 'ola',
      options: olaOptions
    };
  } catch (error) {
    logger.error(`Ola API error: ${error.message}`);
    
    // If we can't get real data, fall back to mock data
    logger.info('Falling back to mock Ola data');
    return fallbackToMockData(pickup, destination, 'ola');
  }
};

/**
 * Fallback to mock data when API calls fail
 * @param {Object} pickup - Pickup location
 * @param {Object} destination - Destination location
 * @param {string} service - Service name
 * @returns {Object} Mock data for the service
 */
const fallbackToMockData = (pickup, destination, service) => {
  logger.warn(`Using mock data for ${service} due to API failure or missing credentials`);
  
  // Calculate mock distance (simplified)
  const [pickupLng, pickupLat] = pickup.coordinates.coordinates;
  const [destLng, destLat] = destination.coordinates.coordinates;
  
  // Calculate rough distance using Haversine formula
  const distance = calculateDistance(pickupLat, pickupLng, destLat, destLng);
  
  return {
    service: 'ola',
    options: [
      {
        name: 'Ola Mini',
        price: (distance * 1.3 + 2).toFixed(2),
        currency: 'INR',
        eta: Math.floor(Math.random() * 10) + 2,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `₹${(distance * 1.3 + 2).toFixed(2)} - ₹${(distance * 1.3 + 10).toFixed(2)}`
      },
      {
        name: 'Ola Prime',
        price: (distance * 2 + 3.5).toFixed(2),
        currency: 'INR',
        eta: Math.floor(Math.random() * 12) + 3,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `₹${(distance * 2 + 3.5).toFixed(2)} - ₹${(distance * 2 + 15).toFixed(2)}`
      },
      {
        name: 'Ola SUV',
        price: (distance * 3.2 + 5).toFixed(2),
        currency: 'INR',
        eta: Math.floor(Math.random() * 18) + 5,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `₹${(distance * 3.2 + 5).toFixed(2)} - ₹${(distance * 3.2 + 20).toFixed(2)}`
      }
    ]
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

module.exports = {
  getOlaPriceEstimates
}; 