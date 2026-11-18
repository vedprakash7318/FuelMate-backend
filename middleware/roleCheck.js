const ownerOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Access denied: Owner privileges required' });
  }
  next();
};

const employeeOrOwner = (req, res, next) => {
  if (!req.user || !['owner', 'employee'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied: Valid user role required' });
  }
  next();
};

module.exports = {
  ownerOnly,
  employeeOrOwner,
};

