
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
       <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]" onClick={e => e.stopPropagation()}>
          
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col">
             <div className="flex flex-col items-center mb-8">
                <div className="relative group cursor-pointer mb-4">
                    <img src={formData.avatarUrl || user.avatarUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-xl" />
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={24} />
                    </div>
                </div>
                <h3 className="text-white font-bold text-center">{user.fullName}</h3>
                <span className="text-xs text-cyan-400 font-mono mt-1 px-2 py-0.5 bg-cyan-950/30 rounded border border-cyan-900/50">{user.role}</span>
             </div>

             <nav className="flex-1 space-y-1">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                    <UserIcon size={18} /> Profile Details
                </button>
                <button 
                    onClick={() => setActiveTab('security')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                    <Shield size={18} /> Security & Auth
                </button>
                <button 
                    onClick={() => setActiveTab('sessions')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sessions' ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                >
                    <Activity size={18} /> Active Sessions
                </button>
             </nav>

             <div className="pt-6 border-t border-slate-900">
                 <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-950/20 transition-colors"
                 >
                    <LogOut size={18} /> Sign Out
                 </button>
             </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-900 p-8 overflow-y-auto custom-scrollbar relative">
             <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                <X size={24} />
             </button>

             {/* PROFILE TAB */}
             {activeTab === 'profile' && (
                <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">My Profile</h2>
                        <p className="text-slate-400 text-sm">Manage your personal information and preferences.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    disabled={!isEditing}
                                    value={formData.fullName}
                                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:border-cyan-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee ID</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={user.id} 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                            <input 
                                type="email" 
                                disabled={!isEditing}
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 disabled:opacity-50 focus:border-cyan-500 outline-none transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                                <input type="text" disabled value={user.department} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Role</label>
                                <input type="text" disabled value={user.role} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-500 cursor-not-allowed" />
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-2">
                             <div className="flex items-center gap-2 text-slate-300 text-sm font-bold mb-2">
                                <Shield size={16} className="text-emerald-400" /> RBAC Permissions
                             </div>
                             <div className="flex flex-wrap gap-2">
                                 {user.permissions?.map(perm => (
                                     <span key={perm} className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-400 font-mono">
                                         {perm}
                                     </span>
                                 ))}
                             </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors">Edit Profile</button>
                        ) : (
                            <>
                                <button onClick={() => { setIsEditing(false); setFormData(user); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                                    {isSaving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
             )}

             {/* SECURITY TAB */}
             {activeTab === 'security' && (
                 <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Security Settings</h2>
                        <p className="text-slate-400 text-sm">Update password and manage 2FA.</p>
                    </div>

                    <form onSubmit={handlePasswordChange} className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Key size={18} className="text-cyan-400"/> Change Password
                        </h3>
                        
                        <div className="space-y-3">
                            <input 
                                type="password" 
                                placeholder="Current Password"
                                value={passwords.current}
                                onChange={e => setPasswords({...passwords, current: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-cyan-500 outline-none transition-all"
                            />
                             <input 
                                type="password" 
                                placeholder="New Password"
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-cyan-500 outline-none transition-all"
                            />
                             <input 
                                type="password" 
                                placeholder="Confirm New Password"
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-cyan-500 outline-none transition-all"
                            />
                        </div>

                        {passMessage && (
                            <div className={`text-sm p-3 rounded flex items-center gap-2 ${passMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {passMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {passMessage.text}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button type="submit" disabled={isSaving || !passwords.current} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
                                {isSaving ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex justify-between items-center opacity-75 grayscale hover:grayscale-0 transition-all">
                         <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                                <Smartphone size={18} className="text-purple-400"/> Two-Factor Authentication
                            </h3>
                            <p className="text-xs text-slate-500">Enhanced security is currently disabled by organization policy.</p>
                         </div>
                         <div className="w-12 h-6 bg-slate-800 rounded-full relative cursor-not-allowed">
                             <div className="w-4 h-4 bg-slate-600 rounded-full absolute top-1 left-1"></div>
                         </div>
                    </div>
                 </div>
             )}

             {/* SESSIONS TAB */}
             {activeTab === 'sessions' && (
                 <div className="max-w-xl space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Active Sessions</h2>
                        <p className="text-slate-400 text-sm">Manage devices logged into your account.</p>
                    </div>

                    <div className="space-y-3">
                        {sessions.map(sess => (
                            <div key={sess.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
                                <div className={`p-3 rounded-full ${sess.isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                                    {sess.device.includes('Mobile') ? <Smartphone size={20} /> : <Activity size={20} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-slate-200">{sess.device}</h4>
                                        {sess.isCurrent && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Current</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Globe size={10} /> {sess.ip} • {sess.location}
                                    </p>
                                    <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1"><Clock size={10} /> Last active: {sess.lastActive}</p>
                                </div>
                                {!sess.isCurrent && (
                                    <button 
                                        onClick={() => authService.revokeSession(sess.id)}
                                        className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-3 py-1.5 rounded transition-colors"
                                    >
                                        Revoke
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl flex gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-bold text-amber-500">Security Tip</h4>
                            <p className="text-xs text-amber-400/80">If you see an unfamiliar device, revoke access immediately and change your password.</p>
                        </div>
                    </div>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};
