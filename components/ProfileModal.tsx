
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';
import { 
    X, User as UserIcon, Shield, Activity, Key, Smartphone, 
    Save, Camera, LogOut, CheckCircle2, AlertTriangle, Clock, MapPin, Globe
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
  initialTab?: 'profile' | 'security' | 'sessions';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onUpdate, onLogout, initialTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions'>(initialTab);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Password State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [passMessage, setPassMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
        setFormData(user);
        setIsEditing(false);
        setPassMessage(null);
        setPasswords({ current: '', new: '', confirm: '' });
        setActiveTab(initialTab);
    }
  }, [isOpen, user, initialTab]);

  if (!isOpen) return null;

  const handleSaveProfile = async () => {
      setIsSaving(true);
      // Simulate network delay
      await new Promise(r => setTimeout(r, 800));
      const updated = authService.updateProfile(formData);
      onUpdate(updated);
      setIsEditing(false);
      setIsSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwords.new !== passwords.confirm) {
          setPassMessage({ type: 'error', text: 'Passwords do not match' });
          return;
      }
      if (passwords.new.length < 8) {
        setPassMessage({ type: 'error', text: 'Password must be at least 8 characters' });
        return;
      }
      
      setIsSaving(true);
      await authService.changePassword(passwords.current, passwords.new);
      setIsSaving(false);
      setPassMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswords({ current: '', new: '', confirm: '' });
      setTimeout(() => setPassMessage(null), 3000);
  };

  const sessions = authService.getSessions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
       <div className="bg-app-panel border border-border rounded-2xl w-full max-w-4xl max-h-[95vh] shadow-2xl overflow-hidden flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
          
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-app-primary border-b md:border-b-0 md:border-r border-border p-4 sm:p-6 flex flex-col shrink-0">
             <div className="flex flex-row md:flex-col items-center mb-4 md:mb-8 gap-4 md:gap-0">
                <div className="relative group cursor-pointer md:mb-4 shrink-0">
                    <img src={formData.avatarUrl || user.avatarUrl} alt="Profile" className="w-12 h-12 md:w-24 md:h-24 rounded-full object-cover border-2 md:border-4 border-border shadow-xl" />
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={16} />
                    </div>
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                    <h3 className="text-white font-bold text-sm md:text-base md:text-center truncate">{user.fullName}</h3>
                    <div className="md:flex md:justify-center mt-1">
                        <span className="text-[10px] text-cyan-400 font-mono px-2 py-0.5 bg-cyan-950/30 rounded border border-cyan-900/50 uppercase">{user.role}</span>
                    </div>
                </div>
             </div>

             <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 custom-scrollbar scrollbar-none">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-[11px] md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-text-secondary hover:text-white hover:bg-app-panel'}`}
                >
                    <UserIcon size={16} /> <span className="hidden xs:inline">Profil</span><span className="xs:hidden">Profil</span>
                </button>
                <button 
                    onClick={() => setActiveTab('security')}
                    className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-[11px] md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'security' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-text-secondary hover:text-white hover:bg-app-panel'}`}
                >
                    <Shield size={16} /> <span className="hidden xs:inline">Xavfsizlik</span><span className="xs:hidden">Xavf...</span>
                </button>
                <button 
                    onClick={() => setActiveTab('sessions')}
                    className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-[11px] md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'sessions' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-text-secondary hover:text-white hover:bg-app-panel'}`}
                >
                    <Activity size={16} /> <span className="hidden xs:inline">Sessiyalar</span><span className="xs:hidden">Sess...</span>
                </button>
             </nav>

             <div className="hidden md:block pt-6 border-t border-slate-900 mt-auto">
                 <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-950/20 transition-colors"
                 >
                    <LogOut size={18} /> Chiqish
                 </button>
             </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-app-panel p-4 sm:p-8 overflow-y-auto custom-scrollbar relative min-h-0">
             <button onClick={onClose} className="absolute top-4 sm:top-6 right-4 sm:right-6 text-text-primary0 hover:text-white transition-colors">
                <X size={20} className="sm:w-6 sm:h-6" />
             </button>

             {/* PROFILE TAB */}
             {activeTab === 'profile' && (
                <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Mening Profilim</h2>
                        <p className="text-text-secondary text-xs sm:text-sm">Shaxsiy ma'lumotlaringizni boshqaring.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">To'liq Ism</label>
                                <input 
                                    type="text" 
                                    disabled={!isEditing}
                                    value={formData.fullName || ''}
                                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                                    className="w-full bg-app-primary border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary disabled:opacity-50 disabled:cursor-not-allowed focus:border-cyan-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Xodim ID</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={user.id} 
                                    className="w-full bg-app-primary border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary0 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Email Manzili</label>
                            <input 
                                type="email" 
                                disabled={!isEditing}
                                value={formData.email || ''}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-app-primary border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary disabled:opacity-50 focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Bo'lim</label>
                                <input type="text" disabled value={user.department} className="w-full bg-app-primary border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary0 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-primary0 uppercase mb-1 tracking-wider">Tizim Roli</label>
                                <input type="text" disabled value={user.role} className="w-full bg-app-primary border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary0 cursor-not-allowed" />
                            </div>
                        </div>

                        <div className="bg-app-primary border border-border rounded-xl p-3 sm:p-4 mt-2">
                             <div className="flex items-center gap-2 text-text-secondary text-[10px] sm:text-xs font-bold mb-2 uppercase tracking-wider">
                                <Shield size={14} className="text-emerald-400" /> RBAC Ruxsatlar
                             </div>
                             <div className="flex flex-wrap gap-1.5">
                                 {user.permissions?.map(perm => (
                                     <span key={perm} className="px-2 py-0.5 bg-app-panel border border-border rounded text-[9px] sm:text-[10px] text-text-secondary font-mono">
                                         {perm}
                                     </span>
                                 ))}
                             </div>
                        </div>
                    </div>

                    <div className="pt-4 sm:pt-6 border-t border-border flex flex-col sm:flex-row justify-end gap-3">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="w-full sm:w-auto px-6 py-2.5 bg-app-surface text-white rounded-lg hover:bg-app-surface text-sm font-medium transition-colors">Profilni Tahrirlash</button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => { setIsEditing(false); setFormData(user); }} className="flex-1 sm:flex-none px-4 py-2.5 text-sm text-text-secondary hover:text-white transition-colors">Bekor qilish</button>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="flex-2 sm:flex-none px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-cyan-500/20">
                                    {isSaving ? 'Saqlanmoqda...' : <><Save size={16} /> Saqlash</>}
                                </button>
                            </div>
                        )}
                        <button 
                            onClick={onLogout}
                            className="md:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-rose-400 border border-rose-400/20 mt-2"
                        >
                            <LogOut size={16} /> Chiqish
                        </button>
                    </div>
                </div>
             )}

             {/* SECURITY TAB */}
             {activeTab === 'security' && (
                 <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Xavfsizlik Sozlamalari</h2>
                        <p className="text-text-secondary text-xs sm:text-sm">Parolni yangilang va 2FA boshqaring.</p>
                    </div>

                    <form onSubmit={handlePasswordChange} className="bg-app-primary border border-border rounded-xl p-4 sm:p-6 space-y-4">
                        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                            <Key size={18} className="text-cyan-400"/> Parolni O'zgartirish
                        </h3>
                        
                        <div className="space-y-3">
                            <input 
                                type="password" 
                                placeholder="Joriy parol"
                                value={passwords.current}
                                onChange={e => setPasswords({...passwords, current: e.target.value})}
                                className="w-full bg-app-panel border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary focus:border-cyan-500 outline-none transition-all"
                            />
                             <input 
                                type="password" 
                                placeholder="Yangi parol"
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                                className="w-full bg-app-panel border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary focus:border-cyan-500 outline-none transition-all"
                            />
                             <input 
                                type="password" 
                                placeholder="Yangi parolni tasdiqlang"
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                className="w-full bg-app-panel border border-border rounded-lg p-2.5 sm:p-3 text-sm text-text-primary focus:border-cyan-500 outline-none transition-all"
                            />
                        </div>

                        {passMessage && (
                            <div className={`text-[11px] sm:text-xs p-3 rounded flex items-center gap-2 ${passMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {passMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {passMessage.text}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button type="submit" disabled={isSaving || !passwords.current} className="w-full sm:w-auto px-4 py-2.5 bg-app-surface hover:bg-app-surface text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                                {isSaving ? 'Yangilanmoqda...' : 'Parolni Yangilash'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-app-primary border border-border rounded-xl p-4 sm:p-6 flex justify-between items-center opacity-75 grayscale hover:grayscale-0 transition-all">
                         <div className="flex-1 pr-4">
                            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mb-1">
                                <Smartphone size={18} className="text-purple-400"/> Ikki Bosqichli Kirish
                            </h3>
                            <p className="text-[10px] sm:text-xs text-text-primary0">Tashkilot siyosati bo'yicha hozirda faollashtirib bo'lmaydi.</p>
                         </div>
                         <div className="w-10 h-5 sm:w-12 sm:h-6 bg-app-surface rounded-full relative cursor-not-allowed shrink-0">
                             <div className="w-3 h-3 sm:w-4 sm:h-4 bg-slate-600 rounded-full absolute top-1 left-1"></div>
                         </div>
                    </div>
                 </div>
             )}

             {/* SESSIONS TAB */}
             {activeTab === 'sessions' && (
                 <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Faol Sessiyalar</h2>
                        <p className="text-text-secondary text-xs sm:text-sm">Hisobingizga kirgan qurilmalarni boshqaring.</p>
                    </div>

                    <div className="space-y-3">
                        {sessions.map(sess => (
                            <div key={sess.id} className="bg-app-primary border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                                <div className={`p-2 sm:p-3 rounded-full shrink-0 ${sess.isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-app-panel text-text-primary0'}`}>
                                    {sess.device.includes('Mobile') ? <Smartphone size={18} /> : <Activity size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs sm:text-sm font-bold text-text-primary truncate">{sess.device}</h4>
                                        {sess.isCurrent && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">Hozirgi</span>}
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-text-primary0 flex items-center gap-1 mt-0.5 truncate">
                                        <Globe size={10} /> {sess.ip} • {sess.location}
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] text-text-muted mt-1 flex items-center gap-1 whitespace-nowrap"><Clock size={10} /> Oxirgi faollik: {sess.lastActive}</p>
                                </div>
                                {!sess.isCurrent && (
                                    <button 
                                        onClick={() => authService.revokeSession(sess.id)}
                                        className="text-[10px] sm:text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-2 sm:px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0"
                                    >
                                        Yopish
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-3 sm:p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl flex gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                        <div>
                            <h4 className="text-xs sm:text-sm font-bold text-amber-500">Xavfsizlik maslahati</h4>
                            <p className="text-[10px] sm:text-xs text-amber-400/80">Notanish qurilmani ko'rsangiz, sessiyani darhol yoping va parolingizni o'zgartiring.</p>
                        </div>
                    </div>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};
