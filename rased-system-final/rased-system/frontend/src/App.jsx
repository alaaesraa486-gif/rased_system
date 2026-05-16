import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import EnrollmentManager from "./components/Admin/EnrollmentManager";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode, Users, BookOpen, LogOut, X,
  AlertCircle, UserPlus, Camera, Loader, CheckCircle, Plus, Calendar, Shield,
  BarChart2, Download, ChevronRight, Clock, Eye, Search, Filter,
  UserCheck, UserX, TrendingUp, Award, ArrowRight, RefreshCw, Trash2,
  GraduationCap, Menu, Bell, Moon, Sun, ChevronDown, Wifi, WifiOff,
  CheckSquare, Activity, Zap, Star
} from 'lucide-react';

// --- Configuration ---
const API_URL = 'http://localhost:5000/api';
axios.defaults.baseURL = API_URL;

// ==============================
// TOAST SYSTEM
// ==============================
const ToastContext = createContext(null);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 w-full max-w-sm px-4" dir="rtl">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-bold transition-all animate-in slide-in-from-top-4 duration-300 ${
              toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' :
              toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' :
              toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-800' :
              'bg-blue-50/95 border-blue-200 text-blue-800'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-500' :
              toast.type === 'error' ? 'bg-red-500' :
              toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
            } text-white`}>
              {toast.type === 'success' ? <CheckCircle size={14}/> :
               toast.type === 'error' ? <AlertCircle size={14}/> : <Bell size={14}/>}
            </div>
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100 transition-opacity">
              <X size={16}/>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => useContext(ToastContext);

// ==============================
// CONFIRM MODAL
// ==============================
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, danger = true }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
          <AlertCircle className={danger ? 'text-red-600' : 'text-blue-600'} size={28}/>
        </div>
        <h3 className="text-xl font-black text-gray-900 text-center mb-2">{title}</h3>
        <p className="text-gray-500 text-center text-sm font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-black hover:bg-gray-200 transition-colors">إلغاء</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-black text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-700'}`}>تأكيد</button>
        </div>
      </div>
    </div>
  );
};

