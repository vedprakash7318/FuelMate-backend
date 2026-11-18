const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

// GET /api/reports/daily
exports.getDailyReport = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const [fuelList, paymentList] = await Promise.all([
      FuelTransaction.find({ pumpId, status: 'active', createdAt: { $gte: start, $lte: end } })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 }),
      Payment.find({ pumpId, status: 'active', createdAt: { $gte: start, $lte: end } })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber')
        .populate('receivedBy', 'name')
        .sort({ createdAt: -1 }),
    ]);

    const totalFuelAmount = fuelList.reduce((sum, f) => sum + f.totalAmount, 0);
    const totalPetrolQty = fuelList.filter((f) => f.fuelType === 'Petrol').reduce((sum, f) => sum + f.quantity, 0);
    const totalDieselQty = fuelList.filter((f) => f.fuelType === 'Diesel').reduce((sum, f) => sum + f.quantity, 0);
    const totalPayment = paymentList.reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      success: true,
      date: start.toISOString().split('T')[0],
      summary: {
        totalFuelEntries: fuelList.length,
        totalFuelAmount: Math.round(totalFuelAmount * 100) / 100,
        totalPetrolQty: Math.round(totalPetrolQty * 100) / 100,
        totalDieselQty: Math.round(totalDieselQty * 100) / 100,
        totalPaymentsReceived: Math.round(totalPayment * 100) / 100,
      },
      fuelTransactions: fuelList,
      payments: paymentList,
    });
  } catch (err) {
    console.error('getDailyReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/reports/outstanding
exports.getOutstandingReport = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const owners = await Owner.find({ pumpId, totalOutstanding: { $gt: 0 } })
      .sort({ totalOutstanding: -1 });

    const totalOutstanding = owners.reduce((sum, o) => sum + o.totalOutstanding, 0);

    return res.json({
      success: true,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      count: owners.length,
      data: owners,
    });
  } catch (err) {
    console.error('getOutstandingReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/reports/custom
exports.getCustomRangeReport = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { startDate, endDate, fuelType } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const fuelQuery = { pumpId, status: 'active', createdAt: { $gte: start, $lte: end } };
    if (fuelType) fuelQuery.fuelType = fuelType;

    const [fuelList, paymentList] = await Promise.all([
      FuelTransaction.find(fuelQuery)
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 }),
      Payment.find({ pumpId, status: 'active', createdAt: { $gte: start, $lte: end } })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber')
        .populate('receivedBy', 'name')
        .sort({ createdAt: -1 }),
    ]);

    const totalFuelAmount = fuelList.reduce((sum, f) => sum + f.totalAmount, 0);
    const totalPayments = paymentList.reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      success: true,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      summary: {
        totalFuelAmount: Math.round(totalFuelAmount * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        fuelCount: fuelList.length,
        paymentCount: paymentList.length,
      },
      fuelTransactions: fuelList,
      payments: paymentList,
    });
  } catch (err) {
    console.error('getCustomRangeReport error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

