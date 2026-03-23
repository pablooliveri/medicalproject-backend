const ResidentMedication = require('../models/ResidentMedication');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const BillingConfig = require('../models/BillingConfig');

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

const checkBillingAdjustments = async () => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const configs = await BillingConfig.find({ adjustmentMonths: currentMonth })
      .populate('resident');

    for (const config of configs) {
      if (!config.resident || !config.resident.isActive) continue;

      const existing = await Notification.findOne({
        type: 'billing_adjustment',
        resident: config.resident._id,
        createdAt: { $gte: twentyFourHoursAgo }
      });

      if (!existing) {
        await Notification.create({
          type: 'billing_adjustment',
          title: `Ajuste de precio: ${config.resident.firstName} ${config.resident.lastName}`,
          message: `Corresponde aplicar el ajuste del ${config.adjustmentPercentage}% a la cuota mensual de ${config.resident.firstName} ${config.resident.lastName} este mes.`,
          resident: config.resident._id,
          data: {
            adjustmentPercentage: config.adjustmentPercentage,
            currentMonthlyFee: config.monthlyFee,
            month: currentMonth
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking billing adjustments:', error);
  }
};

module.exports = { checkLowStock, checkBillingAdjustments };
