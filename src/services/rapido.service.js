const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Rapido API endpoints
const RAPIDO_API_URL = 'https://rapidoapi.com/api/v1';

// Check if Rapido API credentials are configured
const hasRapidoCredentials = () => {
  return !!(process.env.RAPIDO_API_KEY && process.env.RAPIDO_API_SECRET);
};

/**
 * Generate signature for Rapido API
 * @param {Object} data - The payload data
 * @returns {string} The generated signature
 */
const generateRapidoSignature = (data) => {
  if (!process.env.RAPIDO_API_SECRET) {
    logger.warn('Rapido API secret is missing. Cannot generate signature.');
    return 'mock-signature';
  }
  
  const payload = JSON.stringify(data);
  return crypto
    .createHmac('sha256', process.env.RAPIDO_API_SECRET)
    .update(payload)
    .digest('hex');
};

/**
 * Get price estimates from Rapido API
 * @param {Object} pickup - Pickup coordinates object
 * @param {Object} destination - Destination coordinates object
 * @returns {Promise<Object>} Price estimates for different Rapido services
 */
const getRapidoPriceEstimates = async (pickup, destination) => {
  try {
    logger.info('Getting Rapido price estimates...');

    // Skip API call if credentials are missing
    if (!hasRapidoCredentials()) {
      logger.warn('Rapido API credentials missing. Using mock data.');
      return fallbackToMockData(pickup, destination, 'rapido');
    }

    // Extract coordinates
    const [pickupLng, pickupLat] = pickup.coordinates.coordinates;
    const [destLng, destLat] = destination.coordinates.coordinates;

    // Prepare request data
    const requestData = {
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      drop_lat: destLat,
      drop_lng: destLng,
      timestamp: Date.now()
    };

    // Generate signature
    const signature = generateRapidoSignature(requestData);

    // Make API request to Rapido
    const response = await axios.post(`${RAPIDO_API_URL}/estimate-fare`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.RAPIDO_API_KEY,
        'X-SIGNATURE': signature
      }
    });

    if (!response.data.success) {
      throw new Error(`Rapido API failed: ${response.data.message}`);
    }

    // Format the response
    const rapidoOptions = response.data.services.map(service => ({
      name: service.name,
      price: service.estimated_fare,
      currency: 'INR', // Rapido typically uses INR
      eta: service.eta_mins,
      distance: service.distance_km,
      surge_multiplier: service.surge_multiplier || 1.0,
      estimate: `₹${service.min_fare} - ₹${service.max_fare}`
    }));

    logger.info(`Successfully retrieved ${rapidoOptions.length} Rapido options`);

    return {
      service: 'rapido',
      options: rapidoOptions
    };
  } catch (error) {
    logger.error(`Rapido API error: ${error.message}`);
    
    // If we can't get real data, fall back to mock data
    logger.info('Falling back to mock Rapido data');
    return fallbackToMockData(pickup, destination, 'rapido');
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
    service: 'rapido',
    options: [
      {
        name: 'Rapido Bike',
        price: (distance * 0.8 + 1).toFixed(2),
        currency: 'INR',
        eta: Math.floor(Math.random() * 5) + 1,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `₹${(distance * 0.8 + 1).toFixed(2)} - ₹${(distance * 0.8 + 5).toFixed(2)}`
      },
      {
        name: 'Rapido Auto',
        price: (distance * 1.2 + 1.5).toFixed(2),
        currency: 'INR',
        eta: Math.floor(Math.random() * 8) + 2,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `₹${(distance * 1.2 + 1.5).toFixed(2)} - ₹${(distance * 1.2 + 8).toFixed(2)}`
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
  getRapidoPriceEstimates
}; 