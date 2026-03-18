const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const Settings = require('../models/Settings');

const MONTH_NAMES_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const FORM_LABELS_ES = {
  tablet: 'COMP',
  capsule: 'CÁP',
  liquid: 'ml',
  drops: 'GOTAS',
  injection: 'INY',
  cream: 'CREMA',
  inhaler: 'INH',
  sachet: 'SOBRE',
  other: ''
};

const getFormLabel = (medication) => {
  if (!medication) return '';
  return FORM_LABELS_ES[medication.form] || 'COMP';
};

const generateDeliveryPDF = async (delivery, resident, items) => {
  const settings = await Settings.findOne();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with logo
    const logoPath = settings && settings.logo
      ? path.join(__dirname, '..', settings.logo)
      : null;

    let headerY = 50;

    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, headerY, { width: 80 });
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings.companyName || 'Casa de Salud Residencial', 140, headerY + 10);
      if (settings.address) {
        doc.fontSize(9).font('Helvetica')
          .text(settings.address, 140, headerY + 35);
      }
      if (settings.phone) {
        doc.fontSize(9).font('Helvetica')
          .text(settings.phone, 140, headerY + 48);
      }
      headerY += 90;
    } else {
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings?.companyName || 'Casa de Salud Residencial', 50, headerY);
      if (settings?.address) {
        doc.fontSize(9).font('Helvetica')
          .text(settings.address, 50, headerY + 25);
      }
      headerY += 50;
    }

    // Line separator
    doc.moveTo(50, headerY).lineTo(545, headerY).stroke();
    headerY += 15;

    // Delivery Report Title
    doc.fontSize(14).font('Helvetica-Bold')
      .text('ENTREGA DE MEDICACIÓN', 50, headerY, { align: 'center' });
    headerY += 30;

    // Patient info
    doc.fontSize(10).font('Helvetica-Bold').text('Residente:', 50, headerY);
    doc.font('Helvetica').text(`${resident.firstName} ${resident.lastName}`, 150, headerY);
    headerY += 18;

    doc.font('Helvetica-Bold').text('CI:', 50, headerY);
    doc.font('Helvetica').text(resident.cedula, 150, headerY);
    headerY += 18;

    if (resident.sucursal) {
      doc.font('Helvetica-Bold').text('Sucursal:', 50, headerY);
      doc.font('Helvetica').text(resident.sucursal, 150, headerY);
      headerY += 18;
    }

    doc.font('Helvetica-Bold').text('Fecha de Entrega:', 50, headerY);
    doc.font('Helvetica').text(new Date(delivery.deliveryDate).toLocaleDateString('es-UY'), 150, headerY);
    headerY += 18;

    doc.font('Helvetica-Bold').text('Entregado Por:', 50, headerY);
    doc.font('Helvetica').text(delivery.deliveredBy, 150, headerY);
    headerY += 25;

    // Line separator
    doc.moveTo(50, headerY).lineTo(545, headerY).stroke();
    headerY += 15;

    // Table header
    const tableTop = headerY;
    const col1 = 50;
    const col2 = 200;
    const col3 = 300;
    const col4 = 380;
    const col5 = 460;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Medicación', col1, tableTop);
    doc.text('Dosis', col2, tableTop);
    doc.text('Cantidad', col3, tableTop);
    doc.text('Nuevo Stock', col4, tableTop);
    doc.text('Cubre Hasta', col5, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    let rowY = tableTop + 22;
    doc.font('Helvetica').fontSize(9);

    for (const item of items) {
      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }

      doc.text(item.medicationName, col1, rowY, { width: 145 });
      doc.text(item.dosage, col2, rowY, { width: 95 });
      doc.text(String(item.quantityDelivered), col3, rowY, { width: 75 });
      doc.text(String(item.newStock), col4, rowY, { width: 75 });
      doc.text(item.coverageDate || 'N/A', col5, rowY, { width: 85 });

      rowY += 20;
    }

    // Notes
    if (delivery.notes) {
      rowY += 15;
      doc.font('Helvetica-Bold').fontSize(10).text('Notas:', 50, rowY);
      rowY += 15;
      doc.font('Helvetica').fontSize(9).text(delivery.notes, 50, rowY, { width: 495 });
      rowY += doc.heightOfString(delivery.notes, { width: 495 }) + 10;
    }

    // Photos
    if (delivery.photos && delivery.photos.length > 0) {
      rowY += 15;
      if (rowY > 650) {
        doc.addPage();
        rowY = 50;
      }
      doc.font('Helvetica-Bold').fontSize(10).text('Fotos:', 50, rowY);
      rowY += 20;

      for (const photo of delivery.photos) {
        const photoPath = path.join(__dirname, '..', photo);
        if (fs.existsSync(photoPath)) {
          if (rowY > 550) {
            doc.addPage();
            rowY = 50;
          }
          try {
            doc.image(photoPath, 50, rowY, { width: 200 });
            rowY += 160;
          } catch (err) {
            // Skip invalid images
          }
        }
      }
    }

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica')
        .text(
          `Generado el ${new Date().toLocaleString('es-UY')}`,
          50, 760,
          { align: 'center', width: 495 }
        );
    }

    doc.end();
  });
};

