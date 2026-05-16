const jwt = require('jsonwebtoken');
require('dotenv').config();

// مفاتيح احتياطية في حال فشل قراءة ملف .env
const DEFAULT_SECRET = 'rased_super_secret_key_2024_access';
const DEFAULT_REFRESH_SECRET = 'rased_super_secret_key_2024_refresh';

const authMiddleware = {
  /**
   * التحقق من التوكن وصلاحية الوصول
   */
  verifyToken: (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      // طباعة Header الطلب للتأكد من وصوله
      console.log(`🌐 [INCOMING_REQUEST] ${req.method} ${req.originalUrl}`);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("❌ [AUTH_FAILED] No Bearer token found in headers.");
        return res.status(401).json({ 
          success: false, 
          message: 'Access denied. No token provided.' 
        });
      }

      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
      
      const decoded = jwt.verify(token, secret);
      
      req.user = decoded;
      console.log(`✅ [AUTH_SUCCESS] User: ${decoded.email} | Role: ${decoded.role}`);
      next();
    } catch (error) {
      console.error(`🔥 [JWT_ERROR] ${error.message}`);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired. Please login again.' 
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
  },

  /**
   * التحقق من دور المستخدم (Admin, Professor, Student)
   */
  checkRole: (...allowedRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        console.error("❌ [ROLE_ERROR] No user object found in request.");
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required.' 
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        console.warn(`🚫 [ACCESS_DENIED] User ${req.user.email} (Role: ${req.user.role}) tried to access a restricted route. Allowed: [${allowedRoles}]`);
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Insufficient permissions.' 
        });
      }

      console.log(`🔓 [ACCESS_GRANTED] Role ${req.user.role} is authorized.`);
      next();
    };
  },

  /**
   * إنشاء توكن الوصول (Access Token)
   */
  generateToken: (user) => {
    const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        fullName: user.full_name
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  },

  /**
   * إنشاء توكن التحديث (Refresh Token)
   */
  generateRefreshToken: (user) => {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;
    return jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
  }
};

module.exports = authMiddleware;