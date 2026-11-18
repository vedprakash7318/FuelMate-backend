const mongoose = require('mongoose');

const FuelPriceSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    fuelType: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

FuelPriceSchema.index({ pumpId: 1, fuelType: 1, effectiveFrom: -1 });

module.exports = mongoose.model('FuelPrice', FuelPriceSchema);

