const Vehicle = require('../models/Vehicle');
const Owner = require('../models/Owner');
const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const { logAudit } = require('../middleware/auditLog');

// Helper to generate next Vehicle ID (VEH-001)
const generateVehicleId = async (pumpId) => {
  const lastVehicle = await Vehicle.findOne({ pumpId }).sort({ createdAt: -1 });
  if (!lastVehicle || !lastVehicle.vehicleId) return 'VEH-001';
  const match = lastVehicle.vehicleId.match(/VEH-(\d+)/);
  if (!match) return `VEH-${Date.now().toString().slice(-4)}`;
  const nextNum = parseInt(match[1], 10) + 1;
  return `VEH-${String(nextNum).padStart(3, '0')}`;
};

// GET /api/vehicles - List & search vehicles
exports.getVehicles = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { search, ownerId, status } = req.query;

    const query = { pumpId };
    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }
    if (ownerId) {
      query.ownerId = ownerId;
    }
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ vehicleNumber: regex }, { vehicleName: regex }, { driverName: regex }, { driverMobile: regex }];
    }

    const vehicles = await Vehicle.find(query)
      .populate('ownerId', 'name ownerId mobile companyName')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    console.error('getVehicles error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/vehicles - Register new vehicle
exports.createVehicle = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const {
      ownerId,
      vehicleNumber,
      vehicleName,
      vehicleType,
      fuelType,
      fuelTypes,
      driverName,
      driverMobile,
      remark,
    } = req.body;

    const resolvedVehicleName = (vehicleName || vehicleType || 'Vehicle').trim();

    if (!ownerId || !vehicleNumber || !driverName || !driverMobile) {
      return res.status(400).json({
        success: false,
        message: 'Owner, Vehicle Number, Driver Name, and Driver Mobile are required',
      });
    }

    // Normalize fuel types array (multi-select, exclude 'Both')
    let normalizedFuelTypes = [];
    if (Array.isArray(fuelTypes) && fuelTypes.length > 0) {
      normalizedFuelTypes = fuelTypes;
    } else if (Array.isArray(fuelType) && fuelType.length > 0) {
      normalizedFuelTypes = fuelType;
    } else if (typeof fuelType === 'string' && fuelType.trim()) {
      normalizedFuelTypes = fuelType.split(',').map((s) => s.trim());
    } else if (typeof fuelTypes === 'string' && fuelTypes.trim()) {
      normalizedFuelTypes = fuelTypes.split(',').map((s) => s.trim());
    }

    normalizedFuelTypes = [...new Set(
      normalizedFuelTypes
        .filter((t) => t && typeof t === 'string')
        .map((t) => t.trim())
        .filter((t) => t && t.toLowerCase() !== 'both')
    )];

    if (normalizedFuelTypes.length === 0) {
      normalizedFuelTypes = ['Diesel'];
    }
    const resolvedFuelTypeStr = normalizedFuelTypes.join(', ');

    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '');

    // Check duplicate vehicleNumber in pumpId
    const existing = await Vehicle.findOne({ pumpId, vehicleNumber: cleanVehicleNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Vehicle number ${cleanVehicleNumber} is already registered with ${existing.vehicleName} (${existing.vehicleId})`,
      });
    }

    // Check owner exists
    const owner = await Owner.findOne({ _id: ownerId, pumpId });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Selected owner not found' });
    }

    const vehicleId = await generateVehicleId(pumpId);

    const vehicle = await Vehicle.create({
      pumpId,
      vehicleId,
      ownerId: owner._id,
      vehicleNumber: cleanVehicleNumber,
      vehicleName: resolvedVehicleName,
      vehicleType: vehicleType ? vehicleType.trim() : 'Truck',
      fuelTypes: normalizedFuelTypes,
      fuelType: resolvedFuelTypeStr,
      driverName: driverName.trim(),
      driverMobile: driverMobile.trim(),
      remark: remark ? remark.trim() : undefined,
      status: 'active',
      createdBy: req.user.userId,
    });

    // Increment owner vehicle count
    await Owner.findByIdAndUpdate(owner._id, { $inc: { totalVehicles: 1 } });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'CREATE_VEHICLE',
      entity: 'Vehicle',
      entityId: vehicle._id,
      details: { vehicleId: vehicle.vehicleId, vehicleNumber: vehicle.vehicleNumber, ownerId: owner._id },
      req,
    });

    const populated = await Vehicle.findById(vehicle._id).populate('ownerId', 'name ownerId mobile');

    return res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      data: populated,
    });
  } catch (err) {
    console.error('createVehicle error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/vehicles/:id - Vehicle detail + fuel history
exports.getVehicleById = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;

    const vehicle = await Vehicle.findOne({ _id: id, pumpId })
      .populate('ownerId', 'name ownerId mobile companyName address city state pinCode')
      .populate('createdBy', 'name username');

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const fuelHistory = await FuelTransaction.find({ vehicleId: vehicle._id, pumpId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('createdBy', 'name');

    const paymentHistory = await Payment.find({ vehicleId: vehicle._id, pumpId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('receivedBy', 'name');

    return res.json({
      success: true,
      data: {
        ...vehicle.toObject(),
        fuelHistory,
        paymentHistory,
      },
    });
  } catch (err) {
    console.error('getVehicleById error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/vehicles/:id - Update vehicle
exports.updateVehicle = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const {
      vehicleName,
      vehicleType,
      fuelType,
      fuelTypes,
      driverName,
      driverMobile,
      remark,
      status,
    } = req.body;

    const vehicle = await Vehicle.findOne({ _id: id, pumpId });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    if (vehicleName) vehicle.vehicleName = vehicleName.trim();
    if (vehicleType) vehicle.vehicleType = vehicleType;

    if (fuelTypes !== undefined || fuelType !== undefined) {
      let normalizedFuelTypes = [];
      const raw = fuelTypes !== undefined ? fuelTypes : fuelType;
      if (Array.isArray(raw)) {
        normalizedFuelTypes = raw;
      } else if (typeof raw === 'string') {
        normalizedFuelTypes = raw.split(',').map((s) => s.trim());
      }
      normalizedFuelTypes = [...new Set(
        normalizedFuelTypes
          .filter((t) => t && typeof t === 'string')
          .map((t) => t.trim())
          .filter((t) => t && t.toLowerCase() !== 'both')
      )];
      if (normalizedFuelTypes.length === 0) {
        normalizedFuelTypes = ['Diesel'];
      }
      vehicle.fuelTypes = normalizedFuelTypes;
      vehicle.fuelType = normalizedFuelTypes.join(', ');
    }

    if (driverName) vehicle.driverName = driverName.trim();
    if (driverMobile) vehicle.driverMobile = driverMobile.trim();
    if (remark !== undefined) vehicle.remark = remark ? remark.trim() : undefined;
    if (status) vehicle.status = status;

    await vehicle.save();

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'UPDATE_VEHICLE',
      entity: 'Vehicle',
      entityId: vehicle._id,
      details: { vehicleNumber: vehicle.vehicleNumber, status: vehicle.status },
      req,
    });

    const populated = await Vehicle.findById(vehicle._id).populate('ownerId', 'name ownerId mobile');

    return res.json({ success: true, message: 'Vehicle updated successfully', data: populated });
  } catch (err) {
    console.error('updateVehicle error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

