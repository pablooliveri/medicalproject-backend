const ResidentMedication = require('../models/ResidentMedication');
const StockMovement = require('../models/StockMovement');

// Calculate coverage date for a resident medication
const calculateCoverageDate = (currentStock, schedule) => {
  const dailyConsumption =
    (schedule.breakfast || 0) +
    (schedule.lunch || 0) +
    (schedule.snack || 0) +
    (schedule.dinner || 0);  

  if (dailyConsumption === 0) return null;

  const daysRemaining = Math.floor(currentStock / dailyConsumption);
  const coverageDate = new Date();
  coverageDate.setDate(coverageDate.getDate() + daysRemaining);
  return coverageDate;
};

// Daily stock deduction - runs via cron job at midnight
const dailyStockDeduction = async (institutionId = null) => {
  try {
    const filter = { isActive: true };
    if (institutionId) filter.institution = institutionId;
    const activeMeds = await ResidentMedication.find(filter)
      .populate('resident')
      .populate('medication');

    for (const med of activeMeds) {
      const dailyConsumption =
        (med.schedule.breakfast || 0) +
        (med.schedule.lunch || 0) +
        (med.schedule.snack || 0) +
        (med.schedule.dinner || 0);

      if (dailyConsumption <= 0) continue;

      const previousStock = med.currentStock;
      const newStock = Math.max(0, previousStock - dailyConsumption);

      // Create stock movement record
      await StockMovement.create({
        resident: med.resident._id,
        residentMedication: med._id,
        medication: med.medication._id,
        type: 'daily_deduction',
        quantity: -dailyConsumption,
        previousStock,
        newStock,
        notes: 'Automatic daily deduction',
        date: new Date(),
        institution: med.institution
      });

      // Update current stock
      med.currentStock = newStock;
      await med.save();
    }

    console.log(`Daily deduction completed for ${activeMeds.length} medications`);
  } catch (error) {
    console.error('Error in daily stock deduction:', error);
  }
};

// Recalculate stock after dose/medication change
const recalculateStock = async (residentMedicationId, newSchedule) => {
  try {
    const med = await ResidentMedication.findById(residentMedicationId);
    if (!med) return null;

    if (newSchedule) {
      med.schedule = newSchedule;
    }

    const coverageDate = calculateCoverageDate(med.currentStock, med.schedule);
    await med.save();

    return {
      currentStock: med.currentStock,
      coverageDate,
      dailyConsumption:
        (med.schedule.breakfast || 0) +
        (med.schedule.lunch || 0) +
        (med.schedule.snack || 0) +
        (med.schedule.dinner || 0)
    };
  } catch (error) {
    console.error('Error recalculating stock:', error);
    return null;
  }
};

module.exports = { calculateCoverageDate, dailyStockDeduction, recalculateStock };
