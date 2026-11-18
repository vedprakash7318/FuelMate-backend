const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    vehicleId: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    vehicleName: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      required: true,
      trim: true,
      default: 'Truck',
    },
    fuelTypes: {
      type: [String],
      default: ['Diesel'],
    },
    fuelType: {
      type: String,
      required: true,
      trim: true,
      default: 'Diesel',
    },
    driverName: { type: String, required: true, trim: true },
    driverMobile: { type: String, required: true, trim: true },
    remark: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    totalFuelConsumed: { type: Number, default: 0 }, // in Liters
    totalFuelAmount: { type: Number, default: 0 },
    totalPayment: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

VehicleSchema.index({ vehicleNumber: 1, pumpId: 1 }, { unique: true });
VehicleSchema.index({ vehicleId: 1, pumpId: 1 });

module.exports = mongoose.model('Vehicle', VehicleSchema);

