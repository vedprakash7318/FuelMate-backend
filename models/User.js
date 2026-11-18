const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    pumpId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    username: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['owner', 'employee'], default: 'employee' },
    address: { type: String, trim: true },
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

UserSchema.index({ username: 1, pumpId: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);

