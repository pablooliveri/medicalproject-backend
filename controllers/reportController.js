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

// GET /api/reports/resident/:id
const generateResidentReport = async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    const resMeds = await ResidentMedication.find({
      resident: req.params.id,
      isActive: true
    }).populate('medication');

    const medications = resMeds.map(med => {
      return {
        medicationName: med.medication.genericName.toUpperCase() +
          (med.medication.commercialName ? ` (${med.medication.commercialName})` : ''),
        dosage: `${med.dosageMg} ${med.medication.dosageUnit}`,
        breakfast: med.schedule.breakfast || 0,
        lunch: med.schedule.lunch || 0,
        snack: med.schedule.snack || 0,
        dinner: med.schedule.dinner || 0,
        formLabel: getFormLabel(med.medication),
        stock: med.currentStock
      };
    });

    const pdfBuffer = await generateResidentReportPDF(resident, medications);

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
