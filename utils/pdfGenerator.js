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

/**
 * Helper: draw text centered both horizontally and vertically inside a cell.
 * @param {PDFDocument} doc
 * @param {string} text
 * @param {number} cellX - left edge of cell
 * @param {number} cellY - top edge of cell
 * @param {number} cellW - width of cell
 * @param {number} cellH - height of cell
 * @param {object} opts - extra PDFKit text options (align, strike, etc.)
 */
const drawCellText = (doc, text, cellX, cellY, cellW, cellH, opts = {}) => {
  if (!text && text !== 0) return;
  const str = String(text);
  const fontSize = doc._fontSize || 9;
  // Vertical center: offset by (cellHeight - fontSize) / 2
  const textY = cellY + (cellH - fontSize) / 2;
  const padding = 5;
  doc.text(str, cellX + padding, textY, { width: cellW - padding * 2, ...opts });
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

    // Delivery table columns
    const dCol1 = 50;   // Medicación
    const dCol2 = 200;  // Dosis
    const dCol3 = 300;  // Cantidad
    const dCol4 = 380;  // Nuevo Stock
    const dCol5 = 460;  // Cubre Hasta
    const dTableRight = 545;
    const dRowHeight = 22;
    const dHeaderHeight = 22;

    // Draw table header with borders
    const tableTop = headerY;
    doc.rect(dCol1, tableTop, dTableRight - dCol1, dHeaderHeight).stroke();
    doc.moveTo(dCol2, tableTop).lineTo(dCol2, tableTop + dHeaderHeight).stroke();
    doc.moveTo(dCol3, tableTop).lineTo(dCol3, tableTop + dHeaderHeight).stroke();
    doc.moveTo(dCol4, tableTop).lineTo(dCol4, tableTop + dHeaderHeight).stroke();
    doc.moveTo(dCol5, tableTop).lineTo(dCol5, tableTop + dHeaderHeight).stroke();

    doc.fontSize(9).font('Helvetica-Bold');
    drawCellText(doc, 'Medicación', dCol1, tableTop, dCol2 - dCol1, dHeaderHeight);
    drawCellText(doc, 'Dosis', dCol2, tableTop, dCol3 - dCol2, dHeaderHeight, { align: 'center' });
    drawCellText(doc, 'Cantidad', dCol3, tableTop, dCol4 - dCol3, dHeaderHeight, { align: 'center' });
    drawCellText(doc, 'Nuevo Stock', dCol4, tableTop, dCol5 - dCol4, dHeaderHeight, { align: 'center' });
    drawCellText(doc, 'Cubre Hasta', dCol5, tableTop, dTableRight - dCol5, dHeaderHeight, { align: 'center' });

    // Table rows
    let rowY = tableTop + dHeaderHeight;
    doc.font('Helvetica').fontSize(9);

    for (const item of items) {
      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }

      // Draw row borders
      doc.rect(dCol1, rowY, dTableRight - dCol1, dRowHeight).stroke();
      doc.moveTo(dCol2, rowY).lineTo(dCol2, rowY + dRowHeight).stroke();
      doc.moveTo(dCol3, rowY).lineTo(dCol3, rowY + dRowHeight).stroke();
      doc.moveTo(dCol4, rowY).lineTo(dCol4, rowY + dRowHeight).stroke();
      doc.moveTo(dCol5, rowY).lineTo(dCol5, rowY + dRowHeight).stroke();

      doc.font('Helvetica').fontSize(9);
      drawCellText(doc, item.medicationName, dCol1, rowY, dCol2 - dCol1, dRowHeight);
      drawCellText(doc, item.dosage, dCol2, rowY, dCol3 - dCol2, dRowHeight, { align: 'center' });
      drawCellText(doc, String(item.quantityDelivered), dCol3, rowY, dCol4 - dCol3, dRowHeight, { align: 'center' });
      drawCellText(doc, String(item.newStock), dCol4, rowY, dCol5 - dCol4, dRowHeight, { align: 'center' });
      drawCellText(doc, item.coverageDate || 'N/A', dCol5, rowY, dTableRight - dCol5, dRowHeight, { align: 'center' });

      rowY += dRowHeight;
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

const generateResidentReportPDF = async (resident, medications, options = {}) => {
  const settings = await Settings.findOne();

  // Use provided month/year or default to current
  const month = options.month || (new Date().getMonth() + 1);
  const year = options.year || new Date().getFullYear();
  const monthYear = `${MONTH_NAMES_ES[month - 1]}-${String(year).slice(-2)}`;

  // Separate active and inactive medications
  const activeMeds = medications.filter(m => !m.wasInactive);
  const inactiveMeds = medications.filter(m => m.wasInactive);

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
    const headerHeight = 22;

    // Header border
    doc.rect(colMed, tableHeaderY, tableRight - colMed, headerHeight).stroke();

    // Vertical lines for header
    doc.moveTo(colBreak, tableHeaderY).lineTo(colBreak, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colLunch, tableHeaderY).lineTo(colLunch, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colSnack, tableHeaderY).lineTo(colSnack, tableHeaderY + headerHeight).stroke();
    doc.moveTo(colDinner, tableHeaderY).lineTo(colDinner, tableHeaderY + headerHeight).stroke();

    // Header text - centered in each cell
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    drawCellText(doc, 'Medicación', colMed, tableHeaderY, colBreak - colMed, headerHeight);
    drawCellText(doc, 'Desayuno', colBreak, tableHeaderY, colLunch - colBreak, headerHeight, { align: 'center' });
    drawCellText(doc, 'Almuerzo', colLunch, tableHeaderY, colSnack - colLunch, headerHeight, { align: 'center' });
    drawCellText(doc, 'Merienda', colSnack, tableHeaderY, colDinner - colSnack, headerHeight, { align: 'center' });
    drawCellText(doc, 'Cena', colDinner, tableHeaderY, tableRight - colDinner, headerHeight, { align: 'center' });

    let rowY = tableHeaderY + headerHeight;
    const rowHeight = 22;
    const inactiveRowHeight = 30; // Taller rows for inactive meds to fit the "Baja" label

    // Helper to draw a medication row
    const drawMedRow = (med, isInactive) => {
      const currentRowHeight = isInactive ? inactiveRowHeight : rowHeight;

      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }

      // Light gray background for inactive medications
      if (isInactive) {
        doc.rect(colMed, rowY, tableRight - colMed, currentRowHeight).fill('#f5f5f5');
      }

      // Draw row borders
      doc.fillColor(isInactive ? '#999999' : '#000000');
      doc.rect(colMed, rowY, tableRight - colMed, currentRowHeight).stroke();
      doc.moveTo(colBreak, rowY).lineTo(colBreak, rowY + currentRowHeight).stroke();
      doc.moveTo(colLunch, rowY).lineTo(colLunch, rowY + currentRowHeight).stroke();
      doc.moveTo(colSnack, rowY).lineTo(colSnack, rowY + currentRowHeight).stroke();
      doc.moveTo(colDinner, rowY).lineTo(colDinner, rowY + currentRowHeight).stroke();

      // Medication name + dosage combined (ACHIRAS style)
      const medName = `${med.medicationName} ${med.dosage}`;
      doc.font('Helvetica').fontSize(9);

      if (isInactive) {
        // For inactive: name with strikethrough near top, "Baja" label below
        const nameY = rowY + 3;
        doc.text(medName, colMed + 5, nameY, { width: colBreak - colMed - 10, strike: true });

        // Show deactivation month below the name
        if (med.endDate) {
          const endDate = new Date(med.endDate);
          const endMonthLabel = `Baja: ${MONTH_NAMES_ES[endDate.getMonth()]}-${String(endDate.getFullYear()).slice(-2)}`;
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#cc0000');
          doc.text(endMonthLabel, colMed + 5, rowY + 17, { width: colBreak - colMed - 10 });
          doc.fillColor('#999999');
        }

        // Schedule values vertically centered, with strikethrough
        const formLabel = med.formLabel || 'COMP';
        doc.font('Helvetica').fontSize(9);
        if (med.breakfast > 0) {
          drawCellText(doc, `${med.breakfast} ${formLabel}`, colBreak, rowY, colLunch - colBreak, currentRowHeight, { align: 'center', strike: true });
        }
        if (med.lunch > 0) {
          drawCellText(doc, `${med.lunch} ${formLabel}`, colLunch, rowY, colSnack - colLunch, currentRowHeight, { align: 'center', strike: true });
        }
        if (med.snack > 0) {
          drawCellText(doc, `${med.snack} ${formLabel}`, colSnack, rowY, colDinner - colSnack, currentRowHeight, { align: 'center', strike: true });
        }
        if (med.dinner > 0) {
          const dinnerText = med.dinnerNote ? `${med.dinner} ${formLabel} ${med.dinnerNote}` : `${med.dinner} ${formLabel}`;
          drawCellText(doc, dinnerText, colDinner, rowY, tableRight - colDinner, currentRowHeight, { align: 'center', strike: true });
        }
      } else {
        // Active medication: all cells vertically + horizontally centered
        drawCellText(doc, medName, colMed, rowY, colBreak - colMed, currentRowHeight);

        const formLabel = med.formLabel || 'COMP';
        if (med.breakfast > 0) {
          drawCellText(doc, `${med.breakfast} ${formLabel}`, colBreak, rowY, colLunch - colBreak, currentRowHeight, { align: 'center' });
        }
        if (med.lunch > 0) {
          drawCellText(doc, `${med.lunch} ${formLabel}`, colLunch, rowY, colSnack - colLunch, currentRowHeight, { align: 'center' });
        }
        if (med.snack > 0) {
          drawCellText(doc, `${med.snack} ${formLabel}`, colSnack, rowY, colDinner - colSnack, currentRowHeight, { align: 'center' });
        }
        if (med.dinner > 0) {
          const dinnerText = med.dinnerNote ? `${med.dinner} ${formLabel} ${med.dinnerNote}` : `${med.dinner} ${formLabel}`;
          drawCellText(doc, dinnerText, colDinner, rowY, tableRight - colDinner, currentRowHeight, { align: 'center' });
        }
      }

      rowY += currentRowHeight;
    };

    // Draw active medications first
    for (const med of activeMeds) {
      drawMedRow(med, false);
    }

    // Draw inactive medications (visually distinguished)
    if (inactiveMeds.length > 0) {
      // Add a small separator label if there are inactive meds
      if (rowY > 700) {
        doc.addPage();
        rowY = 50;
      }
      rowY += 4;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#999999');
      doc.text('MEDICAMENTOS INACTIVOS', colMed, rowY, { width: tableRight - colMed, align: 'center' });
      rowY += 12;
      doc.fillColor('#000000');

      for (const med of inactiveMeds) {
        drawMedRow(med, true);
      }
    }

    // Reset fill color for footer
    doc.fillColor('#000000');

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text(`Generado el ${new Date().toLocaleString('es-UY')}`, 50, 760, { align: 'center', width: 495 });

    doc.end();
  });
};

module.exports = { generateDeliveryPDF, generateResidentReportPDF, getFormLabel, FORM_LABELS_ES };
