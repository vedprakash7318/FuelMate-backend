const express = require('express');
const router = express.Router();
const fuelController = require('../controllers/fuelController');
const auth = require('../middleware/auth');
const { ownerOnly, employeeOrOwner } = require('../middleware/roleCheck');

router.post('/', auth, employeeOrOwner, fuelController.createFuelTransaction);
router.get('/', auth, employeeOrOwner, fuelController.getFuelTransactions);
router.post('/:id/cancel', auth, ownerOnly, fuelController.cancelFuelTransaction);

module.exports = router;

