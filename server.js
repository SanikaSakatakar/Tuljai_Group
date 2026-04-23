// server.js — v5 Production-Ready: Socket.IO + Razorpay + Email + PDF
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const dotenv    = require('dotenv');
const connectDB = require('./config/db');
const {
  authRouter, menuRouter, orderRouter, paymentRouter, reviewRouter, dashRouter
} = require('./routes/index');

dotenv.config();
connectDB().then(() => { seedAdmin(); seedMenu(); });

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET','POST'] },
  pingTimeout: 60000,
});

// Make io accessible inside controllers via req.app.get('io')
app.set('io', io);

// ── Socket.IO: Real-time order tracking ──────────────────────────────
io.on('connection', (socket) => {
  // Customer joins their order room to get live updates
  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
  });
  // Admin joins admin room to get all new orders
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });
  socket.on('disconnect', () => {});
});

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── In-memory rate limiter ────────────────────────────────────────────
const rlMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k,v] of rlMap) {
    const f = v.filter(t => now - t < 300000);
    if (!f.length) rlMap.delete(k); else rlMap.set(k, f);
  }
}, 300000);

function rateLimit({ windowMs=60000, max=60, msg='Too many requests. Slow down.' } = {}) {
  return (req, res, next) => {
    const key = req.ip || 'x'; const now = Date.now();
    const hits = (rlMap.get(key) || []).filter(t => now - t < windowMs);
    hits.push(now); rlMap.set(key, hits);
    if (hits.length > max) return res.status(429).json({ success:false, message:msg });
    next();
  };
}

app.use('/api/auth/login',    rateLimit({ windowMs:60000, max:10 }));
app.use('/api/auth/register', rateLimit({ windowMs:60000, max:5 }));
app.use('/api/orders',        rateLimit({ windowMs:60000, max:30 }));
app.use('/api',               rateLimit({ windowMs:60000, max:300 }));

// ── Security headers ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Cache menu GET
app.use('/api/menu', (req, res, next) => {
  if (req.method === 'GET') res.setHeader('Cache-Control', 'public, max-age=60');
  next();
});

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/menu',      menuRouter);
app.use('/api/orders',    orderRouter);
app.use('/api/payment',   paymentRouter);
app.use('/api/reviews',   reviewRouter);
app.use('/api/dashboard', dashRouter);
app.get('/api/health', (req, res) => res.json({
  success: true, message: 'Tuljai API v5 running',
  time: new Date(),
  features: ['JWT-Refresh-Tokens','Razorpay','Socket.IO','Nodemailer','PDF-Invoice'],
}));

// ── 404 + Error handler ───────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success:false, message:'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ success:false, message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🐉 ═══════════════════════════════════════════════');
  console.log(`🚀  Tuljai API v5  →  http://localhost:${PORT}`);
  console.log(`🔒  JWT Refresh Tokens + RBAC active`);
  console.log(`💳  Razorpay Payment Gateway integrated`);
  console.log(`⚡  Socket.IO real-time tracking active`);
  console.log(`📧  Nodemailer email notifications ready`);
  console.log(`🧾  PDF Invoice generation ready`);
  console.log('🐉 ═══════════════════════════════════════════════\n');
});

// ── Seed helpers ──────────────────────────────────────────────────────
async function seedAdmin() {
  const User = require('./models/User');
  if (!(await User.findOne({ role:'admin' }))) {
    await User.create({ name:'Admin', mobile:'9999999999', email:'admin@tuljai.com', password:'admin123', role:'admin' });
    console.log('✅ Admin seeded → 9999999999 / admin123');
  }
}

