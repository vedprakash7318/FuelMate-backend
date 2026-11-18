const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const { ownerOnly } = require('../middleware/roleCheck');

// Reports are accessible by Owner
router.use(auth, ownerOnly);

router.get('/daily', reportController.getDailyReport);
router.get('/outstanding', reportController.getOutstandingReport);
router.get('/custom', reportController.getCustomRangeReport);

module.exports = router;
