const express = require('express');
const router = express.Router();
const fuelPriceController = require('../controllers/fuelPriceController');
const auth = require('../middleware/auth');
const { ownerOnly, employeeOrOwner } = require('../middleware/roleCheck');

// Both owner and employee can view current price
router.get('/current', auth, employeeOrOwner, fuelPriceController.getCurrentPrices);

// Only owner can set price and see price history
router.post('/', auth, ownerOnly, fuelPriceController.setFuelPrice);
router.get('/history', auth, ownerOnly, fuelPriceController.getPriceHistory);

module.exports = router;

