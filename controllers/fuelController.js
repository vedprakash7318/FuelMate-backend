const FuelTransaction = require('../models/FuelTransaction');
const FuelPrice = require('../models/FuelPrice');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const Payment = require('../models/Payment');
const { logAudit } = require('../middleware/auditLog');

// Helper to generate next Transaction ID (TXN-001)
const generateTxnId = async (pumpId) => {
  const lastTxn = await FuelTransaction.findOne({ pumpId }).sort({ createdAt: -1 });
  if (!lastTxn || !lastTxn.transactionId) return 'TXN-001';
  const match = lastTxn.transactionId.match(/TXN-(\d+)/);
  if (!match) return `TXN-${Date.now().toString().slice(-4)}`;
  const nextNum = parseInt(match[1], 10) + 1;
  return `TXN-${String(nextNum).padStart(3, '0')}`;
};

// POST /api/fuel - New fuel filling entry
exports.createFuelTransaction = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const {
      ownerId,
      vehicleId,
      fuelType,
      quantity,
      paymentType,
      amountReceived,
      paymentMode,
      transactionRef,
      remark,
    } = req.body;

    if (!ownerId || !vehicleId || !fuelType || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Owner, Vehicle, Fuel Type, and Quantity are required',
      });
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
    }

    // Verify Owner & Vehicle status
    const owner = await Owner.findOne({ _id: ownerId, pumpId });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });
    if (owner.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Selected Owner is inactive. Cannot record fuel filling.' });
    }

    const vehicle = await Vehicle.findOne({ _id: vehicleId, pumpId });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Selected Vehicle is inactive. Cannot record fuel filling.' });
    }

    // Fetch current price
    const latestPrice = await FuelPrice.findOne({ pumpId, fuelType }).sort({ effectiveFrom: -1 });
    const defaultPrice = fuelType === 'Petrol' ? 96.72 : 89.62;
    const pricePerLiter = latestPrice ? latestPrice.price : defaultPrice;

    const totalAmount = Math.round(numQty * pricePerLiter * 100) / 100;

    let received = 0;
    if (paymentType === 'Full Payment') {
      received = totalAmount;
    } else if (paymentType === 'Partial Payment') {
      received = Math.min(totalAmount, parseFloat(amountReceived) || 0);
    } else {
      received = 0; // Credit
    }
    received = Math.round(received * 100) / 100;
    const remainingAmount = Math.round((totalAmount - received) * 100) / 100;

    const transactionId = await generateTxnId(pumpId);

    const txn = await FuelTransaction.create({
      pumpId,
      transactionId,
      ownerId: owner._id,
      vehicleId: vehicle._id,
      fuelType,
      quantity: numQty,
      pricePerLiter,
      totalAmount,
      paymentType: paymentType || 'Credit',
      amountReceived: received,
      remainingAmount,
      paymentMode: received > 0 ? (paymentMode === 'UPI' ? 'UPI' : 'Cash') : undefined,
      transactionRef: (received > 0 && paymentMode === 'UPI' && transactionRef) ? transactionRef.trim() : undefined,
      remark: remark ? remark.trim() : undefined,
      status: 'active',
      createdBy: req.user.userId,
    });

    // Update Vehicle totals
    await Vehicle.findByIdAndUpdate(vehicle._id, {
      $inc: {
        totalFuelConsumed: numQty,
        totalFuelAmount: totalAmount,
        totalPayment: received,
        pendingBalance: remainingAmount,
      },
    });

    // Update Owner totals
    await Owner.findByIdAndUpdate(owner._id, {
      $inc: {
        totalFuelAmount: totalAmount,
        totalPayment: received,
        totalOutstanding: remainingAmount,
      },
    });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'FUEL_ENTRY',
      entity: 'FuelTransaction',
      entityId: txn._id,
      details: {
        transactionId: txn.transactionId,
        vehicleNumber: vehicle.vehicleNumber,
        fuelType,
        quantity: numQty,
        totalAmount,
        remainingAmount,
      },
      req,
    });

    const populated = await FuelTransaction.findById(txn._id)
      .populate('ownerId', 'name ownerId mobile')
      .populate('vehicleId', 'vehicleNumber vehicleName')
      .populate('createdBy', 'name username');

    return res.status(201).json({
      success: true,
      message: 'Fuel entry recorded successfully',
      data: populated,
    });
  } catch (err) {
    console.error('createFuelTransaction error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/fuel - List fuel transactions
exports.getFuelTransactions = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { ownerId, vehicleId, fuelType, paymentType, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = { pumpId };
    if (ownerId) query.ownerId = ownerId;
    if (vehicleId) query.vehicleId = vehicleId;
    if (fuelType) query.fuelType = fuelType;
    if (paymentType) query.paymentType = paymentType;
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

    const [transactions, total] = await Promise.all([
      FuelTransaction.find(query)
        .populate('ownerId', 'name ownerId mobile companyName')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('createdBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      FuelTransaction.countDocuments(query),
    ]);

    return res.json({
      success: true,
      count: transactions.length,
      total,
      data: transactions,
    });
  } catch (err) {
    console.error('getFuelTransactions error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/fuel/:id/cancel - Reverse/Cancel transaction (Owner only)
exports.cancelFuelTransaction = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const { reason } = req.body;

    const txn = await FuelTransaction.findOne({ _id: id, pumpId, status: 'active' });
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Active fuel transaction not found' });
    }

    txn.status = 'cancelled';
    txn.cancelledBy = req.user.userId;
    txn.cancelledAt = new Date();
    txn.cancelReason = reason || 'Cancelled by owner';
    await txn.save();

    // Revert Vehicle totals
    await Vehicle.findByIdAndUpdate(txn.vehicleId, {
      $inc: {
        totalFuelConsumed: -txn.quantity,
        totalFuelAmount: -txn.totalAmount,
        totalPayment: -txn.amountReceived,
        pendingBalance: -txn.remainingAmount,
      },
    });

    // Revert Owner totals
    await Owner.findByIdAndUpdate(txn.ownerId, {
      $inc: {
        totalFuelAmount: -txn.totalAmount,
        totalPayment: -txn.amountReceived,
        totalOutstanding: -txn.remainingAmount,
      },
    });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'CANCEL_FUEL_TRANSACTION',
      entity: 'FuelTransaction',
      entityId: txn._id,
      details: { transactionId: txn.transactionId, reason: txn.cancelReason },
      req,
    });

    return res.json({ success: true, message: 'Fuel transaction cancelled and balances reversed', data: txn });
  } catch (err) {
    console.error('cancelFuelTransaction error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

