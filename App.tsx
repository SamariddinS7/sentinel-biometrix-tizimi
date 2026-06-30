
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { UserManagement } from './components/UserManagement';
import { FaceDetectorView } from './components/FaceDetectorView';
import { SettingsView } from './components/SettingsView';
import { AttendanceLogViewer } from './components/AttendanceLogViewer';
import { CamerasView } from './components/CamerasView';
import { AIChatView } from './components/AIChatView';
import { AreaMapView } from './components/AreaMapView';
import { DigitalTwinBuilder } from './components/DigitalTwinBuilder'; 
import { ProfileModal } from './components/ProfileModal';
import { SupportModal } from './components/SupportModal';
import { NotificationCenter } from './components/NotificationCenter';
import { authService } from './services/authService';
import { notificationService } from './services/notificationService';
import { User } from './types';
import { 
  LayoutDashboard, Users, FileText, Settings, Search, Bell, Menu, X, Shield, 
  ChevronDown, Camera, Video, LogOut, User as UserIcon, Lock, HelpCircle, 
  KeyRound, Mail, ArrowRight, Bot, Map as MapIcon, PenTool, Moon, Sun
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './services/i18n';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState('admin@sentinel.sys');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800)); 
    await authService.login(email);
    setIsLoading(false);
    onLogin();
  };

  return (
    <div className="min-h-screen bg-app-primary flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-primary/20 via-app-primary to-app-primary pointer-events-none" />
      
      <div className="w-full max-w-md bg-app-panel/50 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
             <Shield size={40} fill="currentColor" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-text-primary mb-2">Sentinel Biometrics</h2>
        <p className="text-text-secondary text-center text-sm mb-8">Korporativ Boshqaruv Konsoli</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Email Manzil</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-app-primary border border-border text-text-primary text-sm rounded-lg pl-10 pr-4 py-3 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                placeholder="name@company.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Parol</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-app-primary border border-border text-text-primary text-sm rounded-lg pl-10 pr-4 py-3 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-lg shadow-lg shadow-brand-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Kirish <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
      <p className="mt-8 text-xs text-text-muted">v3.0.4-Enterprise • Gemini AI tomonidan himoyalangan</p>
    </div>
  );
};

