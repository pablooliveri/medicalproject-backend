const Medication = require('../models/Medication');

// GET /api/medications
const getMedications = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { genericName: { $regex: search, $options: 'i' } },
        { commercialName: { $regex: search, $options: 'i' } }
      ];
    }

    const medications = await Medication.find({ ...query, ...req.tenantFilter }).sort({ genericName: 1 });
    res.json(medications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/medications/:id
const getMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    res.json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/medications
const createMedication = async (req, res) => {
  try {
    const medication = await Medication.create({ ...req.body, institution: req.user.institution });
    res.status(201).json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/medications/:id
const updateMedication = async (req, res) => {
  try {
    const medication = await Medication.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    res.json(medication);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/medications/:id (soft delete)
const deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      { isActive: false },
      { returnDocument: 'after' }
    );
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    res.json({ message: 'Medication deactivated', medication });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMedications, getMedication, createMedication, updateMedication, deleteMedication };
