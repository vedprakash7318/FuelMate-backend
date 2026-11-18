const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');
const { ownerOnly, employeeOrOwner } = require('../middleware/roleCheck');

router.get('/', auth, employeeOrOwner, (req, res) => {
  if (req.user.role === 'owner') {
    return dashboardController.getOwnerDashboard(req, res);
  }
  return dashboardController.getEmployeeDashboard(req, res);
});

router.get('/owner', auth, ownerOnly, dashboardController.getOwnerDashboard);
router.get('/employee', auth, employeeOrOwner, dashboardController.getEmployeeDashboard);

module.exports = router;
