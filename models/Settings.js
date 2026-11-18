const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, unique: true, index: true },
    pumpName: { type: String, required: true, trim: true },
    pumpAddress: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },

    // Subscription Details
    subscriptionPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    subscriptionPlanName: { type: String, default: 'Trial' },
    subscriptionStartedAt: { type: Date, default: Date.now },
    subscriptionExpiresAt: { type: Date },
    subscriptionDurationType: {
      type: String,
      enum: ['week', 'month', 'year', 'day'],
      default: 'month',
    },
    subscriptionDurationValue: { type: Number, default: 1 },
    subscriptionPrice: { type: Number, default: 0 },

    // Admin & Status
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'blocked', 'expired'],
      default: 'active',
    },

    customVehicleTypes: {
      type: [String],
      default: ['Truck', 'Car', 'Bus', 'Tractor', 'Pickup', 'Commercial Vehicle', 'Auto', 'Two Wheeler', 'Other'],
    },
    customFuelTypes: {
      type: [String],
      default: ['Diesel', 'Petrol', 'CNG', 'Speed/XP95'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', SettingsSchema);
