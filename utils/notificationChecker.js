const ResidentMedication = require('../models/ResidentMedication');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

const checkLowStock = async () => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const threshold = settings.lowStockThresholdDays;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeMeds = await ResidentMedication.find({ isActive: true })
      .populate('resident')
      .populate('medication');

    for (const med of activeMeds) {
      const dailyConsumption =
        (med.schedule.breakfast || 0) +
        (med.schedule.lunch || 0) +
        (med.schedule.snack || 0) +
        (med.schedule.dinner || 0);

      if (dailyConsumption === 0) continue;

      const daysRemaining = Math.floor(med.currentStock / dailyConsumption);

      if (med.currentStock === 0) {
        // Check if a notification already exists within the last 24 hours (read or unread)
        const existing = await Notification.findOne({
          type: 'out_of_stock',
          resident: med.resident._id,
          medication: med.medication._id,
          createdAt: { $gte: twentyFourHoursAgo }
        });

        if (!existing) {
          await Notification.create({
            type: 'out_of_stock',
            title: `Out of Stock: ${med.medication.genericName}`,
            message: `${med.resident.firstName} ${med.resident.lastName} has run out of ${med.medication.genericName} (${med.dosageMg}${med.medication.dosageUnit}).`,
            resident: med.resident._id,
            medication: med.medication._id,
            data: { residentMedicationId: med._id, daysRemaining: 0 }
          });
        }
      } else if (daysRemaining <= threshold) {
        const existing = await Notification.findOne({
          type: 'low_stock',
          resident: med.resident._id,
          medication: med.medication._id,
          createdAt: { $gte: twentyFourHoursAgo }
        });

        if (!existing) {
          await Notification.create({
            type: 'low_stock',
            title: `Low Stock: ${med.medication.genericName}`,
            message: `${med.resident.firstName} ${med.resident.lastName} has only ${daysRemaining} day(s) of ${med.medication.genericName} (${med.dosageMg}${med.medication.dosageUnit}) remaining. Current stock: ${med.currentStock}.`,
            resident: med.resident._id,
            medication: med.medication._id,
            data: { residentMedicationId: med._id, daysRemaining }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking low stock:', error);
  }
};

module.exports = { checkLowStock };
