const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  mobile:          { type: String, required: true, unique: true, trim: true, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
  email:           { type: String, default: '', trim: true, lowercase: true },
  password:        { type: String, required: true, minlength: 6, select: false },
  role:            { type: String, enum: ['user','admin'], default: 'user' },
  address:         { type: String, default: '' },
  // Security: track failed logins
  loginAttempts:   { type: Number, default: 0 },
  lockUntil:       { type: Date, default: null },
  // OTP for password reset (optional future use)
  resetOtp:        { type: String, default: null },
  resetOtpExpiry:  { type: Date, default: null },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts; lock after 5 failures
userSchema.methods.incLoginAttempts = async function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15 minutes
    this.loginAttempts = 0;
  }
  await this.save();
};

// Reset on successful login
userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = null;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
