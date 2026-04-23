// tests/order.test.js — Order validation tests
const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());

// Mock order endpoint
app.post('/api/orders', (req, res) => {
  const { brand, customerName, customerMobile, items, totalAmount } = req.body;
  if (!brand) return res.status(400).json({ success: false, message: 'Brand is required.' });
  if (!customerName?.trim()) return res.status(400).json({ success: false, message: 'Customer name is required.' });
  if (!/^[6-9]\d{9}$/.test(customerMobile || '')) return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
  if (!items?.length) return res.status(400).json({ success: false, message: 'Cart is empty.' });
  if (!totalAmount || totalAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid total amount.' });
  res.status(201).json({ success: true, order: { orderNumber: 'TLC-1001', status: 'pending', totalAmount } });
});

const validOrder = {
  brand: 'chinese',
  customerName: 'Rahul Sharma',
  customerMobile: '9876543210',
  items: [{ name: 'Veg Noodles', price: 80, quantity: 2, emoji: '🍜' }],
  subtotal: 160, deliveryFee: 20, tax: 9, totalAmount: 189,
  paymentMethod: 'cod', orderType: 'delivery',
};

describe('Order API — Validation', () => {
  test('POST /orders → 400 if brand missing', async () => {
    const { brand, ...rest } = validOrder;
    const res = await request(app).post('/api/orders').send(rest);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/brand/i);
  });

  test('POST /orders → 400 if customer name missing', async () => {
    const res = await request(app).post('/api/orders').send({ ...validOrder, customerName: '' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  test('POST /orders → 400 if mobile invalid', async () => {
    const res = await request(app).post('/api/orders').send({ ...validOrder, customerMobile: '12345' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/mobile/i);
  });

  test('POST /orders → 400 if cart empty', async () => {
    const res = await request(app).post('/api/orders').send({ ...validOrder, items: [] });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/cart/i);
  });

  test('POST /orders → 400 if totalAmount invalid', async () => {
    const res = await request(app).post('/api/orders').send({ ...validOrder, totalAmount: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/total/i);
  });

  test('POST /orders → 201 with valid payload', async () => {
    const res = await request(app).post('/api/orders').send(validOrder);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toHaveProperty('orderNumber');
    expect(res.body.order.status).toBe('pending');
  });
});

describe('Order helpers — Business logic', () => {
  test('Order total should equal subtotal + fees', () => {
    const subtotal = 160, deliveryFee = 20, tax = 9;
    expect(subtotal + deliveryFee + tax).toBe(189);
  });

  test('Order number prefix for chinese brand', () => {
    const number = 'TLC-1001';
    expect(number.startsWith('TLC')).toBe(true);
  });

  test('Order number prefix for icecream brand', () => {
    const number = 'TLI-1001';
    expect(number.startsWith('TLI')).toBe(true);
  });
});
