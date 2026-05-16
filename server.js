
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const os = require('os');
require('dotenv').config();

const routes = require('./routes');
const qrTokenService = require('./services/qrTokenService');
const pool = require('./config/database');

// --- [إعداد تطبيق Express] ---
const app = express();
const server = http.createServer(app);

// --- [إعداد Socket.IO] ---
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
    credentials: true
  }
});

// --- [Middlewares] ---
app.use(helmet({
  contentSecurityPolicy: false, 
}));

app.use(cors({
  origin: "*", 
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تمرير كائن io لكل الـ Routes
app.use((req, res, next) => {
  req.io = io;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// تحديد معدل الطلبات
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, 
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// --- [Routes] ---
app.use('/api', routes);

// --- [Socket.IO Authentication Middleware] ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.token;
  
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    // تأكد أنك تستخدم نفس المتغير الموجود في الـ Login
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    // اضف هذا السطر لتعرف لماذا يرفضه السيرفر
    console.log("❌ JWT Auth Error Detail:", error.message); 
    return next(new Error('Invalid authentication token'));
  }
});

// --- [Socket.IO Connection Handling] ---
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.user.email} | Socket ID: ${socket.id}`);

  /**
   * 1. بدء جلسة الحضور (Start Attendance)
   */
  socket.on('start_attendance', async (courseId) => {
    try {
      // حماية من القيم الفارغة
      if (!courseId) {
        console.error('❌ Error: courseId is undefined or null');
        return socket.emit('error', { message: 'معرف المادة غير صالح.' });
      }

      // تحويل صارم إلى نص صريح
      const roomId = String(courseId);
      
      console.log(`🎯 [ROOM_JOIN] Professor ${socket.user.email} joining EXACT room: "${roomId}"`);
      
      // إدخال المدرس في غرفة المادة
      socket.join(roomId);
      
      // تفعيل خدمة التدوير
      qrTokenService.startRotation(roomId, io);

      socket.emit('session_started', { 
        courseId: roomId,
        message: 'QR rotation active.' 
      });

    } catch (error) {
      console.error('🔥 Socket Error (start_attendance):', error);
      socket.emit('error', { message: 'Failed to start QR session.' });
    }
  });

  /**
   * 2. إيقاف الجلسة (Stop Attendance)
   */
  socket.on('stop_attendance', (courseId) => {
    try {
      if (!courseId) return;
      const roomId = String(courseId);
      qrTokenService.stopRotation(roomId);
      socket.leave(roomId);
      console.log(`⏹️ Session stopped for room: "${roomId}"`);
    } catch (error) {
      console.error('Stop session error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.user.email} | Socket ID: ${socket.id}`);
  });
});

// --- [Error Handling Middleware] ---
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// --- [Server Startup] ---
const PORT = process.env.PORT || 5000;

const networkInterfaces = os.networkInterfaces();
let localIp = 'localhost';
for (const name in networkInterfaces) {
  for (const iface of networkInterfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIp = iface.address;
    }
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║        🎓 Rased Attendance System - Secure Mode          ║
╠══════════════════════════════════════════════════════════╣
║ 🚀 Port: ${PORT}                                            ║
║ 🔗 Local: http://localhost:${PORT}/api                    ║
║ 📱 Network: http://${localIp}:${PORT}/api                   ║
║ 🛡️  Redis: Active & Monitoring                              ║
╚══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});

module.exports = { app, server, io };