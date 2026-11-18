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

