const jwt = require('jsonwebtoken');
const checkSubscription = require('./checkSubscription');

module.exports = async function (req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'petrol_pump_secret_key_2024');
    req.user = decoded; // { userId, username, role, pumpId }

    // Allow auth and superadmin routes without pump subscription check
    if (
      req.baseUrl === '/api/auth' ||
      req.baseUrl === '/api/superadmin' ||
      (req.baseUrl === '/api/settings' && req.method === 'GET')
    ) {
      return next();
    }

    // Run subscription check for pump operations
    return checkSubscription(req, res, next);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token is not valid or expired' });
  }
};
