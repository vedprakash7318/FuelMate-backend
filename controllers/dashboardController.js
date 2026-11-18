const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const AuditLog = require('../models/AuditLog');

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// GET /api/dashboard/owner
exports.getOwnerDashboard = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { start, end } = getTodayRange();

    const [
      totalOwners,
      totalVehicles,
      todayFuelSalesAgg,
      todayPaymentAgg,
      outstandingAgg,
      petrolSalesAgg,
      dieselSalesAgg,
      totalFuelQtyAgg,
      recentFuelTransactions,
      recentPayments,
      topPendingOwners,
    ] = await Promise.all([
      Owner.countDocuments({ pumpId }),
      Vehicle.countDocuments({ pumpId }),
      FuelTransaction.aggregate([
        { $match: { pumpId, status: 'active', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Payment.aggregate([
        { $match: { pumpId, status: 'active', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Owner.aggregate([
        { $match: { pumpId } },
        { $group: { _id: null, total: { $sum: '$totalOutstanding' } } },
      ]),
      FuelTransaction.aggregate([
        { $match: { pumpId, status: 'active', fuelType: 'Petrol' } },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, totalQty: { $sum: '$quantity' } } },
      ]),
      FuelTransaction.aggregate([
        { $match: { pumpId, status: 'active', fuelType: 'Diesel' } },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, totalQty: { $sum: '$quantity' } } },
      ]),
      FuelTransaction.aggregate([
        { $match: { pumpId, status: 'active' } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
      FuelTransaction.find({ pumpId, status: 'active' })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Payment.find({ pumpId, status: 'active' })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber')
        .populate('receivedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Owner.find({ pumpId, totalOutstanding: { $gt: 0 } })
        .sort({ totalOutstanding: -1 })
        .limit(8)
        .select('name ownerId mobile totalOutstanding companyName totalVehicles')
        .lean(),
    ]);

    // Daily sales chart (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const dailySalesChart = await FuelTransaction.aggregate([
      { $match: { pumpId, status: 'active', createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalAmount: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.json({
      success: true,
      data: {
        totalOwners,
        totalVehicles,
        todayFuelSales: todayFuelSalesAgg[0]?.total || 0,
        todayPaymentCollection: todayPaymentAgg[0]?.total || 0,
        totalOutstanding: outstandingAgg[0]?.total || 0,
        petrolSales: {
          amount: petrolSalesAgg[0]?.totalAmount || 0,
          quantity: petrolSalesAgg[0]?.totalQty || 0,
        },
        dieselSales: {
          amount: dieselSalesAgg[0]?.totalAmount || 0,
          quantity: dieselSalesAgg[0]?.totalQty || 0,
        },
        totalFuelQuantity: totalFuelQtyAgg[0]?.total || 0,
        recentFuelTransactions,
        recentPayments,
        topPendingOwners,
        dailySalesChart,
      },
    });
  } catch (err) {
    console.error('getOwnerDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/dashboard/employee
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { start, end } = getTodayRange();

    const [fuelAgg, paymentAgg, fuelCount, recentEntries] = await Promise.all([
      FuelTransaction.aggregate([
        { $match: { pumpId, status: 'active', createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            todayFuelAmount: { $sum: '$totalAmount' },
            todayPetrolQuantity: { $sum: { $cond: [{ $eq: ['$fuelType', 'Petrol'] }, '$quantity', 0] } },
            todayDieselQuantity: { $sum: { $cond: [{ $eq: ['$fuelType', 'Diesel'] }, '$quantity', 0] } },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { pumpId, status: 'active', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      FuelTransaction.countDocuments({ pumpId, status: 'active', createdAt: { $gte: start, $lte: end } }),
      FuelTransaction.find({ pumpId, status: 'active' })
        .populate('ownerId', 'name ownerId mobile')
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        todayFuelEntries: fuelCount,
        todayPetrolQuantity: fuelAgg[0]?.todayPetrolQuantity || 0,
        todayDieselQuantity: fuelAgg[0]?.todayDieselQuantity || 0,
        todayFuelAmount: fuelAgg[0]?.todayFuelAmount || 0,
        todayPaymentCollection: paymentAgg[0]?.total || 0,
        recentEntries,
      },
    });
  } catch (err) {
    console.error('getEmployeeDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

