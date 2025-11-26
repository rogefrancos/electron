const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * generatePDF(parsedHL7, outputPath) -> Promise<string>
 * - parsedHL7: object parsed by your HL7 parser
 * - outputPath: full path where PDF will be written (required)
 *
 * Returns a Promise that resolves with the outputPath on success or rejects with an Error.
 */
function generatePDF(parsedHL7, outputPath) {
  return new Promise((resolve, reject) => {
    if (!outputPath) {
      return reject(new Error('outputPath is required for generatePDF'));
    }

    try {
      console.log('[pdfgen] Starting PDF generation to:', outputPath);

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('[pdfgen] Created directory:', dir);
      }

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      let finished = false;
      // Safety timeout (in case stream never finishes): 30s
      const timeoutMs = 30000;
      const timer = setTimeout(() => {
        if (!finished) {
          const err = new Error('PDF generation timed out');
          console.error('[pdfgen] Timeout:', err);
          reject(err);
        }
      }, timeoutMs);

      // Stream event handling
      stream.on('finish', () => {
        finished = true;
        clearTimeout(timer);
        console.log('[pdfgen] Write stream finished:', outputPath);
        resolve(outputPath);
      });

      // Sometimes 'close' fires instead of 'finish'
      stream.on('close', () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          console.log('[pdfgen] Write stream closed:', outputPath);
          resolve(outputPath);
        }
      });

      stream.on('error', (err) => {
        clearTimeout(timer);
        console.error('[pdfgen] Stream error:', err);
        reject(err);
      });

      // Pipe doc to stream
      doc.pipe(stream);

      // Begin content (kept similar to previous prettier layout)
      try {
        const titleFontSize = 18;
        const headingFontSize = 13;
        const textFontSize = 11;
        const leftX = doc.page.margins.left;
        const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc.font('Helvetica-Bold').fontSize(titleFontSize).text("Laboratory Results Report", { align: "center" });
        doc.moveDown(1);

        // Message header
        doc.fontSize(headingFontSize).fillColor('#333').text("Message Information", { underline: true });
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(textFontSize).fillColor('#000');
        doc.text(`Sending App: ${parsedHL7.header?.sendingApp || "N/A"}`);
        doc.text(`Sending Facility: ${parsedHL7.header?.sendingFacility || "N/A"}`);
        doc.text(`Message Date: ${parsedHL7.header?.messageDate || "N/A"}`);
        doc.text(`Message Type: ${parsedHL7.header?.messageType || "N/A"}`);
        doc.moveDown();

        // Patient boxed section
        const p = parsedHL7.patient || {};
        const o = parsedHL7.order || {};

        const boxTop = doc.y;
        const boxHeight = 80;
        doc.rect(leftX - 2, boxTop - 4, usableWidth + 4, boxHeight).stroke('#CCCCCC');

        doc.fontSize(headingFontSize).font('Helvetica-Bold').text("Patient Information", leftX, boxTop);
        doc.moveDown(0.3);
        doc.fontSize(textFontSize).font('Helvetica');

        const patientInfoTop = doc.y;
        const col1x = leftX;
        const col2x = leftX + (usableWidth / 2);

        doc.text(`Patient ID: `, col1x, patientInfoTop, { continued: true }).font('Helvetica-Bold').text(`${p.id || 'N/A'}`).font('Helvetica');
        doc.moveDown(0.2);
        doc.text(`Name: `, { continued: true }).font('Helvetica-Bold').text(`${(p.firstName || '')} ${(p.lastName || '')}`.trim() || 'N/A').font('Helvetica');
        doc.moveDown(0.2);

        const currentY = doc.y;
        doc.text(`Birth Date: `, col2x, patientInfoTop, { continued: true }).font('Helvetica-Bold').text(`${p.birthDate || 'N/A'}`).font('Helvetica');
        doc.moveDown(0.2);
        doc.text(`Gender: `, col2x, doc.y, { continued: true }).font('Helvetica-Bold').text(`${p.gender || 'N/A'}`).font('Helvetica');

        doc.moveDown(2);

        // Order info
        doc.fontSize(headingFontSize).font('Helvetica-Bold').text("Order Information");
        doc.moveDown(0.3);
        doc.fontSize(textFontSize).font('Helvetica');
        doc.text(`Order Number: ${o.orderNumber || 'N/A'}`);
        doc.text(`Test Name: ${o.testName || 'N/A'}`);
        doc.text(`Date/Time: ${o.dateTime || 'N/A'}`);
        doc.moveDown();

        // Observations as table
        doc.fontSize(headingFontSize).font('Helvetica-Bold').text("Observations");
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(textFontSize);

        const tableX = leftX;
        const colWidths = {
          name: Math.floor(usableWidth * 0.4),
          value: Math.floor(usableWidth * 0.15),
          unit: Math.floor(usableWidth * 0.12),
          ref: Math.floor(usableWidth * 0.2),
          flag: usableWidth - (Math.floor(usableWidth * 0.4) + Math.floor(usableWidth * 0.15) + Math.floor(usableWidth * 0.12) + Math.floor(usableWidth * 0.2))
        };
        const headerY = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Name', tableX, headerY, { width: colWidths.name });
        doc.text('Value', tableX + colWidths.name, headerY, { width: colWidths.value, align: 'left' });
        doc.text('Unit', tableX + colWidths.name + colWidths.value, headerY, { width: colWidths.unit, align: 'left' });
        doc.text('Reference', tableX + colWidths.name + colWidths.value + colWidths.unit, headerY, { width: colWidths.ref, align: 'left' });
        doc.text('Flag', tableX + colWidths.name + colWidths.value + colWidths.unit + colWidths.ref, headerY, { width: colWidths.flag, align: 'left' });
        doc.moveDown(0.6);
        doc.font('Helvetica');

        parsedHL7.observations = parsedHL7.observations || [];
        parsedHL7.observations.forEach((obs) => {
          if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
            doc.addPage();
          }
          const rowY = doc.y;
          doc.text(obs.name || 'Unknown', tableX, rowY, { width: colWidths.name });
          doc.text(obs.value || '-', tableX + colWidths.name, rowY, { width: colWidths.value });
          doc.text(obs.unit || '-', tableX + colWidths.name + colWidths.value, rowY, { width: colWidths.unit });
          doc.text(obs.referenceRange || '-', tableX + colWidths.name + colWidths.value + colWidths.unit, rowY, { width: colWidths.ref });
          doc.text(obs.flag || '-', tableX + colWidths.name + colWidths.value + colWidths.unit + colWidths.ref, rowY, { width: colWidths.flag });
          doc.moveDown(0.8);
        });

        // Footer
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#666').text("Generated automatically from HL7 data", { align: "center" });

        // End doc
        doc.end();

        console.log('[pdfgen] doc.end() called, waiting for stream to finish...');
      } catch (err) {
        clearTimeout(timer);
        console.error('[pdfgen] Error while adding content to PDF:', err);
        // Close doc/stream safely
        try { doc.end(); } catch (e) { /* ignore */ }
        try { stream.close(); } catch (e) { /* ignore */ }
        reject(err);
      }
    } catch (err) {
      console.error('[pdfgen] Unexpected error before PDF generation:', err);
      reject(err);
    }
  });
}

module.exports = { generatePDF };