require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Pump = require('../models/Pump');
const Owner = require('../models/Owner');
const Vehicle = require('../models/Vehicle');
const FuelPrice = require('../models/FuelPrice');
const FuelTransaction = require('../models/FuelTransaction');
const Payment = require('../models/Payment');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const AuditLog = require('../models/AuditLog');

async function seedSuperAdminSystem() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petrol_pump_db';
    console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`);
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB.');

    console.log('\n🧹 Clearing all collections for clean setup...');
    await Promise.all([
      User.deleteMany({}),
      Pump.deleteMany({}),
      Owner.deleteMany({}),
      Vehicle.deleteMany({}),
      FuelPrice.deleteMany({}),
      FuelTransaction.deleteMany({}),
      Payment.deleteMany({}),
      SubscriptionPlan.deleteMany({}),
      SubscriptionHistory.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('✅ All old data cleared.');

    // 1. Create Super Admin User
    console.log('\n👑 Creating Super Admin...');
    const salt = await bcrypt.genSalt(10);
    const superAdminPassword = await bcrypt.hash('superadmin123', salt);

    const superAdmin = await User.create({
      pumpId: 'SYSTEM',
      name: 'Platform Super Admin',
      mobile: '9999999999',
      email: 'superadmin@techsunited.in',
      username: 'superadmin',
      password: superAdminPassword,
      role: 'superadmin',
      status: 'active',
      address: 'Central Headquarters',
    });
    console.log(`✅ Super Admin created: username="superadmin" / password="superadmin123"`);

    // 2. Create Standard Subscription Plans
    console.log('\n📦 Creating Subscription Plans...');
    const plansData = [
      {
        name: '1 Week Trial',
        description: 'Free 7-day test drive for new petrol pumps',
        durationType: 'week',
        durationValue: 1,
        price: 0,
        features: [
          'Full Fuel Filling Register',
          'Khata Credit / Ledger',
          'Vehicle & Driver Management',
          'Instant Thermal Slip / Receipt',
          '7 Days Access',
        ],
        sortOrder: 1,
        createdBy: superAdmin._id,
      },
      {
        name: '1 Month Starter',
        description: 'Standard monthly plan for independent petrol pumps',
        durationType: 'month',
        durationValue: 1,
        price: 999,
        features: [
          'Unlimited Fuel Entries',
          'Unlimited Fleet Vehicles & Drivers',
          'WhatsApp Payment Reminders',
          'Daily Shift & Cashier Audit',
          '30 Days Validity',
        ],
        sortOrder: 2,
        createdBy: superAdmin._id,
      },
      {
        name: '3 Months Quarter',
        description: 'Quarterly subscription plan with 15% discount',
        durationType: 'month',
        durationValue: 3,
        price: 2499,
        features: [
          'All Starter Features',
          'Custom Vehicle & Fuel Types',
          'Multi-Staff Employee Accounts',
          'PDF Financial Statement Export',
          '90 Days Validity',
        ],
        sortOrder: 3,
        createdBy: superAdmin._id,
      },
      {
        name: '6 Months Growth',
        description: 'Half-yearly plan for busy highway fuel stations',
        durationType: 'month',
        durationValue: 6,
        price: 4499,
        features: [
          'All Quarter Features',
          'Multi-Pump Sync Ready',
          'Advanced Financial Reports',
          'Automated Audit Logging',
          '180 Days Validity',
        ],
        sortOrder: 4,
        createdBy: superAdmin._id,
      },
      {
        name: '1 Year Enterprise',
        description: 'Annual license with maximum savings & priority support',
        durationType: 'year',
        durationValue: 1,
        price: 7999,
        features: [
          'Complete Petrol Pump SaaS Suite',
          'Zero Downtime Guarantee',
          'Dedicated VIP Account Manager',
          'Free Setup & Historical Data Import',
          '365 Days Validity',
        ],
        sortOrder: 5,
        createdBy: superAdmin._id,
      },
    ];

    const createdPlans = await SubscriptionPlan.insertMany(plansData);
    console.log(`✅ Created ${createdPlans.length} Subscription Plans (Week / Month / Quarter / Half-Year / Annual)`);

    // 3. Create Default First Pump Admin with 1 Year Subscription
    console.log('\n⛽ Creating First Pump & Admin User...');
    const adminPassword = await bcrypt.hash('admin123', salt);
    const pumpId = 'PUMP001';

    const adminUser = await User.create({
      pumpId,
      name: 'Pump Admin',
      mobile: '9876543210',
      email: 'admin@techsunited.in',
      username: 'admin',
      password: adminPassword,
      role: 'owner',
      status: 'active',
      address: 'NH-27, Bypass Road, Lucknow, Uttar Pradesh',
      createdBy: superAdmin._id,
    });

    const annualPlan = createdPlans.find((p) => p.name === '1 Year Enterprise') || createdPlans[0];
    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year active

    const pump = await Pump.create({
      pumpId,
      pumpName: 'Kripa Indian Oil Kisan Seva Kendra',
      pumpAddress: 'NH-27, Bypass Road, Lucknow, Uttar Pradesh',
      ownerName: 'Pump Admin',
      mobile: '9876543210',
      email: 'admin@techsunited.in',
      gstNumber: '09AAACK1234F1Z8',
      licenseNumber: 'IOCL-EXP-2024-8891',
      subscriptionPlanId: annualPlan._id,
      subscriptionPlanName: annualPlan.name,
      subscriptionStartedAt: startedAt,
      subscriptionExpiresAt: expiresAt,
      subscriptionDurationType: 'year',
      subscriptionDurationValue: 1,
      subscriptionPrice: annualPlan.price,
      adminUserId: adminUser._id,
      status: 'active',
      isBlocked: false,
    });

    // Log to SubscriptionHistory
    await SubscriptionHistory.create({
      pumpId,
      pumpName: pump.pumpName,
      adminName: adminUser.name,
      planId: annualPlan._id,
      planName: annualPlan.name,
      durationType: 'year',
      durationValue: 1,
      price: annualPlan.price,
      startedAt,
      expiresAt,
      action: 'create',
      notes: 'Initial 1-Year Subscription granted by Super Admin',
      assignedBy: superAdmin._id,
    });

    // 4. Initial Fuel Rates
    await FuelPrice.create([
      {
        pumpId,
        fuelType: 'Petrol',
        price: 96.72,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
      {
        pumpId,
        fuelType: 'Diesel',
        price: 89.62,
        effectiveFrom: new Date(),
        setBy: adminUser._id,
      },
    ]);
    console.log(`✅ Base rates set for ${pump.pumpName}: Petrol ₹96.72/L | Diesel ₹89.62/L`);

    console.log('\n======================================================');
    console.log('🎉 PLATFORM SETUP & SEEDING COMPLETE');
    console.log('======================================================');
    console.log('👑 Super Admin Portal:');
    console.log('   URL:      /superadmin');
    console.log('   Username: "superadmin"');
    console.log('   Password: "superadmin123"');
    console.log('\n⛽ First Pump Admin (Owner):');
    console.log('   Pump ID:  "PUMP001"');
    console.log('   Username: "admin"');
    console.log('   Password: "admin123"');
    console.log(`   Validity: 1 Year (Expires on: ${expiresAt.toDateString()})`);
    console.log('   Data:     0 customers, 0 vehicles, 0 transactions');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err);
    process.exit(1);
  }
}

seedSuperAdminSystem();
