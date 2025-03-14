const express = require('express');
const { 
  comparePrices, 
  getSearchHistory, 
  getSearchById 
} = require('../controllers/price.controller');

const router = express.Router();

router.post('/compare', comparePrices);
router.get('/history', getSearchHistory);
router.get('/history/:id', getSearchById);

module.exports = router; 