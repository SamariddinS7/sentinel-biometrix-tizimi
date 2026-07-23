
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { userService } from '../services/userService';
import { insightFaceService } from '../services/insightFaceService';
import { UserRole, User } from '../types';
import { analyzeBiometricFrame, BiometricAnalysisResult } from '../services/geminiService';
import { MoreHorizontal, Plus, Search, Fingerprint, X, User as UserIcon, Camera, Upload, CheckCircle2, Loader2, RefreshCw, AlertCircle, Film, Image as ImageIcon, Trash2, ShieldAlert, Sparkles, ScanFace, LayoutList, UserX, Eye } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { PersonNameLink, usePersonProfile } from '../context/PersonProfileContext';

// ── Anonymous/Unknown Persons Panel ─────────────────────────────────────────

interface AnonProfile {
  personId: string;
  fullName: string;
  status: string;
  firstSeen: string;
  lastSeen: string;
  lastCameraId: string;
  totalDetections: number;
  currentlyPresent: boolean;
}

const UnknownPersonsPanel: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
  const [persons, setPersons] = useState<AnonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { openProfile } = usePersonProfile();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/persons?status=ANONYMOUS&limit=200');
      if (r.ok) {
        const j = await r.json();
        setPersons(j?.data?.profiles ?? []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return persons.filter(p =>
      p.personId.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      (p.lastCameraId ?? '').toLowerCase().includes(q),
    );
  }, [persons, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mr-2 text-cyan-500" />
        <span className="text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  return (
    <div className="bg-app-panel shadow-sm rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-app-primary/60">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <UserX size={14} className="text-amber-400" />
          <span>Kamerada aniqlangan, lekin ro'yxatda yo'q shaxslar</span>
        </div>
        <button onClick={load} className="p-1.5 rounded hover:bg-white/10 text-text-muted hover:text-white transition-all">
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm min-w-[600px]">
          <thead className="bg-app-primary border-b border-border">
            <tr>
              <th className="px-6 py-3 font-semibold text-text-secondary whitespace-nowrap">ID / Ism</th>
              <th className="px-6 py-3 font-semibold text-text-secondary whitespace-nowrap">Birinchi ko'ringan</th>
              <th className="px-6 py-3 font-semibold text-text-secondary whitespace-nowrap">Oxirgi kamera</th>
              <th className="px-6 py-3 font-semibold text-text-secondary whitespace-nowrap">Aniqlashlar</th>
              <th className="px-6 py-3 font-semibold text-text-secondary whitespace-nowrap">Holat</th>
              <th className="px-6 py-3 font-semibold text-text-secondary text-right">Profil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.personId} className="hover:bg-app-surface/40 transition-colors group">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <UserX size={14} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{p.fullName}</p>
                      <p className="text-[10px] font-mono text-text-muted">{p.personId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-text-secondary text-xs whitespace-nowrap">
                  {p.firstSeen ? new Date(p.firstSeen).toLocaleString('uz-UZ') : '—'}
                </td>
                <td className="px-6 py-3 text-text-secondary text-xs whitespace-nowrap font-mono">
                  {p.lastCameraId || '—'}
                </td>
                <td className="px-6 py-3">
                  <span className="text-cyan-400 font-bold tabular-nums">{p.totalDetections ?? 0}×</span>
                </td>
                <td className="px-6 py-3">
                  {p.currentlyPresent ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />JONLI
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      ANONIM
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => openProfile(p.personId)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-cyan-500/10 text-text-muted hover:text-cyan-400"
                    title="Profilni ko'rish"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <UserX size={28} className="opacity-20" />
                    <p className="text-sm">
                      {searchQuery
                        ? "Qidiruv bo'yicha noma'lum shaxs topilmadi."
                        : "Hali hech qanday noma'lum shaxs aniqlanmagan."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

export const UserManagement: React.FC<{ globalSearchTerm?: string }> = ({ globalSearchTerm }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'staff' | 'unknown'>('staff');
  const { language, t } = useLanguage();
  const { openProfile } = usePersonProfile();

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await userService.getAllUsers();
        setUsers(users || []);
      } catch (e) {
        console.error("Failed to load users:", e);
        setUsers([]);
      }
    };
    loadUsers();
    insightFaceService.loadModels();
  }, []);

  useEffect(() => {
    if (typeof globalSearchTerm === 'string') {
        setSearchQuery(globalSearchTerm);
    }
  }, [globalSearchTerm]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rescanUser, setRescanUser] = useState<User | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    role: UserRole.EMPLOYEE,
    department: '',
    id: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: boolean}>({});

  // Biometric State
  const [biometricImage, setBiometricImage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{url: string, type: 'image' | 'video'}[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [faceMetadata, setFaceMetadata] = useState<BiometricAnalysisResult | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (value) setFormErrors(prev => ({ ...prev, [name]: false }));
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Kameraga kirish imkoni bo'lmadi. Ruxsatlarni tekshiring.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      const img = new Image();
      img.src = base64;
      img.onload = async () => {
         setBiometricImage(base64);
         setUploadedFiles([{ url: base64, type: 'image' }]);
         stopCamera();
         await processFaceData(base64, img);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const files = Array.from(e.target.files || []) as File[];
     if (files.length === 0) return;
     const base64 = URL.createObjectURL(files[0]);
     setBiometricImage(base64);
     
     const img = new Image();
     img.src = base64;
     img.onload = async () => {
         await processFaceData(base64, img); // In real app, convert Blob to Base64 string for API
     }
  };

  const processFaceData = async (base64: string, imgElement: HTMLImageElement) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
        // Step 1: Local / Edge Vector Encoding
        setModelLoading(true);
        await insightFaceService.loadModels();
        const descriptor = await insightFaceService.getDescriptor(imgElement);
        setModelLoading(false);
        
        if (descriptor) {
            setFaceDescriptor(Array.from(descriptor));
            
            // Step 2: Cloud AI Analysis (Gemini)
            const result = await analyzeBiometricFrame(base64, language);
            if (result) {
                setFaceMetadata(result);
            } else {
               // Fallback if API fails but detection worked
               setAnalysisError("AI Tahlil mavjud emas. Vektor muvaffaqiyatli kodlandi.");
            }
        } else {
            setAnalysisError("Yuz aniqlanmadi. Iltimos, aniqroq rasm bilan urinib ko'ring.");
        }
    } catch (e) {
        console.error(e);
        setAnalysisError("Tahlil jarayonida xatolik. Tarmoqni tekshiring.");
    } finally {
        setIsAnalyzing(false);
        setModelLoading(false);
    }
  };

  const resetBiometrics = () => {
    setBiometricImage(null);
    setUploadedFiles([]);
    setFaceMetadata(null);
    setFaceDescriptor(null);
    setAnalysisError(null);
    stopCamera();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return;

    const finalId = formData.id.trim() || `U-${Math.floor(100000 + Math.random() * 900000)}`;
    const newUser: User = {
      id: finalId,
      fullName: formData.fullName,
      role: formData.role as UserRole,
      department: formData.department,
      enrolledDate: new Date().toISOString().split('T')[0],
      hasEmbedding: !!faceDescriptor,
      lastActive: 'Hozirgina',
      avatarUrl: biometricImage || `https://ui-avatars.com/api/?name=${formData.fullName.replace(' ', '+')}`,
      faceDescriptor: faceDescriptor || undefined
    };
    await userService.saveUser(newUser);
    const updatedUsers = await userService.getAllUsers();
    setUsers(updatedUsers || []);
    closeModal();
  };

  const handleDeleteUser = async (userId: string) => {
      // GDPR Right-to-Erasure simulation
      if (confirm("⚠️ QAYTARIB BO'LMAYDIGAN HARAKAT\n\nHaqiqatan ham bu foydalanuvchini BUTUNLAY o'chirib tashlamoqchimisiz?\nBu barcha biometrik shablonlar va kirish jurnallarini o'chirib yuboradi.")) {
          await userService.deleteUser(userId);
          const updatedUsers = await userService.getAllUsers();
          setUsers(updatedUsers || []);
      }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ fullName: '', role: UserRole.EMPLOYEE, department: '', id: '' });
    resetBiometrics();
  };

  const handleUpdateBiometrics = async () => {
    if (!rescanUser || !faceDescriptor) return;

    const updatedUser: User = {
      ...rescanUser,
      hasEmbedding: true,
      faceDescriptor: faceDescriptor,
      avatarUrl: biometricImage || rescanUser.avatarUrl
    };

    await userService.saveUser(updatedUser);
    const updatedUsers = await userService.getAllUsers();
    setUsers(updatedUsers || []);
    setRescanUser(null);
    resetBiometrics();
  };

  return (
    <div className="h-full overflow-y-auto pr-1 custom-scrollbar pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Foydalanuvchilarni Boshqarish</h2>
        <div className="flex gap-2">
            {activeTab === 'staff' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                Yangi Xodim Qo'shish
              </button>
            )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border gap-1">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'staff'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <UserIcon size={14} />
          Xodimlar ro'yxati
        </button>
        <button
          onClick={() => setActiveTab('unknown')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'unknown'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <UserX size={14} />
          Noma'lum shaxslar
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-primary0" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'staff' ? "Ism, ID yoki bo'lim bo'yicha qidirish..." : "ID yoki kamera bo'yicha qidirish..."}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-app-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent placeholder:text-text-muted"
            />
        </div>
      </div>

      {activeTab === 'unknown' && <UnknownPersonsPanel searchQuery={searchQuery} />}

      {activeTab === 'staff' && (
        <div className="bg-app-panel shadow-sm rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-app-primary border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold text-text-secondary whitespace-nowrap">Shaxs</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary whitespace-nowrap">Rol</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary whitespace-nowrap">Bo'lim</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary whitespace-nowrap">Biometrik Holat</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary whitespace-nowrap">Qo'shilgan Sana</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-app-surface/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full bg-app-surface object-cover border border-border shrink-0" />
                        <div className="min-w-0">
                          <PersonNameLink personId={user.id} name={user.fullName} className="font-medium text-text-primary truncate block" />
                          <p className="text-xs text-text-primary0 truncate">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border whitespace-nowrap
                        ${user.role === UserRole.ADMIN ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          user.role === UserRole.OPERATOR ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-app-surface text-text-secondary border-border'}
                      `}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary whitespace-nowrap">{user.department}</td>
                    <td className="px-6 py-4">
                      {user.hasEmbedding ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 whitespace-nowrap">
                          <Fingerprint className="w-4 h-4" />
                          <span className="text-xs font-medium">Vektor Kodlangan</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-text-primary0 whitespace-nowrap">
                          <Fingerprint className="w-4 h-4" />
                          <span className="text-xs">Kiritilmagan</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-primary0 whitespace-nowrap">{user.enrolledDate}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openProfile(user.id)}
                          className="text-text-primary0 hover:text-cyan-400 p-2 hover:bg-cyan-950/30 rounded"
                          title="Atribut Profilini Ko'rish"
                        >
                          <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-text-primary0 hover:text-red-400 p-2 hover:bg-red-950/30 rounded"
                          title="Shaxsni Unutish (GDPR Erasure)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRescanUser(user)}
                          className="text-text-primary0 hover:text-cyan-400 p-2 hover:bg-cyan-950/30 rounded"
                          title="Yuzni Qayta Skanerlash"
                        >
                          <ScanFace className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-primary0">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search size={24} className="opacity-20" />
                        <p>Sizning so'rovingiz bo'yicha hech kim topilmadi.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rescanUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-app-panel border border-border rounded-xl w-full max-w-xl max-h-[95vh] overflow-y-auto shadow-2xl scale-100 animate-in zoom-in-95 duration-200 flex flex-col custom-scrollbar">
             <div className="px-4 sm:px-6 py-4 border-b border-border flex justify-between items-center bg-app-primary sticky top-0 z-10 shrink-0">
               <div className="flex items-center gap-2 min-w-0">
                 <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                    <ScanFace size={18} />
                 </div>
                 <h3 className="font-bold text-white truncate">Yuzni Yangilash: {rescanUser.fullName}</h3>
               </div>
               <button onClick={() => { setRescanUser(null); resetBiometrics(); }} className="p-2 text-text-secondary hover:text-white transition-colors shrink-0">
                 <X size={20}/>
               </button>
             </div>
             
             <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="bg-app-primary rounded-xl border border-border p-3 sm:p-4 flex flex-col">
                    <div className="mb-3 flex items-center justify-between">
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Jonli Biometrik Yangilash</label>
                        {biometricImage && (
                            <button type="button" onClick={resetBiometrics} className="text-xs text-red-400 hover:text-red-300">Qayta urinish</button>
                        )}
                    </div>

                    <div className="flex-1 bg-app-panel rounded-lg border-2 border-dashed border-border relative overflow-hidden flex flex-col items-center justify-center min-h-[250px] sm:min-h-[300px]">
                        {!biometricImage && !isCameraOpen && (
                            <div className="text-center p-4">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-app-surface rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-400 animate-pulse">
                                    <ScanFace size={28} />
                                </div>
                                <p className="text-sm text-text-primary mb-4 max-w-[200px] mx-auto">Modelni yangilash uchun kamerani oching.</p>
                                <button type="button" onClick={startCamera} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all mx-auto shadow-lg shadow-cyan-500/20">
                                    <Camera size={16} /> Skanerlash
                                </button>
                            </div>
                        )}

                        {isCameraOpen && (
                            <div className="absolute inset-0 bg-black flex flex-col">
                                <video ref={videoRef} autoPlay playsInline muted className="flex-1 w-full object-cover" />
                                <div className="p-4 bg-black/80 backdrop-blur flex justify-center gap-4">
                                    <button type="button" onClick={stopCamera} className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white transition-colors">Bekor qilish</button>
                                    <button type="button" onClick={capturePhoto} className="px-6 py-2 rounded-lg bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/30">Skanerlash</button>
                                </div>
                                {/* Scanning Effect */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    <div className="w-full h-1 bg-cyan-400/50 absolute top-0 animate-[scan_3s_linear_infinite]"></div>
                                </div>
                                <style>{`
                                    @keyframes scan {
                                        0% { top: 0; }
                                        100% { top: 100%; }
                                    }
                                `}</style>
                            </div>
                        )}

                        {biometricImage && (
                            <div className="absolute inset-0 w-full h-full">
                                <img src={biometricImage} alt="Preview" className="w-full h-full object-cover opacity-40" />
                                
                                <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                                    {(isAnalyzing || modelLoading) ? (
                                        <div className="flex flex-col items-center gap-4 text-cyan-400 bg-app-primary/90 p-6 sm:p-8 rounded-2xl border border-cyan-500/30 backdrop-blur-xl shadow-2xl">
                                            <Loader2 size={40} className="animate-spin" />
                                            <div className="text-center">
                                                <p className="text-base sm:text-lg font-bold animate-pulse">BIOMETRIK TAHLIL</p>
                                                <p className="text-[10px] sm:text-xs text-text-secondary mt-1">{modelLoading ? "Vektorlar hisoblanmoqda..." : "Gemini AI tekshirmoqda..."}</p>
                                            </div>
                                        </div>
                                    ) : faceMetadata ? (
                                        <div className="w-full max-w-sm bg-app-primary/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-cyan-500/30 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                                            <div className="flex items-center justify-between border-b border-border pb-3">
                                                <span className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-2">
                                                    <CheckCircle2 size={16} /> Muvaffaqiyatli
                                                </span>
                                                <span className="text-[9px] sm:text-[10px] text-text-secondary font-mono bg-app-surface px-2 py-0.5 rounded border border-border">
                                                    99.8% ANIQLIK
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-app-surface p-2 sm:p-3 rounded-xl border border-border/50">
                                                    <span className="text-[9px] sm:text-[10px] text-text-primary0 block uppercase tracking-wider">Yosh</span>
                                                    <span className="text-xs sm:text-sm text-text-primary font-mono font-bold">{faceMetadata.estimatedAge}</span>
                                                </div>
                                                <div className="bg-app-surface p-2 sm:p-3 rounded-xl border border-border/50">
                                                    <span className="text-[9px] sm:text-[10px] text-text-primary0 block uppercase tracking-wider">Ifoda</span>
                                                    <span className="text-xs sm:text-sm text-text-primary font-bold">{faceMetadata.expression}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                                                    <span>Jonlilik</span>
                                                    <span className="text-emerald-400">{(faceMetadata.livenessConfidence * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-app-surface rounded-full overflow-hidden border border-border/30">
                                                    <div 
                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                                                        style={{ width: `${faceMetadata.livenessConfidence * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : analysisError ? (
                                        <div className="bg-red-950/90 backdrop-blur-xl border border-red-500/30 p-4 sm:p-6 rounded-2xl flex flex-col items-center text-center gap-3 text-red-200 shadow-2xl">
                                            <AlertCircle size={28} className="text-red-500" />
                                            <div>
                                                <p className="font-bold text-sm">Skanerlashda xatolik</p>
                                                <p className="text-[10px] text-red-300/70 mt-1">{analysisError}</p>
                                            </div>
                                            <button onClick={resetBiometrics} className="mt-2 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded-lg text-[10px] font-bold transition-colors">Qayta urinish</button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 shrink-0">
                    <button 
                        type="button" 
                        onClick={() => { setRescanUser(null); resetBiometrics(); }} 
                        className="px-4 sm:px-5 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-app-surface transition-colors"
                    >
                        Bekor qilish
                    </button>
                    <button 
                        onClick={handleUpdateBiometrics}
                        disabled={isAnalyzing || modelLoading || !faceDescriptor}
                        className="px-6 sm:px-8 py-2.5 rounded-lg text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                        {isAnalyzing ? "Tahlil..." : "Yangilash"}
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-app-panel border border-border rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl scale-100 animate-in zoom-in-95 duration-200 custom-scrollbar flex flex-col">
             <div className="px-4 sm:px-6 py-4 border-b border-border flex justify-between items-center bg-app-primary sticky top-0 z-10 shrink-0">
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                    <UserIcon size={18} />
                 </div>
                 <h3 className="font-bold text-white text-sm sm:text-base">Yangi Xodim Ro'yxatdan O'tkazish</h3>
               </div>
               <button onClick={closeModal} className="p-2 text-text-secondary hover:text-white transition-colors shrink-0">
                 <X size={20}/>
               </button>
             </div>
             
             <form onSubmit={handleRegister} className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">To'liq Ism (F.I.Sh) *</label>
                            <input 
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                type="text" 
                                className={`w-full bg-app-primary border rounded-lg px-4 py-2.5 text-text-primary text-sm focus:ring-1 outline-none transition-all placeholder:text-text-muted ${formErrors.fullName ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-cyan-500 focus:border-cyan-500'}`}
                                placeholder="masalan, Sarvar Komilov"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Xodim ID</label>
                                <input 
                                    name="id"
                                    value={formData.id}
                                    onChange={handleInputChange}
                                    type="text" 
                                    className="w-full bg-app-primary border border-border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all placeholder:text-text-muted"
                                    placeholder="Avto-yaratish"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Bo'lim *</label>
                                <input 
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    type="text" 
                                    list="departments"
                                    className={`w-full bg-app-primary border rounded-lg px-3 py-2.5 text-text-primary text-sm focus:ring-1 outline-none transition-all placeholder:text-text-muted ${formErrors.department ? 'border-red-500 focus:ring-red-500' : 'border-border focus:ring-cyan-500 focus:border-cyan-500'}`}
                                    placeholder="Xavfsizlik"
                                />
                                <datalist id="departments">
                                    <option value="Xavfsizlik" />
                                    <option value="IT" />
                                    <option value="HR" />
                                    <option value="Operatsiyalar" />
                                </datalist>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] sm:text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Tizim Roli</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[UserRole.EMPLOYEE, UserRole.OPERATOR, UserRole.ADMIN].map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, role }))}
                                        className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold border transition-all truncate px-1 ${
                                            formData.role === role 
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' 
                                            : 'bg-app-primary border-border text-text-primary0 hover:bg-app-surface'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-app-primary rounded-xl border border-border p-3 sm:p-4 flex flex-col">
                        <div className="mb-3 flex items-center justify-between">
                            <label className="block text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-wider">Yuz Biometriyasi</label>
                            {biometricImage && (
                                <button type="button" onClick={resetBiometrics} className="text-[10px] text-red-400 hover:text-red-300">Bekor qilish</button>
                            )}
                        </div>

                        <div className="flex-1 bg-app-panel rounded-lg border-2 border-dashed border-border relative overflow-hidden flex flex-col items-center justify-center min-h-[200px] sm:min-h-[250px]">
                            
                            {!biometricImage && !isCameraOpen && (
                                <div className="text-center p-3 sm:p-4">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-app-surface rounded-full flex items-center justify-center mx-auto mb-3 text-text-primary0">
                                        <UserIcon size={28} />
                                    </div>
                                    <div className="flex gap-2 justify-center">
                                        <button type="button" onClick={startCamera} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors">
                                            <Camera size={14} /> Kamera
                                        </button>
                                        <label className="px-3 py-2 bg-app-surface hover:bg-app-surface text-text-secondary rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-border">
                                            <Upload size={14} /> Fayl
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                    <p className="mt-3 text-[9px] sm:text-[10px] text-text-primary0 px-2 leading-relaxed">JPG, PNG (Maks 10MB)</p>
                                </div>
                            )}

                            {isCameraOpen && (
                                <div className="absolute inset-0 bg-black flex flex-col">
                                    <video ref={videoRef} autoPlay playsInline muted className="flex-1 w-full object-cover" />
                                    <div className="p-3 bg-black flex justify-center gap-3">
                                        <button type="button" onClick={stopCamera} className="px-3 py-1.5 rounded text-[10px] font-medium text-text-secondary hover:text-white">Bekor</button>
                                        <button type="button" onClick={capturePhoto} className="px-4 py-1.5 rounded bg-white text-black text-[10px] font-bold">Rasmga Olish</button>
                                    </div>
                                </div>
                            )}

                            {biometricImage && (
                                <div className="absolute inset-0 w-full h-full">
                                    <img src={biometricImage} alt="Preview" className="w-full h-full object-cover opacity-60" />
                                    
                                    {/* Analysis Result Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                                        {(isAnalyzing || modelLoading) ? (
                                            <div className="flex items-center gap-3 text-cyan-400 bg-app-primary/80 p-2 sm:p-3 rounded-lg border border-border backdrop-blur-md">
                                                <Loader2 size={16} className="animate-spin shrink-0" />
                                                <span className="text-[10px] sm:text-xs font-bold animate-pulse">
                                                    {modelLoading ? "Kodlanmoqda..." : "Tahlil qilinmoqda..."}
                                                </span>
                                            </div>
                                        ) : faceMetadata ? (
                                            <div className="w-full bg-app-primary/80 backdrop-blur-md p-2 sm:p-3 rounded-lg border border-border space-y-2 animate-in slide-in-from-bottom-4">
                                                <div className="flex items-center justify-between border-b border-border pb-2">
                                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                                        <Sparkles size={10} /> Gemini AI
                                                    </span>
                                                    <span className="text-[9px] text-text-secondary font-mono flex items-center gap-1 uppercase">
                                                        Vektor Ok
                                                    </span>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-2 text-[9px]">
                                                    <div className="bg-app-surface p-1 rounded">
                                                        <span className="text-text-primary0 block">Yosh</span>
                                                        <span className="text-text-primary font-mono">{faceMetadata.estimatedAge}</span>
                                                    </div>
                                                    <div className="bg-app-surface p-1 rounded">
                                                        <span className="text-text-primary0 block">Ifoda</span>
                                                        <span className="text-text-primary truncate">{faceMetadata.expression}</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="h-1 w-full bg-app-surface rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${faceMetadata.livenessConfidence > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                                            style={{ width: `${faceMetadata.livenessConfidence * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : analysisError ? (
                                            <div className="bg-red-950/90 backdrop-blur border border-red-900 p-2 rounded-lg flex items-center gap-1.5 text-red-200 text-[10px] animate-in slide-in-from-bottom-2">
                                                <AlertCircle size={12} className="shrink-0" />
                                                <span className="truncate">{analysisError}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3 shrink-0">
                    <button 
                        type="button" 
                        onClick={closeModal} 
                        className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-app-surface transition-colors"
                    >
                        Bekor qilish
                    </button>
                    <button 
                        type="submit"
                        disabled={isAnalyzing || modelLoading || (!biometricImage && !formData.fullName)}
                        className="px-6 py-2 rounded-lg text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Ro'yxatdan O'tkazish
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