const generateResidentReportPDF = async (resident, medications) => {
  const settings = await Settings.findOne();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    const logoPath = settings && settings.logo
      ? path.join(__dirname, '..', settings.logo)
      : null;

    let headerY = 50;

    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, headerY, { width: 80 });
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings.companyName || 'Casa de Salud Residencial', 140, headerY + 10);
      headerY += 90;
    } else {
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings?.companyName || 'Casa de Salud Residencial', 50, headerY);
      headerY += 40;
    }

    doc.moveTo(50, headerY).lineTo(545, headerY).stroke();
    headerY += 20;

    // Title - MEDICACIÓN (centered, bold, underlined like ACHIRAS)
    doc.fontSize(16).font('Helvetica-Bold')
      .text('MEDICACIÓN', 50, headerY, { align: 'center', underline: true });
    headerY += 35;

    // Resident info left side + Date right side
    const now = new Date();
    const monthYear = `${MONTH_NAMES_ES[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;

    doc.fontSize(10).font('Helvetica-Bold').text('Residente:', 50, headerY);
    doc.font('Helvetica').text(`${resident.firstName} ${resident.lastName}`, 120, headerY);

    // Date on the right
    doc.font('Helvetica-Bold').text('FECHA:', 400, headerY);
    doc.font('Helvetica').text(monthYear, 460, headerY);
    headerY += 18;

    doc.font('Helvetica-Bold').text('CI:', 50, headerY);
    doc.font('Helvetica').text(resident.cedula, 120, headerY);

    if (resident.sucursal) {
      doc.font('Helvetica-Bold').text('Sucursal:', 400, headerY);
      doc.font('Helvetica').text(resident.sucursal, 460, headerY);
    }
    headerY += 25;

    // Medication table - ACHIRAS format
    // Columns: Medicación | Desayuno | Almuerzo | Merienda | Cena
    const colMed = 50;
    const colBreak = 230;
    const colLunch = 310;
    const colSnack = 390;
    const colDinner = 470;
    const tableRight = 545;

    // Draw table header with borders
    const tableHeaderY = headerY;
    const headerHeight = 20;

    // Header background
    doc.rect(colMed, tableHeaderY, tableRight - colMed, headerHeight).stroke();

    // Vertical lines for header
    doc.moveTo(colBreak, tableHeaderY).lineTo(colBreak, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colLunch, tableHeaderY).lineTo(colLunch, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colSnack, tableHeaderY).lineTo(colSnack, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colDinner, tableHeaderY).lineTo(colDinner, tableHeaderY + headerHeight).stroke();

    // Header text
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Medicación', colMed + 5, tableHeaderY + 5, { width: colBreak - colMed - 10 });
    doc.text('Desayuno', colBreak + 5, tableHeaderY + 5, { width: colLunch - colBreak - 10, align: 'center' });
    doc.text('Almuerzo', colLunch + 5, tableHeaderY + 5, { width: colSnack - colLunch - 10, align: 'center' });
    doc.text('Merienda', colSnack + 5, tableHeaderY + 5, { width: colDinner - colSnack - 10, align: 'center' });
    doc.text('Cena', colDinner + 5, tableHeaderY + 5, { width: tableRight - colDinner - 10, align: 'center' });

    let rowY = tableHeaderY + headerHeight;
    const rowHeight = 18;
    doc.font('Helvetica').fontSize(9);

    for (const med of medications) {
      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }

      // Draw row borders
      doc.rect(colMed, rowY, tableRight - colMed, rowHeight).stroke();
      doc.moveTo(colBreak, rowY).lineTo(colBreak, rowY + rowHeight).stroke();
      doc.moveTo(colLunch, rowY).lineTo(colLunch, rowY + rowHeight).stroke();
      doc.moveTo(colSnack, rowY).lineTo(colSnack, rowY + rowHeight).stroke();
      doc.moveTo(colDinner, rowY).lineTo(colDinner, rowY + rowHeight).stroke();

      // Medication name + dosage combined (ACHIRAS style)
      const medName = `${med.medicationName} ${med.dosage}`;
      doc.text(medName, colMed + 5, rowY + 4, { width: colBreak - colMed - 10 });

      // Schedule values - show "X COMP" format or blank for 0
      const formLabel = med.formLabel || 'COMP';

      if (med.breakfast > 0) {
        doc.text(`${med.breakfast} ${formLabel}`, colBreak + 5, rowY + 4, { width: colLunch - colBreak - 10, align: 'center' });
      }
      if (med.lunch > 0) {
        doc.text(`${med.lunch} ${formLabel}`, colLunch + 5, rowY + 4, { width: colSnack - colLunch - 10, align: 'center' });
      }
      if (med.snack > 0) {
        doc.text(`${med.snack} ${formLabel}`, colSnack + 5, rowY + 4, { width: colDinner - colSnack - 10, align: 'center' });
      }
      if (med.dinner > 0) {
        const dinnerText = med.dinnerNote ? `${med.dinner} ${formLabel} ${med.dinnerNote}` : `${med.dinner} ${formLabel}`;
        doc.text(dinnerText, colDinner + 5, rowY + 4, { width: tableRight - colDinner - 10, align: 'center' });
      }

      rowY += rowHeight;
    }

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text(`Generado el ${new Date().toLocaleString('es-UY')}`, 50, 760, { align: 'center', width: 495 });

    doc.end();
  });
};

module.exports = { generateDeliveryPDF, generateResidentReportPDF, getFormLabel, FORM_LABELS_ES };
