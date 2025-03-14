const axios = require('axios');
const logger = require('../utils/logger');
const querystring = require('querystring');

// Uber API endpoints
const UBER_API_URL = 'https://api.uber.com/v1.2';
const UBER_AUTH_URL = 'https://auth.uber.com/oauth/v2/authorize';
const UBER_TOKEN_URL = 'https://auth.uber.com/oauth/v2/token';

// Token cache (in a production app, you'd want to use Redis or another persistent storage)
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

// Check if Uber API credentials are configured
const hasUberCredentials = () => {
  return !!(process.env.UBER_CLIENT_ID && process.env.UBER_CLIENT_SECRET && process.env.UBER_REDIRECT_URI);
};

/**
 * Generate the authorization URL for Uber OAuth
 * @param {Array} scopes - Array of scopes to request
 * @returns {string} The authorization URL
 */
const getUberAuthorizationUrl = (scopes = ['profile', 'ride_widgets', 'price_estimates']) => {
  if (!hasUberCredentials()) {
    logger.warn('Uber API credentials missing. Cannot generate authorization URL.');
    throw new Error('Uber API credentials not configured');
  }

  const params = {
    client_id: process.env.UBER_CLIENT_ID,
    redirect_uri: process.env.UBER_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' ')
  };

  const authUrl = `${UBER_AUTH_URL}?${querystring.stringify(params)}`;
  logger.info(`Generated Uber authorization URL: ${authUrl}`);
  
  return authUrl;
};

/**
 * Exchange authorization code for access token
 * @param {string} authorizationCode - The authorization code from Uber
 * @returns {Promise<Object>} The token response
 */
