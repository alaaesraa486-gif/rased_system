/**
 * EnrollmentManager.jsx
 * =====================
 * Admin panel for linking students to courses.
 *
 * Features:
 *  - Live search for students (name or university ID)
 *  - Live search for courses (name or code)
 *  - Multi-select students & courses
 *  - Bulk enroll (N students × M courses in one request)
 *  - Excel import with client-side parse → server validation → bulk insert
 *  - Detailed import results (success / duplicate / error rows)
 *  - Skeleton loading, toast-style inline feedback, responsive layout
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Search, X, CheckSquare, Square, Users, BookOpen,
  Upload, Download, AlertCircle, CheckCircle, Loader,
  ChevronDown, ChevronUp, FileSpreadsheet, UserPlus,
  RefreshCw, Filter, Info, Trash2, Link,
} from 'lucide-react';

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const cls = (...args) => args.filter(Boolean).join(' ');

const Skeleton = ({ className }) => (
  <div
    className={cls(
      'animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800',
      className,
    )}
  />
);

const Badge = ({ children, color = 'blue' }) => {
  const map = {
    blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    green:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    slate:  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };
  return (
    <span className={cls('text-[10px] font-black px-2 py-0.5 rounded-full', map[color])}>
      {children}
    </span>
  );
};

// ─── Section header used in each panel ────────────────────────────────────────
const PanelHeader = ({ icon: Icon, title, count, color = 'blue' }) => {
  const iconBg = {
    blue:   'bg-blue-700',
    amber:  'bg-amber-500',
    emerald:'bg-emerald-500',
  };
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cls('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg[color])}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-black text-slate-900 dark:text-white text-sm leading-none">{title}</h3>
      </div>
      {count !== undefined && (
        <Badge color="slate">{count}</Badge>
      )}
    </div>
  );
};

// ─── Search input ──────────────────────────────────────────────────────────────
const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative mb-3">
    <Search
      size={13}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
    />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pr-8 pl-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-blue-300 dark:ring-blue-700 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

// ─── Selectable row ────────────────────────────────────────────────────────────
const SelectableRow = ({ selected, onToggle, primary, secondary, tag }) => (
  <button
    onClick={onToggle}
    className={cls(
      'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right border',
      selected
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
    )}
  >
    <div className={cls(
      'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
      selected ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600',
    )}>
      {selected ? <CheckSquare size={12} /> : <Square size={12} />}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cls('text-xs font-black truncate', selected ? 'text-blue-900 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200')}>
        {primary}
      </p>
      {secondary && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 truncate">{secondary}</p>
      )}
    </div>
    {tag && <Badge color={selected ? 'blue' : 'slate'}>{tag}</Badge>}
  </button>
);

// ─── Inline alert banner ───────────────────────────────────────────────────────
const Alert = ({ type, children, onDismiss }) => {
  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300',
    error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300',
    info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300',
  };
  const Icon = type === 'success' ? CheckCircle : AlertCircle;
  return (
    <div className={cls('flex items-start gap-3 p-4 rounded-2xl border text-sm font-medium animate-in slide-in-from-top-2 duration-300', styles[type])}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ─── Import result row ─────────────────────────────────────────────────────────
const ImportResultRow = ({ row }) => {
  const statusStyle = {
    enrolled:  'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    duplicate: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    error:     'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  };
  const statusLabel = { enrolled: 'مسجّل ✓', duplicate: 'مكرر', error: 'خطأ' };
  return (
    <tr className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono">{row.rowNum}</td>
      <td className="px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200">{row.studentName || '—'}</td>
      <td className="px-3 py-2 text-xs font-mono text-slate-500 dark:text-slate-400">{row.studentId || '—'}</td>
      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{row.courseCode || '—'}</td>
      <td className="px-3 py-2">
        <span className={cls('text-[10px] font-black px-2 py-0.5 rounded-full', statusStyle[row.status] || statusStyle.error)}>
          {statusLabel[row.status] || 'خطأ'}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 max-w-[160px] truncate">{row.message || ''}</td>
    </tr>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const EnrollmentManager = () => {
  // ── data ────────────────────────────────────────────────────────────────────
  const [students, setStudents]             = useState([]);
  const [courses, setCourses]               = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCourses, setLoadingCourses]   = useState(true);

  // ── selection ────────────────────────────────────────────────────────────────
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [selectedCourses, setSelectedCourses]   = useState(new Set());

  // ── search ───────────────────────────────────────────────────────────────────
  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch]   = useState('');

  // ── pagination ───────────────────────────────────────────────────────────────
  const [studentPage, setStudentPage] = useState(1);
  const [coursePage, setCoursePage]   = useState(1);
  const PAGE_SIZE = 8;

  // ── manual enroll ────────────────────────────────────────────────────────────
  const [enrolling, setEnrolling]   = useState(false);
  const [enrollResult, setEnrollResult] = useState(null); // { success, enrolled, duplicates, errors }

  // ── excel import ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState('manual'); // 'manual' | 'excel'
  const [importFile, setImportFile]       = useState(null);
  const [importParsed, setImportParsed]   = useState(null);   // parsed rows before sending
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult]   = useState(null);   // server response
  const [importError, setImportError]     = useState(null);
  const [showImportDetails, setShowImportDetails] = useState(false);
  const fileInputRef = useRef(null);

  // ── fetch ────────────────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const res = await axios.get('/admin/students');
      setStudents(res.data?.data?.students ?? []);
    } catch (err) {
      console.error('fetchStudents:', err);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await axios.get('/admin/courses');
      setCourses(res.data?.data?.courses ?? []);
    } catch (err) {
      console.error('fetchCourses:', err);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, [fetchStudents, fetchCourses]);

  // ── filtered + paginated lists ───────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c =>
      c.course_name?.toLowerCase().includes(q) ||
      c.course_code?.toLowerCase().includes(q) ||
      c.professor_name?.toLowerCase().includes(q),
    );
  }, [courses, courseSearch]);

  // reset page when search changes
  useEffect(() => { setStudentPage(1); }, [studentSearch]);
  useEffect(() => { setCoursePage(1);  }, [courseSearch]);

  const studentPages  = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const coursePages   = Math.max(1, Math.ceil(filteredCourses.length  / PAGE_SIZE));
  const pagedStudents = filteredStudents.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE);
  const pagedCourses  = filteredCourses.slice((coursePage  - 1) * PAGE_SIZE, coursePage  * PAGE_SIZE);

  // ── selection helpers ────────────────────────────────────────────────────────
  const toggleStudent = id => setSelectedStudents(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleCourse = id => setSelectedCourses(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAllStudents = () => {
    if (pagedStudents.every(s => selectedStudents.has(s.id))) {
      setSelectedStudents(prev => {
        const next = new Set(prev);
        pagedStudents.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedStudents(prev => {
        const next = new Set(prev);
        pagedStudents.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const toggleAllCourses = () => {
    if (pagedCourses.every(c => selectedCourses.has(c.id))) {
      setSelectedCourses(prev => {
        const next = new Set(prev);
        pagedCourses.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedCourses(prev => {
        const next = new Set(prev);
        pagedCourses.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const clearAll = () => {
    setSelectedStudents(new Set());
    setSelectedCourses(new Set());
    setEnrollResult(null);
  };

  // ── manual bulk enroll ───────────────────────────────────────────────────────
  const handleBulkEnroll = async () => {
    if (selectedStudents.size === 0 || selectedCourses.size === 0) return;
    setEnrolling(true);
    setEnrollResult(null);
    try {
      const res = await axios.post('/admin/enroll-bulk', {
        studentIds: Array.from(selectedStudents),
        courseIds:  Array.from(selectedCourses),
      });
      setEnrollResult(res.data);
      // clear selection on full success
      if (res.data.errors === 0) clearAll();
    } catch (err) {
      setEnrollResult({
        success: false,
        message: err.response?.data?.message || 'حدث خطأ أثناء عملية الربط.',
      });
    } finally {
      setEnrolling(false);
    }
  };

  // ── excel import ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportError(null);
    setImportParsed(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array' });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) {
        setImportError('الملف فارغ أو لا يحتوي على بيانات.');
        return;
      }

      // normalise column names (case-insensitive)
      const norm = rows.map((row, idx) => {
        const keys = Object.keys(row);
        const get  = (...candidates) => {
          const k = keys.find(k => candidates.some(c => k.trim().toLowerCase() === c));
          return k ? String(row[k]).trim() : '';
        };
        return {
          rowNum:      idx + 2,                     // Excel row number (1-indexed + header)
          studentName: get('student name', 'الاسم', 'name', 'full_name', 'full name', 'اسم الطالب'),
          studentId:   get('student id', 'university id', 'الرقم الجامعي', 'student_id', 'id', 'رقم'),
          courseCode:  get('course code', 'كود المادة', 'course_code', 'code', 'material code', 'كود'),
          courseName:  get('course name', 'اسم المادة', 'course_name', 'course', 'material'),
        };
      });

      // basic client-side validation
      const valid   = norm.filter(r => r.studentId && (r.courseCode || r.courseName));
      const invalid = norm.filter(r => !r.studentId || (!r.courseCode && !r.courseName));

      setImportParsed({ total: rows.length, valid: valid.length, invalid: invalid.length, rows: norm });

      if (valid.length === 0) {
        setImportError('لم يتم العثور على صفوف صالحة. تأكد من وجود أعمدة: student_id، course_code.');
      }
    } catch (err) {
      console.error('Excel parse error:', err);
      setImportError('فشل في قراءة الملف. تأكد من أنه ملف Excel صحيح (.xlsx / .xls).');
    }
    // reset so the same file can be re-selected
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importParsed || importParsed.valid === 0) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError(null);
    try {
      const res = await axios.post('/admin/enroll-import', {
        rows: importParsed.rows,
      });
      setImportResult(res.data);
      setShowImportDetails(false);
      if (res.data.success) {
        fetchStudents(); // refresh lists in case new data
        fetchCourses();
      }
    } catch (err) {
      setImportError(err.response?.data?.message || 'حدث خطأ أثناء الاستيراد.');
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportParsed(null);
    setImportResult(null);
    setImportError(null);
    setShowImportDetails(false);
  };

  // ── download template ────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['student_id', 'student_name', 'course_code', 'course_name'],
      ['ST-001', 'أحمد محمد علي', 'CS101', 'مقدمة في علم الحاسب'],
      ['ST-002', 'منى حسن عبد الله', 'MATH201', 'رياضيات متقدمة'],
    ]);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Enrollments');
    XLSX.writeFile(wb, 'enrollment_template.xlsx');
  };

  // ── pagination control ───────────────────────────────────────────────────────
  const Pagination = ({ page, setPage, totalPages }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-3 px-1">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="text-[10px] font-black text-slate-400 dark:text-slate-500 disabled:opacity-30 hover:text-slate-700 dark:hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ← السابق
        </button>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="text-[10px] font-black text-slate-400 dark:text-slate-500 disabled:opacity-30 hover:text-slate-700 dark:hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          التالي →
        </button>
      </div>
    );
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Tab switcher ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-2xl p-1.5 w-fit shadow-sm border border-slate-200/60 dark:border-slate-700/60">
        {[
          { key: 'manual', label: 'ربط يدوي', icon: UserPlus },
          { key: 'excel',  label: 'استيراد Excel', icon: FileSpreadsheet },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cls(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm transition-all',
              activeTab === t.key
                ? 'bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: MANUAL ENROLL
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* Enroll result alert */}
          {enrollResult && (
            <Alert
              type={enrollResult.success ? 'success' : 'error'}
              onDismiss={() => setEnrollResult(null)}
            >
              {enrollResult.success ? (
                <div className="space-y-1">
                  <p className="font-black">
                    تم التسجيل بنجاح — {enrollResult.enrolled} تسجيل جديد
                    {enrollResult.duplicates > 0 && ` · ${enrollResult.duplicates} مكرر تم تخطيه`}
                  </p>
                  {enrollResult.errors > 0 && (
                    <p className="text-xs opacity-80">{enrollResult.errors} صف به خطأ</p>
                  )}
                </div>
              ) : (
                <p className="font-black">{enrollResult.message}</p>
              )}
            </Alert>
          )}

          {/* 3-column grid: students | action | courses */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">

            {/* ── Students panel ──────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm p-5">
              <PanelHeader
                icon={Users}
                title="الطلاب"
                count={`${selectedStudents.size} / ${filteredStudents.length}`}
                color="blue"
              />

              <SearchInput
                value={studentSearch}
                onChange={setStudentSearch}
                placeholder="بحث بالاسم أو الرقم الجامعي..."
              />

              {/* Select all on page */}
              {pagedStudents.length > 0 && (
                <button
                  onClick={toggleAllStudents}
                  className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors mb-2 px-1"
                >
                  <CheckSquare size={11} />
                  {pagedStudents.every(s => selectedStudents.has(s.id)) ? 'إلغاء تحديد الصفحة' : 'تحديد الصفحة كلها'}
                </button>
              )}

              {/* List */}
              <div className="space-y-1.5 min-h-[280px]">
                {loadingStudents ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : pagedStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Users size={24} className="text-slate-200 dark:text-slate-700 mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {studentSearch ? 'لا توجد نتائج' : 'لا يوجد طلاب'}
                    </p>
                  </div>
                ) : pagedStudents.map(s => (
                  <SelectableRow
                    key={s.id}
                    selected={selectedStudents.has(s.id)}
                    onToggle={() => toggleStudent(s.id)}
                    primary={s.full_name}
                    secondary={s.email}
                    tag={s.student_id}
                  />
                ))}
              </div>

              <Pagination page={studentPage} setPage={setStudentPage} totalPages={studentPages} />
            </div>

            {/* ── Middle action column ─────────────────────────────────────── */}
            <div className="flex flex-col items-center justify-center gap-4 py-4 lg:pt-20">
              {/* Link button */}
              <button
                onClick={handleBulkEnroll}
                disabled={enrolling || selectedStudents.size === 0 || selectedCourses.size === 0}
                className={cls(
                  'group flex flex-col items-center gap-2 px-5 py-4 rounded-2xl font-black text-sm transition-all shadow-lg',
                  selectedStudents.size > 0 && selectedCourses.size > 0
                    ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-200/60 dark:shadow-blue-900/50 active:scale-95'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none',
                )}
              >
                {enrolling
                  ? <Loader size={20} className="animate-spin" />
                  : <Link size={20} className="group-hover:scale-110 transition-transform" />
                }
                <span className="text-[10px] whitespace-nowrap">
                  {enrolling ? 'جارٍ الربط...' : 'ربط الآن'}
                </span>
              </button>

              {/* Selection summary */}
              {(selectedStudents.size > 0 || selectedCourses.size > 0) && (
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    {selectedStudents.size} طالب × {selectedCourses.size} مادة
                    {selectedStudents.size > 0 && selectedCourses.size > 0 && (
                      <span className="text-blue-600 dark:text-blue-400 block mt-0.5">
                        = {selectedStudents.size * selectedCourses.size} تسجيل
                      </span>
                    )}
                  </p>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 font-bold transition-colors mx-auto"
                  >
                    <Trash2 size={10} /> مسح التحديد
                  </button>
                </div>
              )}

              {selectedStudents.size === 0 && selectedCourses.size === 0 && (
                <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center max-w-[80px] font-medium leading-relaxed">
                  اختر طلاباً ومواداً للربط
                </p>
              )}
            </div>

            {/* ── Courses panel ────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm p-5">
              <PanelHeader
                icon={BookOpen}
                title="المواد الدراسية"
                count={`${selectedCourses.size} / ${filteredCourses.length}`}
                color="amber"
              />

              <SearchInput
                value={courseSearch}
                onChange={setCourseSearch}
                placeholder="بحث باسم المادة أو الكود..."
              />

              {pagedCourses.length > 0 && (
                <button
                  onClick={toggleAllCourses}
                  className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mb-2 px-1"
                >
                  <CheckSquare size={11} />
                  {pagedCourses.every(c => selectedCourses.has(c.id)) ? 'إلغاء تحديد الصفحة' : 'تحديد الصفحة كلها'}
                </button>
              )}

              <div className="space-y-1.5 min-h-[280px]">
                {loadingCourses ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                ) : pagedCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <BookOpen size={24} className="text-slate-200 dark:text-slate-700 mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      {courseSearch ? 'لا توجد نتائج' : 'لا توجد مواد'}
                    </p>
                  </div>
                ) : pagedCourses.map(c => (
                  <SelectableRow
                    key={c.id}
                    selected={selectedCourses.has(c.id)}
                    onToggle={() => toggleCourse(c.id)}
                    primary={c.course_name}
                    secondary={c.professor_name}
                    tag={c.course_code}
                  />
                ))}
              </div>

              <Pagination page={coursePage} setPage={setCoursePage} totalPages={coursePages} />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EXCEL IMPORT
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'excel' && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* ── Step 1: Template download ──────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Download size={18} className="text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm mb-1">الخطوة 1: تحميل النموذج</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm">
                    حمّل ملف Excel النموذجي وأدخل بيانات الطلاب والمواد. الأعمدة المطلوبة:
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded mx-1">student_id</span>
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded mx-1">course_code</span>
                  </p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-4 py-2.5 rounded-xl font-black text-xs transition-colors"
              >
                <Download size={14} />
                تحميل النموذج
              </button>
            </div>
          </div>

          {/* ── Step 2: Upload ─────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Upload size={18} className="text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">الخطوة 2: رفع الملف</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">يدعم .xlsx و .xls</p>
              </div>
            </div>

            {/* Drop zone */}
            <label className={cls(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
              importFile
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
            )}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <FileSpreadsheet size={28} className={importFile ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
              </div>
              {importFile ? (
                <div className="text-center">
                  <p className="font-black text-blue-800 dark:text-blue-300 text-sm">{importFile.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-black text-slate-600 dark:text-slate-400 text-sm">اسحب الملف هنا أو انقر للاختيار</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">Excel (.xlsx / .xls)</p>
                </div>
              )}
            </label>

            {/* Parse error */}
            {importError && !importParsed && (
              <div className="mt-4">
                <Alert type="error" onDismiss={resetImport}>{importError}</Alert>
              </div>
            )}

            {/* Parse preview */}
            {importParsed && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'إجمالي الصفوف', value: importParsed.total, color: 'text-slate-800 dark:text-slate-200', bg: 'bg-slate-50 dark:bg-slate-800' },
                    { label: 'صفوف صالحة',    value: importParsed.valid,   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'صفوف غير مكتملة', value: importParsed.invalid, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  ].map((s, i) => (
                    <div key={i} className={cls('rounded-xl p-3 text-center', s.bg)}>
                      <p className={cls('text-xl font-black', s.color)}>{s.value}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {importParsed.invalid > 0 && (
                  <Alert type="warning">
                    {importParsed.invalid} صف سيتم تخطيه لعدم وجود رقم طالب أو كود مادة.
                    تحقق من النموذج وأعد المحاولة أو تابع مع {importParsed.valid} صف صالح.
                  </Alert>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleImportSubmit}
                    disabled={importLoading || importParsed.valid === 0}
                    className={cls(
                      'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all',
                      importParsed.valid > 0
                        ? 'bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 active:scale-[0.98]'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed',
                    )}
                  >
                    {importLoading
                      ? <><Loader size={16} className="animate-spin" /> جارٍ الاستيراد...</>
                      : <><Upload size={16} /> استيراد {importParsed.valid} صف</>
                    }
                  </button>
                  <button
                    onClick={resetImport}
                    className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-black text-sm transition-colors"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 3: Import results ─────────────────────────────────────── */}
          {importResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle size={18} className="text-emerald-700 dark:text-emerald-400" />
                </div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">نتائج الاستيراد</h4>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي',     value: importResult.total,      color: 'text-slate-800 dark:text-slate-200',     bg: 'bg-slate-50 dark:bg-slate-800' },
                  { label: 'تم التسجيل', value: importResult.enrolled,   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                  { label: 'مكرر',       value: importResult.duplicates, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'أخطاء',      value: importResult.errors,     color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20' },
                ].map((s, i) => (
                  <div key={i} className={cls('rounded-xl p-3 text-center', s.bg)}>
                    <p className={cls('text-xl font-black', s.color)}>{s.value ?? 0}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {importResult.details?.length > 0 && (
                <>
                  <button
                    onClick={() => setShowImportDetails(v => !v)}
                    className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    {showImportDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showImportDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                  </button>

                  {showImportDetails && (
                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                      <table className="w-full text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            {['#', 'الطالب', 'الرقم الجامعي', 'المادة', 'الحالة', 'ملاحظة'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.details.map((row, i) => (
                            <ImportResultRow key={i} row={row} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {importError && importParsed && (
            <Alert type="error" onDismiss={() => setImportError(null)}>
              {importError}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

export default EnrollmentManager;