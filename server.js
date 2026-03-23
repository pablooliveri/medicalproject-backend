const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cron = require('node-cron');
const { dailyStockDeduction } = require('./utils/stockCalculator');
const { checkLowStock, checkBillingAdjustments } = require('./utils/notificationChecker');

dotenv.config();

connectDB();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://medicalsite-pablo.netlify.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/residents', require('./routes/residentRoutes'));
app.use('/api/medications', require('./routes/medicationRoutes'));
app.use('/api/resident-medications', require('./routes/residentMedicationRoutes'));
app.use('/api/deliveries', require('./routes/deliveryRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/medication-history', require('./routes/medicationHistoryRoutes'));
app.use('/api/billing', require('./routes/billingRoutes'));

// Daily cron job - runs every day at midnight to deduct daily medication
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily stock deduction...');
  await dailyStockDeduction();
  await checkLowStock();
  await checkBillingAdjustments();
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
