const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const Settings = require('../models/Settings');
const { fetchImageBuffer } = require('./storage');

const MONTH_NAMES_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const FULL_MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
  const logoBuffer = await loadLogoBuffer(settings);

  // Pre-fetch photo buffers before entering the Promise
  const photoBuffers = [];
  if (delivery.photos && delivery.photos.length > 0) {
    for (const photo of delivery.photos) {
      try {
        let buf;
        if (photo.startsWith('http')) {
          buf = await fetchImageBuffer(photo);
        } else {
          const photoPath = path.join(__dirname, '..', photo);
          if (fs.existsSync(photoPath)) {
            buf = fs.readFileSync(photoPath);
          }
        }
        if (buf) photoBuffers.push(buf);
      } catch (err) {
        console.error('Failed to fetch photo for PDF:', err.message);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let headerY = 50;

    if (logoBuffer) {
      doc.image(logoBuffer, 50, headerY, { width: 80 });
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings.companyName || 'Casa de Salud Residencial', 140, headerY + 10);
      if (settings.address) {
        doc.fontSize(9).font('Helvetica').text(settings.address, 140, headerY + 35);
      }
      if (settings.phone) {
        doc.fontSize(9).font('Helvetica').text(settings.phone, 140, headerY + 48);
      }
      headerY += 90;
    } else {
      doc.fontSize(18).font('Helvetica-Bold')
        .text(settings?.companyName || 'Casa de Salud Residencial', 50, headerY);
      if (settings?.address) {
        doc.fontSize(9).font('Helvetica').text(settings.address, 50, headerY + 25);
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
    if (photoBuffers.length > 0) {
      rowY += 15;
      if (rowY > 650) {
        doc.addPage();
        rowY = 50;
      }
      doc.font('Helvetica-Bold').fontSize(10).text('Fotos:', 50, rowY);
      rowY += 20;

      for (const buf of photoBuffers) {
        if (rowY > 550) {
          doc.addPage();
          rowY = 50;
        }
        try {
          doc.image(buf, 50, rowY, { width: 200 });
          rowY += 160;
        } catch (err) {
          console.error('Failed to embed photo in PDF:', err.message);
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
  const logoBuffer = await loadLogoBuffer(settings);

  const month = options.month || (new Date().getMonth() + 1);
  const year = options.year || new Date().getFullYear();
  const monthYear = `${MONTH_NAMES_ES[month - 1]}-${String(year).slice(-2)}`;

  const activeMeds = medications.filter(m => !m.wasInactive);
  const inactiveMeds = medications.filter(m => m.wasInactive);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let headerY = 50;

    if (logoBuffer) {
      doc.image(logoBuffer, 50, headerY, { width: 80 });
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

      // Medication name only (ACHIRAS style)
      const medName = med.medicationName;
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

const generateAllResidentsReportPDF = async (residentsData, options = {}) => {
  const settings = await Settings.findOne();
  const logoBuffer = await loadLogoBuffer(settings);

  const month = options.month || (new Date().getMonth() + 1);
  const year = options.year || new Date().getFullYear();
  const monthYear = `${MONTH_NAMES_ES[month - 1]}-${String(year).slice(-2)}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    residentsData.forEach((entry, index) => {
      const { resident, medications } = entry;
      const activeMeds = medications.filter(m => !m.wasInactive);
      const inactiveMeds = medications.filter(m => m.wasInactive);

      if (index > 0) doc.addPage();

      let headerY = 50;

      if (logoBuffer) {
        doc.image(logoBuffer, 50, headerY, { width: 80 });
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

      // Title
      doc.fontSize(16).font('Helvetica-Bold')
        .text('MEDICACIÓN', 50, headerY, { align: 'center', underline: true });
      headerY += 35;

      // Resident info
      doc.fontSize(10).font('Helvetica-Bold').text('Residente:', 50, headerY);
      doc.font('Helvetica').text(`${resident.firstName} ${resident.lastName}`, 120, headerY);
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

      // Table columns
      const colMed = 50;
      const colBreak = 230;
      const colLunch = 310;
      const colSnack = 390;
      const colDinner = 470;
      const tableRight = 545;
      const tableHeaderY = headerY;
      const headerHeight = 22;

      // Table header
      doc.rect(colMed, tableHeaderY, tableRight - colMed, headerHeight).stroke();
      doc.moveTo(colBreak, tableHeaderY).lineTo(colBreak, tableHeaderY + headerHeight).stroke();
      doc.moveTo(colLunch, tableHeaderY).lineTo(colLunch, tableHeaderY + headerHeight).stroke();
      doc.moveTo(colSnack, tableHeaderY).lineTo(colSnack, tableHeaderY + headerHeight).stroke();
      doc.moveTo(colDinner, tableHeaderY).lineTo(colDinner, tableHeaderY + headerHeight).stroke();

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      drawCellText(doc, 'Medicación', colMed, tableHeaderY, colBreak - colMed, headerHeight);
      drawCellText(doc, 'Desayuno', colBreak, tableHeaderY, colLunch - colBreak, headerHeight, { align: 'center' });
      drawCellText(doc, 'Almuerzo', colLunch, tableHeaderY, colSnack - colLunch, headerHeight, { align: 'center' });
      drawCellText(doc, 'Merienda', colSnack, tableHeaderY, colDinner - colSnack, headerHeight, { align: 'center' });
      drawCellText(doc, 'Cena', colDinner, tableHeaderY, tableRight - colDinner, headerHeight, { align: 'center' });

      let rowY = tableHeaderY + headerHeight;
      const rowHeight = 22;
      const inactiveRowHeight = 30;

      const drawMedRow = (med, isInactive) => {
        const currentRowHeight = isInactive ? inactiveRowHeight : rowHeight;

        if (rowY > 720) {
          doc.addPage();
          rowY = 50;
        }

        if (isInactive) {
          doc.rect(colMed, rowY, tableRight - colMed, currentRowHeight).fill('#f5f5f5');
        }

        doc.fillColor(isInactive ? '#999999' : '#000000');
        doc.rect(colMed, rowY, tableRight - colMed, currentRowHeight).stroke();
        doc.moveTo(colBreak, rowY).lineTo(colBreak, rowY + currentRowHeight).stroke();
        doc.moveTo(colLunch, rowY).lineTo(colLunch, rowY + currentRowHeight).stroke();
        doc.moveTo(colSnack, rowY).lineTo(colSnack, rowY + currentRowHeight).stroke();
        doc.moveTo(colDinner, rowY).lineTo(colDinner, rowY + currentRowHeight).stroke();

        const medName = med.medicationName;
        doc.font('Helvetica').fontSize(9);

        if (isInactive) {
          const nameY = rowY + 3;
          doc.text(medName, colMed + 5, nameY, { width: colBreak - colMed - 10, strike: true });
          if (med.endDate) {
            const endDate = new Date(med.endDate);
            const endMonthLabel = `Baja: ${MONTH_NAMES_ES[endDate.getMonth()]}-${String(endDate.getFullYear()).slice(-2)}`;
            doc.fontSize(7).font('Helvetica-Oblique').fillColor('#cc0000');
            doc.text(endMonthLabel, colMed + 5, rowY + 17, { width: colBreak - colMed - 10 });
            doc.fillColor('#999999');
          }
          const formLabel = med.formLabel || 'COMP';
          doc.font('Helvetica').fontSize(9);
          if (med.breakfast > 0) drawCellText(doc, `${med.breakfast} ${formLabel}`, colBreak, rowY, colLunch - colBreak, currentRowHeight, { align: 'center', strike: true });
          if (med.lunch > 0) drawCellText(doc, `${med.lunch} ${formLabel}`, colLunch, rowY, colSnack - colLunch, currentRowHeight, { align: 'center', strike: true });
          if (med.snack > 0) drawCellText(doc, `${med.snack} ${formLabel}`, colSnack, rowY, colDinner - colSnack, currentRowHeight, { align: 'center', strike: true });
          if (med.dinner > 0) {
            const dinnerText = med.dinnerNote ? `${med.dinner} ${formLabel} ${med.dinnerNote}` : `${med.dinner} ${formLabel}`;
            drawCellText(doc, dinnerText, colDinner, rowY, tableRight - colDinner, currentRowHeight, { align: 'center', strike: true });
          }
        } else {
          drawCellText(doc, medName, colMed, rowY, colBreak - colMed, currentRowHeight);
          const formLabel = med.formLabel || 'COMP';
          if (med.breakfast > 0) drawCellText(doc, `${med.breakfast} ${formLabel}`, colBreak, rowY, colLunch - colBreak, currentRowHeight, { align: 'center' });
          if (med.lunch > 0) drawCellText(doc, `${med.lunch} ${formLabel}`, colLunch, rowY, colSnack - colLunch, currentRowHeight, { align: 'center' });
          if (med.snack > 0) drawCellText(doc, `${med.snack} ${formLabel}`, colSnack, rowY, colDinner - colSnack, currentRowHeight, { align: 'center' });
          if (med.dinner > 0) {
            const dinnerText = med.dinnerNote ? `${med.dinner} ${formLabel} ${med.dinnerNote}` : `${med.dinner} ${formLabel}`;
            drawCellText(doc, dinnerText, colDinner, rowY, tableRight - colDinner, currentRowHeight, { align: 'center' });
          }
        }

        rowY += currentRowHeight;
      };

      for (const med of activeMeds) drawMedRow(med, false);

      if (inactiveMeds.length > 0) {
        if (rowY > 700) { doc.addPage(); rowY = 50; }
        rowY += 4;
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#999999');
        doc.text('MEDICAMENTOS INACTIVOS', colMed, rowY, { width: tableRight - colMed, align: 'center' });
        rowY += 12;
        doc.fillColor('#000000');
        for (const med of inactiveMeds) drawMedRow(med, true);
      }

      doc.fillColor('#000000');
    });

    // Footer on all pages
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica')
        .text(`Generado el ${new Date().toLocaleString('es-UY')}`, 50, 760, { align: 'center', width: 495 });
    }

    doc.end();
  });
};

/**
 * Format number as $U X.XXX (Uruguayan peso style)
 */
const formatCurrency = (amount, currency = '$U') => {
  if (amount === null || amount === undefined) return `${currency} 0`;
  const formatted = Math.round(Number(amount)).toLocaleString('es-UY');
  return `${currency} ${formatted}`;
};

/**
 * Draw the company header (logo + name + address + phone) on the current page.
 * logoBuffer: Buffer of the logo image (or null)
 * Returns the Y position after the header separator line.
 */
const drawCompanyHeader = (doc, settings, logoBuffer) => {
  let headerY = 50;

  if (logoBuffer) {
    doc.image(logoBuffer, 50, headerY, { width: 80 });
    doc.fontSize(18).font('Helvetica-Bold')
      .fillColor('#000000')
      .text(settings.companyName || 'Casa de Salud Residencial', 140, headerY + 10);
    if (settings.address) {
      doc.fontSize(9).font('Helvetica').text(settings.address, 140, headerY + 35);
    }
    if (settings.phone) {
      doc.fontSize(9).font('Helvetica').text(`Tel: ${settings.phone}`, 140, headerY + 48);
    }
    headerY += 90;
  } else {
    doc.fontSize(18).font('Helvetica-Bold')
      .fillColor('#000000')
      .text(settings?.companyName || 'Casa de Salud Residencial', 50, headerY);
    if (settings?.address) {
      doc.fontSize(9).font('Helvetica').text(settings.address, 50, headerY + 28);
    }
    headerY += 55;
  }

  doc.moveTo(50, headerY).lineTo(545, headerY).stroke();
  return headerY + 15;
};

/**
 * Load logo as Buffer from Cloudinary URL or local path.
 */
const loadLogoBuffer = async (settings) => {
  if (!settings || !settings.logo) return null;
  try {
    if (settings.logo.startsWith('http')) {
      return await fetchImageBuffer(settings.logo);
    }
    // Legacy local path
    const localPath = path.join(__dirname, '..', settings.logo);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
  } catch (e) {
    // If logo can't be loaded, continue without it
  }
  return null;
};

/**
 * Generate a monthly account statement PDF for a single resident.
 * Matches the "Ana Brun Febrero 2026" format exactly.
 */
const generateStatementPDF = async (resident, statement, expenses, payments) => {
  const settings = await Settings.findOne() || {};
  const logoBuffer = await loadLogoBuffer(settings);

  const month = statement.month;
  const year = statement.year;
  const monthName = FULL_MONTH_NAMES_ES[month - 1];
  const currency = settings.currency || '$U';

  const introText = settings.statementIntroText
    ? `${settings.statementIntroText} ${monthName} ${year}`
    : `Estimadas Familias, Adjuntamos Estado de Cuenta del Mes ${monthName} ${year}`;

  const footerText = settings.statementFooterText ||
    'Recordamos que los pagos deben Realizarse del 1 al 5 de cada mes.\nQuedamos a las órdenes para cualquier consulta.';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    let y = drawCompanyHeader(doc, settings, logoBuffer);

    // Intro text (green, like client PDF)
    doc.fontSize(11).font('Helvetica').fillColor('#2e7d32')
      .text(introText, 50, y);
    y += 20;

    doc.fontSize(11).font('Helvetica').fillColor('#2e7d32')
      .text(`Residente:  ${resident.firstName} ${resident.lastName}`, 50, y);
    y += 30;

    doc.fillColor('#000000');

    // Table columns
    const colConcept = 50;
    const colImporte = 290;
    const colCantidad = 390;
    const colTotal = 460;
    const tableRight = 545;
    const rowH = 22;
    const headerH = 24;

    // Table header
    doc.rect(colConcept, y, tableRight - colConcept, headerH).stroke();
    doc.moveTo(colImporte, y).lineTo(colImporte, y + headerH).stroke();
    doc.moveTo(colCantidad, y).lineTo(colCantidad, y + headerH).stroke();
    doc.moveTo(colTotal, y).lineTo(colTotal, y + headerH).stroke();

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    drawCellText(doc, 'Concepto', colConcept, y, colImporte - colConcept, headerH);
    drawCellText(doc, 'Importe', colImporte, y, colCantidad - colImporte, headerH, { align: 'center' });
    drawCellText(doc, 'Cantidad', colCantidad, y, colTotal - colCantidad, headerH, { align: 'center' });
    drawCellText(doc, 'Total', colTotal, y, tableRight - colTotal, headerH, { align: 'center' });
    y += headerH;

    // Helper to draw a data row
    const drawRow = (concept, importe, cantidad, total, isBold = false, bgColor = null) => {
      if (y > 720) { doc.addPage(); y = 50; }
      if (bgColor) {
        doc.rect(colConcept, y, tableRight - colConcept, rowH).fill(bgColor);
      }
      doc.fillColor('#000000');
      doc.rect(colConcept, y, tableRight - colConcept, rowH).stroke();
      doc.moveTo(colImporte, y).lineTo(colImporte, y + rowH).stroke();
      doc.moveTo(colCantidad, y).lineTo(colCantidad, y + rowH).stroke();
      doc.moveTo(colTotal, y).lineTo(colTotal, y + rowH).stroke();

      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
      drawCellText(doc, concept, colConcept, y, colImporte - colConcept, rowH);
      if (importe !== null) drawCellText(doc, importe, colImporte, y, colCantidad - colImporte, rowH, { align: 'center' });
      if (cantidad !== null) drawCellText(doc, cantidad, colCantidad, y, colTotal - colCantidad, rowH, { align: 'center' });
      drawCellText(doc, total, colTotal, y, tableRight - colTotal, rowH, { align: 'right' });
      y += rowH;
    };

    // Row 1: Monthly fee (bold)
    drawRow(
      `Mensualidad ${monthName} ${year}`,
      formatCurrency(statement.monthlyFee, currency),
      '1',
      formatCurrency(statement.monthlyFee, currency),
      true
    );

    // Expense rows (alternating background)
    expenses.forEach((exp, idx) => {
      const bg = idx % 2 === 0 ? null : '#f9f9f9';
      drawRow(
        exp.concept,
        formatCurrency(exp.unitPrice, currency),
        String(exp.quantity),
        formatCurrency(exp.amount, currency),
        false,
        bg
      );
    });

    // Empty filler rows to keep consistent height (min 8 rows total)
    const totalRows = 1 + expenses.length;
    const minRows = 8;
    for (let i = totalRows; i < minRows; i++) {
      if (y > 720) break;
      doc.rect(colConcept, y, tableRight - colConcept, rowH).stroke();
      doc.moveTo(colImporte, y).lineTo(colImporte, y + rowH).stroke();
      doc.moveTo(colCantidad, y).lineTo(colCantidad, y + rowH).stroke();
      doc.moveTo(colTotal, y).lineTo(colTotal, y + rowH).stroke();
      y += rowH;
    }

    // Total Mes row
    y += 5;
    const totalRowH = 24;
    doc.rect(colTotal - 80, y, 80 + (tableRight - colTotal), totalRowH).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    drawCellText(doc, 'Total Mes', colTotal - 80, y, 80, totalRowH, { align: 'right' });
    drawCellText(doc, formatCurrency(statement.totalAmount, currency), colTotal, y, tableRight - colTotal, totalRowH, { align: 'right' });
    y += totalRowH + 25;

    // Addenda (custom message for this statement)
    if (statement.addenda && statement.addenda.trim()) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a237e')
        .text(statement.addenda, 50, y, { width: 495 });
      y += doc.heightOfString(statement.addenda, { width: 495, fontSize: 10 }) + 14;
    }

    // Footer text (green, like client PDF)
    doc.fontSize(10).font('Helvetica').fillColor('#2e7d32');
    const footerLines = footerText.split('\n');
    for (const line of footerLines) {
      doc.text(line, 50, y);
      y += 18;
    }

    // Page footer: website | phone – email
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const footerParts = [
        settings.website,
        settings.phone ? `Teléfono ${settings.phone}` : null,
        settings.email ? `info@${settings.email}` : null
      ].filter(Boolean).join('  –  ');

      if (footerParts) {
        doc.fontSize(8).font('Helvetica').fillColor('#555555')
          .text(footerParts, 50, 760, { align: 'center', width: 495 });
      }
    }

    doc.end();
  });
};

/**
 * Generate a single PDF with all residents' statements for a given month/year.
 * One resident per page.
 */
const generateAllStatementsPDF = async (residentsData, options = {}) => {
  const settings = await Settings.findOne() || {};
  const logoBuffer = await loadLogoBuffer(settings);
  const month = options.month || (new Date().getMonth() + 1);
  const year = options.year || new Date().getFullYear();
  const currency = settings.currency || '$U';
  const monthName = FULL_MONTH_NAMES_ES[month - 1];

  const introText = settings.statementIntroText
    ? `${settings.statementIntroText} ${monthName} ${year}`
    : `Estimadas Familias, Adjuntamos Estado de Cuenta del Mes ${monthName} ${year}`;

  const footerText = settings.statementFooterText ||
    'Recordamos que los pagos deben Realizarse del 1 al 5 de cada mes.\nQuedamos a las órdenes para cualquier consulta.';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    residentsData.forEach(({ resident, statement, expenses }, index) => {
      if (index > 0) doc.addPage();

      let y = drawCompanyHeader(doc, settings, logoBuffer);

      doc.fontSize(11).font('Helvetica').fillColor('#2e7d32').text(introText, 50, y);
      y += 20;
      doc.fontSize(11).font('Helvetica').fillColor('#2e7d32')
        .text(`Residente:  ${resident.firstName} ${resident.lastName}`, 50, y);
      y += 30;
      doc.fillColor('#000000');

      const colConcept = 50, colImporte = 290, colCantidad = 390, colTotal = 460, tableRight = 545;
      const rowH = 22, headerH = 24;

      // Table header
      doc.rect(colConcept, y, tableRight - colConcept, headerH).stroke();
      doc.moveTo(colImporte, y).lineTo(colImporte, y + headerH).stroke();
      doc.moveTo(colCantidad, y).lineTo(colCantidad, y + headerH).stroke();
      doc.moveTo(colTotal, y).lineTo(colTotal, y + headerH).stroke();
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      drawCellText(doc, 'Concepto', colConcept, y, colImporte - colConcept, headerH);
      drawCellText(doc, 'Importe', colImporte, y, colCantidad - colImporte, headerH, { align: 'center' });
      drawCellText(doc, 'Cantidad', colCantidad, y, colTotal - colCantidad, headerH, { align: 'center' });
      drawCellText(doc, 'Total', colTotal, y, tableRight - colTotal, headerH, { align: 'center' });
      y += headerH;

      const drawRow = (concept, importe, cantidad, total, isBold = false, bgColor = null) => {
        if (bgColor) doc.rect(colConcept, y, tableRight - colConcept, rowH).fill(bgColor);
        doc.fillColor('#000000');
        doc.rect(colConcept, y, tableRight - colConcept, rowH).stroke();
        doc.moveTo(colImporte, y).lineTo(colImporte, y + rowH).stroke();
        doc.moveTo(colCantidad, y).lineTo(colCantidad, y + rowH).stroke();
        doc.moveTo(colTotal, y).lineTo(colTotal, y + rowH).stroke();
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
        drawCellText(doc, concept, colConcept, y, colImporte - colConcept, rowH);
        if (importe !== null) drawCellText(doc, importe, colImporte, y, colCantidad - colImporte, rowH, { align: 'center' });
        if (cantidad !== null) drawCellText(doc, cantidad, colCantidad, y, colTotal - colCantidad, rowH, { align: 'center' });
        drawCellText(doc, total, colTotal, y, tableRight - colTotal, rowH, { align: 'right' });
        y += rowH;
      };

      const fee = statement ? statement.monthlyFee : 0;
      const totalAmount = statement ? statement.totalAmount : 0;

      drawRow(`Mensualidad ${monthName} ${year}`, formatCurrency(fee, currency), '1', formatCurrency(fee, currency), true);

      (expenses || []).forEach((exp, idx) => {
        drawRow(exp.concept, formatCurrency(exp.unitPrice, currency), String(exp.quantity), formatCurrency(exp.amount, currency), false, idx % 2 === 0 ? null : '#f9f9f9');
      });

      const totalRows = 1 + (expenses || []).length;
      for (let i = totalRows; i < 8; i++) {
        if (y > 720) break;
        doc.rect(colConcept, y, tableRight - colConcept, rowH).stroke();
        doc.moveTo(colImporte, y).lineTo(colImporte, y + rowH).stroke();
        doc.moveTo(colCantidad, y).lineTo(colCantidad, y + rowH).stroke();
        doc.moveTo(colTotal, y).lineTo(colTotal, y + rowH).stroke();
        y += rowH;
      }

      y += 5;
      const totalRowH = 24;
      doc.rect(colTotal - 80, y, 80 + (tableRight - colTotal), totalRowH).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      drawCellText(doc, 'Total Mes', colTotal - 80, y, 80, totalRowH, { align: 'right' });
      drawCellText(doc, formatCurrency(totalAmount, currency), colTotal, y, tableRight - colTotal, totalRowH, { align: 'right' });
      y += totalRowH + 25;

      if (statement?.addenda && statement.addenda.trim()) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a237e')
          .text(statement.addenda, 50, y, { width: 495 });
        y += doc.heightOfString(statement.addenda, { width: 495, fontSize: 10 }) + 14;
      }

      doc.fontSize(10).font('Helvetica').fillColor('#2e7d32');
      const footerLines = footerText.split('\n');
      for (const line of footerLines) {
        doc.text(line, 50, y);
        y += 18;
      }
      doc.fillColor('#000000');
    });

    // Page footers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const footerParts = [
        settings.website,
        settings.phone ? `Teléfono ${settings.phone}` : null,
        settings.email ? `info@${settings.email}` : null
      ].filter(Boolean).join('  –  ');

      if (footerParts) {
        doc.fontSize(8).font('Helvetica').fillColor('#555555')
          .text(footerParts, 50, 760, { align: 'center', width: 495 });
      }
    }

    doc.end();
  });
};

/**
 * Generate a ledger PDF (libro de ventas or debtors list).
 * @param {Array} statements - populated MonthlyStatement documents
 * @param {Object} options - { month, year, type: 'summary'|'debtors', sucursal }
 */
const generateLedgerPDF = async (statements, options = {}) => {
  const settings = await Settings.findOne() || {};
  const logoBuffer = await loadLogoBuffer(settings);
  const month = options.month;
  const year = options.year;
  const type = options.type || 'summary';
  const currency = settings.currency || '$U';
  const monthName = FULL_MONTH_NAMES_ES[month - 1];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = drawCompanyHeader(doc, settings, logoBuffer);

    // Title
    const title = type === 'debtors'
      ? `LISTA DE DEUDORES — ${monthName} ${year}`
      : `LIBRO DE VENTAS — ${monthName} ${year}`;

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
      .text(title, 50, y, { align: 'center', width: 495 });
    y += 25;

    if (options.sucursal) {
      doc.fontSize(10).font('Helvetica').fillColor('#555555')
        .text(`Sucursal: ${options.sucursal}`, 50, y);
      y += 18;
    }
    doc.fillColor('#000000');

    const hasSucursal = statements.some(s => s.resident && s.resident.sucursal);

    // Column definitions
    const cols = hasSucursal
      ? [
          { label: 'Residente',   x: 50,  w: 120, align: 'left'  },
          { label: 'Sucursal',    x: 170, w: 65,  align: 'left'  },
          { label: 'Mensualidad', x: 235, w: 65,  align: 'right' },
          { label: 'Gastos',      x: 300, w: 60,  align: 'right' },
          { label: 'Total',       x: 360, w: 60,  align: 'right' },
          { label: 'Pagado',      x: 420, w: 60,  align: 'right' },
          { label: 'Saldo',       x: 480, w: 65,  align: 'right' },
        ]
      : [
          { label: 'Residente',   x: 50,  w: 155, align: 'left'  },
          { label: 'Mensualidad', x: 205, w: 75,  align: 'right' },
          { label: 'Gastos',      x: 280, w: 65,  align: 'right' },
          { label: 'Total',       x: 345, w: 65,  align: 'right' },
          { label: 'Pagado',      x: 410, w: 65,  align: 'right' },
          { label: 'Saldo',       x: 475, w: 70,  align: 'right' },
        ];

    const tableRight = 545;
    const rowH = 20;
    const headerH = 22;

    // Header row
    doc.rect(50, y, tableRight - 50, headerH).fill('#2e7d32');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    cols.forEach(col => {
      drawCellText(doc, col.label, col.x, y, col.w, headerH, { align: col.align });
    });
    y += headerH;

    let totFee = 0, totExp = 0, totTotal = 0, totPaid = 0, totBalance = 0;

    statements.forEach((s, idx) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      const bg = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
      doc.rect(50, y, tableRight - 50, rowH).fill(bg);

      totFee     += s.monthlyFee    || 0;
      totExp     += s.totalExpenses || 0;
      totTotal   += s.totalAmount   || 0;
      totPaid    += s.amountPaid    || 0;
      totBalance += s.balance       || 0;

      doc.fillColor('#000000').fontSize(8).font('Helvetica');

      let ci = 0;
      const name = `${s.resident.firstName} ${s.resident.lastName}`;
      drawCellText(doc, name, cols[ci].x, y, cols[ci].w, rowH); ci++;
      if (hasSucursal) {
        drawCellText(doc, s.resident.sucursal || '', cols[ci].x, y, cols[ci].w, rowH); ci++;
      }
      drawCellText(doc, formatCurrency(s.monthlyFee,    currency), cols[ci].x, y, cols[ci].w, rowH, { align: 'right' }); ci++;
      drawCellText(doc, formatCurrency(s.totalExpenses, currency), cols[ci].x, y, cols[ci].w, rowH, { align: 'right' }); ci++;
      drawCellText(doc, formatCurrency(s.totalAmount,   currency), cols[ci].x, y, cols[ci].w, rowH, { align: 'right' }); ci++;
      drawCellText(doc, formatCurrency(s.amountPaid,    currency), cols[ci].x, y, cols[ci].w, rowH, { align: 'right' }); ci++;

      doc.fillColor(s.balance > 0 ? '#c62828' : '#2e7d32');
      drawCellText(doc, formatCurrency(s.balance, currency), cols[ci].x, y, cols[ci].w, rowH, { align: 'right' });

      doc.fillColor('#000000');
      doc.rect(50, y, tableRight - 50, rowH).stroke();
      y += rowH;
    });

    // Totals row
    y += 4;
    doc.rect(50, y, tableRight - 50, 22).fill('#e8f5e9');
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');

    let ci = 0;
    drawCellText(doc, `TOTALES (${statements.length})`, cols[ci].x, y, cols[ci].w, 22); ci++;
    if (hasSucursal) ci++;
    drawCellText(doc, formatCurrency(totFee,     currency), cols[ci].x, y, cols[ci].w, 22, { align: 'right' }); ci++;
    drawCellText(doc, formatCurrency(totExp,     currency), cols[ci].x, y, cols[ci].w, 22, { align: 'right' }); ci++;
    drawCellText(doc, formatCurrency(totTotal,   currency), cols[ci].x, y, cols[ci].w, 22, { align: 'right' }); ci++;
    drawCellText(doc, formatCurrency(totPaid,    currency), cols[ci].x, y, cols[ci].w, 22, { align: 'right' }); ci++;
    doc.fillColor('#c62828');
    drawCellText(doc, formatCurrency(totBalance, currency), cols[ci].x, y, cols[ci].w, 22, { align: 'right' });
    doc.fillColor('#000000');
    doc.rect(50, y, tableRight - 50, 22).stroke();

    // Page footers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#555555')
        .text(`Generado el ${new Date().toLocaleString('es-UY')}`, 50, 760, { align: 'center', width: 495 });
    }

    doc.end();
  });
};

module.exports = { generateDeliveryPDF, generateResidentReportPDF, generateAllResidentsReportPDF, generateStatementPDF, generateAllStatementsPDF, generateLedgerPDF, getFormLabel, FORM_LABELS_ES, FULL_MONTH_NAMES_ES };
