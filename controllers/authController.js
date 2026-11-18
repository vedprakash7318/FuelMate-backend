const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pump = require('../models/Pump');
const { logAudit } = require('../middleware/auditLog');

// Helper to compute subscription metadata
const computeSubscriptionMeta = (pump) => {
  if (!pump) return { subscriptionStatus: 'active', isExpired: false, daysRemaining: null };

  if (pump.isBlocked || pump.status === 'blocked') {
    return {
      subscriptionStatus: 'blocked',
      isBlocked: true,
      isExpired: false,
      blockReason: pump.blockReason || 'Account suspended by Super Admin',
      daysRemaining: 0,
    };
  }

  if (!pump.subscriptionExpiresAt) {
    return { subscriptionStatus: 'active', isExpired: false, daysRemaining: 999 };
  }

  const now = new Date();
  const expiresAt = new Date(pump.subscriptionExpiresAt);
  const diffTime = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining < 0;

  return {
    subscriptionStatus: isExpired ? 'expired' : 'active',
    isExpired,
    daysRemaining: isExpired ? 0 : daysRemaining,
    daysExpired: isExpired ? Math.abs(daysRemaining) : 0,
    expiresAt: pump.subscriptionExpiresAt,
  };
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, loginId, identifier, email, mobile, password } = req.body;
    const loginCredential = (loginId || identifier || email || mobile || username || '').trim();

    if (!loginCredential || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number or Email and password are required',
      });
    }

    const cleanId = loginCredential.toLowerCase();

    // Match by mobile number, email address, or username
    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { mobile: loginCredential },
        { username: cleanId },
      ],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBlocked || user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: user.blockReason || 'Your user account is suspended. Please contact administrator.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact owner.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If regular user or owner, check Pump Block Status
    let pump = null;
    let subMeta = { subscriptionStatus: 'active', isExpired: false };
    if (user.role !== 'superadmin' && user.pumpId) {
      pump = await Pump.findOne({ pumpId: user.pumpId });
      if (pump) {
        if (pump.isBlocked || pump.status === 'blocked') {
          return res.status(403).json({
            success: false,
            isBlocked: true,
            message:
              pump.blockReason ||
              'Your pump account has been suspended by Super Admin. Please contact platform support.',
          });
        }
        subMeta = computeSubscriptionMeta(pump);
      }
    }

    const payload = {
      userId: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      pumpId: user.pumpId || 'SYSTEM',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'petrol_pump_secret_key_2024', {
      expiresIn: process.env.JWT_EXPIRE || '30d',
    });

    if (user.pumpId) {
      await logAudit({
        pumpId: user.pumpId,
        userId: user._id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user._id,
        details: { role: user.role },
        req,
      });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      mobile: user.mobile,
      email: user.email,
      pumpId: user.pumpId,
    };

    const pumpResponse = pump
      ? {
          ...pump.toObject(),
          ...subMeta,
        }
      : {
          pumpName: user.role === 'superadmin' ? 'Super Admin Portal' : 'Petrol Pump Manager',
          pumpId: user.pumpId || 'SYSTEM',
          ...subMeta,
        };

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse,
      pump: pumpResponse,
      data: {
        token,
        user: userResponse,
        pump: pumpResponse,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let pump = null;
    let subMeta = { subscriptionStatus: 'active', isExpired: false };
    if (user.role !== 'superadmin' && user.pumpId) {
      pump = await Pump.findOne({ pumpId: user.pumpId });
      if (pump) {
        subMeta = computeSubscriptionMeta(pump);
      }
    }

    const pumpResponse = pump
      ? {
          ...pump.toObject(),
          ...subMeta,
        }
      : {
          pumpName: user.role === 'superadmin' ? 'Super Admin Portal' : 'Petrol Pump Manager',
          pumpId: user.pumpId || 'SYSTEM',
          ...subMeta,
        };

    return res.json({
      success: true,
      user,
      pump: pumpResponse,
      data: {
        user,
        pump: pumpResponse,
      },
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
