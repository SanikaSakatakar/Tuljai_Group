// reviewController.js
const Review = require('../models/Review');
const MenuItem = require('../models/MenuItem');

exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ item: req.params.itemId }).sort({ createdAt: -1 });
    const avg = reviews.length ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : 0;
    res.json({ success: true, reviews, average: avg, count: reviews.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createReview = async (req, res) => {
  try {
    const { item, brand, customerName, rating, comment } = req.body;
    if (!item || !brand || !customerName || !rating) return res.status(400).json({ success: false, message: 'All required fields missing.' });
    const review = await Review.create({ item, brand, user: req.user?._id || null, customerName, rating, comment });
    const all = await Review.find({ item });
    const avg = parseFloat((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1));
    await MenuItem.findByIdAndUpdate(item, { 'ratings.average': avg, 'ratings.count': all.length });
    res.status(201).json({ success: true, review });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteReview = async (req, res) => {
  try { await Review.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
