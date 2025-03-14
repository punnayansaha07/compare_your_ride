const express = require('express');
const { getUberAuthorizationUrl, handleUberCallback } = require('../services/uber.service');
const { authenticate } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @desc    Redirect user to Uber authorization page
 * @route   GET /api/uber-auth/login
 * @access  Private
 */
router.get('/login', authenticate, (req, res) => {
  try {
    // Generate the authorization URL
    const authUrl = getUberAuthorizationUrl();
    
    // Redirect the user to Uber's authorization page
    res.redirect(authUrl);
  } catch (error) {
    logger.error(`Error generating Uber auth URL: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Could not generate Uber authorization URL',
      error: error.message
    });
  }
});

/**
 * @desc    Handle Uber OAuth callback
 * @route   GET /api/uber-auth/callback
 * @access  Public
 */
router.get('/callback', async (req, res) => {
  try {
    // Extract the authorization code from the query parameters
    const { code, error } = req.query;
    
    // Handle error returned from Uber
    if (error) {
      logger.error(`Uber OAuth error: ${error}`);
      return res.redirect('/#profile?oauth_success=false&service=uber&error=' + encodeURIComponent(error));
    }
    
    // Validate the authorization code
    if (!code) {
      logger.error('No authorization code provided in callback');
      return res.redirect('/#profile?oauth_success=false&service=uber&error=no_code');
    }
    
    // Exchange the authorization code for an access token
    const tokenResponse = await handleUberCallback(code);
    
    // Log successful OAuth completion
    logger.info('Successfully authenticated with Uber API');
    
    // Redirect back to the profile page with success parameters
    res.redirect('/#profile?oauth_success=true&service=uber');
  } catch (error) {
    logger.error(`Error handling Uber callback: ${error.message}`);
    res.redirect('/#profile?oauth_success=false&service=uber&error=' + encodeURIComponent(error.message));
  }
});

module.exports = router; 