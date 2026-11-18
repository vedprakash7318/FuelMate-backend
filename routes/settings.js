const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const { ownerOnly, employeeOrOwner } = require('../middleware/roleCheck');

router.get('/', auth, employeeOrOwner, settingsController.getSettings);
router.put('/', auth, ownerOnly, settingsController.updateSettings);

module.exports = router;
