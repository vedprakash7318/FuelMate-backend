const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Pump = require('../models/Pump');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const FuelPrice = require('../models/FuelPrice');

// Helper to calculate expiration date
const calculateExpiration = (startDate, durationType, durationValue) => {
  const d = new Date(startDate || Date.now());
  const val = parseInt(durationValue, 10) || 1;

  switch (durationType) {
    case 'week':
      d.setDate(d.getDate() + val * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() + val);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + val);
      break;
    case 'day':
    default:
      d.setDate(d.getDate() + val);
      break;
  }
  return d;
};

// Helper to calculate dynamic pump status
const computePumpStatus = (pump) => {
  if (pump.isBlocked || pump.status === 'blocked') return 'blocked';
  if (!pump.subscriptionExpiresAt) return 'active';

  const now = new Date();
  const expiresAt = new Date(pump.subscriptionExpiresAt);
  if (now > expiresAt) return 'expired';

  const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'expiring_soon';
  return 'active';
};

// ==========================================
// 1. DASHBOARD METRICS
// ==========================================
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalPumps,
      blockedPumps,
      expiredPumps,
      expiringSoonPumps,
      totalPlans,
      revenueAgg,
      recentPumps,
      recentSubscriptions,
    ] = await Promise.all([
      Pump.countDocuments({}),
      Pump.countDocuments({ $or: [{ isBlocked: true }, { status: 'blocked' }] }),
      Pump.countDocuments({
        isBlocked: false,
        status: { $ne: 'blocked' },
        subscriptionExpiresAt: { $lt: now },
      }),
      Pump.countDocuments({
        isBlocked: false,
        status: { $ne: 'blocked' },
        subscriptionExpiresAt: { $gte: now, $lte: in7Days },
      }),
      SubscriptionPlan.countDocuments({ isActive: true }),
      SubscriptionHistory.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: '$price' }, totalCount: { $sum: 1 } } },
      ]),
      Pump.find({}).sort({ createdAt: -1 }).limit(5).lean(),
      SubscriptionHistory.find({}).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const activePumps = Math.max(0, totalPumps - blockedPumps - expiredPumps);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    return res.json({
      success: true,
      data: {
        metrics: {
          totalPumps,
          activePumps,
          expiredPumps,
          expiringSoonPumps,
          blockedPumps,
          totalPlans,
          totalRevenue,
        },
        recentPumps,
        recentSubscriptions,
      },
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 2. PUMPS & ADMINS MANAGEMENT
// ==========================================

// GET /api/superadmin/pumps
exports.getPumps = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 15 } = req.query;
    const query = {};

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { pumpName: regex },
        { ownerName: regex },
        { pumpId: regex },
        { mobile: regex },
        { email: regex },
      ];
    }

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (status === 'blocked') {
      query.$or = [{ isBlocked: true }, { status: 'blocked' }];
    } else if (status === 'expired') {
      query.isBlocked = false;
      query.status = { $ne: 'blocked' };
      query.subscriptionExpiresAt = { $lt: now };
    } else if (status === 'expiring_soon') {
      query.isBlocked = false;
      query.status = { $ne: 'blocked' };
      query.subscriptionExpiresAt = { $gte: now, $lte: in7Days };
    } else if (status === 'active') {
      query.isBlocked = false;
      query.status = { $ne: 'blocked' };
      query.$or = [
        { subscriptionExpiresAt: { $gte: now } },
        { subscriptionExpiresAt: null },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const [pumps, total] = await Promise.all([
      Pump.find(query)
        .populate('adminUserId', 'name username mobile email isBlocked status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Pump.countDocuments(query),
    ]);

    // Attach computed daysRemaining and status
    const formatted = pumps.map((p) => {
      let daysRemaining = null;
      let isExpired = false;

      if (p.subscriptionExpiresAt) {
        const exp = new Date(p.subscriptionExpiresAt);
        const diff = exp.getTime() - now.getTime();
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining < 0;
      }

      return {
        ...p,
        computedStatus: computePumpStatus(p),
        daysRemaining: isExpired ? 0 : daysRemaining,
        daysExpired: isExpired ? Math.abs(daysRemaining) : 0,
      };
    });

    return res.json({
      success: true,
      count: formatted.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: formatted,
    });
  } catch (err) {
    console.error('getPumps error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/superadmin/pumps - Create new Pump, Admin User, and assign Subscription
exports.createPumpAndAdmin = async (req, res) => {
  try {
    const {
      pumpName,
      pumpAddress,
      ownerName,
      mobile,
      email,
      gstNumber,
      licenseNumber,
      username,
      password,
      planId,
      customDurationType,
      customDurationValue,
      customPrice,
    } = req.body;

    if (!pumpName || !ownerName || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Pump Name, Owner Name, Mobile Number, and Password are required',
      });
    }

    const resolvedUsername = (username || mobile).toLowerCase().trim();

    // Check unique username, mobile, or email
    const duplicateQuery = [{ username: resolvedUsername }, { mobile: mobile.trim() }];
    if (email && email.trim()) {
      duplicateQuery.push({ email: email.toLowerCase().trim() });
    }

    const existingUser = await User.findOne({ $or: duplicateQuery });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An admin account with this Mobile Number, Email, or Username already exists',
      });
    }

    // Generate unique pumpId
    const lastPump = await Pump.findOne({}).sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastPump && lastPump.pumpId) {
      const match = lastPump.pumpId.match(/PUMP(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const pumpId = `PUMP${String(nextNum).padStart(3, '0')}`;

    // Resolve Subscription Duration & Price
    let planName = 'Custom Plan';
    let durationType = customDurationType || 'month';
    let durationValue = parseInt(customDurationValue, 10) || 1;
    let price = parseFloat(customPrice) || 0;
    let resolvedPlanId = null;

    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        resolvedPlanId = plan._id;
        planName = plan.name;
        durationType = plan.durationType;
        durationValue = plan.durationValue;
        price = plan.price;
      }
    }

    const startedAt = new Date();
    const expiresAt = calculateExpiration(startedAt, durationType, durationValue);

    // 1. Create Admin User (role: owner)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const adminUser = await User.create({
      pumpId,
      name: ownerName.trim(),
      mobile: mobile.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      username: resolvedUsername,
      password: hashedPassword,
      role: 'owner',
      status: 'active',
      address: pumpAddress ? pumpAddress.trim() : undefined,
      createdBy: req.user.userId,
    });

    // 2. Create Pump (Settings)
    const pump = await Pump.create({
      pumpId,
      pumpName: pumpName.trim(),
      pumpAddress: pumpAddress ? pumpAddress.trim() : 'Bypass Road',
      ownerName: ownerName.trim(),
      mobile: mobile.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      gstNumber: gstNumber ? gstNumber.trim() : undefined,
      licenseNumber: licenseNumber ? licenseNumber.trim() : undefined,
      subscriptionPlanId: resolvedPlanId,
      subscriptionPlanName: planName,
      subscriptionStartedAt: startedAt,
      subscriptionExpiresAt: expiresAt,
      subscriptionDurationType: durationType,
      subscriptionDurationValue: durationValue,
      subscriptionPrice: price,
      adminUserId: adminUser._id,
      status: 'active',
      isBlocked: false,
    });

    // 3. Log to SubscriptionHistory
    await SubscriptionHistory.create({
      pumpId,
      pumpName: pump.pumpName,
      adminName: adminUser.name,
      planId: resolvedPlanId,
      planName,
      durationType,
      durationValue,
      price,
      startedAt,
      expiresAt,
      action: 'create',
      notes: `Initial subscription granted (${durationValue} ${durationType}s)`,
      assignedBy: req.user.userId,
    });

    // 4. Initialize Base Fuel Prices so fuel entries work immediately
    await FuelPrice.create([
      {
        pumpId,
        fuelType: 'Petrol',
        price: 96.72,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
      {
        pumpId,
        fuelType: 'Diesel',
        price: 89.62,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
    ]);

    return res.status(201).json({
      success: true,
      message: `Pump "${pump.pumpName}" and Admin "${adminUser.username}" registered successfully!`,
      data: {
        pump,
        adminUser: {
          id: adminUser._id,
          username: adminUser.username,
          name: adminUser.name,
          role: adminUser.role,
        },
        subscription: {
          planName,
          expiresAt,
          daysGranted: Math.ceil((expiresAt - startedAt) / (1000 * 60 * 60 * 24)),
        },
      },
    });
  } catch (err) {
    console.error('createPumpAndAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/superadmin/pumps/:pumpId/block - Block / Unblock Pump
exports.toggleBlockPump = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { isBlocked, reason } = req.body;

    const pump = await Pump.findOne({ pumpId });
    if (!pump) return res.status(404).json({ success: false, message: 'Pump not found' });

    const blocked = Boolean(isBlocked);
    pump.isBlocked = blocked;
    pump.blockReason = blocked ? reason || 'Blocked by Super Admin' : undefined;
    pump.status = blocked ? 'blocked' : 'active';
    await pump.save();

    // Also update Admin user
    await User.updateMany(
      { pumpId },
      {
        $set: {
          isBlocked: blocked,
          blockReason: pump.blockReason,
          status: blocked ? 'blocked' : 'active',
        },
      }
    );

    return res.json({
      success: true,
      message: blocked ? `Pump ${pump.pumpName} has been BLOCKED` : `Pump ${pump.pumpName} has been UNBLOCKED`,
      data: pump,
    });
  } catch (err) {
    console.error('toggleBlockPump error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/superadmin/pumps/:pumpId/subscription - Renew or Extend Subscription
exports.extendSubscription = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { planId, durationType, durationValue, price, notes } = req.body;

    const pump = await Pump.findOne({ pumpId });
    if (!pump) return res.status(404).json({ success: false, message: 'Pump not found' });

    let pName = 'Custom Extension';
    let dType = durationType || 'month';
    let dVal = parseInt(durationValue, 10) || 1;
    let subPrice = parseFloat(price) || 0;
    let resolvedPlanId = null;

    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        resolvedPlanId = plan._id;
        pName = plan.name;
        dType = plan.durationType;
        dVal = plan.durationValue;
        subPrice = plan.price;
      }
    }

    const now = new Date();
    // If current subscription is still active, extend from current expiry date!
    // If expired, start from now!
    let baseStartDate = now;
    if (pump.subscriptionExpiresAt && new Date(pump.subscriptionExpiresAt) > now) {
      baseStartDate = new Date(pump.subscriptionExpiresAt);
    }

    const newExpiresAt = calculateExpiration(baseStartDate, dType, dVal);

    pump.subscriptionPlanId = resolvedPlanId;
    pump.subscriptionPlanName = pName;
    pump.subscriptionStartedAt = now;
    pump.subscriptionExpiresAt = newExpiresAt;
    pump.subscriptionDurationType = dType;
    pump.subscriptionDurationValue = dVal;
    pump.subscriptionPrice = subPrice;
    if (pump.status === 'expired') pump.status = 'active';
    await pump.save();

    // Log to history
    await SubscriptionHistory.create({
      pumpId,
      pumpName: pump.pumpName,
      adminName: pump.ownerName,
      planId: resolvedPlanId,
      planName: pName,
      durationType: dType,
      durationValue: dVal,
      price: subPrice,
      startedAt: now,
      expiresAt: newExpiresAt,
      action: 'extend',
      notes: notes || `Extended by ${dVal} ${dType}(s)`,
      assignedBy: req.user.userId,
    });

    const diffDays = Math.ceil((newExpiresAt - now) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      message: `Subscription extended for ${pump.pumpName}! Valid until ${newExpiresAt.toLocaleDateString()}`,
      data: {
        pump,
        expiresAt: newExpiresAt,
        daysRemaining: diffDays,
      },
    });
  } catch (err) {
    console.error('extendSubscription error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/superadmin/pumps/:pumpId/reset-password - Reset Admin Password
exports.resetAdminPassword = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const adminUser = await User.findOne({ pumpId, role: 'owner' });
    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin user for this pump not found' });
    }

    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(newPassword, salt);
    await adminUser.save();

    return res.json({
      success: true,
      message: `Password reset successfully for admin username "${adminUser.username}"`,
    });
  } catch (err) {
    console.error('resetAdminPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/superadmin/pumps/:pumpId - Update Pump Details
exports.updatePump = async (req, res) => {
  try {
    const { pumpId } = req.params;
    const { pumpName, pumpAddress, ownerName, mobile, email, gstNumber, licenseNumber } = req.body;

    const pump = await Pump.findOne({ pumpId });
    if (!pump) return res.status(404).json({ success: false, message: 'Pump not found' });

    if (pumpName) pump.pumpName = pumpName.trim();
    if (pumpAddress) pump.pumpAddress = pumpAddress.trim();
    if (ownerName) pump.ownerName = ownerName.trim();
    if (mobile) pump.mobile = mobile.trim();
    if (email !== undefined) pump.email = email ? email.toLowerCase().trim() : undefined;
    if (gstNumber !== undefined) pump.gstNumber = gstNumber ? gstNumber.trim() : undefined;
    if (licenseNumber !== undefined) pump.licenseNumber = licenseNumber ? licenseNumber.trim() : undefined;

    await pump.save();

    // Also update Admin user's name/mobile
    await User.updateOne(
      { pumpId, role: 'owner' },
      {
        $set: {
          name: pump.ownerName,
          mobile: pump.mobile,
          email: pump.email,
        },
      }
    );

    return res.json({ success: true, message: 'Pump details updated successfully', data: pump });
  } catch (err) {
    console.error('updatePump error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 3. SUBSCRIPTION PLANS CRUD
// ==========================================

// GET /api/superadmin/plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({}).sort({ sortOrder: 1, createdAt: 1 });
    return res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    console.error('getPlans error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/superadmin/plans
exports.createPlan = async (req, res) => {
  try {
    const { name, description, durationType, durationValue, price, features, sortOrder } = req.body;

    if (!name || !durationType || !durationValue || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Plan Name, Duration Type, Duration Value, and Price are required',
      });
    }

    const plan = await SubscriptionPlan.create({
      name: name.trim(),
      description: description ? description.trim() : undefined,
      durationType,
      durationValue: parseInt(durationValue, 10),
      price: parseFloat(price),
      features: Array.isArray(features) ? features : [],
      sortOrder: parseInt(sortOrder, 10) || 0,
      createdBy: req.user.userId,
    });

    return res.status(201).json({ success: true, message: 'Subscription plan created', data: plan });
  } catch (err) {
    console.error('createPlan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/superadmin/plans/:id
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, durationType, durationValue, price, features, isActive, sortOrder } = req.body;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    if (name) plan.name = name.trim();
    if (description !== undefined) plan.description = description ? description.trim() : undefined;
    if (durationType) plan.durationType = durationType;
    if (durationValue) plan.durationValue = parseInt(durationValue, 10);
    if (price !== undefined) plan.price = parseFloat(price);
    if (features !== undefined) plan.features = Array.isArray(features) ? features : [];
    if (isActive !== undefined) plan.isActive = Boolean(isActive);
    if (sortOrder !== undefined) plan.sortOrder = parseInt(sortOrder, 10);

    await plan.save();

    return res.json({ success: true, message: 'Plan updated successfully', data: plan });
  } catch (err) {
    console.error('updatePlan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/superadmin/plans/:id
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    return res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    console.error('deletePlan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 4. SUBSCRIPTION HISTORY / AUDIT
// ==========================================

// GET /api/superadmin/subscriptions/history
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const { search, pumpId, page = 1, limit = 20 } = req.query;
    const query = {};

    if (pumpId) query.pumpId = pumpId;
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ pumpName: regex }, { adminName: regex }, { planName: regex }, { pumpId: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
      SubscriptionHistory.find(query)
        .populate('assignedBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SubscriptionHistory.countDocuments(query),
    ]);

    return res.json({
      success: true,
      count: history.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: history,
    });
  } catch (err) {
    console.error('getSubscriptionHistory error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
