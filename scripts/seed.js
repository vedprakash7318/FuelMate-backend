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

const PUMP_ID = 'PUMP001';

async function seedData() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petrol_pump_db';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');

    console.log('Clearing existing data for pump:', PUMP_ID);
    await Promise.all([
      User.deleteMany({ pumpId: PUMP_ID }),
      Owner.deleteMany({ pumpId: PUMP_ID }),
      Vehicle.deleteMany({ pumpId: PUMP_ID }),
      FuelPrice.deleteMany({ pumpId: PUMP_ID }),
      FuelTransaction.deleteMany({ pumpId: PUMP_ID }),
      Payment.deleteMany({ pumpId: PUMP_ID }),
      Settings.deleteMany({ pumpId: PUMP_ID }),
    ]);

    // 1. Settings
    const settings = await Settings.create({
      pumpId: PUMP_ID,
      pumpName: 'Kripa Indian Oil Kisan Seva Kendra',
      pumpAddress: 'NH-27, Bypass Road, Lucknow, Uttar Pradesh',
      ownerName: 'Rameshwar Dayal',
      mobile: '9876543210',
      email: 'contact@kripapetrol.in',
      gstNumber: '09AAACK1234F1Z8',
      licenseNumber: 'IOCL-EXP-2024-8891',
    });
    console.log('Created Settings:', settings.pumpName);

    // 2. Users (Owner & Employee)
    const salt = await bcrypt.genSalt(10);
    const ownerPassword = await bcrypt.hash('owner123', salt);
    const empPassword = await bcrypt.hash('emp123', salt);

    const ownerUser = await User.create({
      pumpId: PUMP_ID,
      name: 'Rameshwar Dayal (Owner)',
      mobile: '9876543210',
      email: 'owner@kripapetrol.in',
      username: 'owner',
      password: ownerPassword,
      role: 'owner',
      status: 'active',
      address: 'Civil Lines, Lucknow',
    });

    const empUser = await User.create({
      pumpId: PUMP_ID,
      name: 'Suresh Kumar (Cashier)',
      mobile: '9876543211',
      email: 'suresh@kripapetrol.in',
      username: 'employee',
      password: empPassword,
      role: 'employee',
      status: 'active',
      address: 'Transport Nagar, Lucknow',
      createdBy: ownerUser._id,
    });
    console.log('Created Users: owner / owner123 and employee / emp123');

    // 3. Fuel Prices
    await FuelPrice.create([
      {
        pumpId: PUMP_ID,
        fuelType: 'Petrol',
        price: 96.72,
        effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        setBy: ownerUser._id,
      },
      {
        pumpId: PUMP_ID,
        fuelType: 'Diesel',
        price: 89.62,
        effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        setBy: ownerUser._id,
      },
    ]);
    console.log('Created Fuel Prices: Petrol ₹96.72/L, Diesel ₹89.62/L');

    // 4. Sample Khata Owners (Customers)
    const ownersData = [
      {
        ownerId: 'OWN-001',
        name: 'Rajesh Sharma',
        mobile: '9812345671',
        email: 'rajesh@sharmatransport.com',
        address: 'Plot 14, Transport Nagar',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pinCode: '226012',
        companyName: 'Sharma Transport Co.',
        gstNumber: '09AAAPS1122D1Z1',
      },
      {
        ownerId: 'OWN-002',
        name: 'Amit Verma',
        mobile: '9812345672',
        address: 'Bhattha Road, Mohanlalganj',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pinCode: '226301',
        companyName: 'Verma Brick Kiln & Logistics',
      },
      {
        ownerId: 'OWN-003',
        name: 'Gurpreet Singh',
        mobile: '9812345673',
        address: 'GT Road, Near Toll Plaza',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        pinCode: '208001',
        companyName: 'Punjab Roadlines',
      },
      {
        ownerId: 'OWN-004',
        name: 'Manoj Yadav',
        mobile: '9812345674',
        address: 'Village Gosainganj',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pinCode: '226501',
        companyName: 'Yadav Kisan Agro Farms',
      },
      {
        ownerId: 'OWN-005',
        name: 'Dinesh Patel',
        mobile: '9812345675',
        address: 'Sector 8, Ring Road',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pinCode: '226020',
        companyName: 'Patel Earthmovers & Construction',
      },
    ];

    const createdOwners = [];
    for (const o of ownersData) {
      const doc = await Owner.create({
        ...o,
        pumpId: PUMP_ID,
        status: 'active',
        createdBy: empUser._id,
      });
      createdOwners.push(doc);
    }
    console.log(`Created ${createdOwners.length} Customer Owners (OWN-001 to OWN-005)`);

    // 5. Sample Vehicles
    const vehiclesData = [
      {
        vehicleId: 'VEH-001',
        ownerIndex: 0,
        vehicleNumber: 'UP32AB1234',
        vehicleName: 'Tata Prima 4028.S Truck',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Ramu Pal',
        driverMobile: '9123456781',
      },
      {
        vehicleId: 'VEH-002',
        ownerIndex: 0,
        vehicleNumber: 'UP32CD5678',
        vehicleName: 'Eicher Pro 3019',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Mithilesh Yadav',
        driverMobile: '9123456782',
      },
      {
        vehicleId: 'VEH-003',
        ownerIndex: 1,
        vehicleNumber: 'UP32EF9012',
        vehicleName: 'Mahindra Blazo X Tipper',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Kallu Bhai',
        driverMobile: '9123456783',
      },
      {
        vehicleId: 'VEH-004',
        ownerIndex: 1,
        vehicleNumber: 'UP32GH3456',
        vehicleName: 'Tata Ace Gold (Chota Hathi)',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Sonu Rawat',
        driverMobile: '9123456784',
      },
      {
        vehicleId: 'VEH-005',
        ownerIndex: 2,
        vehicleNumber: 'PB08XY7890',
        vehicleName: 'BharatBenz 2823C Multi-Axle',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Harpreet Singh',
        driverMobile: '9123456785',
      },
      {
        vehicleId: 'VEH-006',
        ownerIndex: 2,
        vehicleNumber: 'PB08MN4321',
        vehicleName: 'Ashok Leyland 4220 HG',
        vehicleType: 'Truck',
        fuelType: 'Diesel',
        driverName: 'Jaswant Sandhu',
        driverMobile: '9123456786',
      },
      {
        vehicleId: 'VEH-007',
        ownerIndex: 3,
        vehicleNumber: 'UP32KL6543',
        vehicleName: 'Mahindra 575 DI Tractor',
        vehicleType: 'Tractor',
        fuelType: 'Diesel',
        driverName: 'Santosh Yadav',
        driverMobile: '9123456787',
      },
      {
        vehicleId: 'VEH-008',
        ownerIndex: 3,
        vehicleNumber: 'UP32PQ8765',
        vehicleName: 'Mahindra Bolero Camper Pickup',
        vehicleType: 'Car',
        fuelType: 'Diesel',
        driverName: 'Brijesh Kumar',
        driverMobile: '9123456788',
      },
      {
        vehicleId: 'VEH-009',
        ownerIndex: 4,
        vehicleNumber: 'UP32RS2345',
        vehicleName: 'JCB 3DX Super Eco Excavator',
        vehicleType: 'Other',
        fuelType: 'Diesel',
        driverName: 'Anil Operator',
        driverMobile: '9123456789',
      },
      {
        vehicleId: 'VEH-010',
        ownerIndex: 4,
        vehicleNumber: 'UP32TC6789',
        vehicleName: 'Toyota Fortuner (Boss Car)',
        vehicleType: 'Car',
        fuelType: 'Diesel',
        driverName: 'Dinesh Patel (Self)',
        driverMobile: '9812345675',
      },
    ];

    const createdVehicles = [];
    for (const v of vehiclesData) {
      const owner = createdOwners[v.ownerIndex];
      const doc = await Vehicle.create({
        pumpId: PUMP_ID,
        vehicleId: v.vehicleId,
        ownerId: owner._id,
        vehicleNumber: v.vehicleNumber,
        vehicleName: v.vehicleName,
        vehicleType: v.vehicleType,
        fuelType: v.fuelType,
        driverName: v.driverName,
        driverMobile: v.driverMobile,
        status: 'active',
        createdBy: empUser._id,
      });
      createdVehicles.push(doc);
      await Owner.findByIdAndUpdate(owner._id, { $inc: { totalVehicles: 1 } });
    }
    console.log(`Created ${createdVehicles.length} Vehicles (VEH-001 to VEH-010)`);

    // 6. Fuel Transactions (20 realistic transactions over past 20 days)
    const txns = [
      { vIdx: 0, qty: 100, payType: 'Credit', rec: 0, daysAgo: 18 },
      { vIdx: 1, qty: 80, payType: 'Credit', rec: 0, daysAgo: 17 },
      { vIdx: 2, qty: 120, payType: 'Credit', rec: 0, daysAgo: 16 },
      { vIdx: 3, qty: 40, payType: 'Partial Payment', rec: 1500, daysAgo: 15 },
      { vIdx: 4, qty: 150, payType: 'Credit', rec: 0, daysAgo: 14 },
      { vIdx: 5, qty: 140, payType: 'Credit', rec: 0, daysAgo: 13 },
      { vIdx: 6, qty: 50, payType: 'Credit', rec: 0, daysAgo: 12 },
      { vIdx: 7, qty: 60, payType: 'Full Payment', rec: 60 * 89.62, daysAgo: 11 },
      { vIdx: 8, qty: 110, payType: 'Credit', rec: 0, daysAgo: 10 },
      { vIdx: 9, qty: 70, payType: 'Partial Payment', rec: 3000, daysAgo: 9 },
      { vIdx: 0, qty: 95, payType: 'Credit', rec: 0, daysAgo: 8 },
      { vIdx: 1, qty: 85, payType: 'Credit', rec: 0, daysAgo: 7 },
      { vIdx: 2, qty: 130, payType: 'Credit', rec: 0, daysAgo: 6 },
      { vIdx: 4, qty: 125, payType: 'Credit', rec: 0, daysAgo: 5 },
      { vIdx: 5, qty: 115, payType: 'Credit', rec: 0, daysAgo: 4 },
      { vIdx: 6, qty: 45, payType: 'Credit', rec: 0, daysAgo: 3 },
      { vIdx: 7, qty: 55, payType: 'Credit', rec: 0, daysAgo: 2 },
      { vIdx: 8, qty: 105, payType: 'Credit', rec: 0, daysAgo: 1 },
      { vIdx: 0, qty: 110, payType: 'Credit', rec: 0, daysAgo: 0 },
      { vIdx: 3, qty: 35, payType: 'Credit', rec: 0, daysAgo: 0 },
    ];

    let txnCounter = 1;
    for (const t of txns) {
      const veh = createdVehicles[t.vIdx];
      const owner = createdOwners.find((o) => o._id.toString() === veh.ownerId.toString());
      const price = 89.62; // Diesel
      const totalAmount = Math.round(t.qty * price * 100) / 100;
      const rec = Math.round(t.rec * 100) / 100;
      const remaining = Math.round((totalAmount - rec) * 100) / 100;
      const date = new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000);

      const txnId = `TXN-${String(txnCounter++).padStart(3, '0')}`;
      await FuelTransaction.create({
        pumpId: PUMP_ID,
        transactionId: txnId,
        ownerId: owner._id,
        vehicleId: veh._id,
        fuelType: 'Diesel',
        quantity: t.qty,
        pricePerLiter: price,
        totalAmount,
        paymentType: t.payType,
        amountReceived: rec,
        remainingAmount: remaining,
        remark: `Trip fuel fill #${txnId}`,
        status: 'active',
        createdBy: empUser._id,
        createdAt: date,
        updatedAt: date,
      });

      // Update vehicle
      await Vehicle.findByIdAndUpdate(veh._id, {
        $inc: {
          totalFuelConsumed: t.qty,
          totalFuelAmount: totalAmount,
          totalPayment: rec,
          pendingBalance: remaining,
        },
      });

      // Update owner
      await Owner.findByIdAndUpdate(owner._id, {
        $inc: {
          totalFuelAmount: totalAmount,
          totalPayment: rec,
          totalOutstanding: remaining,
        },
      });
    }
    console.log(`Created 20 Fuel Transactions (TXN-001 to TXN-020)`);

    // 7. Payments Received (10 payments)
    const paymentsData = [
      { oIdx: 0, vIdx: 0, adj: 'vehicle', amt: 8000, mode: 'UPI', ref: 'UPI9837261827', daysAgo: 14 },
      { oIdx: 0, vIdx: null, adj: 'owner', amt: 10000, mode: 'Bank Transfer', ref: 'NEFT-HDFC-9912', daysAgo: 7 },
      { oIdx: 1, vIdx: 2, adj: 'vehicle', amt: 10000, mode: 'Cash', ref: '', daysAgo: 13 },
      { oIdx: 1, vIdx: null, adj: 'owner', amt: 5000, mode: 'UPI', ref: 'UPI8829102918', daysAgo: 5 },
      { oIdx: 2, vIdx: 4, adj: 'vehicle', amt: 12000, mode: 'Bank Transfer', ref: 'RTGS-PUNB-4412', daysAgo: 10 },
      { oIdx: 2, vIdx: null, adj: 'owner', amt: 15000, mode: 'Cheque', ref: 'CHQ-882191', daysAgo: 3 },
      { oIdx: 3, vIdx: null, adj: 'owner', amt: 4000, mode: 'Cash', ref: '', daysAgo: 8 },
      { oIdx: 4, vIdx: 8, adj: 'vehicle', amt: 9000, mode: 'UPI', ref: 'UPI7728192019', daysAgo: 6 },
      { oIdx: 4, vIdx: null, adj: 'owner', amt: 5000, mode: 'Cash', ref: '', daysAgo: 2 },
      { oIdx: 0, vIdx: null, adj: 'owner', amt: 5000, mode: 'UPI', ref: 'UPI3392817261', daysAgo: 1 },
    ];

    let payCounter = 1;
    for (const p of paymentsData) {
      const owner = createdOwners[p.oIdx];
      const veh = p.vIdx !== null ? createdVehicles[p.vIdx] : null;
      const date = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000);
      const payId = `PAY-${String(payCounter++).padStart(3, '0')}`;

      await Payment.create({
        pumpId: PUMP_ID,
        paymentId: payId,
        ownerId: owner._id,
        adjustmentType: p.adj,
        vehicleId: veh ? veh._id : undefined,
        amount: p.amt,
        paymentMode: p.mode,
        transactionRef: p.ref || undefined,
        remark: `Account payment clearance #${payId}`,
        status: 'active',
        receivedBy: empUser._id,
        createdAt: date,
        updatedAt: date,
      });

      // Update Owner
      await Owner.findByIdAndUpdate(owner._id, {
        $inc: {
          totalPayment: p.amt,
          totalOutstanding: -p.amt,
        },
      });

      // Update Vehicle if vehicle-level
      if (veh) {
        await Vehicle.findByIdAndUpdate(veh._id, {
          $inc: {
            totalPayment: p.amt,
            pendingBalance: -p.amt,
          },
        });
      }
    }
    console.log(`Created 10 Payments (PAY-001 to PAY-010)`);

    console.log('\n======================================================');
    console.log('✅ SEEDING COMPLETE FOR PETROL PUMP KHATA MANAGEMENT');
    console.log('======================================================');
    console.log('Credentials:');
    console.log('  👑 Owner Login:    username: "owner"     password: "owner123"');
    console.log('  👷 Employee Login: username: "employee"  password: "emp123"');
    console.log('Pump ID: PUMP001');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed Error:', err);
    process.exit(1);
  }
}

seedData();
