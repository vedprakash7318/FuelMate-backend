const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');

// GET /api/ledger/owner/:ownerId
exports.getOwnerLedger = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { ownerId } = req.params;
    const { startDate, endDate } = req.query;

    const owner = await Owner.findOne({ _id: ownerId, pumpId });
    if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });

    const filter = { pumpId, ownerId: owner._id, status: 'active' };

    const [fuelEntries, payments] = await Promise.all([
      FuelTransaction.find(filter)
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('createdBy', 'name username')
        .lean(),
      Payment.find(filter)
        .populate('vehicleId', 'vehicleNumber vehicleName')
        .populate('receivedBy', 'name username')
        .lean(),
    ]);

    // Map into ledger entries
    const entries = [];

    fuelEntries.forEach((fuel) => {
      const paymentInfo = fuel.amountReceived > 0
        ? ` [Paid ₹${fuel.amountReceived} via ${fuel.paymentMode || 'Cash'}${fuel.transactionRef ? ' - ' + fuel.transactionRef : ''}]`
        : '';
      entries.push({
        id: fuel._id,
        refId: fuel.transactionId,
        date: fuel.createdAt,
        type: 'FUEL',
        description: `${fuel.fuelType} ${fuel.quantity}L @ ₹${fuel.pricePerLiter}/L (${fuel.vehicleId?.vehicleNumber || 'Vehicle'})${paymentInfo}`,
        debit: fuel.totalAmount, // Fuel adds to debt
        credit: fuel.amountReceived || 0, // If instant payment was received during fuel fill
        vehicleNumber: fuel.vehicleId?.vehicleNumber || '-',
        vehicleName: fuel.vehicleId?.vehicleName || '-',
        paymentMode: fuel.amountReceived > 0 ? `${fuel.paymentType} (${fuel.paymentMode || 'Cash'})` : fuel.paymentType,
        user: fuel.createdBy?.name || '-',
        rawDate: new Date(fuel.createdAt).getTime(),
      });
    });

    payments.forEach((pay) => {
      entries.push({
        id: pay._id,
        refId: pay.paymentId,
        date: pay.createdAt,
        type: 'PAYMENT',
        description: `Payment Received (${pay.paymentMode}${pay.transactionRef ? ' - ' + pay.transactionRef : ''})${pay.adjustmentType === 'vehicle' ? ' for ' + (pay.vehicleId?.vehicleNumber || 'Vehicle') : ''}`,
        debit: 0,
        credit: pay.amount, // Payment reduces debt
        vehicleNumber: pay.vehicleId?.vehicleNumber || 'Owner Level',
        vehicleName: pay.vehicleId?.vehicleName || '-',
        paymentMode: pay.paymentMode,
        user: pay.receivedBy?.name || '-',
        rawDate: new Date(pay.createdAt).getTime(),
      });
    });

    // Sort chronologically ascending to compute running balance
    entries.sort((a, b) => a.rawDate - b.rawDate);

    let runningBalance = 0;
    const ledger = entries.map((item) => {
      runningBalance = Math.round((runningBalance + item.debit - item.credit) * 100) / 100;
      return {
        ...item,
        balance: runningBalance,
      };
    });

    // Optional date filtering
    let filteredLedger = ledger;
    if (startDate) {
      const s = new Date(startDate).getTime();
      filteredLedger = filteredLedger.filter((e) => e.rawDate >= s);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const e = end.getTime();
      filteredLedger = filteredLedger.filter((item) => item.rawDate <= e);
    }

    return res.json({
      success: true,
      owner: {
        id: owner._id,
        ownerId: owner.ownerId,
        name: owner.name,
        mobile: owner.mobile,
        companyName: owner.companyName,
        totalOutstanding: owner.totalOutstanding,
      },
      summary: {
        totalDebit: Math.round(entries.reduce((acc, curr) => acc + curr.debit, 0) * 100) / 100,
        totalCredit: Math.round(entries.reduce((acc, curr) => acc + curr.credit, 0) * 100) / 100,
        currentBalance: runningBalance,
      },
      count: filteredLedger.length,
      ledger: filteredLedger.reverse(), // Latest first for display, with calculated running balance
    });
  } catch (err) {
    console.error('getOwnerLedger error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/ledger/vehicle/:vehicleId
exports.getVehicleLedger = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { vehicleId } = req.params;

    const vehicle = await Vehicle.findOne({ _id: vehicleId, pumpId }).populate('ownerId', 'name ownerId mobile');
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const [fuelEntries, payments] = await Promise.all([
      FuelTransaction.find({ pumpId, vehicleId: vehicle._id, status: 'active' })
        .populate('createdBy', 'name username')
        .lean(),
      Payment.find({ pumpId, vehicleId: vehicle._id, status: 'active' })
        .populate('receivedBy', 'name username')
        .lean(),
    ]);

    const entries = [];

    fuelEntries.forEach((fuel) => {
      entries.push({
        id: fuel._id,
        refId: fuel.transactionId,
        date: fuel.createdAt,
        type: 'FUEL',
        description: `${fuel.fuelType} ${fuel.quantity}L @ ₹${fuel.pricePerLiter}/L`,
        debit: fuel.totalAmount,
        credit: fuel.amountReceived || 0,
        user: fuel.createdBy?.name || '-',
        rawDate: new Date(fuel.createdAt).getTime(),
      });
    });

    payments.forEach((pay) => {
      entries.push({
        id: pay._id,
        refId: pay.paymentId,
        date: pay.createdAt,
        type: 'PAYMENT',
        description: `Payment Received (${pay.paymentMode}${pay.transactionRef ? ' - ' + pay.transactionRef : ''})`,
        debit: 0,
        credit: pay.amount,
        user: pay.receivedBy?.name || '-',
        rawDate: new Date(pay.createdAt).getTime(),
      });
    });

    entries.sort((a, b) => a.rawDate - b.rawDate);

    let runningBalance = 0;
    const ledger = entries.map((item) => {
      runningBalance = Math.round((runningBalance + item.debit - item.credit) * 100) / 100;
      return {
        ...item,
        balance: runningBalance,
      };
    });

    return res.json({
      success: true,
      vehicle: {
        id: vehicle._id,
        vehicleId: vehicle.vehicleId,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleName: vehicle.vehicleName,
        fuelType: vehicle.fuelType,
        pendingBalance: vehicle.pendingBalance,
        owner: vehicle.ownerId,
      },
      summary: {
        totalDebit: Math.round(entries.reduce((acc, curr) => acc + curr.debit, 0) * 100) / 100,
        totalCredit: Math.round(entries.reduce((acc, curr) => acc + curr.credit, 0) * 100) / 100,
        currentBalance: runningBalance,
      },
      count: ledger.length,
      ledger: ledger.reverse(),
    });
  } catch (err) {
    console.error('getVehicleLedger error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

