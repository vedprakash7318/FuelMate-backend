const Settings = require('../models/Settings');
const { logAudit } = require('../middleware/auditLog');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    let settings = await Settings.findOne({ pumpId });
    if (!settings) {
      settings = await Settings.create({
        pumpId,
        pumpName: 'Kripa Petrol Pump',
        pumpAddress: 'Main Highway Road',
        ownerName: 'Owner',
        mobile: '9876543210',
      });
    }
    return res.json({ success: true, data: settings });
  } catch (err) {
    console.error('getSettings error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const pumpId = req.user.pumpId;
    const { pumpName, pumpAddress, ownerName, mobile, email, gstNumber, licenseNumber, customVehicleTypes, customFuelTypes } = req.body;

    let settings = await Settings.findOne({ pumpId });
    if (!settings) {
      settings = new Settings({ pumpId });
    }

    if (pumpName) settings.pumpName = pumpName.trim();
    if (pumpAddress) settings.pumpAddress = pumpAddress.trim();
    if (ownerName) settings.ownerName = ownerName.trim();
    if (mobile) settings.mobile = mobile.trim();
    if (email !== undefined) settings.email = email ? email.trim() : undefined;
    if (gstNumber !== undefined) settings.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : undefined;
    if (licenseNumber !== undefined) settings.licenseNumber = licenseNumber ? licenseNumber.trim() : undefined;
    if (Array.isArray(customVehicleTypes)) settings.customVehicleTypes = customVehicleTypes;
    if (Array.isArray(customFuelTypes)) settings.customFuelTypes = customFuelTypes;

    await settings.save();

    await logAudit({
      pumpId,
      userId: req.user.userId,
      action: 'UPDATE_SETTINGS',
      entity: 'Settings',
      entityId: settings._id,
      details: { pumpName: settings.pumpName },
      req,
    });

    return res.json({ success: true, message: 'Pump settings updated successfully', data: settings });
  } catch (err) {
    console.error('updateSettings error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

