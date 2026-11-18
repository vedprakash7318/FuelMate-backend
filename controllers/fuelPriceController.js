const FuelPrice = require('../models/FuelPrice');
const { logAudit } = require('../middleware/auditLog');

// GET /api/fuel-prices/current - Get current prices for all Fuel Types
exports.getCurrentPrices = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;

    // Fetch all price records sorted by latest effective date
    const allPrices = await FuelPrice.find({ pumpId }).sort({ effectiveFrom: -1 });

    const pricesMap = {
      Petrol: 96.72,
      Diesel: 89.62,
    };
    const lastUpdatedMap = {};
    const seenTypes = new Set();
    const list = [];

    allPrices.forEach((entry) => {
      if (!seenTypes.has(entry.fuelType)) {
        seenTypes.add(entry.fuelType);
        pricesMap[entry.fuelType] = entry.price;
        lastUpdatedMap[entry.fuelType] = entry.effectiveFrom;
        list.push({
          fuelType: entry.fuelType,
          price: entry.price,
          effectiveFrom: entry.effectiveFrom,
        });
      }
    });

    // Ensure Petrol and Diesel are present in list if not yet recorded
    if (!seenTypes.has('Diesel')) {
      list.unshift({ fuelType: 'Diesel', price: 89.62, effectiveFrom: null });
    }
    if (!seenTypes.has('Petrol')) {
      list.unshift({ fuelType: 'Petrol', price: 96.72, effectiveFrom: null });
    }

    return res.json({
      success: true,
      data: {
        ...pricesMap,
        fuelList: list,
        fuelTypes: Array.from(new Set(['Diesel', 'Petrol', ...Array.from(seenTypes)])),
        lastUpdatedPetrol: lastUpdatedMap.Petrol || null,
        lastUpdatedDiesel: lastUpdatedMap.Diesel || null,
      },
    });
  } catch (err) {
    console.error('getCurrentPrices error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/fuel-prices - Set/Create new fuel price (Owner only)
exports.setFuelPrice = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { fuelType, price } = req.body;

    if (!fuelType || typeof fuelType !== 'string' || !fuelType.trim()) {
      return res.status(400).json({ success: false, message: 'Valid fuelType name is required' });
    }

    const trimmedFuelType = fuelType.trim();

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive price per liter is required' });
    }

    const priceEntry = await FuelPrice.create({
      pumpId,
      fuelType: trimmedFuelType,
      price: Math.round(numPrice * 100) / 100, // round to 2 decimals
      effectiveFrom: new Date(),
      setBy: req.user.userId,
    });

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'SET_FUEL_PRICE',
      entity: 'FuelPrice',
      entityId: priceEntry._id,
      details: { fuelType, newPrice: priceEntry.price },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `${fuelType} price updated to ₹${priceEntry.price}/L`,
      data: priceEntry,
    });
  } catch (err) {
    console.error('setFuelPrice error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/fuel-prices/history - Price change history
exports.getPriceHistory = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { fuelType } = req.query;

    const query = { pumpId };
    if (fuelType && ['Petrol', 'Diesel'].includes(fuelType)) {
      query.fuelType = fuelType;
    }

    const history = await FuelPrice.find(query)
      .populate('setBy', 'name username')
      .sort({ effectiveFrom: -1 })
      .limit(50);

    return res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    console.error('getPriceHistory error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

