const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    paymentId: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    adjustmentType: {
      type: String,
      required: true,
      enum: ['owner', 'vehicle'],
      default: 'owner',
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMode: {
      type: String,
      required: true,
      enum: ['Cash', 'UPI'],
      default: 'Cash',
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
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ pumpId: 1, paymentId: 1 }, { unique: true });
PaymentSchema.index({ pumpId: 1, ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);

