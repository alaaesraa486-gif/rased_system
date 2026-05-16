const pool = require('../config/database');
const ExcelJS = require('exceljs');

const analyticsController = {
  /**
   * Get course analytics (Professor)
   */
  getCourseAnalytics: async (req, res) => {
    try {
      const { courseId } = req.params;
      const professorId = req.user.id;

      // Verify ownership
      const courseCheck = await pool.query(
        'SELECT * FROM courses WHERE id = $1 AND professor_id = $2',
        [courseId, professorId]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      // Get total sessions and students
      const statsResult = await pool.query(
        `SELECT 
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT e.student_id) as total_students,
          COUNT(DISTINCT ar.id) as total_attendance_records
         FROM courses c
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         LEFT JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id
         WHERE c.id = $1`,
        [courseId]
      );

      const stats = statsResult.rows[0];

      // Get attendance trend (last 10 sessions)
      // ✅ FIX: Added s.id to SELECT so the frontend can use session.id
      //    to fetch per-session attendance records.
      const trendResult = await pool.query(
        `SELECT s.id, s.session_name, s.session_date,
                COUNT(ar.id) as attendance_count
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar ON s.id = ar.session_id
         WHERE s.course_id = $1
         GROUP BY s.id, s.session_name, s.session_date
         ORDER BY s.session_date DESC
         LIMIT 10`,
        [courseId]
      );

      // Get at-risk students (< 25% attendance)
      const atRiskResult = await pool.query(
        `SELECT u.id, u.full_name, u.student_id,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions,
                ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         CROSS JOIN attendance_sessions s
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
         WHERE e.course_id = $1 AND s.course_id = $1
         GROUP BY u.id, u.full_name, u.student_id
         HAVING COUNT(DISTINCT s.id) > 0 
           AND (CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / COUNT(DISTINCT s.id)) < 0.25
         ORDER BY attendance_percentage ASC`,
        [courseId]
      );

      res.json({
        success: true,
        data: {
          course: courseCheck.rows[0],
          statistics: {
            total_sessions: parseInt(stats.total_sessions),
            total_students: parseInt(stats.total_students),
            total_attendance: parseInt(stats.total_attendance_records),
            average_attendance: parseInt(stats.total_sessions) > 0
              ? Math.round((parseInt(stats.total_attendance_records) / (parseInt(stats.total_sessions) * parseInt(stats.total_students))) * 100)
              : 0
          },
          attendance_trend: trendResult.rows.reverse(),
          at_risk_students: atRiskResult.rows
        }
      });

    } catch (error) {
      console.error('Get course analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching analytics.'
      });
    }
  },

  /**
   * Get student personal analytics
   */
  getStudentAnalytics: async (req, res) => {
    try {
      const studentId = req.user.id;

      // Get overall stats
      const statsResult = await pool.query(
        `SELECT 
          COUNT(DISTINCT e.course_id) as enrolled_courses,
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT ar.id) as attended_sessions
         FROM enrollments e
         LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
         WHERE e.student_id = $1`,
        [studentId]
      );

      const stats = statsResult.rows[0];

      // Get course-wise breakdown
      const coursesResult = await pool.query(
        `SELECT c.course_name, c.course_code,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions,
                ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
         WHERE e.student_id = $1
         GROUP BY c.id, c.course_name, c.course_code
         ORDER BY attendance_percentage DESC`,
        [studentId]
      );

      // Get recent attendance
      const recentResult = await pool.query(
        `SELECT c.course_name, s.session_name, s.session_date, ar.scanned_at
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE ar.student_id = $1
         ORDER BY ar.scanned_at DESC
         LIMIT 10`,
        [studentId]
      );

      res.json({
        success: true,
        data: {
          statistics: {
            enrolled_courses: parseInt(stats.enrolled_courses),
            total_sessions: parseInt(stats.total_sessions),
            attended_sessions: parseInt(stats.attended_sessions),
            overall_percentage: parseInt(stats.total_sessions) > 0
              ? Math.round((parseInt(stats.attended_sessions) / parseInt(stats.total_sessions)) * 100)
              : 0
          },
          courses: coursesResult.rows,
          recent_attendance: recentResult.rows
        }
      });

    } catch (error) {
      console.error('Get student analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while fetching analytics.'
      });
    }
  },

  /**
   * Export attendance report to Excel (Professor)
   */
  exportAttendance: async (req, res) => {
    try {
      const { courseId, sessionId } = req.query;
      const professorId = req.user.id;

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'Course ID is required.'
        });
      }

      // Verify ownership
      const courseCheck = await pool.query(
        'SELECT * FROM courses WHERE id = $1 AND professor_id = $2',
        [courseId, professorId]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      const course = courseCheck.rows[0];

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Attendance Report');

      if (sessionId) {
        // Session-based report
        const sessionResult = await pool.query(
          'SELECT * FROM attendance_sessions WHERE id = $1',
          [sessionId]
        );

        if (sessionResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Session not found.'
          });
        }

        const session = sessionResult.rows[0];

        const attendanceResult = await pool.query(
          `SELECT u.student_id, u.full_name, u.email,
                  ar.scanned_at, ar.is_manual_override
           FROM enrollments e
           JOIN users u ON e.student_id = u.id
           LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = $1
           WHERE e.course_id = $2
           ORDER BY u.full_name`,
          [sessionId, courseId]
        );

        worksheet.columns = [
          { header: 'Student ID', key: 'student_id', width: 15 },
          { header: 'Full Name', key: 'full_name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Scan Time', key: 'scanned_at', width: 20 },
          { header: 'Manual Override', key: 'is_manual_override', width: 15 }
        ];

        attendanceResult.rows.forEach(record => {
          worksheet.addRow({
            student_id: record.student_id,
            full_name: record.full_name,
            email: record.email,
            status: record.scanned_at ? 'Present' : 'Absent',
            scanned_at: record.scanned_at ? new Date(record.scanned_at).toLocaleString() : '-',
            is_manual_override: record.is_manual_override ? 'Yes' : 'No'
          });
        });

      } else {
        // Cumulative course report
        const studentsResult = await pool.query(
          `SELECT u.student_id, u.full_name,
                  COUNT(DISTINCT s.id) as total_sessions,
                  COUNT(DISTINCT ar.id) as attended_sessions,
                  ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as percentage
           FROM enrollments e
           JOIN users u ON e.student_id = u.id
           LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
           LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
           WHERE e.course_id = $1
           GROUP BY u.id, u.student_id, u.full_name
           ORDER BY u.full_name`,
          [courseId]
        );

        worksheet.columns = [
          { header: 'Student ID', key: 'student_id', width: 15 },
          { header: 'Full Name', key: 'full_name', width: 30 },
          { header: 'Total Sessions', key: 'total_sessions', width: 15 },
          { header: 'Attended', key: 'attended_sessions', width: 15 },
          { header: 'Percentage', key: 'percentage', width: 15 },
          { header: 'Status', key: 'status', width: 15 }
        ];

        studentsResult.rows.forEach(record => {
          const percentage = parseFloat(record.percentage) || 0;
          worksheet.addRow({
            student_id: record.student_id,
            full_name: record.full_name,
            total_sessions: record.total_sessions,
            attended_sessions: record.attended_sessions,
            percentage: `${percentage}%`,
            status: percentage < 25 ? 'At Risk' : percentage < 75 ? 'Warning' : 'Good'
          });
        });
      }

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' }
      };

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${course.course_code}_attendance.xlsx"`);
      res.send(buffer);

    } catch (error) {
      console.error('Export attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while exporting attendance.'
      });
    }
  }
};

module.exports = analyticsController;