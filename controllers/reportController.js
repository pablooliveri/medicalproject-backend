const Delivery = require('../models/Delivery');
const Resident = require('../models/Resident');
const ResidentMedication = require('../models/ResidentMedication');
const { generateDeliveryPDF, generateResidentReportPDF, getFormLabel } = require('../utils/pdfGenerator');
const { calculateCoverageDate } = require('../utils/stockCalculator');

// GET /api/reports/delivery/:id
const generateDeliveryReport = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('resident')
      .populate('items.medication')
      .populate('items.residentMedication');

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    const items = delivery.items.map(item => {
      const resMed = item.residentMedication;
      const coverageDate = resMed
        ? calculateCoverageDate(resMed.currentStock, resMed.schedule)
        : null;

      return {
        medicationName: item.medication.genericName +
          (item.medication.commercialName ? ` (${item.medication.commercialName})` : ''),
        dosage: resMed ? `${resMed.dosageMg} ${item.medication.dosageUnit}` : '',
        quantityDelivered: item.quantity,
        newStock: resMed ? resMed.currentStock : 'N/A',
        coverageDate: coverageDate ? coverageDate.toLocaleDateString('es-UY') : 'N/A'
      };
    });

    const pdfBuffer = await generateDeliveryPDF(delivery, delivery.resident, items);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=delivery-report-${delivery._id}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/reports/resident/:id?month=3&year=2026
const generateResidentReport = async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Find all medications that were active at any point during the requested month:
    // - Started before or during the month
    // - AND either still active OR deactivated during/after the month
    const resMeds = await ResidentMedication.find({
      resident: req.params.id,
      startDate: { $lte: endOfMonth },
      $or: [
        { isActive: true },
        { endDate: { $gte: startOfMonth } }
      ]
    }).populate('medication');

    const medications = resMeds.map(med => {
      // Determine if this medication was inactive during the requested month
      const wasInactive = !med.isActive && med.endDate && new Date(med.endDate) <= endOfMonth;

      return {
        medicationName: med.medication.genericName.toUpperCase() +
          (med.medication.commercialName ? ` (${med.medication.commercialName})` : ''),
        dosage: `${med.dosageMg} ${med.medication.dosageUnit}`,
        breakfast: med.schedule.breakfast || 0,
        lunch: med.schedule.lunch || 0,
        snack: med.schedule.snack || 0,
        dinner: med.schedule.dinner || 0,
        formLabel: getFormLabel(med.medication),
        stock: med.currentStock,
        isActive: med.isActive,
        endDate: med.endDate,
        wasInactive
      };
    });

    // Sort alphabetically by medication name
    medications.sort((a, b) => a.medicationName.localeCompare(b.medicationName, 'es'));

    const pdfBuffer = await generateResidentReportPDF(resident, medications, { month, year });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=resident-report-${resident._id}.pdf`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateDeliveryReport, generateResidentReport };
