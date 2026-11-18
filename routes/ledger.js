const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');
const auth = require('../middleware/auth');
const { employeeOrOwner } = require('../middleware/roleCheck');

router.use(auth, employeeOrOwner);

router.get('/owner/:ownerId', ledgerController.getOwnerLedger);
router.get('/vehicle/:vehicleId', ledgerController.getVehicleLedger);

module.exports = router;