// --- Theme Toggle Component ---
const ThemeToggle = () => {
    const { mode, toggleTheme } = useTheme();
    return (
        <button 
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-app-surface rounded-full transition-colors relative"
            title={mode === 'dark' ? 'Yorug\' rejimga o\'tish' : 'Tungi rejimga o\'tish'}
        >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all mb-1 border
      ${active 
        ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
        : 'text-text-secondary hover:bg-app-surface border-transparent hover:text-text-primary'
      }`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_currentColor]" />}
  </button>
);

const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(!!authService.getCurrentUser()); 
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'logs' | 'live_feed' | 'settings' | 'cameras' | 'ai_chat' | 'map' | 'builder'>('dashboard');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'security' | 'sessions'>('profile');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const { t } = useLanguage();

  useEffect(() => {
    setGlobalSearchTerm('');
  }, [currentView]);

  useEffect(() => {
    const updateCount = () => {
        setNotificationCount(notificationService.getUnreadCount());
    };
    
    // Initial count
    updateCount();

    // Subscribe
    const unsubscribe = notificationService.subscribe(updateCount);
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setCurrentUser(authService.getCurrentUser());
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
      authService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsProfileOpen(false);
      setCurrentView('dashboard'); 
  };

  const openProfileModal = (tab: 'profile' | 'security' | 'sessions') => {
      setProfileModalTab(tab);
      setIsProfileModalOpen(true);
      setIsProfileOpen(false);
  };

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;
  if (currentView === 'live_feed') return <FaceDetectorView onBack={() => setCurrentView('dashboard')} />

  const getViewTitle = () => {
      switch(currentView) {
          case 'dashboard': return t('nav.dashboard');
          case 'users': return t('nav.employees');
          case 'logs': return t('nav.records');
          case 'settings': return t('nav.settings');
          case 'cameras': return t('cameras.title');
          case 'ai_chat': return t('nav.aiChat');
          case 'map': return t('nav.areaMap');
          case 'builder': return 'Raqamli Egizak Arxitektori'; 
          default: return '';
      }
  };

  return (
    <div className="h-screen bg-app-primary text-text-primary font-sans flex overflow-hidden transition-colors duration-300">
      
      {currentUser && (
        <ProfileModal 
            isOpen={isProfileModalOpen} 
            onClose={() => setIsProfileModalOpen(false)} 
            user={currentUser}
            onUpdate={setCurrentUser}
            onLogout={handleLogout}
            initialTab={profileModalTab}
        />
      )}
      <SupportModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />

      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-app-primary/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {(isProfileOpen || isNotificationsOpen) && (
        <div 
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => { setIsProfileOpen(false); setIsNotificationsOpen(false); }}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-app-panel border-r border-border transform transition-transform duration-200 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border bg-app-panel">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white mr-3 shadow-lg shadow-brand-primary/20">
             <Shield size={18} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary leading-tight tracking-tight">FaceRec<span className="text-brand-primary">Analytics</span></h1>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Enterprise v3.0</p>
          </div>
          <button 
            className="ml-auto lg:hidden text-text-muted"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <div className="mb-8">
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4">Asosiy Menyu</p>
            <SidebarItem 
              icon={LayoutDashboard} 
              label={t('nav.dashboard')}
              active={currentView === 'dashboard'} 
              onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
            />
            <SidebarItem 
              icon={Video} 
              label={t('nav.cameras')}
              active={currentView === 'cameras'} 
              onClick={() => { setCurrentView('cameras'); setIsSidebarOpen(false); }}
            />
             <SidebarItem 
              icon={MapIcon} 
              label={t('nav.areaMap')} 
              active={currentView === 'map'} 
              onClick={() => { setCurrentView('map'); setIsSidebarOpen(false); }} 
            />
            <SidebarItem 
              icon={Camera} 
              label={t('nav.liveDetector')}
              active={false} 
              onClick={() => { setCurrentView('live_feed'); setIsSidebarOpen(false); }}
            />
            <SidebarItem 
              icon={FileText} 
              label={t('nav.records')}
              active={currentView === 'logs'} 
              onClick={() => { setCurrentView('logs'); setIsSidebarOpen(false); }}
            />
            <SidebarItem 
              icon={Users} 
              label={t('nav.employees')}
              active={currentView === 'users'} 
              onClick={() => { setCurrentView('users'); setIsSidebarOpen(false); }}
            />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4">Intellekt</p>
            <SidebarItem 
              icon={Bot} 
              label={t('nav.aiChat')} 
              active={currentView === 'ai_chat'} 
              onClick={() => { setCurrentView('ai_chat'); setIsSidebarOpen(false); }} 
            />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4">Tizim</p>
            <SidebarItem 
              icon={Settings} 
              label={t('nav.settings')} 
              active={currentView === 'settings'} 
              onClick={() => { setCurrentView('settings'); setIsSidebarOpen(false); }} 
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-app-surface">
            <div className="bg-app-primary p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 text-status-safe-text font-medium text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe-text opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe-text"></span>
                    </span>
                    <span className="text-[10px] font-bold">ALOQADA</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-muted font-mono">
                    <span>CPU: 12%</span>
                    <span>RAM: 3.4GB</span>
                </div>
                <div className="w-full bg-app-surface h-1 mt-2 rounded-full overflow-hidden">
                    <div className="bg-status-safe-text h-full w-[12%]"></div>
                </div>
            </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-app-primary transition-colors duration-300">
        <header className="h-16 px-6 border-b border-border bg-app-panel flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-text-secondary hover:text-text-primary"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">{getViewTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            {(currentView === 'users' || currentView === 'logs' || currentView === 'dashboard') && (
                <div className="hidden md:flex items-center relative">
                    <Search className="w-4 h-4 absolute left-3 text-text-muted" />
                    <input 
                        type="text" 
                        placeholder="Tezkor Qidiruv..." 
                        value={globalSearchTerm}
                        onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        className="bg-app-primary border border-border rounded-full pl-9 pr-4 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none w-64 transition-all"
                    />
                </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <div className="relative">
                <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-app-surface rounded-full transition-colors relative"
                >
                    <Bell className="w-5 h-5" />
                    {/* Badge uses inline semantic colors for consistency */}
                    {notificationCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-critical-text rounded-full animate-pulse border border-app-panel" />
                    )}
                </button>
                <NotificationCenter isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
            </div>

            <div className="h-6 w-px bg-border mx-1" />

            {/* Profile Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-3 p-1 rounded-full hover:bg-app-surface transition-colors"
                >
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-text-primary leading-none">{currentUser?.fullName}</p>
                        <p className="text-[10px] text-text-muted font-mono leading-none mt-1">{currentUser?.role}</p>
                    </div>
                    <img src={currentUser?.avatarUrl} alt="User" className="w-8 h-8 rounded-full border border-border bg-app-surface object-cover" />
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-app-panel border border-border rounded-xl shadow-2xl z-50 py-1 animate-in slide-in-from-top-2">
                        <div className="px-4 py-3 border-b border-border md:hidden">
                            <p className="text-sm font-bold text-text-primary">{currentUser?.fullName}</p>
                            <p className="text-xs text-text-muted">{currentUser?.email}</p>
                        </div>
                        <button onClick={() => openProfileModal('profile')} className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-2">
                            <UserIcon size={16} /> Profilim
                        </button>
                        <button onClick={() => openProfileModal('security')} className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-2">
                            <Lock size={16} /> Xavfsizlik Sozlamalari
                        </button>
                        <button onClick={() => setIsHelpModalOpen(true)} className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-2">
                            <HelpCircle size={16} /> Yordam va Qo'llab-quvvatlash
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-status-critical-text hover:bg-status-critical-bg flex items-center gap-2">
                            <LogOut size={16} /> Chiqish
                        </button>
                    </div>
                )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden p-6 relative">
            {/* Background gradient needs to use CSS variables for transparency */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-primary)_0%,transparent_70%)] opacity-10 pointer-events-none" />
            <div className="relative z-10 h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                {currentView === 'dashboard' && <Dashboard globalSearchTerm={globalSearchTerm} />}
                {currentView === 'users' && <UserManagement globalSearchTerm={globalSearchTerm} />}
                {currentView === 'logs' && <AttendanceLogViewer globalSearchTerm={globalSearchTerm} />}
                {currentView === 'cameras' && <CamerasView />}
                {currentView === 'map' && <AreaMapView />}
                {/* Note: 'builder' view is now handled inside 'map' view as a sub-mode if user navigates internally, but we can keep this for safety if direct link used */}
                {currentView === 'builder' && <DigitalTwinBuilder />} 
                {currentView === 'settings' && <SettingsView />}
                {currentView === 'ai_chat' && <AIChatView />}
            </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
