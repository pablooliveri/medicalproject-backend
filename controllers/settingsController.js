const Settings = require('../models/Settings');
const path = require('path');
const fs = require('fs');

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    const { companyName, lowStockThresholdDays, language, address, phone, email } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    if (companyName !== undefined) settings.companyName = companyName;
    if (lowStockThresholdDays !== undefined) settings.lowStockThresholdDays = lowStockThresholdDays;
    if (language !== undefined) settings.language = language;
    if (address !== undefined) settings.address = address;
    if (phone !== undefined) settings.phone = phone;
    if (email !== undefined) settings.email = email;

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/settings/logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    // Remove old logo if exists
    if (settings.logo) {
      const oldPath = path.join(__dirname, '..', settings.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    settings.logo = `/uploads/logo/${req.file.filename}`;
    await settings.save();

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/settings/logo
const removeLogo = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings || !settings.logo) {
      return res.status(404).json({ message: 'No logo found' });
    }

    const logoPath = path.join(__dirname, '..', settings.logo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    settings.logo = null;
    await settings.save();

    res.json({ message: 'Logo removed', settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings, uploadLogo, removeLogo };
