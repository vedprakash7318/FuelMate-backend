require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const FuelPrice = require('../models/FuelPrice');
const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

const PUMP_ID = 'PUMP001';

async function resetCleanData() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petrol_pump_db';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');

    console.log('Wiping out ALL customer, vehicle, transaction, and payment data...');
    await Promise.all([
      Owner.deleteMany({}),
      Vehicle.deleteMany({}),
      FuelTransaction.deleteMany({}),
      Payment.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({}),
      FuelPrice.deleteMany({}),
      Settings.deleteMany({}),
    ]);
    console.log('Cleared all collections.');

    // 1. Create Default Pump Settings
    const settings = await Settings.create({
      pumpId: PUMP_ID,
      pumpName: 'Kripa Indian Oil Kisan Seva Kendra',
      pumpAddress: 'NH-27, Bypass Road, Lucknow, Uttar Pradesh',
      ownerName: 'Pump Admin',
      mobile: '9876543210',
      email: 'admin@kripapetrol.in',
      gstNumber: '09AAACK1234F1Z8',
      licenseNumber: 'IOCL-EXP-2024-8891',
      customVehicleTypes: ['Truck', 'Car', 'Bus', 'Tractor', 'Pickup', 'Commercial Vehicle', 'Auto', 'Two Wheeler', 'JCB', 'Dumper', 'Tanker', 'Other'],
    });
    console.log('Created Pump Settings:', settings.pumpName);

    // 2. Create SINGLE Admin / Owner Accounts (both 'admin' and 'owner' work)
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const ownerPassword = await bcrypt.hash('owner123', salt);

    const adminUser = await User.create({
      pumpId: PUMP_ID,
      name: 'Pump Admin (Owner)',
      mobile: '9876543210',
      email: 'admin@kripapetrol.in',
      username: 'admin',
      password: adminPassword,
      role: 'owner',
      status: 'active',
      address: 'Petrol Pump Campus',
    });

    // Also support 'owner' / 'owner123' as Admin for convenience
    await User.create({
      pumpId: PUMP_ID,
      name: 'Owner Rameshwar',
      mobile: '9876543210',
      email: 'owner@kripapetrol.in',
      username: 'owner',
      password: ownerPassword,
      role: 'owner',
      status: 'active',
      address: 'Petrol Pump Campus',
    });
    console.log('Created Admin User: username "admin" (pwd: "admin123") & "owner" (pwd: "owner123")');
    console.log('NO employee users created. Ready for you to add staff from scratch.');

    // 3. Set Base Fuel Prices (Owner can update anytime)
    await FuelPrice.create([
      {
        pumpId: PUMP_ID,
        fuelType: 'Petrol',
        price: 96.72,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
      {
        pumpId: PUMP_ID,
        fuelType: 'Diesel',
        price: 89.62,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
    ]);
    console.log('Base fuel prices initialized: Petrol ₹96.72/L, Diesel ₹89.62/L');

    // 4. Verify counts
    const counts = {
      owners: await Owner.countDocuments(),
      vehicles: await Vehicle.countDocuments(),
      fuelTransactions: await FuelTransaction.countDocuments(),
      payments: await Payment.countDocuments(),
      users: await User.countDocuments(),
    };

    console.log('\n--- VERIFICATION OF CLEAN DATABASE ---');
    console.log('Customer Owners:', counts.owners, '(All cleared)');
    console.log('Vehicles:', counts.vehicles, '(All cleared)');
    console.log('Fuel Transactions:', counts.fuelTransactions, '(All cleared)');
    console.log('Payments:', counts.payments, '(All cleared)');
    console.log('Admin Users:', counts.users, '(Admin only)');
    console.log('-------------------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Reset clean error:', err);
    process.exit(1);
  }
}

resetCleanData();
