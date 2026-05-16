const pool = require('../config/database');

const coursesController = {
  /**
   * ==========================================
   * وظائف الأدمن (Admin Functions) - الإضافة الجديدة
   * ==========================================
   */

  /**
   * جلب كافة الطلاب المسجلين في النظام (للأدمن)
   */
  getAllStudents: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, full_name, student_id, email, created_at 
         FROM users 
         WHERE role = 'student' 
         ORDER BY full_name ASC`
      );
      res.json({
        success: true,
        data: { students: result.rows }
      });
    } catch (error) {
      console.error('Admin Get Students Error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء جلب قائمة الطلاب.'
      });
    }
  },

  /**
   * جلب كافة الكورسات الموجودة في النظام (للأدمن)
   */
  getAllCourses: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT c.*, u.full_name as professor_name 
         FROM courses c 
         JOIN users u ON c.professor_id = u.id 
         ORDER BY c.created_at DESC`
      );
      res.json({
        success: true,
        data: { courses: result.rows }
      });
    } catch (error) {
      console.error('Admin Get Courses Error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء جلب قائمة الكورسات.'
      });
    }
  },

  /**
   * ربط طالب بكورس معين (للأدمن)
   */
  enrollStudentInCourse: async (req, res) => {
    try {
      const { studentId, courseId } = req.body;

      if (!studentId || !courseId) {
        return res.status(400).json({
          success: false,
          message: 'يجب اختيار الطالب والكورس.'
        });
      }

      const result = await pool.query(
        `INSERT INTO enrollments (course_id, student_id)
         VALUES ($1, $2)
         ON CONFLICT (course_id, student_id) DO NOTHING
         RETURNING *`,
        [courseId, studentId]
      );

      if (result.rows.length === 0) {
        return res.status(409).json({
          success: false,
          message: 'هذا الطالب مسجل بالفعل في هذا الكورس.'
        });
      }

      res.status(201).json({
        success: true,
        message: 'تم ربط الطالب بالكورس بنجاح.',
        data: { enrollment: result.rows[0] }
      });
    } catch (error) {
      console.error('Admin Enrollment Error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء عملية الربط.'
      });
    }
  },

  /**
   * ==========================================
   * وظائف الدكتور (Professor Functions)
   * ==========================================
   */

  /**
   * Create a new course (Professor)
   */
  createCourse: async (req, res) => {
    try {
      const { courseCode, courseName, semester, academicYear } = req.body;
      const professorId = req.user.id;

      if (!courseCode || !courseName || !semester || !academicYear) {
        return res.status(400).json({
          success: false,
          message: 'All course fields are required.'
        });
      }

      const result = await pool.query(
        `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [courseCode, courseName, professorId, semester, academicYear]
      );

      res.status(201).json({
        success: true,
        message: 'Course created successfully.',
        data: { course: result.rows[0] }
      });

    } catch (error) {
      console.error('Create course error:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Course code already exists.'
        });
      }

      res.status(500).json({
        success: false,
        message: 'An error occurred while creating the course.'
      });
    }
  },

  /**
   * Get all courses for a professor
   */
  getProfessorCourses: async (req, res) => {
    try {
      const professorId = req.user.id;

      const result = await pool.query(
        `SELECT c.*, 
                COUNT(DISTINCT e.student_id) as student_count,
                COUNT(DISTINCT s.id) as session_count
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         WHERE c.professor_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [professorId]
      );

      res.json({
        success: true,
        data: { courses: result.rows }
      });

    } catch (error) {
      console.error('Get professor courses error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching courses.'
      });
    }
  },

  /**
   * Enroll students in a course (Professor - Bulk)
   */
  enrollStudents: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { studentIds } = req.body;
      const professorId = req.user.id;

      // Verify course ownership
      const courseCheck = await pool.query(
        'SELECT id FROM courses WHERE id = $1 AND professor_id = $2',
        [courseId, professorId]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      const enrollments = [];
      for (const studentId of studentIds) {
        try {
          const result = await pool.query(
            `INSERT INTO enrollments (course_id, student_id)
             VALUES ($1, $2)
             ON CONFLICT (course_id, student_id) DO NOTHING
             RETURNING *`,
            [courseId, studentId]
          );
          
          if (result.rows.length > 0) {
            enrollments.push(result.rows[0]);
          }
        } catch (error) {
          console.error(`Failed to enroll student ${studentId}:`, error);
        }
      }

      res.json({
        success: true,
        message: `${enrollments.length} student(s) enrolled successfully.`,
        data: { enrollments }
      });

    } catch (error) {
      console.error('Enroll students error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while enrolling students.'
      });
    }
  },

  /**
   * Get enrolled students for a course with attendance stats (Professor)
   */
  getCourseStudents: async (req, res) => {
    try {
      const { courseId } = req.params;
      const professorId = req.user.id;

      // Verify ownership
      const courseCheck = await pool.query(
        'SELECT id FROM courses WHERE id = $1 AND professor_id = $2',
        [courseId, professorId]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      const result = await pool.query(
        `SELECT u.id, u.full_name, u.student_id, u.email,
                e.enrolled_at,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
         WHERE e.course_id = $1
         GROUP BY u.id, e.enrolled_at
         ORDER BY u.full_name`,
        [courseId]
      );

      const studentsWithAttendance = result.rows.map(student => ({
        ...student,
        attendance_percentage: student.total_sessions > 0
          ? Math.round((student.attended_sessions / student.total_sessions) * 100)
          : 0,
        is_at_risk: student.total_sessions > 0 && 
                    (student.attended_sessions / student.total_sessions) < 0.25
      }));

      res.json({
        success: true,
        data: { students: studentsWithAttendance }
      });

    } catch (error) {
      console.error('Get course students error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching students.'
      });
    }
  },

  /**
   * ==========================================
   * وظائف الطالب (Student Functions)
   * ==========================================
   */

  /**
   * Get all courses for a student
   */
  getStudentCourses: async (req, res) => {
      try {
        const studentId = req.user.id;

        // الاستعلام لجلب المواد مع إحصائيات الحضور
        const result = await pool.query(
          `SELECT c.id, c.course_name, c.course_code, u.full_name as professor_name,
                  COUNT(DISTINCT s.id) as total_sessions,
                  COUNT(DISTINCT ar.id) as attended_sessions
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          JOIN users u ON c.professor_id = u.id
          LEFT JOIN attendance_sessions s ON c.id = s.course_id
          LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
          WHERE e.student_id = $1
          GROUP BY c.id, u.full_name, e.enrolled_at
          ORDER BY e.enrolled_at DESC`,
          [studentId]
        );

        const coursesWithPercentage = result.rows.map(course => ({
          ...course,
          attendance_percentage: course.total_sessions > 0 
            ? Math.round((course.attended_sessions / course.total_sessions) * 100)
            : 0
        }));

        // التعديل هنا: إرسال الـ courses مباشرة داخل الـ JSON 
        // ليتناسب مع كود الـ Frontend: response.data.courses
        res.json({
          success: true,
          courses: coursesWithPercentage 
        });

      } catch (error) {
        console.error('🔥 [GET_COURSES_ERROR]:', error);
        res.status(500).json({
          success: false,
          message: 'حدث خطأ أثناء جلب قائمة المواد الخاصة بك.'
        });
      }
    },

  /**
   * ==========================================
   * وظائف عامة (Shared Functions)
   * ==========================================
   */
