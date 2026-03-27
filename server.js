const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cron = require('node-cron');
const { dailyStockDeduction } = require('./utils/stockCalculator');
const { checkLowStock, checkBillingAdjustments } = require('./utils/notificationChecker');
const { initializeFirstInstitution } = require('./utils/initInstitution');

dotenv.config();

connectDB().then(() => initializeFirstInstitution());

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://medicalmanegement.netlify.app',
    'https://project-jhz2u-git-main-medical3.vercel.app',
    'https://project-jhz2u-medical3.vercel.app'
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
app.use('/api/superadmin', require('./routes/superAdminRoutes'));

// Daily cron job - runs every day at midnight per institution
const Institution = require('./models/Institution');
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily jobs...');
  const institutions = await Institution.find({ isActive: true, subscriptionStatus: 'active' });
  for (const inst of institutions) {
    await dailyStockDeduction(inst._id);
    await checkLowStock(inst._id);
    await checkBillingAdjustments(inst._id);
  }
  // Check for expired subscriptions
  await Institution.updateMany(
    { subscriptionStatus: 'active', subscriptionEndDate: { $lt: new Date(), $ne: null } },
    { $set: { subscriptionStatus: 'expired' } }
  );
  console.log('Daily jobs completed');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
