const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAudit } = require('../middleware/auditLog');

// GET /api/users - List employees with search, filter, pagination
exports.getUsers = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { search, status, page = 1, limit = 20, all = 'false' } = req.query;

    const query = { pumpId, role: 'employee' };
    if (status) query.status = status;

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { name: regex },
        { username: regex },
        { mobile: regex },
        { email: regex },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    if (all === 'true' || limitNum <= 0) {
      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 });
      return res.json({
        success: true,
        count: users.length,
        total: users.length,
        page: 1,
        totalPages: 1,
        data: users,
      });
    }

    const skip = (pageNum - 1) * limitNum;
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    return res.json({
      success: true,
      count: users.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: users,
    });
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/users - Create employee
exports.createUser = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { name, mobile, email, username, password, address } = req.body;

    if (!name || !mobile || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, mobile, username, and password are required' });
    }

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      pumpId,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      role: 'employee',
      address: address ? address.trim() : undefined,
      createdBy: req.user.userId,
    });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'CREATE_EMPLOYEE',
      entity: 'User',
      entityId: user._id,
      details: { username: user.username, name: user.name },
      req,
    });

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(201).json({ success: true, message: 'Employee created successfully', data: userObj });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/users/:id - Update employee
exports.updateUser = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const { name, mobile, email, address, status } = req.body;

    const user = await User.findOne({ _id: id, pumpId, role: 'employee' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (name) user.name = name.trim();
    if (mobile) user.mobile = mobile.trim();
    if (email !== undefined) user.email = email ? email.toLowerCase().trim() : undefined;
    if (address !== undefined) user.address = address ? address.trim() : undefined;
    if (status) user.status = status;

    await user.save();

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'UPDATE_EMPLOYEE',
      entity: 'User',
      entityId: user._id,
      details: { name: user.name, status: user.status },
      req,
    });

    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ success: true, message: 'Employee updated successfully', data: userObj });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/users/:id/password - Reset employee password
exports.resetPassword = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ _id: id, pumpId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: user._id,
      details: { username: user.username },
      req,
    });

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/users/:id/activity - Employee activity logs
exports.getUserActivity = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { id } = req.params;
    const logs = await AuditLog.find({ pumpId, userId: id })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('getUserActivity error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

