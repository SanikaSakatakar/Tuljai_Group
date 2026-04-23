// services/pdfService.js — Generate PDF invoice using PDFKit
const PDFDocument = require('pdfkit');

exports.generateInvoicePDF = (order, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
  doc.pipe(res);

  const RED = '#e8294a';
  const DARK = '#1a1a2e';
  const GRAY = '#888888';
  const LIGHT = '#f8f9fa';

  // ── Header band ───────────────────────────────────────────────────
  doc.rect(0, 0, 595, 120).fill(RED);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(28).text('TULJAI FOODS', 50, 35);
  doc.fillColor('rgba(255,255,255,0.75)').font('Helvetica').fontSize(11)
     .text(order.brand === 'chinese' ? 'Chinese Kitchen' : 'Ice Cream Parlour', 50, 68);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14)
     .text('INVOICE', 430, 42, { align: 'right', width: 115 });
  doc.fillColor('rgba(255,255,255,0.85)').font('Helvetica').fontSize(10)
     .text(`#${order.orderNumber}`, 430, 62, { align: 'right', width: 115 });
  doc.fillColor('rgba(255,255,255,0.7)').fontSize(9)
     .text(new Date(order.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }), 430, 78, { align: 'right', width: 115 });

  // ── Customer info ─────────────────────────────────────────────────
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
     .text('BILLED TO', 50, 145);
  doc.fillColor(DARK).font('Helvetica').fontSize(11)
     .text(order.customerName, 50, 160)
     .text(`Ph: ${order.customerMobile}`, 50, 176);
  if (order.customerEmail) doc.text(order.customerEmail, 50, 192);
  if (order.customerAddress) doc.text(order.customerAddress, 50, 208, { width: 200 });

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text('ORDER DETAILS', 350, 145);
  doc.fillColor(DARK).font('Helvetica').fontSize(10)
     .text(`Type: ${order.orderType.toUpperCase()}`, 350, 160)
     .text(`Payment: ${order.paymentMethod.toUpperCase()}`, 350, 175)
     .text(`Status: ${order.status.replace(/_/g,' ').toUpperCase()}`, 350, 190)
     .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 205);

  // ── Divider ───────────────────────────────────────────────────────
  doc.moveTo(50, 240).lineTo(545, 240).strokeColor('#eee').lineWidth(1).stroke();

  // ── Items table header ────────────────────────────────────────────
  const tableTop = 255;
  doc.rect(50, tableTop, 495, 28).fill(LIGHT);
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(9)
     .text('ITEM', 60, tableTop + 9)
     .text('QTY', 340, tableTop + 9)
     .text('UNIT PRICE', 390, tableTop + 9)
     .text('TOTAL', 480, tableTop + 9, { align: 'right', width: 55 });

  // ── Items rows ────────────────────────────────────────────────────
  let y = tableTop + 28;
  order.items.forEach((item, idx) => {
    if (idx % 2 === 0) doc.rect(50, y, 495, 26).fill('#fffafb');
    doc.fillColor(DARK).font('Helvetica').fontSize(10)
       .text(`${item.emoji || ''} ${item.name}`, 60, y + 8, { width: 270 })
       .text(String(item.quantity), 340, y + 8)
       .text(`Rs.${item.price}`, 390, y + 8)
       .text(`Rs.${item.price * item.quantity}`, 480, y + 8, { align: 'right', width: 55 });
    y += 26;
  });

  // ── Totals ────────────────────────────────────────────────────────
  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#eee').stroke();
  y += 12;

  const addRow = (label, value, bold = false, color = DARK) => {
    if (bold) {
      doc.rect(350, y - 4, 195, 24).fill(RED);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(12)
         .text(label, 360, y + 1).text(`Rs.${value}`, 450, y + 1, { align: 'right', width: 85 });
      y += 24;
    } else {
      doc.fillColor(GRAY).font('Helvetica').fontSize(10).text(label, 350, y);
      doc.fillColor(color).font('Helvetica').fontSize(10).text(`Rs.${value}`, 450, y, { align: 'right', width: 85 });
      y += 18;
    }
  };

  addRow('Subtotal:', order.subtotal);
  if (order.deliveryFee > 0) addRow('Delivery Fee:', order.deliveryFee);
  if (order.tax > 0) addRow('GST (5%):', order.tax.toFixed(2));
  if (order.discount > 0) addRow('Discount:', `-${order.discount}`, false, '#22c55e');
  y += 4;
  addRow('TOTAL AMOUNT', order.totalAmount, true);

  // ── Payment status badge ──────────────────────────────────────────
  y += 20;
  const psColor = order.paymentStatus === 'paid' ? '#22c55e' : order.paymentStatus === 'failed' ? RED : '#f5a623';
  doc.rect(50, y, 120, 26).fill(psColor);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10)
     .text(`Payment: ${order.paymentStatus.toUpperCase()}`, 55, y + 8, { width: 110, align: 'center' });

  // ── Footer ────────────────────────────────────────────────────────
  doc.rect(0, 760, 595, 82).fill('#1a1a2e');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11).text('Thank you for ordering from Tuljai Foods!', 0, 775, { align: 'center', width: 595 });
  doc.fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(9)
     .text('This is a computer-generated invoice. No signature required.', 0, 793, { align: 'center', width: 595 });
  doc.fillColor('rgba(255,255,255,0.4)').fontSize(8)
     .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 0, 810, { align: 'center', width: 595 });

  doc.end();
};
