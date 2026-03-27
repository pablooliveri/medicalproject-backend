const Institution = require('../models/Institution');
const User = require('../models/User');
const Resident = require('../models/Resident');
const Medication = require('../models/Medication');
const ResidentMedication = require('../models/ResidentMedication');
const Delivery = require('../models/Delivery');
const StockMovement = require('../models/StockMovement');
const MedicationHistory = require('../models/MedicationHistory');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const BillingConfig = require('../models/BillingConfig');
const MonthlyStatement = require('../models/MonthlyStatement');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');
const bcrypt = require('bcryptjs');

// GET /api/superadmin/dashboard
const getDashboard = async (req, res) => {
  try {
    const [total, active, blocked, expired] = await Promise.all([
      Institution.countDocuments(),
      Institution.countDocuments({ isActive: true, subscriptionStatus: 'active' }),
      Institution.countDocuments({ subscriptionStatus: 'blocked' }),
      Institution.countDocuments({ subscriptionStatus: 'expired' })
    ]);

    const recentInstitutions = await Institution.find()
      .sort({ createdAt: -1 })
      .limit(5);

    const expiringInstitutions = await Institution.find({
      subscriptionStatus: 'active',
      subscriptionEndDate: { $ne: null, $lte: new Date(Date.now() + 30 * 86400000) }
    }).sort({ subscriptionEndDate: 1 }).limit(5);

    res.json({
      stats: { total, active, blocked, expired },
      recentInstitutions,
      expiringInstitutions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/superadmin/institutions
const getInstitutions = async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (status && status !== 'all') {
      filter.subscriptionStatus = status;
    }

    const institutions = await Institution.find(filter).sort({ createdAt: -1 });

    // Add resident count for each
    const result = await Promise.all(institutions.map(async (inst) => {
      const residentsCount = await Resident.countDocuments({ institution: inst._id, isActive: true });
      return { ...inst.toJSON(), residentsCount };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/superadmin/institutions
const createInstitution = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const slug = username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const institution = await Institution.create({
      name: username,
      slug,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date()
    });

    // Create admin user for this institution
    const adminUser = await User.create({
      username,
      password,
      name: `${username} Admin`,
      role: 'institution_admin',
      institution: institution._id
    });

    // Create default settings for this institution
    await Settings.create({
      companyName: username,
      institution: institution._id
    });

    res.status(201).json({
      institution,
      credentials: {
        username: adminUser.username,
        password
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/superadmin/institutions/:id
const getInstitution = async (req, res) => {
  try {
    const institution = await Institution.findById(req.params.id);
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    const [residentsCount, medicationsCount, usersCount] = await Promise.all([
      Resident.countDocuments({ institution: institution._id, isActive: true }),
      Medication.countDocuments({ institution: institution._id, isActive: true }),
      User.countDocuments({ institution: institution._id })
    ]);

    const users = await User.find({ institution: institution._id, role: { $ne: 'superadmin' } }).select('-password');
    const settings = await Settings.findOne({ institution: institution._id });

    res.json({
      ...institution.toJSON(),
      stats: { residentsCount, medicationsCount, usersCount },
      users,
      settings: settings ? { companyName: settings.companyName, address: settings.address, phone: settings.phone, email: settings.email } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/institutions/:id
const updateInstitution = async (req, res) => {
  try {
    const { name, contactName, contactEmail, contactPhone, address, notes } = req.body;
    const institution = await Institution.findByIdAndUpdate(
      req.params.id,
      { name, contactName, contactEmail, contactPhone, address, notes },
      { returnDocument: 'after', runValidators: true }
    );
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }
    res.json(institution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/institutions/:id/status
const updateStatus = async (req, res) => {
  try {
    const { isActive, subscriptionStatus } = req.body;
    const update = {};
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (subscriptionStatus) update.subscriptionStatus = subscriptionStatus;

    const institution = await Institution.findByIdAndUpdate(
      req.params.id, update, { returnDocument: 'after' }
    );
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }
    res.json(institution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/institutions/:id/subscription
const updateSubscription = async (req, res) => {
  try {
    const { subscriptionStatus, subscriptionStartDate, subscriptionEndDate } = req.body;
    const institution = await Institution.findByIdAndUpdate(
      req.params.id,
      { subscriptionStatus, subscriptionStartDate, subscriptionEndDate },
      { returnDocument: 'after' }
    );
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }
    res.json(institution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/institutions/:id/reset-password
const resetPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const user = await User.findOne({ _id: userId, institution: req.params.id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot reset superadmin password from here' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/institutions/:id/update-user
const updateUser = async (req, res) => {
  try {
    const { userId, username } = req.body;
    const user = await User.findOne({ _id: userId, institution: req.params.id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin from here' });
    }
    if (username) {
      const existing = await User.findOne({ username, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }
    await user.save();
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/superadmin/institutions/:id
const deleteInstitution = async (req, res) => {
  try {
    const instId = req.params.id;
    const institution = await Institution.findById(instId);
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    const filter = { institution: instId };

    // Delete all data belonging to this institution
    await Promise.all([
      Payment.deleteMany(filter),
      Expense.deleteMany(filter),
      MonthlyStatement.deleteMany(filter),
      BillingConfig.deleteMany(filter),
      Notification.deleteMany(filter),
      MedicationHistory.deleteMany(filter),
      StockMovement.deleteMany(filter),
      Delivery.deleteMany(filter),
      ResidentMedication.deleteMany(filter),
      Medication.deleteMany(filter),
      Resident.deleteMany(filter),
      Settings.deleteMany(filter),
      User.deleteMany(filter)
    ]);

    await Institution.findByIdAndDelete(instId);

    res.json({ message: 'Institution and all its data deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/superadmin/account
const updateAccount = async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (username && username !== user.username) {
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword;
    }

    await user.save();
    res.json({ message: 'Account updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboard,
  getInstitutions,
  createInstitution,
  getInstitution,
  updateInstitution,
  updateStatus,
  updateSubscription,
  resetPassword,
  updateUser,
  deleteInstitution,
  updateAccount
};
