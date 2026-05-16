const crypto = require('crypto');
require('dotenv').config();

// ملاحظة: تم تبسيط الكود ليعمل بدون تشفير حقيقي لتسهيل عملية الـ Scan
class TokenEncryption {
  /**
   * تمرير البيانات كـ Base64 بدلاً من التشفير
   * @param {Object} data - بيانات التوكن
   * @returns {string} - نص سهل القراءة/فك الترميز
   */
  static encrypt(data) {
    try {
      // تحويل الكائن إلى نص JSON ثم إلى Base64 لسهولة النقل
      const jsonData = JSON.stringify(data);
      const simpleToken = Buffer.from(jsonData).toString('base64');
      
      // نضع تنسيقاً وهمياً (iv:tag:data) لكي لا نضطر لتغيير كود الـ QR بالكامل
      // سنضع قيم ثابتة مكان الـ IV والـ Tag
      return `dummy_iv:dummy_tag:${simpleToken}`;
    } catch (error) {
      console.error('Simulated Encryption error:', error);
      throw new Error('Token processing failed');
    }
  }

  /**
   * فك ترميز البيانات (بدون مفاتيح تشفير)
   * @param {string} encryptedToken - التوكن القادم من السكنر
   * @returns {Object} - البيانات الأصلية
   */
  static decrypt(encryptedToken) {
    try {
      const parts = encryptedToken.split(':');
      
      // إذا كان الكود قادم بالتنسيق الجديد (3 أجزاء)
      if (parts.length === 3) {
        const base64Data = parts[2];
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf8');
        return JSON.parse(jsonData);
      } 
      
      // إذا كان الكود قادم كـ JSON مباشر أو Base64 فقط (للاحتياط)
      const rawData = Buffer.from(encryptedToken, 'base64').toString('utf8');
      return JSON.parse(rawData);

    } catch (error) {
      console.error('Decoding error:', error);
      // إذا فشل كل شيء، نحاول إرجاع النص كما هو إذا كان JSON
      try {
          return JSON.parse(encryptedToken);
      } catch(e) {
          throw new Error('Token decoding failed - Invalid Format');
      }
    }
  }

  /**
   * توليد Hash للمفتاح في Redis (يبقى كما هو لأنه لا يسبب مشاكل)
   */
  static hash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * توليد Salt عشوائي
   */
  static generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = TokenEncryption;