const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const { logAudit } = require('../middleware/auditLog');

// Helper to generate next Owner ID (OWN-001)
const generateOwnerId = async (pumpId) => {
  const lastOwner = await Owner.findOne({ pumpId }).sort({ createdAt: -1 });
  if (!lastOwner || !lastOwner.ownerId) return 'OWN-001';
  const match = lastOwner.ownerId.match(/OWN-(\d+)/);
  if (!match) return `OWN-${Date.now().toString().slice(-4)}`;
  const nextNum = parseInt(match[1], 10) + 1;
  return `OWN-${String(nextNum).padStart(3, '0')}`;
};

// GET /api/owners - Search & list owners
exports.getOwners = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { search, status, hasOutstanding, page, limit, sortBy = 'name', sortOrder = 'asc' } = req.query;

    const query = { pumpId };
    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }
    if (hasOutstanding === 'true') {
      query.totalOutstanding = { $gt: 0 };
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { mobile: regex }, { companyName: regex }, { ownerId: regex }];
    }

    const sortObj = {};
    if (sortBy === 'outstanding') {
      sortObj.totalOutstanding = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
      sortObj.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj.name = sortOrder === 'asc' ? 1 : -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Compute overall summary stats for the pump
    const summaryAgg = await Owner.aggregate([
      { $match: { pumpId } },
      { $group: { _id: null, totalOutstandingSum: { $sum: '$totalOutstanding' }, totalCount: { $sum: 1 } } },
    ]);
    const summary = summaryAgg[0] || { totalOutstandingSum: 0, totalCount: 0 };

    if (pageNum > 0 && limitNum > 0) {
      const total = await Owner.countDocuments(query);
      const skip = (pageNum - 1) * limitNum;
      const owners = await Owner.find(query).sort(sortObj).skip(skip).limit(limitNum);
      return res.json({
        success: true,
        count: owners.length,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        summary: {
          totalOutstandingSum: summary.totalOutstandingSum,
          totalCount: summary.totalCount,
        },
        data: owners,
      });
    }

    // Default or limit=0 or all=true: return all matching
    const owners = await Owner.find(query).sort(sortObj);
    return res.json({
      success: true,
      count: owners.length,
      total: owners.length,
      page: 1,
      totalPages: 1,
      summary: {
        totalOutstandingSum: summary.totalOutstandingSum,
        totalCount: summary.totalCount,
      },
      data: owners,
    });
  } catch (err) {
    console.error('getOwners error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/owners - Register new owner
exports.createOwner = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const {
      name,
      mobile,
      alternateMobile,
      email,
      address,
      city,
      state,
      pinCode,
      companyName,
      gstNumber,
      remark,
    } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Owner Name and Mobile Number are required',
      });
    }

    // Check duplicate mobile warning
    const existingMobile = await Owner.findOne({ pumpId, mobile: mobile.trim() });
    let warning = null;
    if (existingMobile) {
      warning = `Note: Customer with mobile ${mobile} is already registered as ${existingMobile.name} (${existingMobile.ownerId})`;
    }

    const ownerId = await generateOwnerId(pumpId);

    const owner = await Owner.create({
      pumpId,
      ownerId,
      name: name.trim(),
      mobile: mobile.trim(),
      alternateMobile: alternateMobile ? alternateMobile.trim() : undefined,
      email: email ? email.toLowerCase().trim() : undefined,
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      pinCode: pinCode ? pinCode.trim() : '',
      companyName: companyName ? companyName.trim() : undefined,
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : undefined,
      remark: remark ? remark.trim() : undefined,
      status: 'active',
      createdBy: req.user.userId,
    });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'CREATE_OWNER',
      entity: 'Owner',
      entityId: owner._id,
      details: { ownerId: owner.ownerId, name: owner.name, mobile: owner.mobile },
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Owner created successfully',
      warning,
      data: owner,
    });
  } catch (err) {
    console.error('createOwner error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/owners/:id - Get owner detail
exports.getOwnerById = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;

    const owner = await Owner.findOne({ _id: id, pumpId }).populate('createdBy', 'name username');
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    const vehicles = await Vehicle.find({ ownerId: owner._id, pumpId }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        ...owner.toObject(),
        vehicles,
      },
    });
  } catch (err) {
    console.error('getOwnerById error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/owners/:id - Update owner
exports.updateOwner = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const {
      name,
      mobile,
      alternateMobile,
      email,
      address,
      city,
      state,
      pinCode,
      companyName,
      gstNumber,
      remark,
      status,
    } = req.body;

    const owner = await Owner.findOne({ _id: id, pumpId });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    if (name) owner.name = name.trim();
    if (mobile) owner.mobile = mobile.trim();
    if (alternateMobile !== undefined) owner.alternateMobile = alternateMobile ? alternateMobile.trim() : undefined;
    if (email !== undefined) owner.email = email ? email.toLowerCase().trim() : undefined;
    if (address !== undefined) owner.address = address ? address.trim() : '';
    if (city !== undefined) owner.city = city ? city.trim() : '';
    if (state !== undefined) owner.state = state ? state.trim() : '';
    if (pinCode !== undefined) owner.pinCode = pinCode ? pinCode.trim() : '';
    if (companyName !== undefined) owner.companyName = companyName ? companyName.trim() : undefined;
    if (gstNumber !== undefined) owner.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : undefined;
    if (remark !== undefined) owner.remark = remark ? remark.trim() : undefined;
    if (status) owner.status = status;

    await owner.save();

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'UPDATE_OWNER',
      entity: 'Owner',
      entityId: owner._id,
      details: { ownerId: owner.ownerId, name: owner.name },
      req,
    });

    return res.json({ success: true, message: 'Owner updated successfully', data: owner });
  } catch (err) {
    console.error('updateOwner error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/owners/:id/vehicles - Get vehicles for owner
exports.getOwnerVehicles = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const vehicles = await Vehicle.find({ ownerId: id, pumpId }).sort({ createdAt: -1 });
    return res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    console.error('getOwnerVehicles error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

