// tests/auth.test.js — API tests for auth endpoints
const request = require('supertest');
const express = require('express');

// Minimal express app for testing (no DB needed for unit checks)
const app = express();
app.use(express.json());

// Mock route: validate registration inputs
app.post('/api/auth/register', (req, res) => {
  const { name, mobile, password } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Full name is required.' });
  if (!/^[6-9]\d{9}$/.test(mobile || '')) return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
  if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password min 6 chars.' });
  res.status(201).json({ success: true, message: 'Registered.' });
});

app.post('/api/auth/login', (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile || !password) return res.status(400).json({ success: false, message: 'Mobile and password required.' });
  if (mobile === '9999999999' && password === 'admin123')
    return res.status(200).json({ success: true, accessToken: 'mock_token', refreshToken: 'mock_refresh' });
  return res.status(401).json({ success: false, message: 'Invalid credentials.' });
});

describe('Auth API — Input Validation', () => {
  // Registration
  test('POST /register → 400 if name missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ mobile: '9876543210', password: 'pass123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/name/i);
  });

  test('POST /register → 400 if mobile invalid', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', mobile: '12345', password: 'pass123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/mobile/i);
  });

  test('POST /register → 400 if password too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Test', mobile: '9876543210', password: '123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  test('POST /register → 201 with valid data', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Test User', mobile: '9876543210', password: 'secure123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // Login
  test('POST /login → 400 if fields missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ mobile: '9999999999' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /login → 401 for wrong credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ mobile: '9999999999', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /login → 200 with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ mobile: '9999999999', password: 'admin123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });
});
