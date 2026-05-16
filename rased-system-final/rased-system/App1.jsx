import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import EnrollmentManager from "./components/Admin/EnrollmentManager";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';

import { Html5Qrcode } from 'html5-qrcode';
import { 
  QrCode, Users, BookOpen, LogOut, X, 
  AlertCircle, UserPlus, Camera, Loader, CheckCircle, Plus, Calendar, Shield
} from 'lucide-react';

// --- Configuration ---
const API_URL = 'http://192.168.1.4:5000/api';
axios.defaults.baseURL = API_URL;

// --- Contexts ---
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
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post('/auth/login', { email, password });
    const { accessToken, user } = response.data.data;
    setToken(accessToken);
    setUser(user);
    localStorage.setItem('token', accessToken);
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

// --- Shared Components ---

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-gray-500 font-medium">جاري التحميل...</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const DashboardLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans" dir="rtl">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <QrCode className="text-white w-7 h-7 -rotate-3" />
            </div>
            <div>
              <span className="text-2xl font-black text-gray-900 tracking-tight block">راصد</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Rased System</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-left hidden md:block" dir="ltr">
              <p className="text-sm font-bold text-gray-900 leading-none mb-1">{user?.full_name}</p>
              <p className="text-[11px] text-blue-600 font-bold uppercase bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                {user?.role}
              </p>
            </div>
            <button 
              onClick={logout} 
              className="group flex items-center gap-2 p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300"
              title="تسجيل الخروج"
            >
              <span className="text-sm font-bold hidden sm:block">خروج</span>
              <LogOut size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10 flex items-center justify-between">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">{title}</h1>
          <div className="text-sm text-gray-500 font-medium bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

// --- Professor Components (Dynamic QR Engine) ---

