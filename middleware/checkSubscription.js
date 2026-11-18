const Pump = require('../models/Pump');
const User = require('../models/User');

/**
 * Middleware to strictly enforce subscription status and block checks
 * Superadmin bypasses all checks.
 * For Owners and Employees:
 * - Rejects if pump is blocked
 * - Rejects if pump subscription has expired
 * - Rejects if individual user is blocked
 */
module.exports = async function checkSubscription(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Super Admin has unrestricted platform access
    if (req.user.role === 'superadmin') {
      return next();
    }

    const { pumpId, userId } = req.user;

    // 1. Check User Level Block
    if (userId) {
      const user = await User.findById(userId).select('isBlocked blockReason status');
      if (user && (user.isBlocked || user.status === 'blocked')) {
        return res.status(403).json({
          success: false,
          isBlocked: true,
          message: user.blockReason || 'Your user account has been suspended. Please contact administrator.',
        });
      }
    }

    // 2. Check Pump Level Subscription & Block
    if (pumpId) {
      const pump = await Pump.findOne({ pumpId });
      if (pump) {
        // A. Is Pump Blocked?
        if (pump.isBlocked || pump.status === 'blocked') {
          return res.status(403).json({
            success: false,
            isBlocked: true,
            message:
              pump.blockReason ||
              'Your pump account has been suspended by Super Admin. Please contact platform support.',
          });
        }

        // B. Is Subscription Expired?
        if (pump.subscriptionExpiresAt) {
          const now = new Date();
          const expiresAt = new Date(pump.subscriptionExpiresAt);

          if (now > expiresAt) {
            return res.status(403).json({
              success: false,
              isExpired: true,
              message:
                'Your pump subscription has expired. Please contact Super Admin to renew your subscription plan.',
              expiresAt: pump.subscriptionExpiresAt,
              daysExpired: Math.ceil((now - expiresAt) / (1000 * 60 * 60 * 24)),
            });
          }
        }

        req.pump = pump;
      }
    }

    next();
  } catch (err) {
    console.error('checkSubscription error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify subscription status' });
  }
};
