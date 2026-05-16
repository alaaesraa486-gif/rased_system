const express = require('express');
const pool = require('../config/database'); 
const authController = require('../controllers/authController');
const coursesController = require('../controllers/coursesController');
const attendanceController = require('../controllers/attendanceController');
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth'); 

const router = express.Router();

// ============ AUTH ROUTES ============
router.post('/auth/login', authController.login);
router.post('/auth/register', auth.verifyToken, auth.checkRole('admin', 'professor'), authController.register);
router.get('/auth/profile', auth.verifyToken, authController.getProfile);

// ============ COURSES ROUTES ============
router.post('/courses', auth.verifyToken, auth.checkRole('professor'), coursesController.createCourse);
router.delete('/courses/:courseId', auth.verifyToken, auth.checkRole('professor'), coursesController.deleteCourse);

// المسار الجديد الذي سيستخدمه الطالب لعرض مواده في الـ Dashboard
router.get('/courses/my-courses', auth.verifyToken, auth.checkRole('student'), coursesController.getStudentCourses);

router.get('/courses', auth.verifyToken, (req, res) => {
  if (req.user.role === 'professor') {
    return coursesController.getProfessorCourses(req, res);
  } else if (req.user.role === 'student') {
    return coursesController.getStudentCourses(req, res);
  }
  return res.status(403).json({ success: false, message: 'Access denied.' });
});

router.get('/courses/:courseId', auth.verifyToken, coursesController.getCourseDetails);
router.post('/courses/:courseId/enroll', auth.verifyToken, auth.checkRole('professor'), coursesController.enrollStudents);
router.get('/courses/:courseId/students', auth.verifyToken, auth.checkRole('professor'), coursesController.getCourseStudents);

// ============ ATTENDANCE ROUTES ============
// ملاحظة: يمكنك الإبقاء على active-sessions أو حذفها، لكن الطالب الآن سيعتمد على my-courses
router.get('/attendance/active-sessions', auth.verifyToken, auth.checkRole('student'), attendanceController.getActiveSessions);

router.post('/attendance/sessions', auth.verifyToken, auth.checkRole('professor'), attendanceController.createSession);
router.patch('/attendance/sessions/:sessionId/end', auth.verifyToken, auth.checkRole('professor'), attendanceController.endSession);

// المسار الأهم: معالجة عملية المسح بناءً على المادة أو الجلسة
router.post('/attendance/scan', auth.verifyToken, auth.checkRole('student'), attendanceController.scanQR);

router.get('/attendance/sessions/:sessionId', auth.verifyToken, attendanceController.getSessionAttendance);
router.get('/attendance/student', auth.verifyToken, auth.checkRole('student'), attendanceController.getStudentAttendance);
router.post('/attendance/manual-override', auth.verifyToken, auth.checkRole('professor'), attendanceController.manualOverride);

// ============ ANALYTICS ROUTES ============
router.get('/analytics/course/:courseId', auth.verifyToken, auth.checkRole('professor'), analyticsController.getCourseAnalytics);
router.get('/analytics/student', auth.verifyToken, auth.checkRole('student'), analyticsController.getStudentAnalytics);
router.get('/analytics/export', auth.verifyToken, auth.checkRole('professor'), analyticsController.exportAttendance);

// ============ ADMIN ROUTES ============
const adminController = require('../controllers/adminController');

router.get('/admin/users', auth.verifyToken, auth.checkRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, full_name, student_id, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching users.' });
  }
});

// Student & course lists (support ?q= search)
router.get('/admin/students', auth.verifyToken, auth.checkRole('admin'), adminController.getAllStudents);
router.get('/admin/courses',  auth.verifyToken, auth.checkRole('admin'), adminController.getAllCourses);

// Single enroll (legacy — kept for backward compat)
router.post('/admin/enroll', auth.verifyToken, auth.checkRole('admin'), coursesController.enrollStudentInCourse);

// Bulk enroll: N students × M courses in one shot
router.post('/admin/enroll-bulk',   auth.verifyToken, auth.checkRole('admin'), adminController.enrollBulk);

// Excel import: parsed rows from the frontend
router.post('/admin/enroll-import', auth.verifyToken, auth.checkRole('admin'), adminController.enrollImport);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;