// controllers/dashboardController.js — UPGRADED with today's stats
const Order    = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User     = require('../models/User');

exports.getStats = async (req, res) => {
  try {
    const { brand } = req.query;
    const of = brand ? { brand } : {};

    // Today filter
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
    const todayFilter = { ...of, createdAt:{ $gte:todayStart, $lte:todayEnd } };

    const [
      totalOrders, totalItems, totalUsers, pendingOrders,
      revResult, byStatus, topItems, recentOrders,
      todayOrders, todayRevResult, todayPending
    ] = await Promise.all([
      Order.countDocuments(of),
      MenuItem.countDocuments(brand ? { brand } : {}),
      User.countDocuments({ role:'user' }),
      Order.countDocuments({ ...of, status:'pending' }),
      Order.aggregate([{ $match:{ ...of, status:{ $ne:'cancelled' } } }, { $group:{ _id:null, total:{ $sum:'$totalAmount' } } }]),
      Order.aggregate([{ $match:of }, { $group:{ _id:'$status', count:{ $sum:1 } } }]),
      Order.aggregate([{ $match:of }, { $unwind:'$items' }, { $group:{ _id:'$items.name', qty:{ $sum:'$items.quantity' }, rev:{ $sum:{ $multiply:['$items.price','$items.quantity'] } } } }, { $sort:{ qty:-1 } }, { $limit:5 }]),
      Order.find(of).sort({ createdAt:-1 }).limit(6),
      Order.countDocuments(todayFilter),
      Order.aggregate([{ $match:{ ...todayFilter, status:{ $ne:'cancelled' } } }, { $group:{ _id:null, total:{ $sum:'$totalAmount' } } }]),
      Order.countDocuments({ ...todayFilter, status:'pending' }),
    ]);

    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate()-7);
    const daily = await Order.aggregate([
      { $match:{ ...of, createdAt:{ $gte:sevenAgo }, status:{ $ne:'cancelled' } } },
      { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } }, revenue:{ $sum:'$totalAmount' }, count:{ $sum:1 } } },
      { $sort:{ _id:1 } },
    ]);

    // Pending orders list (for admin notification)
    const pendingList = await Order.find({ ...of, status:'pending' }).sort({ createdAt:-1 }).limit(10);

    res.json({ success:true, stats:{
      totalOrders, totalItems, totalUsers, pendingOrders,
      totalRevenue: revResult[0]?.total || 0,
      byStatus, topItems, daily, recentOrders,
      today: {
        orders: todayOrders,
        revenue: todayRevResult[0]?.total || 0,
        pending: todayPending,
      },
      pendingList,
    }});
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role:'user' }).sort({ createdAt:-1 }).select('-password');
    res.json({ success:true, users });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
};
