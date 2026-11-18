const Payment = require('../models/Payment');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const { logAudit } = require('../middleware/auditLog');

// Helper to generate next Payment ID (PAY-001)
const generatePayId = async (pumpId) => {
  const lastPay = await Payment.findOne({ pumpId }).sort({ createdAt: -1 });
  if (!lastPay || !lastPay.paymentId) return 'PAY-001';
  const match = lastPay.paymentId.match(/PAY-(\d+)/);
  if (!match) return `PAY-${Date.now().toString().slice(-4)}`;
  const nextNum = parseInt(match[1], 10) + 1;
  return `PAY-${String(nextNum).padStart(3, '0')}`;
};

// POST /api/payments - Receive payment
exports.createPayment = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const {
      ownerId,
      adjustmentType,
      vehicleId,
      amount,
      paymentMode,
      transactionRef,
      remark,
    } = req.body;

    if (!ownerId || !amount) {
      return res.status(400).json({ success: false, message: 'Owner and Amount are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }

    const owner = await Owner.findOne({ _id: ownerId, pumpId });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    let vehicle = null;
    if (adjustmentType === 'vehicle') {
      if (!vehicleId) {
        return res.status(400).json({ success: false, message: 'Vehicle is required for vehicle-level payment' });
      }
      vehicle = await Vehicle.findOne({ _id: vehicleId, pumpId, ownerId: owner._id });
      if (!vehicle) {
        return res.status(404).json({ success: false, message: 'Vehicle not found under this owner' });
      }
    }

    const paymentId = await generatePayId(pumpId);

    const payment = await Payment.create({
      pumpId,
      paymentId,
      ownerId: owner._id,
      adjustmentType: adjustmentType || 'owner',
      vehicleId: vehicle ? vehicle._id : undefined,
      amount: Math.round(numAmount * 100) / 100,
      paymentMode: paymentMode || 'Cash',
      transactionRef: transactionRef ? transactionRef.trim() : undefined,
      remark: remark ? remark.trim() : undefined,
      status: 'active',
      receivedBy: req.user.userId,
    });

    // Update Owner totals
    await Owner.findByIdAndUpdate(owner._id, {
      $inc: {
        totalPayment: payment.amount,
        totalOutstanding: -payment.amount,
      },
    });

    // If Vehicle Level payment, also update vehicle balance
    if (vehicle) {
      await Vehicle.findByIdAndUpdate(vehicle._id, {
        $inc: {
          totalPayment: payment.amount,
          pendingBalance: -payment.amount,
        },
      });
    }

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'RECEIVE_PAYMENT',
      entity: 'Payment',
      entityId: payment._id,
      details: {
        paymentId: payment.paymentId,
        ownerName: owner.name,
        amount: payment.amount,
        adjustmentType: payment.adjustmentType,
        paymentMode: payment.paymentMode,
      },
      req,
    });

    const populated = await Payment.findById(payment._id)
      .populate('ownerId', 'name ownerId mobile')
      .populate('vehicleId', 'vehicleNumber vehicleName')
      .populate('receivedBy', 'name username');

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: populated,
    });
  } catch (err) {
    console.error('createPayment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/payments - List payments
exports.getPayments = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { ownerId, vehicleId, paymentMode, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = { pumpId };
    if (ownerId) query.ownerId = ownerId;
    if (vehicleId) query.vehicleId = vehicleId;
    if (paymentMode) query.paymentMode = paymentMode;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('ownerId', 'name ownerId mobile companyName')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('receivedBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Payment.countDocuments(query),
    ]);

    return res.json({
      success: true,
      count: payments.length,
      total,
      data: payments,
    });
  } catch (err) {
    console.error('getPayments error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/payments/:id/cancel - Reverse/Cancel payment (Owner only)
exports.cancelPayment = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findOne({ _id: id, pumpId, status: 'active' });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Active payment not found' });
    }

    payment.status = 'cancelled';
    payment.cancelledBy = req.user.userId;
    payment.cancelledAt = new Date();
    payment.cancelReason = reason || 'Cancelled by owner';
    await payment.save();

    // Revert Owner balances
    await Owner.findByIdAndUpdate(payment.ownerId, {
      $inc: {
        totalPayment: -payment.amount,
        totalOutstanding: payment.amount,
      },
    });

    // Revert Vehicle balance if applicable
    if (payment.vehicleId) {
      await Vehicle.findByIdAndUpdate(payment.vehicleId, {
        $inc: {
          totalPayment: -payment.amount,
          pendingBalance: payment.amount,
        },
      });
    }

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'CANCEL_PAYMENT',
      entity: 'Payment',
      entityId: payment._id,
      details: { paymentId: payment.paymentId, reason: payment.cancelReason },
      req,
    });

    return res.json({ success: true, message: 'Payment cancelled and balances adjusted', data: payment });
  } catch (err) {
    console.error('cancelPayment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

