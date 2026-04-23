// models/Transaction.js
// Stores Razorpay payment records linked to orders
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order:              { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  razorpayOrderId:    { type: String, required: true, unique: true },
  razorpayPaymentId:  { type: String, default: null },
  razorpaySignature:  { type: String, default: null },
  amount:             { type: Number, required: true },  // in paise
  currency:           { type: String, default: 'INR' },
  status:             { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
  method:             { type: String, default: null },   // upi, card, netbanking etc.
  notes:              { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
