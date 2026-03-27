const MedicationHistory = require('../models/MedicationHistory');
const ResidentMedication = require('../models/ResidentMedication');

// GET /api/medication-history/:residentId
const getResidentHistory = async (req, res) => {
  try {
    const { residentId } = req.params;
    const { month, year } = req.query;

    const query = { resident: residentId, ...req.tenantFilter };

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const history = await MedicationHistory.find(query)
      .populate('medication')
      .populate('residentMedication')
      .sort({ date: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/medication-history/:residentId/months
// Returns list of months that have history records
const getAvailableMonths = async (req, res) => {
  try {
    const { residentId } = req.params;

    // Get all history records for this resident
    const history = await MedicationHistory.find({ resident: residentId, ...req.tenantFilter })
      .select('date')
      .sort({ date: -1 });

    // Also get all ResidentMedication records (active and inactive) for start/end dates
    const resMeds = await ResidentMedication.find({ resident: residentId })
      .select('startDate endDate isActive');

    // Collect all unique months
    const monthsSet = new Set();

    for (const h of history) {
      const d = new Date(h.date);
      monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    for (const rm of resMeds) {
      if (rm.startDate) {
        const d = new Date(rm.startDate);
        monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      if (rm.endDate) {
        const d = new Date(rm.endDate);
        monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }

    // Always include current month
    const now = new Date();
    monthsSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

    const months = Array.from(monthsSet).sort().reverse();

    res.json(months);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/medication-history/:residentId/snapshot
// Returns the medication state at a given month (what was active, what changed)
const getMonthlySnapshot = async (req, res) => {
  try {
    const { residentId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // Get all resident medications that were active during this month
    const allMeds = await ResidentMedication.find({
      resident: residentId,
      ...req.tenantFilter,
      startDate: { $lte: endOfMonth },
      $or: [
        { endDate: null },
        { endDate: { $gte: new Date(year, month - 1, 1) } }
      ]
    }).populate('medication');

    // Get history events for this month
    const startOfMonth = new Date(year, month - 1, 1);
    const changes = await MedicationHistory.find({
      resident: residentId,
      ...req.tenantFilter,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('medication').sort({ date: -1 });

    // Separate active and deactivated during this month
    const activeMeds = allMeds.filter(m => m.isActive || (m.endDate && m.endDate >= startOfMonth));

    res.json({
      medications: activeMeds,
      changes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getResidentHistory, getAvailableMonths, getMonthlySnapshot };
