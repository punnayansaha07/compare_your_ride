const SearchHistory = require('../models/searchHistory.model');
const { ErrorResponse } = require('../middleware/error.middleware');
const logger = require('../utils/logger');
const { compareAllPrices } = require('../services/price-comparison.service');

/**
 * @desc    Compare prices between ride services
 * @route   POST /api/prices/compare
 * @access  Private
 */
exports.comparePrices = async (req, res, next) => {
  try {
    const { pickup, destination } = req.body;

    // Validate request body
    if (!pickup || !destination) {
      return next(new ErrorResponse('Please provide pickup and destination locations', 400));
    }

    // Use our price comparison service
    const comparisonResults = await compareAllPrices(pickup, destination);

    // Try to save search to history
    try {
      await SearchHistory.create({
        user: req.user.id,
        pickup: comparisonResults.pickup,
        destination: comparisonResults.destination,
        results: comparisonResults.results
      });
      logger.info(`Search history saved for user ${req.user.id}`);
    } catch (dbError) {
      // Log the error but continue with the response
      logger.error(`Failed to save search history: ${dbError.message}`);
    }

    res.status(200).json({
      success: true,
      data: {
        distanceInfo: comparisonResults.distanceInfo,
        ...comparisonResults.results
      }
    });
  } catch (err) {
    logger.error(`Price comparison error: ${err.message}`);
    next(err);
  }
};

/**
 * @desc    Get user's search history
 * @route   GET /api/prices/history
 * @access  Private
 */
exports.getSearchHistory = async (req, res, next) => {
  try {
    logger.info(`Fetching search history for user ${req.user.id}`);
    const history = await SearchHistory.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    logger.error(`Error fetching search history: ${err.message}`);
    // Return empty history instead of error
    res.status(200).json({
      success: true,
      count: 0,
      data: [],
      message: "Could not retrieve search history"
    });
  }
};

/**
 * @desc    Get single search result
 * @route   GET /api/prices/history/:id
 * @access  Private
 */
exports.getSearchById = async (req, res, next) => {
  try {
    logger.info(`Fetching search history item with id ${req.params.id}`);
    const search = await SearchHistory.findById(req.params.id);

    if (!search) {
      return next(new ErrorResponse(`Search not found with id ${req.params.id}`, 404));
    }

    // Check if search belongs to user
    if (search.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to access this search', 401));
    }

    res.status(200).json({
      success: true,
      data: search
    });
  } catch (err) {
    logger.error(`Error fetching search by ID: ${err.message}`);
    next(err);
  }
}; 