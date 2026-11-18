const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    durationType: {
      type: String,
      enum: ['week', 'month', 'year', 'day'],
      required: true,
      default: 'month',
    },
    durationValue: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0, default: 0 },
    features: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
