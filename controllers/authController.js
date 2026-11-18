const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { logAudit } = require('../middleware/auditLog');

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact owner.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const payload = {
      userId: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      pumpId: user.pumpId,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'petrol_pump_secret_key_2024', {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });

    // Fetch pump settings if available
    const settings = await Settings.findOne({ pumpId: user.pumpId });

    await logAudit({
      pumpId: user.pumpId,
      userId: user._id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id,
      details: { role: user.role },
      req,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        mobile: user.mobile,
        email: user.email,
        pumpId: user.pumpId,
      },
      pump: settings || { pumpName: 'Petrol Pump Manager', pumpId: user.pumpId },
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
    const settings = await Settings.findOne({ pumpId: user.pumpId });
    return res.json({
      success: true,
      user,
      pump: settings || { pumpName: 'Petrol Pump Manager', pumpId: user.pumpId },
    });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

