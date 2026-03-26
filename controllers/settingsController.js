const Settings = require('../models/Settings');
const { uploadImage, deleteImage, getKeyFromUrl } = require('../utils/storage');

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
    if (req.body.branches !== undefined) settings.branches = req.body.branches;

    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/settings/logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    // Delete old logo from R2
    if (settings.logo) {
      await deleteImage(getKeyFromUrl(settings.logo));
    }

    // Upload to R2 (fixed public_id so it overwrites)
    const result = await uploadImage(req.file.buffer, 'medical/logo', {
      public_id: 'company-logo',
      contentType: req.file.mimetype
    });

    settings.logo = result.secure_url;
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
    if (!settings || !settings.logo) return res.status(404).json({ message: 'No logo found' });

    await deleteImage(getKeyFromUrl(settings.logo));

    settings.logo = null;
    await settings.save();

    res.json({ message: 'Logo removed', settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/settings/branches - Add a branch
const addBranch = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Branch name is required' });
    }
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    if (settings.branches.includes(name.trim())) {
      return res.status(400).json({ message: 'Branch already exists' });
    }
    settings.branches.push(name.trim());
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/settings/branches - Rename a branch
const updateBranch = async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || !newName.trim()) {
      return res.status(400).json({ message: 'Old name and new name are required' });
    }
    let settings = await Settings.findOne();
    if (!settings) return res.status(404).json({ message: 'Settings not found' });

    const idx = settings.branches.indexOf(oldName);
    if (idx === -1) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    if (oldName !== newName.trim() && settings.branches.includes(newName.trim())) {
      return res.status(400).json({ message: 'Branch name already exists' });
    }
    settings.branches[idx] = newName.trim();
    await settings.save();

    // Update all residents with the old branch name
    const Resident = require('../models/Resident');
    await Resident.updateMany({ sucursal: oldName }, { sucursal: newName.trim() });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/settings/branches/:name - Delete a branch
const deleteBranch = async (req, res) => {
  try {
    const { name } = req.params;
    let settings = await Settings.findOne();
    if (!settings) return res.status(404).json({ message: 'Settings not found' });

    const idx = settings.branches.indexOf(name);
    if (idx === -1) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    // Check if any residents are assigned to this branch
    const Resident = require('../models/Resident');
    const count = await Resident.countDocuments({ sucursal: name });
    if (count > 0) {
      return res.status(400).json({ message: `Cannot delete: ${count} resident(s) assigned to this branch` });
    }

    settings.branches.splice(idx, 1);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings, uploadLogo, removeLogo, addBranch, updateBranch, deleteBranch };
