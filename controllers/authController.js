const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const authController = {
    /**
     * تسجيل الدخول (Login)
     */
    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني وكلمة المرور مطلوبان.'
                });
            }

            const result = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'بيانات الدخول غير صحيحة.'
                });
            }

            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'بيانات الدخول غير صحيحة.'
                });
            }

            const accessToken = authMiddleware.generateToken(user);
            const refreshToken = authMiddleware.generateRefreshToken(user);

            const { password_hash, ...userData } = user;

            res.json({
                success: true,
                message: 'تم تسجيل الدخول بنجاح.',
                data: {
                    user: userData,
                    accessToken,
                    refreshToken
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تسجيل الدخول.'
            });
        }
    },

    /**
     * تسجيل مستخدم جديد (Register)
     */
    register: async (req, res) => {
        try {
            const { email, password, role, fullName, studentId } = req.body;

            // 1. التحقق من الحقول الأساسية
            if (!email || !password || !role || !fullName) {
                return res.status(400).json({
                    success: false,
                    message: 'جميع الحقول الأساسية مطلوبة.'
                });
            }

            // 2. التحقق من رقم الطالب فقط إذا كان الحساب لطالب
            if (role === 'student' && !studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'يجب إدخال الرقم الجامعي للطالب.'
                });
            }

            // 3. التحقق من تكرار البريد الإلكتروني
            const existingUser = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'هذا البريد الإلكتروني مسجل بالفعل.'
                });
            }

            // 4. تشفير كلمة المرور
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            /**
             * 5. معالجة الرقم الجامعي:
             * إذا لم يكن طالباً، نجبر القيمة أن تكون null تماماً.
             * الـ Frontend قد يرسل سلسلة فارغة "" وهي تسبب خطأ تكرار (Unique Constraint)
             */
            const finalStudentId = (role === 'student' && studentId) ? studentId : null;

            // 6. الإدخال في قاعدة البيانات
            const result = await pool.query(
                `INSERT INTO users (email, password_hash, role, full_name, student_id)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, email, role, full_name, student_id, created_at`,
                [email, passwordHash, role, fullName, finalStudentId]
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء الحساب بنجاح.',
                data: { user: result.rows[0] }
            });

        } catch (error) {
            console.error('Registration error:', error);
            
            // خطأ تكرار (البريد أو الرقم الجامعي)
            if (error.code === '23505') { 
                return res.status(409).json({
                    success: false,
                    message: 'البريد الإلكتروني أو الرقم الجامعي موجود مسبقاً.'
                });
            }

            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء عملية التسجيل.'
            });
        }
    },

    /**
     * ملف المستخدم الحالي
     */
    getProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            const result = await pool.query(
                'SELECT id, email, role, full_name, student_id, created_at FROM users WHERE id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود.'
                });
            }

            res.json({
                success: true,
                data: { user: result.rows[0] }
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب بيانات الملف الشخصي.'
            });
        }
    }
};

module.exports = authController;