/**
   * Delete a course (Professor)
   */
  deleteCourse: async (req, res) => {
    try {
      const { courseId } = req.params;
      const professorId = req.user.id;

      // التأكد من أن الدكتور هو مالك المادة قبل الحذف
      const result = await pool.query(
        'DELETE FROM courses WHERE id = $1 AND professor_id = $2 RETURNING *',
        [courseId, professorId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'المادة غير موجودة أو ليس لديك صلاحية لحذفها.'
        });
      }

      res.json({
        success: true,
        message: 'تم حذف المادة وجميع البيانات المرتبطة بها بنجاح.'
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء محاولة الحذف.'
      });
    }
  },
  /**
   * Get single course details
   */
  getCourseDetails: async (req, res) => {
    try {
      const { courseId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const courseResult = await pool.query(
        `SELECT c.*, u.full_name as professor_name
         FROM courses c
         JOIN users u ON c.professor_id = u.id
         WHERE c.id = $1`,
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Course not found.'
        });
      }

      const course = courseResult.rows[0];

      if (userRole === 'professor' && course.professor_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      if (userRole === 'student') {
        const enrollmentCheck = await pool.query(
          'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
          [courseId, userId]
        );

        if (enrollmentCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'You are not enrolled in this course.'
          });
        }
      }

      const studentsResult = await pool.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1',
        [courseId]
      );

      course.enrolled_students = parseInt(studentsResult.rows[0].count);

      res.json({
        success: true,
        data: { course }
      });

    } catch (error) {
      console.error('Get course details error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching course details.'
      });
    }
  }
};

module.exports = coursesController;