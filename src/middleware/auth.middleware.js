const jwt = require('jsonwebtoken');
const { ErrorResponse } = require('./error.middleware');
const User = require('../models/user.model');

/**
 * Middleware to protect routes from unauthorized access
 * Verifies JWT token and adds user to request object
 */
const authenticate = async (req, res, next) => {
  let token;

  // Check if auth header exists and starts with Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Extract token from header
    token = req.headers.authorization.split(' ')[1];
  } 
  // If no token provided
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id from token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return next(new ErrorResponse('User no longer exists', 401));
    }

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

/**
 * Middleware to restrict access based on user role
 * @param {...String} roles - Roles allowed to access the route
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize
}; 