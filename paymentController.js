// controllers/paymentController.js — Razorpay integration
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_YourKeyHere') {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// POST /api/payment/create-order
// Creates a Razorpay order for a given app-order
exports.createPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId required.' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'Order already paid.' });

    const rzp = getRazorpay();
    if (!rzp) {
      // Demo mode — return mock Razorpay order
      return res.json({
        success: true,
        demo: true,
        razorpayOrderId: `demo_order_${Date.now()}`,
        amount: order.totalAmount * 100,
        currency: 'INR',
        key: 'rzp_test_demo',
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerMobile: order.customerMobile,
        message: 'Razorpay keys not configured — running in demo mode.',
      });
    }

    const rzpOrder = await rzp.orders.create({
      amount: order.totalAmount * 100, // paise
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    });

    // Save transaction record
    await Transaction.create({
      order: order._id,
      user: order.user,
      razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount * 100,
      currency: 'INR',
      notes: rzpOrder.notes,
    });

    // Link Razorpay order to our order
    order.razorpayOrderId = rzpOrder.id;
    order.paymentMethod = 'razorpay';
    await order.save();

    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerMobile: order.customerMobile,
    });
  } catch (err) {
    console.error('Payment create error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
};

// POST /api/payment/verify
// Verifies Razorpay signature after payment success
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

    // Verify signature using HMAC-SHA256
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'demo')
      .update(body)
      .digest('hex');

    const isValid = expectedSig === razorpaySignature;

    if (!isValid) {
      // Mark transaction as failed
      await Transaction.findOneAndUpdate(
        { razorpayOrderId },
        { status: 'failed' }
      );
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Update transaction
    await Transaction.findOneAndUpdate(
      { razorpayOrderId },
      { razorpayPaymentId, razorpaySignature, status: 'paid' }
    );

    // Update order payment status
    const order = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus: 'paid', status: 'confirmed' },
      { new: true }
    );

    res.json({ success: true, message: 'Payment verified successfully!', order });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// GET /api/payment/transaction/:orderId
exports.getTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOne({ order: req.params.orderId })
      .populate('order', 'orderNumber totalAmount status');
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    res.json({ success: true, transaction: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
