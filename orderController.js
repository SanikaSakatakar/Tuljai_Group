// controllers/orderController.js — v5: real-time socket + email + PDF
const Order = require('../models/Order');
const { sendOrderConfirmation, sendStatusUpdate } = require('../services/emailService');
const { generateInvoicePDF } = require('../services/pdfService');

// Helper: emit socket event if io is available
const emitOrderUpdate = (req, orderId, event, data) => {
  const io = req.app.get('io');
  if (io) {
    io.to(`order_${orderId}`).emit(event, data);
    io.to('admin_room').emit(event, data);
  }
};

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const {
      brand, customerName, customerMobile, customerEmail, customerAddress,
      orderType, items, subtotal, deliveryFee, tax, discount, totalAmount,
      paymentMethod, notes
    } = req.body;

    if (!brand)                 return res.status(400).json({ success:false, message:'Brand is required.' });
    if (!customerName?.trim())  return res.status(400).json({ success:false, message:'Customer name is required.' });
    if (!/^[6-9]\d{9}$/.test((customerMobile||'').trim()))
      return res.status(400).json({ success:false, message:'Enter a valid 10-digit mobile number.' });
    if (!items?.length)         return res.status(400).json({ success:false, message:'Cart is empty.' });
    if (!totalAmount || totalAmount <= 0)
      return res.status(400).json({ success:false, message:'Invalid total amount.' });

    // Duplicate prevention
    const dupe = await Order.findOne({
      customerMobile: customerMobile.trim(), brand, totalAmount,
      createdAt: { $gte: new Date(Date.now() - 60000) }
    });
    if (dupe) return res.status(400).json({ success:false, message:'Duplicate order detected. Please wait.' });

    const order = await Order.create({
      brand, user: req.user?._id || null,
      customerName: customerName.trim(), customerMobile: customerMobile.trim(),
      customerEmail: customerEmail || '', customerAddress: customerAddress || '',
      orderType: orderType || 'dine-in', items, subtotal,
      deliveryFee: deliveryFee || 0, tax: tax || 0,
      discount: discount || 0, totalAmount,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      notes: notes || '',
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    });

    // Emit real-time event to admin room
    emitOrderUpdate(req, order._id, 'new_order', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      brand: order.brand,
    });

    // Send confirmation email (non-blocking)
    if (order.customerEmail) sendOrderConfirmation(order);

    res.status(201).json({ success:true, message:'Order placed successfully!', order });
  } catch (err) {
    if (err.name === 'ValidationError')
      return res.status(400).json({ success:false, message: Object.values(err.errors)[0].message });
    res.status(500).json({ success:false, message:'Failed to place order.' });
  }
};

// GET /api/orders/:id — live tracking (public)
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('status orderNumber brand customerName items totalAmount orderType createdAt updatedAt paymentMethod paymentStatus customerMobile statusHistory estimatedTime');
    if (!order) return res.status(404).json({ success:false, message:'Order not found.' });
    res.json({ success:true, order });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders/:id/invoice — full order data for invoice
exports.getInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Order not found.' });
    res.json({ success:true, order });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders/:id/pdf — download PDF invoice
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Order not found.' });
    generateInvoicePDF(order, res);
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders/my-orders
exports.getMyOrders = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.brand) filter.brand = req.query.brand;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success:true, orders });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders/by-mobile/:mobile
exports.getByMobile = async (req, res) => {
  try {
    const filter = { customerMobile: req.params.mobile };
    if (req.query.brand) filter.brand = req.query.brand;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success:true, orders });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders — admin: all orders with pagination + filters
exports.getAllOrders = async (req, res) => {
  try {
    const { brand, status, today, page=1, limit=50, search } = req.query;
    const filter = {};
    if (brand) filter.brand = brand;
    if (status) filter.status = status;
    if (today === 'true') {
      const s = new Date(); s.setHours(0,0,0,0);
      const e = new Date(); e.setHours(23,59,59,999);
      filter.createdAt = { $gte: s, $lte: e };
    }
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).populate('user','name mobile').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ success:true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), orders });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/orders/:id/status — admin: update order status
exports.updateStatus = async (req, res) => {
  try {
    const VALID = ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];
    if (!VALID.includes(req.body.status))
      return res.status(400).json({ success:false, message:'Invalid status.' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Order not found.' });

    const prevStatus = order.status;
    order.status = req.body.status;
    if (req.body.estimatedTime) order.estimatedTime = req.body.estimatedTime;
    order.statusHistory.push({ status: req.body.status, timestamp: new Date(), note: req.body.note || '' });
    await order.save();

    // Emit real-time status update
    emitOrderUpdate(req, order._id, 'order_status_update', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
    });

    // Send status update email (non-blocking)
    if (order.customerEmail && prevStatus !== order.status) sendStatusUpdate(order);

    res.json({ success:true, message:'Status updated.', order });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

// DELETE /api/orders/:id
exports.deleteOrder = async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Order deleted.' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
