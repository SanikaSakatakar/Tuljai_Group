const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema({
  item:         { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  brand:        { type: String, enum: ['chinese','icecream'], required: true },
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, required: true },
  rating:       { type: Number, required: true, min: 1, max: 5 },
  comment:      { type: String, default: '' },
}, { timestamps: true });
module.exports = mongoose.model('Review', reviewSchema);
