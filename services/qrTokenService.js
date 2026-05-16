const TokenEncryption = require('../utils/tokenEncryption');
const redisClient = require('../config/redis');

class QRTokenService {
  constructor() {
    // Map لتخزين الفواصل الزمنية (Intervals) لكل مادة
    this.activeRotations = new Map();
  }

  /**
   * توليد توكن جديد وتخزينه في Redis
   */
  async generateToken(sessionId) {
    try {
      const timestamp = Date.now();
      // نستخدم sessionId كاسم موحد سواء كان معرف مادة أو معرف جلسة
      const tokenData = { sId: sessionId.toString(), t: timestamp };
      const encryptedToken = TokenEncryption.encrypt(tokenData);

      if (redisClient.isOpen) {
        // المفتاح في رديس يربط الجلسة بأحدث توكن صالح لها
        const redisKey = `active_qr_session_${sessionId}`;
        
        // EX: 10 ثوانٍ (صلاحية الكود في رديس أطول بـ 2 ثانية من وقت التحديث)
        await redisClient.set(redisKey, encryptedToken, {
          EX: 10 
        });

        console.log(`🆕 [REDIS_STORED] Session: ${sessionId} | Token: ${encryptedToken.substring(0, 10)}...`);
      } else {
        console.error("⚠️ Redis client is not open!");
      }

      return { token: encryptedToken, timestamp };
    } catch (err) {
      console.error("❌ [GENERATION_ERROR]:", err);
      throw err;
    }
  }

  /**
   * التحقق من التوكن القادم من الطالب
   */
  async validateToken(token) {
    try {
      // 1. فك التشفير لمعرفة الجلسة المقصودة
      const decodedData = TokenEncryption.decrypt(token);
      const sessionId = decodedData.sId;

      if (!sessionId) {
        return { valid: false, message: 'بيانات الرمز غير مكتملة.' };
      }

      console.log(`📥 [VALIDATING] Request for Session: ${sessionId}`);

      if (redisClient.isOpen) {
        const redisKey = `active_qr_session_${sessionId}`;
        const latestToken = await redisClient.get(redisKey);

        // إذا لم يجد توكن في رديس (انتهت الـ 10 ثوانٍ)
        if (!latestToken) {
          console.error(`🚫 [EXPIRED] Session ${sessionId} has no active token in Redis.`);
          return { valid: false, message: 'انتهى وقت الرمز، انتظر الكود الجديد على الشاشة.' };
        }

        // مقارنة التوكن المرسل بالتوكن الحالي في رديس
        if (latestToken !== token) {
          console.error(`❌ [MISMATCH] Student sent an outdated token for session ${sessionId}`);
          return { 
            valid: false, 
            message: 'هذا الرمز لم يعد صالحاً، امسح الكود الظاهر حالياً.' 
          };
        }
      }

      // 2. حماية من الـ Replay Attack (منع مسح نفس الكود مرتين)
      const tokenHash = TokenEncryption.hash(token);
      const replayKey = `used_qr:${tokenHash}`;
      const alreadyUsed = await redisClient.get(replayKey);
      
      if (alreadyUsed) {
        return { valid: false, message: 'تم استخدام هذا الرمز مسبقاً.' };
      }
      // تسجيل الكود كـ "مستخدم" لمدة 15 ثانية
      await redisClient.setEx(replayKey, 15, 'true');

      console.log(`✅ [SUCCESS] Token validated for session: ${sessionId}`);
      return { valid: true, courseId: sessionId };

    } catch (error) {
      console.error("🔥 [VALIDATION_ERROR]:", error.message);
      return { valid: false, message: 'رمز غير صالح أو تالف.' };
    }
  }

  /**
   * بدء تدوير الأكواد وإرسالها عبر السوكيت
   */
  startRotation(sessionId, io) {
    // إيقاف أي تدوير قديم لنفس الجلسة منعاً للتداخل
    this.stopRotation(sessionId);

    const rotate = async () => {
      try {
        const { token, timestamp } = await this.generateToken(sessionId);
        
        // إرسال التوكن لغرفة السوكيت الخاصة بالجلسة
        // تأكد أن الدكتور عمل socket.join(sessionId)
        io.to(sessionId.toString()).emit('qr_update', { token, timestamp });
        
        console.log(`📡 [SOCKET_EMIT] Token sent to room: ${sessionId}`);
      } catch (err) {
        console.error("🔥 [ROTATION_STEP_ERROR]:", err);
      }
    };

    // تنفيذ أول مرة فوراً
    rotate();

    // إعداد التكرار كل 8 ثوانٍ
    const interval = setInterval(rotate, 8000);
    this.activeRotations.set(sessionId.toString(), interval);
  }

  /**
   * إيقاف تدوير الأكواد
   */
  stopRotation(sessionId) {
    const sIdStr = sessionId.toString();
    const interval = this.activeRotations.get(sIdStr);
    if (interval) {
      clearInterval(interval);
      this.activeRotations.delete(sIdStr);
      console.log(`⏹️ [ROTATION_STOPPED] Session: ${sIdStr}`);
    }
  }
}

module.exports = new QRTokenService();