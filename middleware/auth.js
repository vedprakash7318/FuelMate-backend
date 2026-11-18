const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'petrol_pump_secret_key_2024');
    req.user = decoded; // { userId, username, role, pumpId }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token is not valid or expired' });
  }
};

