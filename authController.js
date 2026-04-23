// controllers/authController.js — v5: refresh tokens added
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

// ── Token generators ──────────────────────────────────────────────────
const genAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });

const genRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const sendTokens = async (user, status, res) => {
  const accessToken  = genAccessToken(user._id);
  const refreshToken = genRefreshToken(user._id);

  // Store refresh token in DB
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.status(status).json({
    success: true,
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, address: user.address },
  });
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;
    if (!name?.trim())          return res.status(400).json({ success:false, message:'Full name is required.' });
    if (!/^[6-9]\d{9}$/.test(mobile?.trim()||'')) return res.status(400).json({ success:false, message:'Enter a valid 10-digit Indian mobile number.' });
    if (!password || password.length < 6) return res.status(400).json({ success:false, message:'Password must be at least 6 characters.' });
    const weak = ['123456','password','qwerty','abc123','000000'];
    if (weak.includes(password.toLowerCase())) return res.status(400).json({ success:false, message:'Password is too common. Please choose a stronger one.' });
    const exists = await User.findOne({ mobile: mobile.trim() });
    if (exists) return res.status(400).json({ success:false, message:'Mobile number already registered. Please login.' });
    const user = await User.create({ name:name.trim(), mobile:mobile.trim(), email:email||'', password });
    await sendTokens(user, 201, res);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success:false, message:'Server error. Please try again.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ success:false, message:'Mobile and password required.' });
    const user = await User.findOne({ mobile: mobile.trim() }).select('+password +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ success:false, message:'Invalid mobile number or password.' });
    if (user.isLocked()) {
      const min = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success:false, message:`Account locked. Try again in ${min} min.` });
    }
    const ok = await user.matchPassword(password);
    if (!ok) {
      await user.incLoginAttempts();
      const rem = 5 - user.loginAttempts;
      const msg = rem <= 0 ? 'Account locked for 15 minutes.' : `Wrong password. ${rem} attempt(s) left.`;
      return res.status(401).json({ success:false, message:msg });
    }
    await user.resetLoginAttempts();
    await sendTokens(user, 200, res);
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// POST /api/auth/refresh — Issue new access token using refresh token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success:false, message:'Refresh token required.' });

    // Verify signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success:false, message:'Invalid or expired refresh token.' });
    }

    // Check DB (not revoked)
    const stored = await RefreshToken.findOne({ token: refreshToken, revoked: false });
    if (!stored) return res.status(401).json({ success:false, message:'Refresh token revoked or not found.' });

    // Rotation: revoke old, issue new pair
    stored.revoked = true;
    await stored.save();

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success:false, message:'User not found.' });

    await sendTokens(user, 200, res);
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// POST /api/auth/logout — Revoke refresh token
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await RefreshToken.findOneAndUpdate({ token: refreshToken }, { revoked: true });
    res.json({ success:true, message:'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ success:true, user:{ id:u._id, name:u.name, mobile:u.mobile, email:u.email, role:u.role, address:u.address }});
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, address } = req.body;
    const u = await User.findByIdAndUpdate(req.user.id, { name, email, address }, { new:true });
    res.json({ success:true, message:'Profile updated.', user:{ id:u._id, name:u.name, mobile:u.mobile, email:u.email, address:u.address }});
  } catch (err) { res.status(500).json({ success:false, message:'Server error.' }); }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6)
      return res.status(400).json({ success:false, message:'Both fields required. New password min 6 chars.' });
    const u = await User.findById(req.user.id).select('+password');
    if (!(await u.matchPassword(currentPassword)))
      return res.status(400).json({ success:false, message:'Current password incorrect.' });
    u.password = newPassword;
    await u.save();
    // Revoke all existing refresh tokens on password change
    await RefreshToken.updateMany({ user: req.user.id }, { revoked: true });
    res.json({ success:true, message:'Password changed. Please log in again.' });
  } catch (err) { res.status(500).json({ success:false, message:'Server error.' }); }
};
