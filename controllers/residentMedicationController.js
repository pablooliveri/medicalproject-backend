const ResidentMedication = require('../models/ResidentMedication');
const StockMovement = require('../models/StockMovement');
const { recalculateStock, calculateCoverageDate } = require('../utils/stockCalculator');
const { checkLowStock } = require('../utils/notificationChecker');

// GET /api/resident-medications
const getResidentMedications = async (req, res) => {
  try {
    const { residentId, isActive } = req.query;
    const query = {};

    if (residentId) query.resident = residentId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const medications = await ResidentMedication.find(query)
      .populate('medication')
      .populate('resident')
      .sort({ isActive: -1, createdAt: -1 });

    res.json(medications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/resident-medications/:id
const getResidentMedication = async (req, res) => {
  try {
    const med = await ResidentMedication.findById(req.params.id)
      .populate('medication')
      .populate('resident');
    if (!med) {
      return res.status(404).json({ message: 'Medication assignment not found' });
    }
    res.json(med);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/resident-medications
const assignMedication = async (req, res) => {
  try {
    const { resident, medication, dosageMg, schedule, currentStock, notes } = req.body;

    const med = await ResidentMedication.create({
      resident,
      medication,
      dosageMg,
      schedule,
      currentStock: currentStock || 0,
      notes
    });

    // Create initial stock movement
    if (currentStock > 0) {
      await StockMovement.create({
        resident,
        residentMedication: med._id,
        medication,
        type: 'initial',
        quantity: currentStock,
        previousStock: 0,
        newStock: currentStock,
        notes: 'Initial stock on medication assignment'
      });
    }

    const populated = await ResidentMedication.findById(med._id)
      .populate('medication')
      .populate('resident');

    // Record in medication history
    const MedicationHistory = require('../models/MedicationHistory');
    await MedicationHistory.create({
      resident: med.resident,
      residentMedication: med._id,
      medication: med.medication,
      action: 'assigned',
      details: {
        dosageMg: med.dosageMg,
        schedule: med.schedule,
        notes: med.notes
      },
      date: new Date()
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/resident-medications/:id
const updateMedication = async (req, res) => {
  try {
    const { dosageMg, schedule, notes } = req.body;
    const med = await ResidentMedication.findById(req.params.id);

    if (!med) {
      return res.status(404).json({ message: 'Medication assignment not found' });
    }

    const oldSchedule = { ...med.schedule.toObject() };

    if (dosageMg !== undefined) med.dosageMg = dosageMg;
    if (notes !== undefined) med.notes = notes;

    if (schedule) {
      med.schedule = schedule;

      // Create adjustment movement if schedule changed
      const oldDaily = (oldSchedule.breakfast || 0) + (oldSchedule.lunch || 0) +
                       (oldSchedule.snack || 0) + (oldSchedule.dinner || 0);
      const newDaily = (schedule.breakfast || 0) + (schedule.lunch || 0) +
                       (schedule.snack || 0) + (schedule.dinner || 0);

      if (oldDaily !== newDaily) {
        await StockMovement.create({
          resident: med.resident,
          residentMedication: med._id,
          medication: med.medication,
          type: 'adjustment',
          quantity: 0,
          previousStock: med.currentStock,
          newStock: med.currentStock,
          notes: `Schedule changed: daily consumption ${oldDaily} -> ${newDaily}`
        });
      }
    }

    await med.save();
    await checkLowStock();

    // Record in medication history
    const MedicationHistory = require('../models/MedicationHistory');
    await MedicationHistory.create({
      resident: med.resident,
      residentMedication: med._id,
      medication: med.medication,
      action: 'updated',
      details: {
        dosageMg: med.dosageMg,
        schedule: med.schedule,
        notes: med.notes
      },
      date: new Date()
    });

    const populated = await ResidentMedication.findById(med._id)
      .populate('medication')
      .populate('resident');

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/resident-medications/:id/deactivate
const deactivateMedication = async (req, res) => {
  try {
    const { endDate } = req.body || {};
    const deactivationDate = endDate ? new Date(endDate) : new Date();

    const med = await ResidentMedication.findByIdAndUpdate(
      req.params.id,
      { isActive: false, endDate: deactivationDate },
      { new: true }
    ).populate('medication').populate('resident');

    if (!med) {
      return res.status(404).json({ message: 'Medication assignment not found' });
    }

    // Record in medication history
    const MedicationHistory = require('../models/MedicationHistory');
    await MedicationHistory.create({
      resident: med.resident._id,
      residentMedication: med._id,
      medication: med.medication._id,
      action: 'deactivated',
      details: {
        dosageMg: med.dosageMg,
        schedule: med.schedule,
        notes: med.notes
      },
      date: deactivationDate
    });

    res.json(med);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/resident-medications/:id/reactivate
const reactivateMedication = async (req, res) => {
  try {
    const med = await ResidentMedication.findByIdAndUpdate(
      req.params.id,
      { isActive: true, endDate: null },
      { new: true }
    ).populate('medication').populate('resident');

    if (!med) {
      return res.status(404).json({ message: 'Medication assignment not found' });
    }

    // Record in medication history
    const MedicationHistory = require('../models/MedicationHistory');
    await MedicationHistory.create({
      resident: med.resident._id,
      residentMedication: med._id,
      medication: med.medication._id,
      action: 'reactivated',
      details: {
        dosageMg: med.dosageMg,
        schedule: med.schedule,
        notes: med.notes
      },
      date: new Date()
    });

    res.json(med);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getResidentMedications,
  getResidentMedication,
  assignMedication,
  updateMedication,
  deactivateMedication,
  reactivateMedication
};
