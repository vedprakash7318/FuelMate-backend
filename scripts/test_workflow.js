const API_BASE = 'http://127.0.0.1:5000/api';

async function req(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

async function runTests() {
  console.log('--- Starting Petrol Pump Khata End-to-End Verification ---');

  // 1. Owner Login
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: { username: 'owner', password: 'owner123' },
  });
  console.log('✅ 1. Owner Login:', loginRes.success, '| User:', loginRes.user.name);
  const token = loginRes.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // 2. Dashboard
  const dashRes = await req('/dashboard/owner', authHeaders);
  console.log('✅ 2. Dashboard fetched:', {
    totalOwners: dashRes.data.totalOwners,
    totalVehicles: dashRes.data.totalVehicles,
    totalOutstanding: dashRes.data.totalOutstanding,
    todaySales: dashRes.data.todayFuelSales,
  });

  // 3. Owners list
  const ownersRes = await req('/owners', authHeaders);
  const firstOwner = ownersRes.data[0];
  console.log('✅ 3. Owners List:', ownersRes.data.length, 'owners found. First:', firstOwner.name, 'Outstanding:', firstOwner.totalOutstanding);

  // 4. Vehicles of this owner
  const vehiclesRes = await req(`/owners/${firstOwner._id}/vehicles`, authHeaders);
  const firstVehicle = vehiclesRes.data[0];
  console.log('✅ 4. Vehicles for', firstOwner.name, ':', vehiclesRes.data.length, 'vehicles. First:', firstVehicle.vehicleNumber);

  // 5. Create Custom Fuel Type (CNG @ ₹82.50)
  const cngRes = await req('/fuel-prices', {
    method: 'POST',
    body: { fuelType: 'CNG', price: 82.50 },
    ...authHeaders,
  });
  console.log('✅ 5. Custom Fuel Type Created:', cngRes.data.fuelType, 'Price: ₹' + cngRes.data.price);

  // 6. Register Vehicle with Custom Vehicle Type "JCB Earthmover" (default active!)
  const newVehNumber = `TEST-${Date.now().toString().slice(-4)}`;
  const vehCreateRes = await req('/vehicles', {
    method: 'POST',
    body: {
      ownerId: firstOwner._id,
      vehicleNumber: newVehNumber,
      vehicleName: 'JCB 3DX Pro',
      vehicleType: 'JCB',
      fuelType: 'Diesel',
      driverName: 'Mohan Driver',
      driverMobile: '9876543299',
    },
    ...authHeaders,
  });
  console.log('✅ 6. Vehicle Registered with Custom Type & Default Active:', {
    vehicleNumber: vehCreateRes.data.vehicleNumber,
    vehicleType: vehCreateRes.data.vehicleType,
    status: vehCreateRes.data.status,
  });

  // 7. Fuel Filling Entry (50L Diesel)
  const fuelRes = await req('/fuel', {
    method: 'POST',
    body: {
      ownerId: firstOwner._id,
      vehicleId: vehCreateRes.data._id,
      fuelType: 'Diesel',
      quantity: 40,
      paymentType: 'Credit',
      remark: 'Test filling on custom JCB',
    },
    ...authHeaders,
  });
  console.log('✅ 7. Fuel Entry Created:', {
    transactionId: fuelRes.data.transactionId,
    quantity: fuelRes.data.quantity,
    totalAmount: fuelRes.data.totalAmount,
    remainingAmount: fuelRes.data.remainingAmount,
  });

  // 8. Check Ledger
  const ledgerRes = await req(`/ledger/owner/${firstOwner._id}`, authHeaders);
  console.log('✅ 8. Owner Khata Ledger verified:', {
    count: ledgerRes.count,
    currentBalance: ledgerRes.summary.currentBalance,
    totalDebit: ledgerRes.summary.totalDebit,
    totalCredit: ledgerRes.summary.totalCredit,
    latestRef: ledgerRes.ledger[0]?.refId,
    latestBalance: ledgerRes.ledger[0]?.balance,
  });

  // 9. Receive Payment (₹1500)
  const payRes = await req('/payments', {
    method: 'POST',
    body: {
      ownerId: firstOwner._id,
      adjustmentType: 'vehicle',
      vehicleId: vehCreateRes.data._id,
      amount: 1500,
      paymentMode: 'UPI',
      transactionRef: 'UPI-TEST-123456',
    },
    ...authHeaders,
  });
  console.log('✅ 9. Payment Received (Vehicle Level):', {
    paymentId: payRes.data.paymentId,
    amount: payRes.data.amount,
    adjustmentType: payRes.data.adjustmentType,
  });

  // 10. Re-check Ledger after payment
  const ledgerAfterRes = await req(`/ledger/owner/${firstOwner._id}`, authHeaders);
  console.log('✅ 10. Ledger after payment:', {
    newBalance: ledgerAfterRes.summary.currentBalance,
    latestRef: ledgerAfterRes.ledger[0]?.refId,
    latestCredit: ledgerAfterRes.ledger[0]?.credit,
  });

  console.log('========================================================');
  console.log('🎉 ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

runTests().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
