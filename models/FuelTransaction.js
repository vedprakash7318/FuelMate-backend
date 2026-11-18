const mongoose = require('mongoose');

const FuelTransactionSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    transactionId: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    fuelType: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    pricePerLiter: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      required: true,
      enum: ['Credit', 'Partial Payment', 'Full Payment'],
      default: 'Credit',
    },
    amountReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'UPI', null],
      default: null,
    },
    transactionRef: { type: String, trim: true },
    remark: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

FuelTransactionSchema.index({ pumpId: 1, transactionId: 1 }, { unique: true });
FuelTransactionSchema.index({ pumpId: 1, ownerId: 1, createdAt: -1 });
FuelTransactionSchema.index({ pumpId: 1, vehicleId: 1, createdAt: -1 });

module.exports = mongoose.model('FuelTransaction', FuelTransactionSchema);

