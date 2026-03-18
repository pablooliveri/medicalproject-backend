const Resident = require('../models/Resident');
const ResidentMedication = require('../models/ResidentMedication');

// GET /api/residents
const getResidents = async (req, res) => {
  try {
    const { search, isActive, sucursal } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (sucursal) {
      query.sucursal = sucursal;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } }
      ];
    }

    const residents = await Resident.find(query).sort({ lastName: 1, firstName: 1 });
    res.json(residents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/residents/:id
const getResident = async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.json(resident);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/residents
const createResident = async (req, res) => {
  try {
    const { firstName, lastName, cedula, admissionDate, notes, sucursal } = req.body;
    const resident = await Resident.create({ firstName, lastName, cedula, admissionDate, notes, sucursal });
    res.status(201).json(resident);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A resident with this ID number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/residents/:id
const updateResident = async (req, res) => {
  try {
    const { firstName, lastName, cedula, admissionDate, notes, isActive, sucursal } = req.body;
    const resident = await Resident.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, cedula, admissionDate, notes, isActive, sucursal },
      { new: true, runValidators: true }
    );
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.json(resident);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/residents/:id (soft delete)
const deleteResident = async (req, res) => {
  try {
    const resident = await Resident.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.json({ message: 'Resident deactivated successfully', resident });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/residents/:id/full
const getResidentWithMedications = async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    const medications = await ResidentMedication.find({ resident: req.params.id })
      .populate('medication')
      .sort({ isActive: -1, createdAt: -1 });

    res.json({ resident, medications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getResidents, getResident, createResident, updateResident, deleteResident, getResidentWithMedications };
