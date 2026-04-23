const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  brand:       { type: String, required: true, enum: ['chinese','icecream'], index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 1 },
  category:    { type: String, required: true },
  image:       { type: String, default: '' },
  emoji:       { type: String, default: '🍽️' },
  type:        { type: String, enum: ['veg','nv','egg'], default: 'veg' },
  popular:     { type: Boolean, default: false },
  badge:       { type: String, default: null },
  available:   { type: Boolean, default: true },
  ratings:     { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
