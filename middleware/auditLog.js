const AuditLog = require('../models/AuditLog');

const logAudit = async ({ pumpId, userId, action, entity, entityId, details, req }) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '127.0.0.1';
    await AuditLog.create({
      pumpId,
      userId,
      action,
      entity,
      entityId,
      details,
      ip,
    });
  } catch (err) {
    console.error('AuditLog error:', err.message);
  }
};

module.exports = { logAudit };

