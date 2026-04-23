// services/emailService.js — Nodemailer email service
const nodemailer = require('nodemailer');

const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

const buildOrderEmail = (order) => {
  const brand = order.brand === 'chinese' ? 'Tuljai Chinese' : 'Tuljai Ice Cream';
  const itemRows = order.items.map(i =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${i.emoji||''} ${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center">x${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700">Rs.${(i.price * i.quantity)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f9fa;font-family:sans-serif">
  <div style="max-width:580px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#e8294a,#c0202e);padding:30px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:26px">Order Confirmed!</h1>
      <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px">${brand}</p>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 4px;color:#888;font-size:11px;text-transform:uppercase;font-weight:700">Order Number</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:900;color:#e8294a">#${order.orderNumber}</p>
      <p style="margin:0 0 16px;color:#333">Hi <strong>${order.customerName}</strong>, your order has been placed!</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tbody>${itemRows}</tbody></table>
      <div style="background:#f8f9fa;border-radius:10px;padding:14px 16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;padding-top:8px;font-size:16px;font-weight:800;color:#1a1a2e">
          <span>Total</span><span style="color:#e8294a">Rs.${order.totalAmount}</span>
        </div>
      </div>
      <p style="margin:0 0 4px;color:#888;font-size:11px">Payment: <strong style="color:#333;text-transform:uppercase">${order.paymentMethod}</strong> | Type: <strong style="color:#333;text-transform:capitalize">${order.orderType}</strong></p>
      <p style="margin:14px 0 0;color:#666;font-size:13px">Thank you for choosing Tuljai! Your food is being prepared.</p>
    </div>
    <div style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #eee">
      <p style="margin:0;font-size:12px;color:#bbb">Tuljai Foods | Est. ${new Date().getFullYear()}</p>
    </div>
  </div></body></html>`;
};

exports.sendOrderConfirmation = async (order) => {
  try {
    const transporter = getTransporter();
    if (!transporter || !order.customerEmail) return;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Tuljai Foods <noreply@tuljai.com>',
      to: order.customerEmail,
      subject: `Order Confirmed #${order.orderNumber} | Tuljai Foods`,
      html: buildOrderEmail(order),
    });
    console.log(`Email sent to ${order.customerEmail}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
};

exports.sendStatusUpdate = async (order) => {
  try {
    const transporter = getTransporter();
    if (!transporter || !order.customerEmail) return;
    const msgs = {
      confirmed: 'Your order has been confirmed!',
      preparing: 'Our chefs are preparing your order!',
      out_for_delivery: 'Your order is out for delivery!',
      delivered: 'Your order has been delivered. Enjoy!',
      cancelled: 'Your order has been cancelled. Contact us for support.',
    };
    const text = msgs[order.status];
    if (!text) return;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: order.customerEmail,
      subject: `Order Update #${order.orderNumber} | Tuljai Foods`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:20px auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #eee">
        <h2 style="color:#e8294a;margin:0 0 12px">Order Status Update</h2>
        <p style="color:#333">Hi <strong>${order.customerName}</strong>, ${text}</p>
        <p style="color:#888;font-size:13px">Order: <strong>#${order.orderNumber}</strong> | Status: <strong style="text-transform:uppercase;color:#e8294a">${order.status.replace(/_/g,' ')}</strong></p>
      </div>`,
    });
  } catch (err) {
    console.error('Status email error:', err.message);
  }
};
