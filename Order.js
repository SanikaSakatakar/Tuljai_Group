// models/Order.js — v5: added payment tracking + status timestamps
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  item:     { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  image:    { type: String, default: '' },
  emoji:    { type: String, default: '' },
});

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String },
  timestamp: { type: Date, default: Date.now },
  note:      { type: String, default: '' },
});

const orderSchema = new mongoose.Schema({
  orderNumber:     { type: String, unique: true },
  brand:           { type: String, required: true, enum: ['chinese','icecream'] },
  user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName:    { type: String, required: true, trim: true },
  customerMobile:  { type: String, required: true, trim: true, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
  customerEmail:   { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  orderType:       { type: String, enum: ['dine-in','takeaway','delivery'], default: 'dine-in' },
  items:           [itemSchema],
  subtotal:        { type: Number, required: true },
  deliveryFee:     { type: Number, default: 0 },
  tax:             { type: Number, default: 0 },
  discount:        { type: Number, default: 0 },
  totalAmount:     { type: Number, required: true },
  // Payment fields
  paymentMethod:   { type: String, enum: ['upi','card','cod','razorpay'], default: 'cod' },
  paymentStatus:   { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
  razorpayOrderId: { type: String, default: null },
  // Status tracking
  status:          { type: String, enum: ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'], default: 'pending' },
  statusHistory:   [statusHistorySchema],
  // Email notification sent?
  emailSent:       { type: Boolean, default: false },
  notes:           { type: String, default: '' },
  estimatedTime:   { type: Number, default: 30 },  // minutes
}, { timestamps: true });

// Auto-generate human-readable order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    const prefix = this.brand === 'chinese' ? 'TLC' : 'TLI';
    this.orderNumber = `${prefix}-${String(count + 1001).padStart(4, '0')}`;
  }
  // Auto-push to status history on status change
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({ status: this.status, timestamp: new Date() });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