async function seedMenu() {
  const MI = require('./models/MenuItem');
  if ((await MI.countDocuments()) > 0) return;
  await MI.insertMany([
    {brand:'chinese',name:'Veg Hakka Noodles',category:'Noodles',price:80,description:'Stir-fried noodles with cabbage, carrots, capsicum and soy sauce',image:'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',type:'veg',popular:true,badge:"Chef's Pick",emoji:'🍜',available:true},
    {brand:'chinese',name:'Chicken Hakka Noodles',category:'Noodles',price:110,description:'Tender chicken strips wok-tossed with noodles in rich soy sauce',image:'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=80',type:'nv',popular:true,badge:'Bestseller',emoji:'🍜',available:true},
    {brand:'chinese',name:'Egg Noodles',category:'Noodles',price:90,description:'Scrambled egg folded into silky noodles with onions',image:'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=80',type:'egg',popular:false,badge:null,emoji:'🍜',available:true},
    {brand:'chinese',name:'Veg Fried Rice',category:'Rice',price:90,description:'Long-grain rice wok-tossed with garden vegetables',image:'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80',type:'veg',popular:true,badge:'Popular',emoji:'🍚',available:true},
    {brand:'chinese',name:'Chicken Fried Rice',category:'Rice',price:120,description:'Basmati rice with marinated chicken and scrambled egg',image:'https://images.unsplash.com/photo-1512058454905-6b841e7ad132?w=600&q=80',type:'nv',popular:true,badge:'Bestseller',emoji:'🍚',available:true},
    {brand:'chinese',name:'Veg Manchurian',category:'Starters',price:100,description:'Crispy veg balls in tangy sweet-spicy Manchurian sauce',image:'https://images.unsplash.com/photo-1625938145744-533a7a3c4938?w=600&q=80',type:'veg',popular:true,badge:'Must Try',emoji:'🥟',available:true},
    {brand:'chinese',name:'Chicken Manchurian',category:'Starters',price:140,description:'Juicy boneless chicken in fiery Manchurian gravy',image:'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80',type:'nv',popular:true,badge:'Bestseller',emoji:'🥟',available:true},
    {brand:'chinese',name:'Chicken 65',category:'Starters',price:150,description:'Crispy chicken marinated in yoghurt and red chillis',image:'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&q=80',type:'nv',popular:true,badge:'🔥 Hot',emoji:'🥟',available:true},
    {brand:'chinese',name:'Sweet Corn Soup',category:'Soups',price:70,description:'Creamy sweet corn in warm vegetable broth',image:'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80',type:'veg',popular:true,badge:'Comfort',emoji:'🍲',available:true},
    {brand:'chinese',name:'Hot & Sour Soup',category:'Soups',price:75,description:'Tangy spiced broth with tofu, mushrooms and chilli oil',image:'https://images.unsplash.com/photo-1604152135912-04a022e23696?w=600&q=80',type:'veg',popular:false,badge:'🌶 Spicy',emoji:'🍲',available:true},
    {brand:'icecream',name:'Mango Sundae',category:'Sundaes',price:120,description:'Fresh Alphonso mango with 2 vanilla scoops and mango sauce',image:'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80',type:'veg',popular:true,badge:'Must Try',emoji:'🍦',available:true},
    {brand:'icecream',name:'Chocolate Lava Sundae',category:'Sundaes',price:180,description:'Warm brownie topped with 3 scoops and hot fudge',image:'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80',type:'veg',popular:true,badge:'Special ⭐',emoji:'🍫',available:true},
    {brand:'icecream',name:'Vanilla Scoop',category:'Scoops',price:40,description:'Classic creamy vanilla ice cream',image:'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=600&q=80',type:'veg',popular:true,badge:null,emoji:'🍦',available:true},
    {brand:'icecream',name:'Chocolate Scoop',category:'Scoops',price:45,description:'Rich Belgian chocolate ice cream',image:'https://images.unsplash.com/photo-1580915411954-282cb1b0d780?w=600&q=80',type:'veg',popular:true,badge:'Bestseller',emoji:'🍫',available:true},
    {brand:'icecream',name:'Mango Scoop',category:'Scoops',price:50,description:'Fresh Alphonso mango ice cream',image:'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80',type:'veg',popular:true,badge:'🥭 Seasonal',emoji:'🥭',available:true},
    {brand:'icecream',name:'Strawberry Milkshake',category:'Shakes',price:95,description:'Thick creamy shake with fresh strawberries',image:'https://images.unsplash.com/photo-1572490122747-3e9be045b0c8?w=600&q=80',type:'veg',popular:true,badge:'Thick Shake',emoji:'🍓',available:true},
    {brand:'icecream',name:'Chocolate Shake',category:'Shakes',price:100,description:'Rich Belgian chocolate milkshake',image:'https://images.unsplash.com/photo-1572490122747-3e9be045b0c8?w=600&q=80',type:'veg',popular:true,badge:'Bestseller',emoji:'🍫',available:true},
    {brand:'icecream',name:'Waffle Cone Special',category:'Waffles',price:150,description:'Crispy waffle with 3 scoops sauce and nuts',image:'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&q=80',type:'veg',popular:true,badge:'Instagram Worthy 📸',emoji:'🧇',available:true},
  ]);
  console.log('✅ Menu seeded');
}
