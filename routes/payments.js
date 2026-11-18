const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const { ownerOnly, employeeOrOwner } = require('../middleware/roleCheck');

router.post('/', auth, employeeOrOwner, paymentController.createPayment);
router.get('/', auth, employeeOrOwner, paymentController.getPayments);
router.post('/:id/cancel', auth, ownerOnly, paymentController.cancelPayment);

module.exports = router;

