const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth.middleware');

// This will be implemented as needed
router.get('/profile', (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user
  });
});

// Admin routes
router.get('/', authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin route - will list all users'
  });
});

module.exports = router; 