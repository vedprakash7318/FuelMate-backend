const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const auth = require('../middleware/auth');
const { employeeOrOwner } = require('../middleware/roleCheck');

router.use(auth, employeeOrOwner);

router.get('/', ownerController.getOwners);
router.post('/', ownerController.createOwner);
router.get('/:id', ownerController.getOwnerById);
router.put('/:id', ownerController.updateOwner);
router.get('/:id/vehicles', ownerController.getOwnerVehicles);

module.exports = router;

