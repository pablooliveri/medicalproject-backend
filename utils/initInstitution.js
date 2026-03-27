const Institution = require('../models/Institution');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Resident = require('../models/Resident');
const Medication = require('../models/Medication');
const ResidentMedication = require('../models/ResidentMedication');
const Delivery = require('../models/Delivery');
const StockMovement = require('../models/StockMovement');
const MedicationHistory = require('../models/MedicationHistory');
const Notification = require('../models/Notification');
const BillingConfig = require('../models/BillingConfig');
const MonthlyStatement = require('../models/MonthlyStatement');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');

const initializeFirstInstitution = async () => {
  try {
    // Fix: ensure superadmin users are never linked to an institution
    const fixResult = await User.updateMany(
      { role: 'superadmin', institution: { $ne: null } },
      { $set: { institution: null } }
    );
    if (fixResult.modifiedCount > 0) {
      console.log(`[Init] Unlinked ${fixResult.modifiedCount} superadmin user(s) from institutions`);
    }

    // Ensure every institution has at least one admin user
    const allInstitutions = await Institution.find();
    for (const inst of allInstitutions) {
      const hasAdmin = await User.findOne({ institution: inst._id, role: 'institution_admin' });
      if (!hasAdmin) {
        const slug = inst.slug || inst.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const username = `${slug}_admin`;
        const existingUsername = await User.findOne({ username });
        if (!existingUsername) {
          await User.create({
            username,
            password: 'admin123',
            name: `${inst.name} Admin`,
            role: 'institution_admin',
            institution: inst._id
          });
          console.log(`[Init] Created admin user "${username}" for institution "${inst.name}"`);
        }
      }
    }

    // If an institution already exists, skip
    const existing = await Institution.findOne();
    if (existing) return;

    // Read current settings to populate institution info
    const settings = await Settings.findOne();
    const companyName = settings?.companyName || 'Default Institution';

    // Create slug from company name
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const institution = await Institution.create({
      name: companyName,
      slug: slug,
      contactEmail: settings?.email || '',
      contactPhone: settings?.phone || '',
      address: settings?.address || '',
      isActive: true,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date()
    });

    console.log(`[Init] Created first institution: "${institution.name}" (${institution._id})`);

    // Link all existing data to this institution
    const collections = [
      Resident, Medication, ResidentMedication,
      Delivery, StockMovement, MedicationHistory, Notification,
      Settings, BillingConfig, MonthlyStatement, Expense, Payment
    ];

    for (const Model of collections) {
      const result = await Model.updateMany(
        { institution: null },
        { $set: { institution: institution._id } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Init] Linked ${result.modifiedCount} ${Model.modelName} records`);
      }
    }

    // Link non-superadmin users to this institution (superadmin stays global)
    const userResult = await User.updateMany(
      { institution: null, role: { $ne: 'superadmin' } },
      { $set: { institution: institution._id } }
    );
    if (userResult.modifiedCount > 0) {
      console.log(`[Init] Linked ${userResult.modifiedCount} User records`);
    }

    // Set existing admin user as superadmin
    const adminResult = await User.updateMany(
      { role: { $in: ['staff', null] } },
      { $set: { role: 'superadmin' } }
    );
    if (adminResult.modifiedCount > 0) {
      console.log(`[Init] Set ${adminResult.modifiedCount} existing user(s) as superadmin`);
    }

    console.log('[Init] First institution setup complete');
  } catch (error) {
    console.error('[Init] Error initializing first institution:', error.message);
  }
};

module.exports = { initializeFirstInstitution };
