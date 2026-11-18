const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },
    entity: { type: String, required: true, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '127.0.0.1' },
  },
  { timestamps: true }
);

AuditLogSchema.index({ pumpId: 1, createdAt: -1 });
AuditLogSchema.index({ pumpId: 1, userId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);

