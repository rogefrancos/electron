const fs = require("fs");
const PDFDocument = require("pdfkit");

function generatePDF(parsedHL7, outputPath = "report.pdf") {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(outputPath));

  // Header section
  doc.fontSize(20).text("Laboratory Results Report", { align: "center" });
  doc.moveDown(2);

  // Message header
  doc.fontSize(14).text("Message Information", { underline: true });
  doc.fontSize(12);
  doc.text(`Sending App: ${parsedHL7.header.sendingApp || "N/A"}`);
  doc.text(`Sending Facility: ${parsedHL7.header.sendingFacility || "N/A"}`);
  doc.text(`Message Date: ${parsedHL7.header.messageDate || "N/A"}`);
  doc.text(`Message Type: ${parsedHL7.header.messageType || "N/A"}`);
  doc.moveDown();

  // Patient section
  doc.fontSize(14).text("Patient Information", { underline: true });
  doc.fontSize(12);
  const p = parsedHL7.patient;
  doc.text(`Patient ID: ${p.id || "N/A"}`);
  doc.text(`Name: ${p.firstName || ""} ${p.lastName || ""}`);
  doc.text(`Birth Date: ${p.birthDate || "N/A"}`);
  doc.text(`Gender: ${p.gender || "N/A"}`);
  doc.text(`Address: ${p.address || "N/A"}`);
  doc.moveDown();

  // Order info
  doc.fontSize(14).text("Order Information", { underline: true });
  doc.fontSize(12);
  const o = parsedHL7.order;
  doc.text(`Order Number: ${o.orderNumber || "N/A"}`);
  doc.text(`Test Name: ${o.testName || "N/A"}`);
  doc.text(`Date/Time: ${o.dateTime || "N/A"}`);
  doc.moveDown();

  // Observations
  doc.fontSize(14).text("Observations", { underline: true });
  doc.moveDown(0.5);
  parsedHL7.observations.forEach((obs, index) => {
    doc.fontSize(12).text(`${index + 1}. ${obs.name || "Unknown"}`);
    doc.text(`   Value: ${obs.value || "N/A"} ${obs.unit || ""}`);
    doc.text(`   Reference: ${obs.referenceRange || "N/A"}`);
    doc.text(`   Flag: ${obs.flag || "N/A"}`);
    doc.moveDown(0.5);
  });

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).text("Generated automatically from HL7 data", { align: "center" });

  doc.end();
  console.log(`✅ PDF generated: ${outputPath}`);
}



module.exports = { generatePDF };
