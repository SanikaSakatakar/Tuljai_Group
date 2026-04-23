const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

exports.getItems = async (req, res) => {
  try {
    const { brand, category, type, popular, available, search } = req.query;
    const filter = {};
    if (brand) filter.brand = brand;
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (popular === 'true') filter.popular = true;
    if (available !== undefined) filter.available = available === 'true';
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }
    const items = await MenuItem.find(filter).sort({ popular: -1, createdAt: -1 });
    res.json({ success: true, count: items.length, items });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getItemById = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createItem = async (req, res) => {
  try {
    const item = await MenuItem.create(req.body);
    res.status(201).json({ success: true, item });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(err.errors)[0].message });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteItem = async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getRecommend = async (req, res) => {
  try {
    const { brand, mobile, limit = 6 } = req.query;
    const filter = brand ? { brand } : {};
    let ids = [], cats = [];
    if (mobile && mobile.length >= 10) {
      const orders = await Order.find({ customerMobile: mobile, ...(brand ? { brand } : {}) }).sort({ createdAt: -1 }).limit(15);
      orders.forEach(o => o.items.forEach(i => { if (i.item) ids.push(i.item.toString()); }));
      if (ids.length) {
        const prev = await MenuItem.find({ _id: { $in: ids } });
        cats = [...new Set(prev.map(d => d.category))];
      }
    }
    let rec = [];
    if (cats.length) {
      rec = await MenuItem.find({ ...filter, available: true, category: { $in: cats }, _id: { $nin: ids } }).limit(parseInt(limit));
      if (rec.length < limit) {
        const extra = await MenuItem.find({ ...filter, available: true, _id: { $nin: [...ids, ...rec.map(d => d._id.toString())] } }).sort({ popular: -1 }).limit(limit - rec.length);
        rec = [...rec, ...extra];
      }
    } else {
      rec = await MenuItem.find({ ...filter, available: true, popular: true }).limit(parseInt(limit));
      if (rec.length < limit) {
        const extra = await MenuItem.find({ ...filter, available: true, popular: false, _id: { $nin: rec.map(d => d._id.toString()) } }).limit(limit - rec.length);
        rec = [...rec, ...extra];
      }
    }
    res.json({ success: true, recommended: rec, personalized: ids.length > 0 });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
