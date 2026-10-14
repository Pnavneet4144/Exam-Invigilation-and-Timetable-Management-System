const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

// Creates a PDF buffer
function generatePDF(title, columns, rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).text('IIIT Pune', { align: 'center' });
    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown();

    // Simple Table
    const tableTop = doc.y;
    const itemMargin = 5;
    
    // Draw columns
    let currentY = tableTop;
    const colWidth = (doc.page.width - 60) / columns.length;

    // Table header
    doc.font('Helvetica-Bold').fontSize(10);
    columns.forEach((col, i) => {
      doc.text(col, 30 + (i * colWidth), currentY, { width: colWidth, align: 'left' });
    });
    currentY += 15;
    doc.moveTo(30, currentY).lineTo(doc.page.width - 30, currentY).stroke();
    currentY += 10;

    // Table body
    doc.font('Helvetica').fontSize(9);
    rows.forEach(row => {
      let maxH = 0;
      const startY = currentY;
      row.forEach((cell, i) => {
        const text = String(cell || '');
        doc.text(text, 30 + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
        const h = doc.heightOfString(text, { width: colWidth - 5 });
        if (h > maxH) maxH = h;
      });
      currentY += maxH + itemMargin;
      
      if (currentY > doc.page.height - 50) {
        doc.addPage();
        currentY = 30;
      }
    });

    doc.moveDown();
    doc.fontSize(8).text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.end();
  });
}

// Creates an Excel buffer
function generateExcel(sheetName, columns, rows) {
  const wsData = [columns, ...rows];
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel limits sheet names
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { generatePDF, generateExcel };