const exchangeAuthorizationCode = async (authorizationCode) => {
  try {
    if (!hasUberCredentials()) {
      logger.warn('Uber API credentials missing. Cannot exchange authorization code.');
      throw new Error('Uber API credentials not configured');
    }

    logger.info('Exchanging authorization code for Uber access token...');
    
    const response = await axios.post(UBER_TOKEN_URL, querystring.stringify({
      client_id: process.env.UBER_CLIENT_ID,
      client_secret: process.env.UBER_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: process.env.UBER_REDIRECT_URI,
      code: authorizationCode
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Save the token to the cache
    saveTokenToCache(response.data);
    
    logger.info('Successfully obtained Uber access token');
    return response.data;
  } catch (error) {
    logger.error(`Uber token exchange error: ${error.message}`);
    throw new Error(`Failed to exchange authorization code: ${error.message}`);
  }
};

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<string>} The new access token
 */
const refreshAccessToken = async () => {
  try {
    if (!tokenCache.refreshToken) {
      logger.warn('No refresh token available.');
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing Uber access token...');
    
    const response = await axios.post(UBER_TOKEN_URL, querystring.stringify({
      client_id: process.env.UBER_CLIENT_ID,
      client_secret: process.env.UBER_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tokenCache.refreshToken
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Save the updated token to the cache
    saveTokenToCache(response.data);
    
    logger.info('Successfully refreshed Uber access token');
    return response.data.access_token;
  } catch (error) {
    logger.error(`Uber token refresh error: ${error.message}`);
    tokenCache = { accessToken: null, refreshToken: null, expiresAt: null };
    throw new Error(`Failed to refresh access token: ${error.message}`);
  }
};

/**
 * Save token response to cache
 * @param {Object} tokenResponse - The token response from Uber
 */
const saveTokenToCache = (tokenResponse) => {
  tokenCache.accessToken = tokenResponse.access_token;
  tokenCache.refreshToken = tokenResponse.refresh_token;
  
  // Calculate expiration time (subtract 5 minutes as buffer)
  const expiresInMs = (tokenResponse.expires_in - 300) * 1000;
  tokenCache.expiresAt = Date.now() + expiresInMs;
  
  logger.info(`Uber token saved to cache, expires in ${tokenResponse.expires_in} seconds`);
};

/**
 * Get a valid OAuth token for Uber API
 * @returns {Promise<string>} Valid access token
 */
const getUberAuthToken = async () => {
  try {
    // Check if we have a valid token in cache
    if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
      logger.info('Using cached Uber access token');
      return tokenCache.accessToken;
    }
    
    // If we have a refresh token, try to refresh the access token
    if (tokenCache.refreshToken) {
      logger.info('Access token expired, refreshing...');
      return await refreshAccessToken();
    }

    // For client credentials flow (no user context)
    if (hasUberCredentials()) {
      logger.info('Getting new Uber access token with client credentials...');
      
      const response = await axios.post(UBER_TOKEN_URL, querystring.stringify({
        client_id: process.env.UBER_CLIENT_ID,
        client_secret: process.env.UBER_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'price_estimates'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Save token (won't have refresh token in this flow)
      tokenCache.accessToken = response.data.access_token;
      const expiresInMs = (response.data.expires_in - 300) * 1000;
      tokenCache.expiresAt = Date.now() + expiresInMs;
      
      logger.info('Successfully obtained Uber access token via client credentials');
      return response.data.access_token;
    }

    logger.warn('Uber API credentials missing and no token available.');
    throw new Error('Unable to obtain Uber API token');
  } catch (error) {
    logger.error(`Uber Auth error: ${error.message}`);
    throw new Error(`Failed to authenticate with Uber: ${error.message}`);
  }
};

/**
 * Handle the OAuth callback from Uber
 * @param {string} code - Authorization code from Uber callback
 * @returns {Promise<Object>} Token response
 */
const handleUberCallback = async (code) => {
  try {
    return await exchangeAuthorizationCode(code);
  } catch (error) {
    logger.error(`Error handling Uber callback: ${error.message}`);
    throw error;
  }
};

/**
 * Get price estimates from Uber API
 * @param {Object} pickup - Pickup coordinates object
 * @param {Object} destination - Destination coordinates object
 * @returns {Promise<Object>} Price estimates for different Uber services
 */
const getUberPriceEstimates = async (pickup, destination) => {
  try {
    logger.info('Getting Uber price estimates...');

    // Skip API call if credentials are missing
    if (!hasUberCredentials() && !tokenCache.accessToken) {
      logger.warn('Uber API credentials missing and no cached token. Using mock data.');
      return fallbackToMockData(pickup, destination, 'uber');
    }

    // Get Uber OAuth token
    const token = await getUberAuthToken();

    // Extract coordinates
    const [pickupLng, pickupLat] = pickup.coordinates.coordinates;
    const [destLng, destLat] = destination.coordinates.coordinates;

    // Make API request to Uber
    const response = await axios.get(`${UBER_API_URL}/estimates/price`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'en_US',
        'Content-Type': 'application/json',
      },
      params: {
        start_latitude: pickupLat,
        start_longitude: pickupLng,
        end_latitude: destLat,
        end_longitude: destLng,
      },
    });

    // Format the response
    const uberOptions = response.data.prices.map(price => ({
      name: price.display_name,
      price: price.estimate,
      currency: price.currency_code,
      eta: price.duration / 60, // Convert seconds to minutes
      distance: price.distance,
      surge_multiplier: price.surge_multiplier,
      estimate: price.estimate,
    }));

    logger.info(`Successfully retrieved ${uberOptions.length} Uber options`);

    return {
      service: 'uber',
      options: uberOptions,
    };
  } catch (error) {
    logger.error(`Uber API error: ${error.message}`);
    
    // If we can't get real data, fall back to mock data
    logger.info('Falling back to mock Uber data');
    return fallbackToMockData(pickup, destination, 'uber');
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
    service: 'uber',
    options: [
      {
        name: 'UberX',
        price: `$${(distance * 1.5 + 2.5).toFixed(2)}`,
        currency: 'USD',
        eta: Math.floor(Math.random() * 10) + 1,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `$${(distance * 1.5 + 2.5).toFixed(2)} - $${(distance * 1.5 + 5).toFixed(2)}`
      },
      {
        name: 'UberXL',
        price: `$${(distance * 2.2 + 4).toFixed(2)}`,
        currency: 'USD',
        eta: Math.floor(Math.random() * 15) + 5,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `$${(distance * 2.2 + 4).toFixed(2)} - $${(distance * 2.2 + 8).toFixed(2)}`
      },
      {
        name: 'Uber Black',
        price: `$${(distance * 3.5 + 7).toFixed(2)}`,
        currency: 'USD',
        eta: Math.floor(Math.random() * 20) + 5,
        distance: distance.toFixed(2),
        surge_multiplier: 1.0,
        estimate: `$${(distance * 3.5 + 7).toFixed(2)} - $${(distance * 3.5 + 12).toFixed(2)}`
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
  getUberPriceEstimates,
  getUberAuthorizationUrl,
  handleUberCallback,
}; 