const ResidentMedication = require('../models/ResidentMedication');
const StockMovement = require('../models/StockMovement');
const { dailyStockDeduction, calculateCoverageDate } = require('../utils/stockCalculator');
const { checkLowStock } = require('../utils/notificationChecker');

// GET /api/stock/status/:residentId
const getStockStatus = async (req, res) => {
  try {
    const medications = await ResidentMedication.find({
      resident: req.params.residentId,
      isActive: true,
      ...req.tenantFilter
    }).populate('medication');

    const status = medications.map(med => {
      const dailyConsumption =
        (med.schedule.breakfast || 0) +
        (med.schedule.lunch || 0) +
        (med.schedule.snack || 0) +
        (med.schedule.dinner || 0);

      const daysRemaining = dailyConsumption > 0
        ? Math.floor(med.currentStock / dailyConsumption)
        : null;

      const coverageDate = calculateCoverageDate(med.currentStock, med.schedule);

      return {
        _id: med._id,
        medication: med.medication,
        dosageMg: med.dosageMg,
        schedule: med.schedule,
        currentStock: med.currentStock,
        dailyConsumption,
        daysRemaining,
        coverageDate
      };
    });

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/stock/adjust
const adjustStock = async (req, res) => {
  try {
    const { residentMedicationId, newStock, reason } = req.body;

    const med = await ResidentMedication.findOne({ _id: residentMedicationId, ...req.tenantFilter });
    if (!med) {
      return res.status(404).json({ message: 'Medication assignment not found' });
    }

    const previousStock = med.currentStock;

    await StockMovement.create({
      resident: med.resident,
      residentMedication: med._id,
      medication: med.medication,
      type: 'adjustment',
      quantity: newStock - previousStock,
      previousStock,
      newStock,
      notes: reason || 'Manual adjustment',
      institution: req.user.institution
    });

    med.currentStock = newStock;
    await med.save();

    await checkLowStock();

    res.json({ message: 'Stock adjusted', previousStock, newStock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/stock/deduct
const manualDailyDeduction = async (req, res) => {
  try {
    await dailyStockDeduction();
    await checkLowStock();
    res.json({ message: 'Daily deduction completed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/stock/movements
const getStockMovements = async (req, res) => {
  try {
    const { residentId, residentMedicationId, type, page = 1, limit = 50 } = req.query;
    const query = {};

    if (residentId) query.resident = residentId;
    if (residentMedicationId) query.residentMedication = residentMedicationId;
    if (type) query.type = type;

    const total = await StockMovement.countDocuments({ ...query, ...req.tenantFilter });
    const movements = await StockMovement.find({ ...query, ...req.tenantFilter })
      .populate('medication')
      .populate('resident')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      movements,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getStockStatus, adjustStock, manualDailyDeduction, getStockMovements };
