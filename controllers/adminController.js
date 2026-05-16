/**
 * adminController.js
 * ==================
 * Handles all admin-specific operations:
 *   GET  /api/admin/students          – list all students (with optional search)
 *   GET  /api/admin/courses           – list all courses  (with optional search)
 *   POST /api/admin/enroll-bulk       – enroll N students × M courses
 *   POST /api/admin/enroll-import     – bulk enroll from parsed Excel rows
 *
 * All mutating endpoints use a single DB transaction so partial failures
 * never leave orphaned rows.
 */

const pool = require('../config/database');

const adminController = {

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/students?q=<search>
  // Returns all students; optionally filtered by full_name or student_id.
  // ─────────────────────────────────────────────────────────────────────────────
  getAllStudents: async (req, res) => {
    try {
      const { q = '' } = req.query;
      const search = `%${q.trim().toLowerCase()}%`;

      const result = await pool.query(
        `SELECT id, full_name, student_id, email, created_at
           FROM users
          WHERE role = 'student'
            AND (
              $1 = '%%'
              OR LOWER(full_name)  LIKE $1
              OR LOWER(student_id) LIKE $1
              OR LOWER(email)      LIKE $1
            )
          ORDER BY full_name ASC
          LIMIT 500`,
        [search],
      );

      return res.json({
        success: true,
        data: { students: result.rows },
      });
    } catch (error) {
      console.error('[Admin] getAllStudents error:', error);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء جلب قائمة الطلاب.',
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/courses?q=<search>
  // Returns all courses; optionally filtered by name, code, or professor name.
  // ─────────────────────────────────────────────────────────────────────────────
  getAllCourses: async (req, res) => {
    try {
      const { q = '' } = req.query;
      const search = `%${q.trim().toLowerCase()}%`;

      const result = await pool.query(
        `SELECT c.id, c.course_code, c.course_name, c.semester,
                c.academic_year, c.created_at,
                u.full_name AS professor_name
           FROM courses c
           JOIN users u ON c.professor_id = u.id
          WHERE $1 = '%%'
             OR LOWER(c.course_name) LIKE $1
             OR LOWER(c.course_code) LIKE $1
             OR LOWER(u.full_name)   LIKE $1
          ORDER BY c.created_at DESC
          LIMIT 500`,
        [search],
      );

      return res.json({
        success: true,
        data: { courses: result.rows },
      });
    } catch (error) {
      console.error('[Admin] getAllCourses error:', error);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء جلب قائمة الكورسات.',
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/admin/enroll-bulk
  // Body: { studentIds: number[], courseIds: number[] }
  // Enrolls every student in every course (cartesian product).
  // Skips existing enrollments silently (ON CONFLICT DO NOTHING).
  // ─────────────────────────────────────────────────────────────────────────────
  enrollBulk: async (req, res) => {
    const { studentIds, courseIds } = req.body;

    // ── input validation ──────────────────────────────────────────────────────
    if (
      !Array.isArray(studentIds) || studentIds.length === 0 ||
      !Array.isArray(courseIds)  || courseIds.length  === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.',
      });
    }

    // Guard against absurd sizes (prevent accidental DOS)
    if (studentIds.length * courseIds.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'عدد التسجيلات المطلوبة كبير جداً. يُرجى تقسيمها على دفعات.',
      });
    }

    const client = await pool.connect();
    let enrolled   = 0;
    let duplicates = 0;
    let errors     = 0;

    try {
      await client.query('BEGIN');

      for (const studentId of studentIds) {
        for (const courseId of courseIds) {
          try {
            const result = await client.query(
              `INSERT INTO enrollments (course_id, student_id)
               VALUES ($1, $2)
               ON CONFLICT (course_id, student_id) DO NOTHING
               RETURNING id`,
              [courseId, studentId],
            );

            if (result.rows.length > 0) {
              enrolled++;
            } else {
              duplicates++;
            }
          } catch (rowErr) {
            console.error(`[Admin] enroll student=${studentId} course=${courseId}:`, rowErr.message);
            errors++;
          }
        }
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: `تمّ الربط: ${enrolled} تسجيل جديد، ${duplicates} مكرر، ${errors} خطأ.`,
        enrolled,
        duplicates,
        errors,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[Admin] enrollBulk transaction error:', txErr);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء عملية الربط الجماعي.',
      });
    } finally {
      client.release();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/admin/enroll-import
  // Body: { rows: Array<{ rowNum, studentId, studentName, courseCode, courseName }> }
  //
  // Algorithm:
  //   1. Pre-fetch all students and courses once into Maps (O(1) lookups).
  //   2. Iterate rows, resolve student & course by id/code.
  //   3. Bulk-insert valid pairs inside a single transaction.
  //   4. Return per-row status: enrolled | duplicate | error.
  // ─────────────────────────────────────────────────────────────────────────────
  enrollImport: async (req, res) => {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات للاستيراد.',
      });
    }

    if (rows.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'الحد الأقصى للاستيراد الواحد هو 5000 صف.',
      });
    }

    // ── 1. Pre-fetch lookup tables ────────────────────────────────────────────
    const [studentsRes, coursesRes] = await Promise.all([
      pool.query(
        `SELECT id, student_id, full_name FROM users WHERE role = 'student'`,
      ),
      pool.query(
        `SELECT id, course_code, course_name FROM courses`,
      ),
    ]);

    // Maps: normalised key → DB id
    const studentByUnivId = new Map(
      studentsRes.rows.map(s => [s.student_id?.trim().toLowerCase(), s.id]),
    );
    const studentByName = new Map(
      studentsRes.rows.map(s => [s.full_name?.trim().toLowerCase(), s.id]),
    );
    const courseByCode = new Map(
      coursesRes.rows.map(c => [c.course_code?.trim().toLowerCase(), c.id]),
    );
    const courseByName = new Map(
      coursesRes.rows.map(c => [c.course_name?.trim().toLowerCase(), c.id]),
    );

    // ── 2. Resolve each row ───────────────────────────────────────────────────
    const toInsert = []; // { courseId, studentId, rowNum, ... }
    const details  = [];

    for (const row of rows) {
      const { rowNum, studentId: rawSid, studentName, courseCode: rawCode, courseName } = row;

      // Resolve student
      const sid   = rawSid?.trim().toLowerCase();
      const sname = studentName?.trim().toLowerCase();
      const studentDbId = studentByUnivId.get(sid) ?? studentByName.get(sname);

      // Resolve course
      const code   = rawCode?.trim().toLowerCase();
      const cname  = courseName?.trim().toLowerCase();
      const courseDbId = courseByCode.get(code) ?? courseByName.get(cname);

      const detail = {
        rowNum,
        studentName: studentName || rawSid || '',
        studentId:   rawSid || '',
        courseCode:  rawCode || courseName || '',
        status: '',
        message: '',
      };

      if (!studentDbId && !courseDbId) {
        detail.status  = 'error';
        detail.message = 'الطالب والمادة غير موجودَيْن في النظام';
        details.push(detail);
        continue;
      }
      if (!studentDbId) {
        detail.status  = 'error';
        detail.message = `الطالب غير موجود: ${rawSid || studentName}`;
        details.push(detail);
        continue;
      }
      if (!courseDbId) {
        detail.status  = 'error';
        detail.message = `المادة غير موجودة: ${rawCode || courseName}`;
        details.push(detail);
        continue;
      }

      toInsert.push({ courseId: courseDbId, studentId: studentDbId, rowNum, detail });
    }

    // ── 3. Bulk insert inside a transaction ───────────────────────────────────
    const client = await pool.connect();
    let enrolled   = 0;
    let duplicates = 0;
    let errors     = 0;

    try {
      await client.query('BEGIN');

      for (const { courseId, studentId, detail } of toInsert) {
        try {
          const result = await client.query(
            `INSERT INTO enrollments (course_id, student_id)
             VALUES ($1, $2)
             ON CONFLICT (course_id, student_id) DO NOTHING
             RETURNING id`,
            [courseId, studentId],
          );

          if (result.rows.length > 0) {
            enrolled++;
            detail.status  = 'enrolled';
            detail.message = 'تم التسجيل';
          } else {
            duplicates++;
            detail.status  = 'duplicate';
            detail.message = 'مسجّل مسبقاً';
          }
        } catch (rowErr) {
          errors++;
          detail.status  = 'error';
          detail.message = rowErr.message;
          console.error(`[Admin] import row ${detail.rowNum}:`, rowErr.message);
        }
        details.push(detail);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: `الاستيراد اكتمل: ${enrolled} جديد، ${duplicates} مكرر، ${errors} خطأ.`,
        total:      rows.length,
        enrolled,
        duplicates,
        errors,
        details,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.error('[Admin] enrollImport transaction error:', txErr);
      return res.status(500).json({
        success: false,
        message: 'فشل الاستيراد بسبب خطأ في قاعدة البيانات.',
      });
    } finally {
      client.release();
    }
  },
};

module.exports = adminController;