require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();

const path = require('path');
const fs = require('fs');

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? (process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN.split(',').map((s) => s.trim()))
  : '*';

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superAdminRoutes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/owners', require('./routes/owners'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/fuel-prices', require('./routes/fuelPrices'));
app.use('/api/fuel', require('./routes/fuel'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// Root & Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Petrol Pump Khata Management API is running',
    timestamp: new Date(),
  });
});

// Serve static frontend assets if built
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Petrol Pump Backend running on port ${PORT}`);
  console.log(`🌐 API Health: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

module.exports = app;
