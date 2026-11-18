const mongoose = require('mongoose');

const SubscriptionHistorySchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    pumpName: { type: String, trim: true },
    adminName: { type: String, trim: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    planName: { type: String, trim: true },
    durationType: { type: String, enum: ['week', 'month', 'year', 'day'], required: true },
    durationValue: { type: Number, required: true },
    price: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    action: {
      type: String,
      enum: ['create', 'renew', 'extend', 'modify'],
      default: 'create',
    },
    notes: { type: String, trim: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionHistory', SubscriptionHistorySchema);
