// models/RefreshToken.js
// Stores refresh tokens in DB for rotation + blacklisting
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  revoked:   { type: Boolean, default: false },
}, { timestamps: true });

// Auto-delete expired tokens (TTL index)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