const DynamicQRDisplay = ({ course }) => {
  const [qrValue, setQrValue] = useState('');
  const [timer, setTimer] = useState(8);

  useEffect(() => {
    // 1. تحويل المعرف إلى نص صريح لمنع أي أخطاء في الـ Rooms الخاصة بـ Socket.io
    const roomId = String(course.id);

    // 2. الاتصال بالسيرفر
    const socket = io('http://192.168.1.4:5000', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log("✅ Connected to Server! Socket ID:", socket.id);
      // نطلب الجلسة بالـ String الصريح
      socket.emit('start_attendance', roomId);
    });

    // الاستماع لتأكيد السيرفر أن الجلسة بدأت فعلاً في الغرفة الصحيحة
    socket.on('session_started', (data) => {
      console.log("🚀 Server Confirmed Room Join:", data);
    });

    // 3. استقبال التوكن وتحويله لـ QR
    socket.on('qr_update', (data) => {
      console.log("🆕 Received DATA from Redis! Token:", data.token.substring(0, 15) + "...");
      
      QRCode.toDataURL(data.token, { 
        width: 400, 
        margin: 2, 
        color: { dark: '#1e40af', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      }, (err, url) => {
        if (err) {
          console.error("❌ QR Generation Error:", err);
          return;
        }
        setQrValue(url); // الشاشة ستحدث ويظهر الكود
        setTimer(8); 
      });
    });

    socket.on('connect_error', (err) => {
      console.error("❌ Connection Error:", err.message);
    });

    // استلام أي أخطاء قادمة من السيرفر
    socket.on('error', (err) => {
      console.error("❌ Server Error:", err.message);
    });

    return () => {
      socket.emit('stop_attendance', roomId);
      socket.disconnect();
    };
  }, [course.id]);

  // العداد البصري
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev <= 1 ? 8 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center max-w-xl mx-auto transform transition-all">
      <div className="mb-8">
        <span className="bg-green-100 text-green-700 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-3 inline-block">
          النظام متصل بالسيرفر الآن
        </span>
        <h2 className="text-3xl font-black text-gray-800">{course.course_name}</h2>
        <p className="text-gray-500 mt-2 font-medium">كود المادة: {course.course_code}</p>
      </div>

      <div className="p-6 bg-gray-50 rounded-[2rem] border-2 border-dashed border-blue-200 inline-block relative">
        {qrValue ? (
          <img src={qrValue} alt="QR Code" className="w-80 h-80 rounded-xl shadow-lg" />
        ) : (
          <div className="w-80 h-80 flex flex-col items-center justify-center">
            <Loader className="animate-spin text-blue-600 mb-4" size={50} />
            <p className="text-sm font-bold text-gray-400">في انتظار أول كود من Redis...</p>
          </div>
        )}
      </div>

      <div className="mt-10 max-w-sm mx-auto">
        <div className="flex justify-between mb-3 text-sm font-black px-1">
          <span className="text-gray-400">تزامن مع Redis</span>
          <span className="text-blue-600 font-mono text-lg">{timer}s</span>
        </div>
        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden p-1">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-linear" 
            style={{ width: `${(timer / 8) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

// --- Student Components (Scanner Engine - FIXED) ---



const StudentScanner = ({ courseId }) => { 
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  
  const scannerRef = useRef(null);
  
  // 1. استخدام Ref لضمان تحديث قيمة courseId داخل دالة الكاميرا (لتجنب الـ Stale Closure)
  const courseIdRef = useRef(courseId);

  // تحديث الـ Ref كلما تغيرت المادة التي يختارها الطالب
  useEffect(() => {
    courseIdRef.current = courseId;
  }, [courseId]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
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
    // التأكد من اختيار المادة من القائمة أولاً
    if (!courseIdRef.current) {
      setStatus({ type: 'error', msg: 'يرجى اختيار المادة من القائمة قبل فتح الكاميرا.' });
      return;
    }

    setStatus({ type: '', msg: '' });
    setIsScanning(true);

    // مهلة لضمان ظهور عنصر الـ reader في الـ DOM
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          videoConstraints: { facingMode: "environment" }
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            console.log("📡 [FRONTEND] QR Scanned, stopping camera and sending to server...");
            
            // 1. إيقاف الكاميرا فور التقاط الكود
            await stopScanner();
            
            try {
              // 2. إرسال التوكن الممسوح + معرف المادة للسيرفر
              // استخدمنا الرابط الكامل هنا للتأكد من عدم وجود مشكلة في المسارات
              const response = await axios.post('http://192.168.1.4:5000/api/attendance/scan', { 
                token: decodedText,
                courseId: courseIdRef.current // نستخدم الـ Ref لضمان إرسال أحدث قيمة
              }, {
                headers: { 
                  Authorization: `Bearer ${localStorage.getItem('token')}` 
                }
              });

              console.log("✅ [FRONTEND] Server Response:", response.data);

              if (response.data.success) {
                setStatus({ type: 'success', msg: 'تم تسجيل حضورك بنجاح في هذه المادة! ✅' });
              }
            } catch (err) {
              console.error("❌ [FRONTEND] Server Error:", err.response?.data || err.message);
              const errMsg = err.response?.data?.message || 'كود غير صالح أو منتهي، حاول مرة أخرى';
              setStatus({ type: 'error', msg: errMsg });
            }
          },
          () => {} // صامت أثناء البحث عن كود
        );
      } catch (err) {
        console.error("Camera Error:", err);
        setStatus({ type: 'error', msg: 'تعذر الوصول للكاميرا. تأكد من إعطاء الصلاحيات للمتصفح.' });
        setIsScanning(false);
      }
    }, 400);
  };

  // تنظيف الكاميرا عند إغلاق المكون أو الخروج من الصفحة
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  return (
    <div className="max-w-md mx-auto">
      {status.msg && (
        <div className={`p-5 mb-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top duration-300 shadow-md ${
          status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
        }`}>
          <div className={`p-2 rounded-full ${status.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {status.type === 'success' ? <CheckCircle size={24}/> : <AlertCircle size={24}/>}
          </div>
          <span className="font-black text-lg">{status.msg}</span>
        </div>
      )}
      
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
        
        <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-blue-100 transform -rotate-6">
          <Camera size={48} className="rotate-6" />
        </div>
        
        <h2 className="text-3xl font-black mb-3 text-gray-800 tracking-tight text-center">مسح الكود</h2>
        <p className="text-gray-500 mb-8 font-medium px-4 text-center">وجه الكاميرا نحو شاشة الدكتور لتسجيل حضورك في المادة المختارة</p>
        
        {!isScanning ? (
          <button 
            onClick={startScanner} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.5rem] font-black text-xl shadow-xl shadow-blue-200 active:scale-95 transition-all transform flex items-center justify-center gap-3"
          >
            <Camera size={24} />
            بدء المسح الآن
          </button>
        ) : (
          <div className="animate-in fade-in zoom-in duration-300">
            <div id="reader" className="overflow-hidden rounded-[2rem] border-8 border-blue-50 bg-black shadow-2xl aspect-square"></div>
            <button 
              onClick={stopScanner}
              className="mt-8 text-red-500 font-black hover:bg-red-50 px-6 py-2 rounded-full transition-colors flex items-center gap-2 mx-auto"
            >
              <X size={20}/>
              إيقاف الكاميرا
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-8 bg-indigo-900 rounded-3xl p-6 text-white flex items-center gap-5 shadow-lg shadow-indigo-100">
        <div className="p-3 bg-white/10 rounded-2xl"><Shield className="text-indigo-200" size={30}/></div>
        <div className="text-right text-sm">
          <p className="font-black opacity-60 uppercase text-[10px] tracking-widest mb-1">حماية البيانات</p>
          <p className="font-medium leading-tight text-right">يتم التحقق من هويتك وموقعك وتسجيل الوقت الفعلي لضمان نزاهة عملية التحضير.</p>
        </div>
      </div>
    </div>
  );
};


// --- Admin Dashboard ---

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // نظام التبويبات
  const [formData, setFormData] = useState({ 
    full_name: '', 
    email: '', 
    password: '', 
    role: 'student', 
    student_id: '' 
  });

  // جلب المستخدمين من السيرفر
  const fetchUsers = () => {
    axios.get('/admin/users')
      .then(res => setUsers(res.data.data.users))
      .catch(err => console.error("Error fetching users", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // دالة إنشاء مستخدم جديد
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
      alert('تم إنشاء المستخدم بنجاح');
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في العملية');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row rtl">
      {/* Sidebar - القائمة الجانبية */}
      <div className="w-full md:w-80 bg-white p-8 border-l border-gray-100 shadow-sm z-10">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Shield size={24} />
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tighter">لوحة التحكم</h1>
        </div>

        <nav className="space-y-3">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-4 p-4 rounded-[1.2rem] font-bold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Users size={20} /> إدارة المستخدمين
          </button>
          
          <button 
            onClick={() => setActiveTab('enrollment')}
            className={`w-full flex items-center gap-4 p-4 rounded-[1.2rem] font-bold transition-all ${activeTab === 'enrollment' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <UserPlus size={20} /> ربط الطلاب بالمواد
          </button>

          <div className="pt-10">
             <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-[1.2rem] font-bold text-red-500 hover:bg-red-50 transition-all">
              <LogOut size={20} /> تسجيل الخروج
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content - المحتوى الرئيسي */}
      <div className="flex-1 p-6 md:p-12 overflow-y-auto">
        
        {/* التبويب الأول: إدارة المستخدمين */}
        {activeTab === 'overview' && (
          <div className="animate-slide-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-black text-gray-800">إدارة النظام</h2>
                <p className="text-gray-500 font-bold">التحكم في حسابات الطلاب والدكاترة</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xl">{users.length}</div>
                  <p className="text-sm font-black text-gray-800 leading-none">مستخدم مسجل</p>
                </div>
                
                <button 
                  onClick={() => setShowModal(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl flex items-center gap-3 font-black shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  <Plus size={20}/> إضافة مستخدم
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="p-5 text-gray-400 font-black text-xs uppercase tracking-widest">المستخدم</th>
                      <th className="p-5 text-gray-400 font-black text-xs uppercase tracking-widest">الصلاحية</th>
                      <th className="p-5 text-gray-400 font-black text-xs uppercase tracking-widest">البريد الإلكتروني</th>
                      <th className="p-5 text-gray-400 font-black text-xs uppercase tracking-widest">الرقم التعريفي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                              {u.full_name.charAt(0)}
                            </div>
                            <span className="font-black text-gray-800">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                            u.role === 'professor' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role === 'admin' ? 'مسؤول' : u.role === 'professor' ? 'دكتور' : 'طالب'}
                          </span>
                        </td>
                        <td className="p-5 text-gray-500 font-medium" dir="ltr">{u.email}</td>
                        <td className="p-5 font-mono text-xs text-gray-400 font-bold">{u.student_id || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* التبويب الثاني: مكون ربط الطلاب بالمواد */}
        {activeTab === 'enrollment' && (
          <div className="animate-slide-in">
             <EnrollmentManager />
          </div>
        )}
      </div>

      {/* مودال إضافة مستخدم جديد */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-3xl font-black text-gray-800">بيانات الحساب</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X/></button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 mr-2 uppercase">الاسم الكامل</label>
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all font-bold" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 mr-2 uppercase">البريد الإلكتروني</label>
                <input type="email" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 mr-2 uppercase">كلمة المرور</label>
                <input type="password"  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 transition-all font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 mr-2 uppercase">الصلاحية</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-black text-blue-600" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="student">طالب</option>
                    <option value="professor">دكتور</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </div>
                {formData.role === 'student' && (
                  <div className="space-y-1 animate-in zoom-in duration-200">
                    <label className="text-xs font-black text-gray-400 mr-2 uppercase">الرقم الجامعي</label>
                    <input type="text" placeholder="ST-000" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold" value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} required />
                  </div>
                )}
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black text-lg mt-6 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">إنشاء الحساب فوراً</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Professor Dashboard ---

const ProfessorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', semester: 'Fall', academicYear: '2025/2026' });

  const fetchCourses = async () => {
    try {
      const res = await axios.get('/courses/');
      setCourses(res.data.data.courses);
    } catch (err) { console.error("Error fetching courses"); }
  };

  useEffect(() => { fetchCourses(); }, []);
  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المادة؟ سيتم حذف جميع السجلات المرتبطة بها!')) return;
    
    try {
      const res = await axios.delete(`/courses/${courseId}`);
      if (res.data.success) {
        // تحديث القائمة بعد الحذف
        setCourses(courses.filter(c => c.id !== courseId));
        alert('تم حذف المادة بنجاح');
      }
    } catch (err) {
      alert('فشل في حذف المادة');
    }
  };
  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/courses', newCourse);
      setShowAddModal(false);
      fetchCourses();
      setNewCourse({ courseCode: '', courseName: '', semester: 'Fall', academicYear: '2025/2026' });
    } catch (err) { alert("حدث خطأ أثناء الإضافة"); }
  };

  return (
    <DashboardLayout title="لوحة المحاضر">
      {!activeSession ? (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><BookOpen size={24}/></div>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">المواد الدراسية ({courses.length})</h2>
            </div>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black transition-all shadow-sm"
            >
              <Plus size={20}/>
              مادة جديدة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map(c => (
              <div key={c.id} className="group bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-blue-100 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-all"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-[1.5rem] transition-colors">
                    <BookOpen size={30}/>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black text-gray-400 block uppercase tracking-tighter">عدد المسجلين</span>
                    <span className="text-2xl font-black text-gray-900 leading-none">{c.student_count || 0}</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{c.course_name}</h3>
                <p className="text-blue-600 text-sm mb-6 font-black uppercase tracking-widest">{c.course_code}</p>
                
                <div className="flex gap-2 mb-8">
                  <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={10}/> {c.semester}
                  </span>
                  <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full text-gray-500 uppercase tracking-widest">
                    {c.academic_year}
                  </span>
                </div>

                <button 
                  onClick={() => setActiveSession(c)} 
                  className="w-full bg-gray-900 hover:bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg transition-all transform group-active:scale-95"
                >
                  بدأ تسجيل الحضور
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // لمنع فتح تفاصيل الكورس عند الضغط على حذف
                    handleDeleteCourse(c.id);
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="حذف المادة"
                >
                  <X size={20} /> {/* أو استخدم Trash من lucide-react لو متوفرة */}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in duration-500">
          <button 
            onClick={() => setActiveSession(null)} 
            className="mb-8 flex items-center gap-2 text-red-500 font-black bg-white border border-red-100 px-6 py-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
          >
            <X size={22}/>
            إنهاء الجلسة الحالية
          </button>
          <DynamicQRDisplay course={activeSession} />
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center mb-8 text-right">
              <h3 className="text-3xl font-black text-gray-800">مادة دراسية جديدة</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X/></button>
            </div>
            <form onSubmit={handleAddCourse} className="space-y-6 text-right">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase mr-1">اسم المادة بالكامل</label>
                <input type="text" placeholder="مثال: مقدمة في علوم الحاسب" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold" onChange={e => setNewCourse({...newCourse, courseName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase mr-1">كود المادة</label>
                <input type="text" placeholder="CS101" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-bold" onChange={e => setNewCourse({...newCourse, courseCode: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase mr-1">الفصل الدراسي</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black text-blue-600" onChange={e => setNewCourse({...newCourse, semester: e.target.value})}>
                    <option value="Fall">الخريف (Fall)</option>
                    <option value="Spring">الربيع (Spring)</option>
                    <option value="Summer">الصيف (Summer)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase mr-1">السنة الأكاديمية</label>
                  <input type="text" value="2025/2026" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-center" onChange={e => setNewCourse({...newCourse, academicYear: e.target.value})} required />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">حفظ المادة</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-400 py-5 rounded-[1.5rem] font-black">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

// --- Student Dashboard ---

const StudentDashboard = () => {
  const [myCourses, setMyCourses] = useState([]); // تغيير من activeSessions
  const [selectedCourseId, setSelectedCourseId] = useState(''); // تغيير من sessionId
  const [loading, setLoading] = useState(true);

  // جلب المواد المسجل فيها الطالب مباشرة
  useEffect(() => {
    const fetchMyCourses = async () => {
      try {
        // نستخدم الـ API الجديد الذي يجلب مواد الطالب (تأكد من وجود التوكن في headers)
        const response = await axios.get('http://192.168.1.4:5000/api/courses/my-courses', {
           headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.data.success) {
          const courses = response.data.courses || [];
          setMyCourses(courses);
          
          // اختيار أول مادة تلقائياً لتجهيز الكاميرا
          if (courses.length > 0) {
            setSelectedCourseId(courses[0].id);
          }
        }
      } catch (err) {
        console.error("❌ خطأ أثناء جلب المواد المسجلة:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyCourses();
  }, []);

  return (
    <DashboardLayout title="نظام الحضور الذكي">
      <div className="max-w-md mx-auto animate-in slide-in-from-bottom duration-700 p-4">
        
        <div className="mb-4 px-2 text-right">
          <h3 className="text-gray-800 font-black text-lg">تحضير المحاضرة</h3>
        </div>

        {/* اختيار المادة */}
        <div className="mb-6 bg-white p-5 rounded-3xl border-2 border-gray-50 shadow-xl shadow-blue-50/50">
          <label className="block text-xs font-black text-blue-500 mb-3 uppercase tracking-wider mr-1 text-right">
            اختر المادة التي تحضرها الآن:
          </label>
          
          {loading ? (
            <div className="h-12 bg-gray-100 animate-pulse rounded-xl"></div>
          ) : (
            <select 
              className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none font-bold text-gray-700 transition-all cursor-pointer text-right"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {myCourses.length > 0 ? (
                myCourses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.course_name} ({course.course_code})
                  </option>
                ))
              ) : (
                <option value="">🚫 لا توجد مواد مسجلة لك حالياً</option>
              )}
            </select>
          )}
        </div>

        {/* عرض السكنر بناءً على المادة المختارة */}
        <div className="relative">
          {selectedCourseId ? (
            <div className="animate-in zoom-in duration-500">
                {/* نمرر courseId بدلاً من sessionId للسكنر */}
               <StudentScanner courseId={selectedCourseId} />
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-gray-200 shadow-inner">
              <p className="text-gray-500 font-bold text-lg leading-relaxed">
                لا توجد مواد متاحة <br/>
                <span className="text-sm font-medium text-gray-400">تأكد من تسجيلك في المواد الدراسية</span>
              </p>
            </div>
          )}
        </div>
        
      </div>
    </DashboardLayout>
  );
};
// --- Login Page ---

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-6 font-sans" dir="rtl">
      <div className="w-full max-w-5xl grid md:grid-cols-2 bg-white rounded-[3rem] shadow-2xl overflow-hidden min-h-[600px] border border-white">
        
        {/* الجانب الأيسر - الصورة والترحيب */}
        <div className="hidden md:flex bg-gradient-to-br from-blue-600 to-indigo-900 p-12 flex-col justify-between relative overflow-hidden text-right">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/30 transform -rotate-12">
              <QrCode size={40} className="text-white"/>
            </div>
            <h2 className="text-5xl font-black text-white leading-tight mb-4">أهلاً بك في <br/>نظام راصد</h2>
            <p className="text-indigo-100 text-lg font-medium leading-relaxed max-w-sm">
              أسرع طريقة لتسجيل الحضور الأكاديمي باستخدام تقنية الكود المتغير ذو الحماية العالية.
            </p>
          </div>
          
          <div className="relative z-10 flex gap-10">
            <div>
              <p className="text-3xl font-black text-white leading-none">100%</p>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">حماية البيانات</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white leading-none">2.4s</p>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">سرعة المسح</p>
            </div>
          </div>
        </div>

        {/* الجانب الأيمن - نموذج الدخول */}
        <div className="p-10 md:p-16 flex flex-col justify-center text-right relative">
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><QrCode className="text-white" size={24}/></div>
            <h1 className="text-2xl font-black">راصد Rased</h1>
          </div>

          <h3 className="text-3xl font-black text-gray-800 mb-2">تسجيل الدخول</h3>
          <p className="text-gray-400 font-medium mb-10">الرجاء إدخال بيانات حسابك الموحد للوصول للخدمة</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-black border border-red-100 flex items-center gap-2 animate-shake">
                <AlertCircle size={18}/> {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">البريد الجامعي</label>
              <input 
                type="email" 
                placeholder="name@university.edu" 
                className="w-full p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] outline-none focus:ring-4 ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all font-bold text-lg" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">كلمة المرور</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] outline-none focus:ring-4 ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all font-bold text-lg" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-[1.5rem] font-black text-xl shadow-2xl shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading ? <Loader className="animate-spin"/> : "دخول للنظام"}
            </button>
          </form>
          
          <div className="mt-12 text-center">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">فريق تكنولوجيا المعلومات - 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/professor" element={<ProtectedRoute allowedRoles={['professor']}><ProfessorDashboard /></ProtectedRoute>} />
        <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;