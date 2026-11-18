const mongoose = require('mongoose');

const OwnerSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    alternateMobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pinCode: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    remark: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    totalVehicles: { type: Number, default: 0 },
    totalFuelAmount: { type: Number, default: 0 },
    totalPayment: { type: Number, default: 0 },
    totalOutstanding: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

OwnerSchema.index({ ownerId: 1, pumpId: 1 }, { unique: true });
OwnerSchema.index({ mobile: 1, pumpId: 1 });

module.exports = mongoose.model('Owner', OwnerSchema);