// ==============================
// SKELETON LOADER
// ==============================
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:400%_100%] rounded-xl ${className}`}
    style={{ backgroundSize: '400% 100%', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

// ==============================
// AUTH CONTEXT
// ==============================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/auth/profile');
      setUser(response.data.data.user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    // ✅ FIX: Set the Authorization header immediately here, before any
    // state update triggers a re-render. Previously, setToken() scheduled
    // a useEffect that set the header, but child components (e.g.
    // ProfessorDashboard) mounted and fired their API calls in the same
    // render cycle — before the useEffect had a chance to run — so every
    // request on first login arrived at the server with no token.
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setUser(user);
    return user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==============================
// DARK MODE CONTEXT
// ==============================
const ThemeContext = createContext({ dark: false, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ==============================
// PROTECTED ROUTE
// ==============================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950" dir="rtl">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-300/50 mb-6 mx-auto">
          <GraduationCap className="text-white" size={36}/>
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
      </div>
      <p className="text-slate-400 font-bold text-sm mt-2">جاري التحقق من الهوية...</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

// ==============================
// DASHBOARD LAYOUT
// ==============================
const DashboardLayout = ({ children, title, subtitle }) => {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleLabel = { admin: 'مسؤول النظام', professor: 'عضو هيئة التدريس', student: 'طالب' };
  const roleColor = { admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', professor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-[70px]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-300/40">
              <GraduationCap className="text-white w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-black text-slate-900 dark:text-white leading-none block">كلية التربية النوعية</span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold">جامعة المنصورة</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {dark ? <Sun size={16}/> : <Moon size={16}/>}
            </button>

            {/* User info */}
            <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-2.5 border border-slate-200/60 dark:border-slate-700/60">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-800 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">
                {user?.full_name?.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{user?.full_name}</p>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${roleColor[user?.role]}`}>
                  {roleLabel[user?.role]}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="group flex items-center gap-2 px-3 py-2.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200"
              title="تسجيل الخروج"
            >
              <span className="text-sm font-bold hidden sm:block">خروج</span>
              <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform"/>
            </button>
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/40 dark:border-slate-700/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm hidden sm:block">
              {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

// ==============================
// STAT CARD
// ==============================
const StatCard = ({ icon: Icon, label, value, color = 'blue', trend }) => {
  const colors = {
    blue: 'from-blue-600 to-blue-500 shadow-blue-200/60 dark:shadow-blue-900/50',
    emerald: 'from-teal-400 to-emerald-500 shadow-teal-200/60 dark:shadow-teal-900/50',
    amber: 'from-amber-400 to-orange-400 shadow-amber-200/60 dark:shadow-amber-900/50',
    purple: 'from-cyan-400 to-cyan-600 shadow-cyan-200/60 dark:shadow-cyan-900/50',
    rose: 'from-rose-400 to-pink-500 shadow-rose-200/60 dark:shadow-rose-900/50',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-lg dark:hover:shadow-slate-800/50 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-5">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[color]} shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="text-white" size={22}/>
        </div>
        {trend && (
          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    </div>
  );
};

// ==============================
// DYNAMIC QR DISPLAY
// ==============================
const DynamicQRDisplay = ({ course }) => {
  const [qrValue, setQrValue] = useState('');
  const [timer, setTimer] = useState(8);
  const [attendedStudents, setAttendedStudents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const addToast = useToast();

  useEffect(() => {
    const roomId = String(course.id);
    const socket = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('start_attendance', roomId);
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('qr_update', (data) => {
      QRCode.toDataURL(data.token, {
        width: 400, margin: 2,
        color: { dark: '#1E3A8A', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      }, (err, url) => {
        if (!err) { setQrValue(url); setTimer(8); }
      });
    });

// ابحث عن هذا الجزء في App.jsx وقم بتعديله
  socket.on('student_attended', (data) => {
    const normalized = {
      ...data,
      // التعديل: الترتيب هنا مهم، نبدأ بـ name و full_name لأن الباك-إند يرسلها هكذا
    studentName: data.studentName  || data.full_name || "اسم غير متوفر",      // التأكد من قراءة الرقم الجامعي بشكل صحيح
      studentUniversityId: data.studentUniversityId  || data.university_id  || data.student_id  || 'N/A',
    };
    
    setAttendedStudents(prev => {
      // منع التكرار إذا وصل نفس الطالب مرتين
      if (prev.find(s => s.student_id === normalized.student_id)) return prev;
      return [normalized, ...prev];
    });
  });
  }, [course.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => (prev <= 1 ? 8 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timerPct = (timer / 8) * 100;
  const timerColor = timer <= 2 ? 'bg-rose-400' : timer <= 4 ? 'bg-amber-400' : 'bg-blue-700';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* QR Panel */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        {/* Top bar */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className={`text-xs font-black ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {isConnected ? 'متصل بالخادم' : 'غير متصل'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400">
              <Zap size={14}/>
              <span>تحديث كل 8 ثوانٍ</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{course.course_name}</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-bold mt-1">
            كود المادة: <span className="font-mono text-blue-700 dark:text-blue-400">{course.course_code}</span>
          </p>
        </div>

        <div className="p-8 flex flex-col items-center">
          {/* QR Container */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700/20 to-blue-600/20 rounded-[2rem] blur-2xl scale-110"></div>
            <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-2xl border-4 border-slate-100 dark:border-slate-700">
              {qrValue ? (
                <img src={qrValue} alt="QR Code" className="w-64 h-64 rounded-xl" />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                    <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">في انتظار التوكن...</p>
                </div>
              )}
            </div>
            {/* Corner decorators */}
            {qrValue && ['top-2 right-2', 'top-2 left-2', 'bottom-2 right-2', 'bottom-2 left-2'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-6 h-6 border-2 border-blue-600 dark:border-blue-500 rounded-sm opacity-60`}
                style={{ borderWidth: i < 2 ? '3px 3px 0 0' : '0 0 3px 3px', transform: i === 1 || i === 2 ? 'scaleX(-1)' : 'none' }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between mb-2 text-xs font-black px-1">
              <span className="text-slate-400 dark:text-slate-500">تحديث الكود</span>
              <span className={`font-mono text-base ${timer <= 2 ? 'text-rose-500' : 'text-blue-700 dark:text-blue-400'}`}>{timer}s</span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Attendance Feed */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">الحضور المباشر</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-black px-3 py-1.5 rounded-full">
                {attendedStudents.length} طالب
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
          {attendedStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                <Users size={28} className="text-slate-300 dark:text-slate-600"/>
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">في انتظار الطلاب...</p>
              <p className="text-slate-300 dark:text-slate-600 text-xs font-medium mt-1">سيظهر اسم كل طالب هنا فور مسحه للكود</p>
            </div>
          ) : (
            attendedStudents.map((s, i) => (
              <div
                key={i}
                className="group flex items-center gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl animate-in slide-in-from-right-4 duration-300"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/50 flex-shrink-0">
                  {s.studentName?.charAt(0) || '؟'}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="font-black text-slate-800 dark:text-slate-200 text-sm truncate">{s.studentName || 'غير معروف'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.studentUniversityId && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{s.studentUniversityId}</span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {new Date(s.scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {s.attendanceStats && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.attendanceStats.percentage >= 75 ? 'bg-emerald-400' : s.attendanceStats.percentage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${s.attendanceStats.percentage}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-black ${s.attendanceStats.percentage >= 75 ? 'text-emerald-600 dark:text-emerald-400' : s.attendanceStats.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                        {s.attendanceStats.percentage}%
                      </span>
                    </div>
                  )}
                </div>
                <CheckCircle size={18} className="text-emerald-500 flex-shrink-0"/>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ==============================
// ATTENDANCE MANAGEMENT PAGE
// ==============================
const AttendanceManagementPage = ({ courses }) => {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState([]);
  const [courseStats, setCourseStats] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const addToast = useToast();

  const fetchSessions = async (courseId) => {
    setLoadingSessions(true);
    setSessions([]);
    setSelectedSession(null);
    setSessionRecords([]);
    setCourseStats(null);
    try {
      const analyticsRes = await axios.get(`/analytics/course/${courseId}`);
      if (analyticsRes.data.success) {
        const data = analyticsRes.data.data;
        setCourseStats(data.statistics);
        // ✅ FIX: attendance_trend sessions now include s.id (backend fix).
        // Sessions arrive in DESC order from the backend; reverse for
        // chronological display so the latest session appears last.
        const trend = data.attendance_trend || [];
        setSessions([...trend].reverse());
      } else {
        addToast('فشل في تحميل بيانات المادة', 'error');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      addToast(serverMsg || 'فشل في تحميل بيانات المادة', 'error');
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchSessionRecords = async (sessionId) => {
    setLoadingRecords(true);
    setSessionRecords([]);
    try {
      const res = await axios.get(`/attendance/sessions/${sessionId}`);
      if (res.data.success) {
        setSessionRecords(res.data.data?.records || []);
      } else {
        addToast(res.data.message || 'فشل في تحميل سجلات الجلسة', 'error');
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      addToast(serverMsg || 'فشل في تحميل سجلات الجلسة', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleExport = async (type) => {
    if (!selectedCourse) return;
    setLoadingExport(true);
    try {
      const params = { courseId: selectedCourse.id };
      if (type === 'session' && selectedSession) params.sessionId = selectedSession.id;
      const response = await axios.get('/analytics/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCourse.course_code}_attendance.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('تم تصدير الملف بنجاح', 'success');
    } catch { addToast('حدث خطأ أثناء التصدير', 'error'); }
    finally { setLoadingExport(false); }
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    fetchSessions(course.id);
  };

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    // ✅ FIX: Previously session.id was undefined because the analytics query
    // did not include s.id in its SELECT clause, so fetchSessionRecords was
    // never called and the records panel always showed "no records".
    // Now s.id is selected in analyticsController (backend fix), but we also
    // add a type-safe check here so a missing id produces a clear warning
    // instead of a silent no-op.
    if (session?.id != null) {
      fetchSessionRecords(session.id);
    } else {
      console.warn('[handleSelectSession] Session object has no id:', session);
    }
  };

  const filteredRecords = sessionRecords.filter(r => {
    const matchSearch = !searchQuery ||
      r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.university_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Selector */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-black text-slate-900 dark:text-white text-base">اختر المادة</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {courses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">لا توجد مواد</div>
            ) : courses.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectCourse(c)}
                className={`w-full text-right p-4 flex items-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedCourse?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20 border-r-4 border-blue-700' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedCourse?.id === c.id ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                  <BookOpen size={16}/>
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black truncate ${selectedCourse?.id === c.id ? 'text-blue-800 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{c.course_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{c.course_code}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats + Sessions */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedCourse ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex flex-col items-center justify-center p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4">
                <BarChart2 size={28} className="text-slate-300 dark:text-slate-600"/>
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-bold">اختر مادة لعرض سجل الحضور</p>
            </div>
          ) : loadingSessions ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full"/>)}
            </div>
          ) : (
            <>
              {courseStats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'إجمالي المحاضرات', value: courseStats.total_sessions || 0, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'إجمالي الحضور', value: courseStats.total_attendance || 0, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'معدل الحضور', value: `${courseStats.average_attendance || 0}%`, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-2xl p-4 text-center`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">المحاضرات</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport('course')}
                      disabled={loadingExport}
                      className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loadingExport ? <Loader size={12} className="animate-spin"/> : <Download size={12}/>}
                      تصدير Excel
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-48 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">لا توجد محاضرات مسجلة</div>
                  ) : sessions.map((session, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSession(session)}
                      className={`w-full text-right p-4 flex items-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedSession?.id === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${selectedSession?.id === session.id ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{session.session_name || `محاضرة ${i + 1}`}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          {session.session_date ? new Date(session.session_date).toLocaleDateString('ar-EG') : ''}
                          {session.attendance_count !== undefined && ` · ${session.attendance_count} حاضر`}
                        </p>
                      </div>
                      <ChevronRight size={14} className={`text-slate-300 dark:text-slate-600 flex-shrink-0 ${selectedSession?.id === session.id ? 'text-blue-700' : ''}`}/>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Session Records */}
      {selectedSession && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">{selectedSession.session_name || 'تفاصيل المحاضرة'}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  {selectedSession.session_date ? new Date(selectedSession.session_date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                  <input
                    type="text"
                    placeholder="بحث بالاسم..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-9 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 ring-blue-300 dark:ring-blue-700 w-40 text-slate-700 dark:text-slate-300"
                  />
                </div>
                <button
                  onClick={() => handleExport('session')}
                  disabled={loadingExport}
                  className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition-colors"
                >
                  <Download size={12}/> تصدير
                </button>
              </div>
            </div>
          </div>

          {loadingRecords ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full"/>)}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-16 text-center">
              <UserX size={36} className="text-slate-200 dark:text-slate-700 mx-auto mb-3"/>
              <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">لا توجد سجلات حضور لهذه الجلسة</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                {[
                  { label: 'إجمالي الحاضرين', value: sessionRecords.length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
                  { label: 'مسح QR', value: sessionRecords.filter(r => !r.is_manual_override).length, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                  { label: 'تسجيل يدوي', value: sessionRecords.filter(r => r.is_manual_override).length, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} p-4 text-center`}>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      {['#', 'الطالب', 'الرقم الجامعي', 'وقت التسجيل', 'الطريقة', 'الحالة'].map(h => (
                        <th key={h} className="p-4 text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {filteredRecords.map((record, i) => (
                      <tr key={record.id || i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                        <td className="p-4 text-slate-300 dark:text-slate-600 font-black text-xs">{i + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-700 group-hover:text-white text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center font-black transition-all text-xs">
                              {record.full_name?.charAt(0) || '؟'}
                            </div>
                            <span className="font-black text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">{record.full_name || '—'}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400 dark:text-slate-500">{record.university_id || '—'}</td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                            <Clock size={12} className="text-slate-300 dark:text-slate-600"/>
                            {record.scanned_at ? new Date(record.scanned_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${record.is_manual_override ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                            {record.is_manual_override ? 'يدوي' : 'QR'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xs whitespace-nowrap">
                            <CheckCircle size={14}/>حاضر
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ==============================
// STUDENT SCANNER
// ==============================
const StudentScanner = ({ courseId }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const scannerRef = useRef(null);
  const courseIdRef = useRef(courseId);

  useEffect(() => { courseIdRef.current = courseId; }, [courseId]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner Cleanup Warning:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const startScanner = async () => {
    if (!courseIdRef.current) {
      setStatus({ type: 'error', msg: 'يرجى اختيار المادة من القائمة قبل فتح الكاميرا.' });
      return;
    }
    setStatus({ type: '', msg: '' });
    setIsScanning(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 15, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            await stopScanner();
            try {
              const response = await axios.post('http://192.168.1.4:5000/api/attendance/scan', {
                token: decodedText,
                courseId: courseIdRef.current
              }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              if (response.data.success) {
                setStatus({ type: 'success', msg: 'تم تسجيل حضورك بنجاح! ✅' });
              }
            } catch (err) {
              const errMsg = err.response?.data?.message || 'كود غير صالح أو منتهي، حاول مرة أخرى';
              setStatus({ type: 'error', msg: errMsg });
            }
          },
          () => {}
        );
      } catch (err) {
        setStatus({ type: 'error', msg: 'تعذر الوصول للكاميرا. تأكد من إعطاء الصلاحيات للمتصفح.' });
        setIsScanning(false);
      }
    }, 400);
  };

  useEffect(() => { return () => { stopScanner(); }; }, []);

  return (
    <div className="max-w-md mx-auto space-y-4">
      {status.msg && (
        <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300 shadow-lg border ${
          status.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${status.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
            {status.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
          </div>
          <span className="font-black">{status.msg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-48 h-48 bg-blue-50 dark:bg-blue-900/10 rounded-full -translate-x-24 -translate-y-24 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full translate-x-16 translate-y-16 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-700 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50">
            <Camera size={36} className="text-white"/>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">مسح كود QR</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed max-w-xs mx-auto">
            وجّه الكاميرا نحو شاشة الدكتور لتسجيل حضورك في المادة المختارة
          </p>

          {!isScanning ? (
            <button
              onClick={startScanner}
              className="w-full bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-900 hover:to-blue-700 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Camera size={22}/>
              بدء المسح الآن
            </button>
          ) : (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="relative mb-6">
                <div id="reader" className="overflow-hidden rounded-2xl border-4 border-blue-100 dark:border-blue-900/50 bg-black shadow-2xl aspect-square"></div>
                {/* Scanner frame corners */}
                <div className="absolute top-3 right-3 w-8 h-8 border-t-4 border-r-4 border-blue-600 rounded-tr-xl pointer-events-none"></div>
                <div className="absolute top-3 left-3 w-8 h-8 border-t-4 border-l-4 border-blue-600 rounded-tl-xl pointer-events-none"></div>
                <div className="absolute bottom-3 right-3 w-8 h-8 border-b-4 border-r-4 border-blue-600 rounded-br-xl pointer-events-none"></div>
                <div className="absolute bottom-3 left-3 w-8 h-8 border-b-4 border-l-4 border-blue-600 rounded-bl-xl pointer-events-none"></div>
                {/* Scan line animation */}
                <div className="absolute inset-x-4 top-4 h-0.5 bg-cyan-400/70 animate-bounce pointer-events-none"></div>
              </div>
              <button
                onClick={stopScanner}
                className="flex items-center gap-2 mx-auto text-red-500 dark:text-red-400 font-black hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                <X size={16}/> إيقاف الكاميرا
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="text-slate-300" size={22}/>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">حماية البيانات</p>
          <p className="text-slate-300 text-xs font-medium leading-relaxed">يتم التحقق من هويتك وتسجيل الوقت الفعلي لضمان نزاهة عملية الحضور.</p>
        </div>
      </div>
    </div>
  );
};

// ==============================
// ADMIN DASHBOARD
// ==============================
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const addToast = useToast();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'student', student_id: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/admin/users');
      setUsers(res.data.data.users);
    } catch { addToast('فشل في تحميل المستخدمين', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/auth/register', {
        fullName: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        studentId: formData.student_id
      });
      setShowModal(false);
      fetchUsers();
      setFormData({ full_name: '', email: '', password: '', role: 'student', student_id: '' });
      addToast('تم إنشاء الحساب بنجاح', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'خطأ في العملية', 'error');
    }
  };

  const roleLabel = { admin: 'مسؤول', professor: 'دكتور', student: 'طالب' };
  const roleStyle = {
    admin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    professor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    student: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
  };

  const navItems = [
    { key: 'overview', label: 'إدارة المستخدمين', icon: Users },
    { key: 'enrollment', label: 'ربط الطلاب بالمواد', icon: UserPlus },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-300" dir="rtl">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white dark:bg-slate-900 border-l border-slate-200/60 dark:border-slate-700/60 shadow-sm flex-shrink-0 flex flex-col">
        {/* Logo */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-800 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50">
              <GraduationCap className="text-white" size={22}/>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-none">كلية التربية النوعية</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-bold">جامعة المنصورة</p>
            </div>
          </div>
          <div className="mt-5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md">
              {user?.full_name?.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{user?.full_name}</p>
              <span className="text-[10px] font-black text-blue-700 dark:text-blue-400">مسؤول النظام</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-5 space-y-1.5">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm transition-all ${
                activeTab === item.key
                  ? 'bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <item.icon size={18}/>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
          >
            {dark ? <Sun size={18}/> : <Moon size={18}/>}
            {dark ? 'الوضع النهاري' : 'الوضع الليلي'}
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl font-bold text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <LogOut size={18}/> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'overview' && (
            <div className="animate-in fade-in duration-300">
              {/* Header */}
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">إدارة المستخدمين</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">التحكم في حسابات الطلاب والدكاترة</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl flex items-center justify-center font-black text-sm">{users.length}</div>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">مستخدم مسجل</p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
                  >
                    <Plus size={18}/> إضافة مستخدم
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'طلاب', value: users.filter(u => u.role === 'student').length, color: 'blue', icon: Users },
                  { label: 'دكاترة', value: users.filter(u => u.role === 'professor').length, color: 'amber', icon: GraduationCap },
                  { label: 'مسؤولون', value: users.filter(u => u.role === 'admin').length, color: 'purple', icon: Shield },
                ].map((s, i) => <StatCard key={i} {...s}/>)}
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-8 space-y-4">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-14"/>)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                          {['المستخدم', 'الصلاحية', 'البريد الإلكتروني', 'الرقم التعريفي'].map(h => (
                            <th key={h} className="p-4 text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-700 group-hover:text-white text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center font-black text-xs transition-all">
                                  {u.full_name?.charAt(0)}
                                </div>
                                <span className="font-black text-slate-800 dark:text-slate-200 text-sm whitespace-nowrap">{u.full_name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${roleStyle[u.role]}`}>
                                {roleLabel[u.role]}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 dark:text-slate-400 text-xs font-medium" dir="ltr">{u.email}</td>
                            <td className="p-4 font-mono text-xs text-slate-400 dark:text-slate-500">{u.student_id || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'enrollment' && (
            <div className="animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">ربط الطلاب بالمواد</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">إدارة تسجيل الطلاب في المواد الدراسية</p>
              </div>
              <EnrollmentManager />
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-800 to-blue-600 rounded-t-3xl"></div>
            <div className="flex justify-between items-center mb-7">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">إضافة مستخدم جديد</h3>
              <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"><X size={18}/></button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {[
                { label: 'الاسم الكامل', field: 'full_name', type: 'text', placeholder: 'محمد أحمد علي' },
                { label: 'البريد الإلكتروني', field: 'email', type: 'email', placeholder: 'user@example.com' },
                { label: 'كلمة المرور', field: 'password', type: 'password', placeholder: '••••••••' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 dark:ring-blue-600 transition-all font-bold text-sm text-slate-800 dark:text-slate-200"
                    value={formData[field]}
                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                    required
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">الصلاحية</label>
                  <select
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-black text-blue-700 dark:text-blue-400 text-sm"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="student">طالب</option>
                    <option value="professor">دكتور</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </div>
                {formData.role === 'student' && (
                  <div className="space-y-1.5 animate-in zoom-in duration-200">
                    <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">الرقم الجامعي</label>
                    <input
                      type="text"
                      placeholder="ST-000"
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-bold text-sm text-slate-800 dark:text-slate-200"
                      value={formData.student_id}
                      onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-[2] bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 transition-all active:scale-95">إنشاء الحساب</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-4 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================
// PROFESSOR DASHBOARD
// ==============================
const ProfessorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('courses');
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', semester: 'Fall', academicYear: '2025/2026' });
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const addToast = useToast();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/courses/');
      // ✅ FIX: Guard against unexpected response shapes. Previously, accessing
      // res.data.data.courses when `data` was undefined threw a TypeError, which
      // landed in the catch block and showed the error toast even though the
      // request itself succeeded and the courses rendered correctly.
      const fetchedCourses = res.data?.data?.courses;
      if (!Array.isArray(fetchedCourses)) {
        console.error('[fetchCourses] Unexpected response shape:', res.data);
        addToast('فشل في تحميل المواد', 'error');
        return;
      }
      setCourses(fetchedCourses);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      addToast(serverMsg || 'فشل في تحميل المواد', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleDeleteCourse = async (courseId) => {
    try {
      const res = await axios.delete(`/courses/${courseId}`);
      if (res.data.success) {
        setCourses(courses.filter(c => c.id !== courseId));
        addToast('تم حذف المادة بنجاح', 'success');
      }
    } catch { addToast('فشل في حذف المادة', 'error'); }
    finally { setConfirmDelete(null); }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/courses', newCourse);
      setShowAddModal(false);
      fetchCourses();
      setNewCourse({ courseCode: '', courseName: '', semester: 'Fall', academicYear: '2025/2026' });
      addToast('تمت إضافة المادة بنجاح', 'success');
    } catch { addToast('حدث خطأ أثناء الإضافة', 'error'); }
  };

  const handleStartSession = async (course) => {
    try {
      await axios.post('/attendance/sessions', {
        courseId: course.id,
        sessionName: `محاضرة ${new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}`,
        sessionDate: new Date().toISOString().split('T')[0]
      });
      setActiveSession(course);
    } catch {
      setActiveSession(course);
    }
  };

  return (
    <DashboardLayout
      title={activeSession ? `جلسة نشطة: ${activeSession.course_name}` : 'لوحة المحاضر'}
      subtitle="كلية التربية النوعية — جامعة المنصورة"
    >
      {activeSession ? (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-4 py-2.5 rounded-xl">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">جلسة نشطة</span>
              </div>
            </div>
            <button
              onClick={() => setActiveSession(null)}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 text-red-500 border border-red-200 dark:border-red-800/50 px-5 py-2.5 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all font-black text-sm shadow-sm"
            >
              <X size={16}/> إنهاء الجلسة
            </button>
          </div>
          <DynamicQRDisplay course={activeSession}/>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-8 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-700/60 w-fit">
            {[
              { key: 'courses', label: 'المواد الدراسية', icon: BookOpen },
              { key: 'attendance', label: 'سجل الحضور', icon: BarChart2 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <tab.icon size={16}/>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">المواد الدراسية</h2>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black px-3 py-1 rounded-full">{courses.length}</span>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50 transition-all active:scale-95"
                >
                  <Plus size={16}/> مادة جديدة
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-64"/>)}
                </div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-5">
                    <BookOpen size={32} className="text-slate-300 dark:text-slate-600"/>
                  </div>
                  <h3 className="text-lg font-black text-slate-400 dark:text-slate-500 mb-2">لا توجد مواد بعد</h3>
                  <p className="text-sm text-slate-300 dark:text-slate-600 font-medium">أضف أول مادة دراسية للبدء</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {courses.map(c => (
                    <div key={c.id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-xl dark:hover:shadow-slate-800/50 transition-all duration-300 overflow-hidden">
                      <div className="h-1.5 bg-gradient-to-r from-blue-800 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-5">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-all">
                            <BookOpen size={22}/>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase">المسجلون</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{c.student_count || 0}</p>
                          </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors leading-tight">{c.course_name}</h3>
                        <p className="text-blue-700 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-4">{c.course_code}</p>
                        <div className="flex flex-wrap gap-2 mb-5">
                          <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar size={9}/> {c.semester}
                          </span>
                          <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400">{c.academic_year}</span>
                          {c.session_count > 0 && (
                            <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full text-blue-700 dark:text-blue-400">{c.session_count} محاضرة</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartSession(c)}
                            className="flex-1 bg-slate-900 dark:bg-slate-700 hover:bg-blue-700 dark:hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <QrCode size={16}/> بدء التحضير
                          </button>
                          <button
                            onClick={() => { setActiveTab('attendance'); }}
                            className="px-3.5 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl transition-colors"
                            title="سجل الحضور"
                          >
                            <BarChart2 size={16}/>
                          </button>
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            className="px-3.5 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-400 dark:text-red-400 rounded-xl transition-colors"
                            title="حذف المادة"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="animate-in fade-in duration-300">
              <AttendanceManagementPage courses={courses}/>
            </div>
          )}
        </>
      )}

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-200/60 dark:border-slate-700/60 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-7">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">إضافة مادة دراسية</h3>
              <button onClick={() => setShowAddModal(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"><X size={18}/></button>
            </div>
            <form onSubmit={handleAddCourse} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">اسم المادة</label>
                <input
                  type="text"
                  placeholder="مثال: مقدمة في علوم الحاسب"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-bold text-sm text-slate-800 dark:text-slate-200"
                  onChange={e => setNewCourse({ ...newCourse, courseName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">كود المادة</label>
                <input
                  type="text"
                  placeholder="CS101"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-blue-400 font-bold text-sm font-mono text-slate-800 dark:text-slate-200"
                  onChange={e => setNewCourse({ ...newCourse, courseCode: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">الفصل الدراسي</label>
                  <select
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-blue-700 dark:text-blue-400 text-sm"
                    onChange={e => setNewCourse({ ...newCourse, semester: e.target.value })}
                  >
                    <option value="Fall">الخريف (Fall)</option>
                    <option value="Spring">الربيع (Spring)</option>
                    <option value="Summer">الصيف (Summer)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">السنة الأكاديمية</label>
                  <input
                    type="text"
                    defaultValue="2025/2026"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-center text-sm text-slate-800 dark:text-slate-200"
                    onChange={e => setNewCourse({ ...newCourse, academicYear: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-[2] bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-xl font-black text-sm shadow-lg shadow-blue-200/50 transition-all active:scale-95">حفظ المادة</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-4 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="حذف المادة الدراسية"
        message="هل أنت متأكد؟ سيتم حذف جميع الجلسات والسجلات المرتبطة بهذه المادة بشكل نهائي."
        onConfirm={() => handleDeleteCourse(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </DashboardLayout>
  );
};

// ==============================
// STUDENT DASHBOARD
// ==============================
const StudentDashboard = () => {
  const [myCourses, setMyCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchMyCourses = async () => {
      try {
        const response = await axios.get('http://192.168.1.4:5000/api/courses/my-courses', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.data.success) {
          const courses = response.data.courses || [];
          setMyCourses(courses);
          if (courses.length > 0) setSelectedCourseId(courses[0].id);
        }
      } catch (err) {
        console.error("خطأ أثناء جلب المواد:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyCourses();
  }, []);

  return (
    <DashboardLayout title="تسجيل الحضور" subtitle={`أهلاً ${user?.full_name?.split(' ')[0]} 👋`}>
      <div className="max-w-lg mx-auto space-y-5 animate-in slide-in-from-bottom-4 duration-500">
        {/* Course selector */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
          <label className="block text-xs font-black text-blue-700 dark:text-blue-400 mb-3 uppercase tracking-widest">
            المادة الدراسية
          </label>
          {loading ? (
            <Skeleton className="h-12"/>
          ) : (
            <select
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 ring-blue-300 dark:ring-blue-700 outline-none font-bold text-slate-700 dark:text-slate-300 transition-all text-sm"
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
            >
              {myCourses.length > 0 ? (
                myCourses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.course_name} ({course.course_code})
                  </option>
                ))
              ) : (
                <option value="">لا توجد مواد مسجلة</option>
              )}
            </select>
          )}
        </div>

        {selectedCourseId ? (
          <div className="animate-in zoom-in-95 duration-400">
            <StudentScanner courseId={selectedCourseId}/>
          </div>
        ) : !loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen size={24} className="text-slate-300 dark:text-slate-600"/>
            </div>
            <p className="font-black text-slate-400 dark:text-slate-500 mb-1">لا توجد مواد متاحة</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 font-medium">تأكد من تسجيلك في المواد الدراسية</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

// ==============================
// LOGIN PAGE
// ==============================
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { dark, toggle } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(`/${user.role}`);
    } catch {
      setError('خطأ في البريد أو كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300" dir="rtl">
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm hover:shadow-md transition-all"
      >
        {dark ? <Sun size={16}/> : <Moon size={16}/>}
      </button>

      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-300/50 dark:shadow-slate-900/80 overflow-hidden border border-slate-200/60 dark:border-slate-700/60 min-h-[620px]">

        {/* Left panel — branding */}
        <div className="hidden md:flex bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-12 flex-col justify-between relative overflow-hidden text-right">
          {/* Background blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-blue-400/20 rounded-full -ml-16 -mb-16 blur-3xl pointer-events-none"></div>

          {/* Top */}
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
              <GraduationCap size={30} className="text-white"/>
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-3">
              نظام الحضور<br/>الذكي
            </h2>
            <p className="text-sky-200/80 text-sm font-medium leading-relaxed max-w-xs">
              كلية التربية النوعية — جامعة المنصورة<br/>
              نظام متطور لإدارة الحضور بتقنية QR الديناميكي.
            </p>
          </div>

          {/* Stats */}
          <div className="relative z-10">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'حماية', value: '100%' },
                { label: 'سرعة المسح', value: '2.4s' },
                { label: 'دقة التحقق', value: '99.9%' },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                  <p className="text-2xl font-black text-white leading-none mb-1">{s.value}</p>
                  <p className="text-[10px] text-sky-200/70 font-bold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-sky-300/50 font-bold text-center">فريق تكنولوجيا المعلومات © 2026</p>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
              <GraduationCap className="text-white" size={20}/>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-none">كلية التربية النوعية</p>
              <p className="text-[10px] text-blue-700 font-bold">جامعة المنصورة</p>
            </div>
          </div>

          <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-1">تسجيل الدخول</h3>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mb-8">أدخل بياناتك للوصول إلى النظام</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-200 dark:border-red-800/50 flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle size={18} className="flex-shrink-0"/>
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">البريد الجامعي</label>
              <input
                type="email"
                placeholder="name@university.edu"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 ring-blue-400/40 dark:ring-blue-600/40 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-800 dark:text-slate-200"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">كلمة المرور</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 ring-blue-400/40 dark:ring-blue-600/40 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-800 dark:text-slate-200"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-900 hover:to-blue-700 text-white p-4 rounded-2xl font-black text-base shadow-xl shadow-blue-200/60 dark:shadow-blue-900/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={18}/>
                  جاري التحقق...
                </>
              ) : (
                <>
                  دخول إلى النظام
                  <ArrowRight size={18}/>
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">
            كلية التربية النوعية · جامعة المنصورة · 2026
          </p>
        </div>
      </div>
    </div>
  );
};

// ==============================
// MAIN APP
// ==============================
const App = () => (
  <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard/></ProtectedRoute>}/>
            <Route path="/professor" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorDashboard/></ProtectedRoute>}/>
            <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard/></ProtectedRoute>}/>
            <Route path="/" element={<Navigate to="/login" replace/>}/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </ThemeProvider>
);

export default App;