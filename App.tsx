
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { UserManagement } from './components/UserManagement';
import { FaceDetectorView } from './components/FaceDetectorView';
import { SettingsView } from './components/SettingsView';
import { AttendanceLogViewer } from './components/AttendanceLogViewer';
import { CamerasView } from './components/CamerasView';
import { AIPanel } from './components/AIPanel';
import { AreaMapView } from './components/AreaMapView';
import { DigitalTwinBuilder } from './components/DigitalTwinBuilder';
import { ProfileModal } from './components/ProfileModal';
import { SupportModal } from './components/SupportModal';
import { NotificationCenter } from './components/NotificationCenter';
import { IdentityFusionConsole } from './components/IdentityFusionConsole';
import { AppearanceIntelligenceConsole } from './components/AppearanceIntelligenceConsole';
import { MultiModalIdentityConsole } from './components/MultiModalIdentityConsole';
import { SOCEventTimeline } from './components/soc/SOCEventTimeline';
import { SOCInvestigationCenter } from './components/soc/SOCInvestigationCenter';
import { SOCResourceManager } from './components/soc/SOCResourceManager';
import { SOCMultiSite } from './components/soc/SOCMultiSite';
import { SOCReports } from './components/soc/SOCReports';
import { LivePersonsMonitor } from './components/LivePersonsMonitor';
import { AuthPage } from './components/AuthPage';
import { authService } from './services/authService';
import { notificationService } from './services/notificationService';
import { User } from './types';
import { 
  LayoutDashboard, Users, FileText, Settings, Search, Bell, Menu, X, Shield, 
  ChevronDown, Camera, Video, LogOut, User as UserIcon, Lock, HelpCircle, 
  KeyRound, Mail, ArrowRight, Map as MapIcon, Moon, Sun,
  Activity, Terminal, ShieldAlert, Layers, Eye, Network, Fingerprint, TrendingUp,
  Monitor, Cpu, Zap, AlertTriangle, Archive, BarChart2, UserCheck, Globe,
  HeartPulse, LayoutGrid, FolderSearch, Sparkles
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './services/i18n';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { PersonProfileProvider } from './context/PersonProfileContext';
import { motion, AnimatePresence } from 'motion/react';

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800)); 
    await authService.login(email, password);
    setIsLoading(false);
    onLogin();
  };

  const handleDirectLogin = async () => {
    const bootstrapPassword = prompt(
      "Bootstrap admin login.\nEnter the BOOTSTRAP_ADMIN_PASSWORD set on the server:"
    );
    if (!bootstrapPassword) return;
    setIsLoading(true);
    try {
      await authService.login('admin@sentinel.sys', bootstrapPassword);
      onLogin();
    } catch (err) {
      alert('Kirish amalga oshmadi. Serverda BOOTSTRAP_ADMIN_PASSWORD sozlanganligi tekshiring.');
    } finally {
      setIsLoading(false);
    }
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

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-text-muted">yoki</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleDirectLogin}
          disabled={isLoading}
          className="w-full bg-app-surface hover:bg-app-primary border border-border text-text-primary font-semibold py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Fingerprint size={18} className="text-brand-primary" />
          To'g'ridan-to'g'ri kirish (Admin)
        </button>
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
  
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'users' | 'logs' | 'live_feed' | 'settings' | 'cameras' |
    'map' | 'builder' |
    'identity_fusion' | 'appearance_intel' | 'multi_modal_intel' |
    'event_timeline' | 'investigation' | 'resources' |
    'multi_site' | 'reports' | 'identities'
  >('dashboard');

  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'security' | 'sessions'>('profile');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [sidebarTelemetry, setSidebarTelemetry] = useState<{ cpu: number; ram: string } | null>(null);

  const { t } = useLanguage();

  useEffect(() => {
    setGlobalSearchTerm('');
  }, [currentView]);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          setSidebarTelemetry({
            cpu: data.cpuUsage ?? 0,
            ram: `${((data.ramUsedMb ?? 0) / 1024).toFixed(1)}GB`
          });
        }
      } catch {}
    };
    fetchTelemetry();
    const iv = setInterval(fetchTelemetry, 8000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const updateCount = () => {
        setNotificationCount(notificationService.getUnreadCount());
    };
    updateCount();
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

  if (!isAuthenticated) return <AuthPage onLogin={handleLogin} />;
  if (currentView === 'live_feed') return <FaceDetectorView onBack={() => setCurrentView('dashboard')} />

  const getViewTitle = () => {
      switch(currentView) {
          case 'dashboard':         return t('nav.dashboard');
          case 'users':             return t('nav.employees');
          case 'logs':              return t('nav.records');
          case 'settings':          return t('nav.settings');
          case 'cameras':           return t('cameras.title');
          case 'map':               return t('nav.areaMap');
          case 'builder':           return 'Raqamli Egizak Arxitektori';
          case 'event_timeline':    return 'AI Hodisalar Vaqt Chizig\'i';
          case 'investigation':     return 'Tekshiruv Markazi';
          case 'resources':         return 'Resurslar Boshqaruvi';
          case 'multi_site':        return 'Ko\'p Saytli Boshqaruv';
          case 'reports':           return 'Hisobotlar';
          case 'identities':        return 'Jonli Shaxslar Monitori';
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

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {(isProfileOpen || isNotificationsOpen) && (
        <div 
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => { setIsProfileOpen(false); setIsNotificationsOpen(false); }}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-app-panel border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-border bg-app-panel shrink-0">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white mr-3 shadow-lg shadow-brand-primary/20">
             <Shield size={18} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary leading-tight tracking-tight">Sentinel<span className="text-brand-primary">Bio</span></h1>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Enterprise v3.0</p>
          </div>
          <button 
            className="ml-auto lg:hidden text-text-muted p-2 hover:bg-app-surface rounded-lg"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Asosiy</p>
            <SidebarItem icon={LayoutDashboard} label={t('nav.dashboard')} active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Kuzatuv</p>
            <SidebarItem icon={Video}   label={t('nav.cameras')}   active={currentView === 'cameras'}      onClick={() => { setCurrentView('cameras');      setIsSidebarOpen(false); }} />
            <SidebarItem icon={MapIcon} label={t('nav.areaMap')}    active={currentView === 'map'}          onClick={() => { setCurrentView('map');          setIsSidebarOpen(false); }} />
            <SidebarItem icon={Camera}  label={t('nav.liveDetector')} active={false}                        onClick={() => { setCurrentView('live_feed');    setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Signallar & Hodisalar</p>
            <SidebarItem icon={Zap} label="AI Hodisalar Vaqt Chizig'i" active={currentView === 'event_timeline'} onClick={() => { setCurrentView('event_timeline'); setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Intellekt</p>
            <SidebarItem icon={Users}        label="Jonli Shaxslar"          active={currentView === 'identities'}        onClick={() => { setCurrentView('identities');        setIsSidebarOpen(false); }} />
            <SidebarItem icon={FolderSearch} label="Tekshiruv Markazi"       active={currentView === 'investigation'}     onClick={() => { setCurrentView('investigation');     setIsSidebarOpen(false); }} />
            <SidebarItem icon={Layers}       label="Identity Fusion"         active={currentView === 'identity_fusion'}   onClick={() => { setCurrentView('identity_fusion');   setIsSidebarOpen(false); }} />
            <SidebarItem icon={Eye}          label="Appearance Intelligence" active={currentView === 'appearance_intel'}  onClick={() => { setCurrentView('appearance_intel');  setIsSidebarOpen(false); }} />
            <SidebarItem icon={Network}      label="Multi-Modal Engine"      active={currentView === 'multi_modal_intel'} onClick={() => { setCurrentView('multi_modal_intel'); setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Tahlil</p>
            <SidebarItem icon={BarChart2} label="Hisobotlar" active={currentView === 'reports'} onClick={() => { setCurrentView('reports'); setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Boshqaruv</p>
            <SidebarItem icon={UserCheck} label="Resurslar"       active={currentView === 'resources'}  onClick={() => { setCurrentView('resources');  setIsSidebarOpen(false); }} />
            <SidebarItem icon={Globe}     label="Ko'p Saytli Ops" active={currentView === 'multi_site'} onClick={() => { setCurrentView('multi_site'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={Users}     label={t('nav.employees')} active={currentView === 'users'}   onClick={() => { setCurrentView('users');      setIsSidebarOpen(false); }} />
            <SidebarItem icon={FileText}  label={t('nav.records')}   active={currentView === 'logs'}    onClick={() => { setCurrentView('logs');       setIsSidebarOpen(false); }} />
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Tizim</p>
            <SidebarItem icon={Settings} label={t('nav.settings')}  active={currentView === 'settings'}   onClick={() => { setCurrentView('settings');   setIsSidebarOpen(false); }} />
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-app-surface mt-auto">
            <div className="bg-app-primary p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 text-status-safe-text font-medium text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe-text opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe-text"></span>
                    </span>
                    <span className="text-[10px] font-bold">ONLINE</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-muted font-mono mt-1">
                    <span>CPU: {sidebarTelemetry ? `${sidebarTelemetry.cpu}%` : '—'}</span>
                    <span>RAM: {sidebarTelemetry ? sidebarTelemetry.ram : '—'}</span>
                </div>
                <div className="w-full bg-app-surface h-1 mt-2 rounded-full overflow-hidden">
                    <div
                      className="bg-status-safe-text h-full transition-all duration-500"
                      style={{ width: `${sidebarTelemetry?.cpu ?? 0}%` }}
                    />
                </div>
            </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-app-primary transition-colors duration-300 relative h-screen">
        <header className="h-16 px-4 md:px-6 border-b border-border bg-app-panel flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 overflow-hidden">
            <button 
              className="lg:hidden text-text-secondary hover:text-text-primary p-1.5 hover:bg-app-surface rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-text-primary tracking-tight truncate">{getViewTitle()}</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {(currentView === 'users' || currentView === 'logs' || currentView === 'dashboard') && (
                <div className="hidden sm:flex items-center relative">
                    <Search className="w-4 h-4 absolute left-3 text-text-muted" />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={globalSearchTerm}
                        onChange={(e) => setGlobalSearchTerm(e.target.value)}
                        className="bg-app-primary border border-border rounded-full pl-9 pr-4 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none w-40 md:w-64 transition-all"
                    />
                </div>
            )}

            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />

              {/* AI Panel toggle */}
              <button
                onClick={() => setIsAIPanelOpen(v => !v)}
                className={`p-2 rounded-full transition-colors relative ${
                  isAIPanelOpen
                    ? 'text-cyan-400 bg-cyan-500/15 hover:bg-cyan-500/25'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-surface'
                }`}
                title="AI Copilot & Chat"
              >
                <Sparkles className="w-5 h-5" />
                {isAIPanelOpen && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full border border-app-panel" />
                )}
              </button>

              <div className="relative">
                  <button 
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                      className="p-2 text-text-secondary hover:text-text-primary hover:bg-app-surface rounded-full transition-colors relative"
                  >
                      <Bell className="w-5 h-5" />
                      {notificationCount > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-critical-text rounded-full animate-pulse border border-app-panel" />
                      )}
                  </button>
                  <NotificationCenter isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
              </div>
            </div>

            <div className="h-6 w-px bg-border mx-1 hidden xs:block" />

            <div className="relative">
                <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 sm:gap-3 p-1 rounded-full hover:bg-app-surface transition-colors"
                >
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-bold text-text-primary leading-none">{currentUser?.fullName}</p>
                        <p className="text-[10px] text-text-muted font-mono leading-none mt-1 uppercase">{currentUser?.role}</p>
                    </div>
                    <img src={currentUser?.avatarUrl} alt="User" className="w-8 h-8 rounded-full border border-border bg-app-surface object-cover flex-shrink-0" />
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform hidden sm:block ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-app-panel border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                      >
                          <div className="px-4 py-3 border-b border-border md:hidden">
                              <p className="text-sm font-bold text-text-primary truncate">{currentUser?.fullName}</p>
                              <p className="text-xs text-text-muted truncate">{currentUser?.email}</p>
                          </div>
                          <button onClick={() => openProfileModal('profile')} className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-3 transition-colors">
                              <UserIcon size={16} /> Profilim
                          </button>
                          <button onClick={() => openProfileModal('security')} className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-3 transition-colors">
                              <Lock size={16} /> Xavfsizlik
                          </button>
                          <button onClick={() => setIsHelpModalOpen(true)} className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-app-surface hover:text-text-primary flex items-center gap-3 transition-colors">
                              <HelpCircle size={16} /> Yordam
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-status-critical-text hover:bg-status-critical-bg flex items-center gap-3 transition-colors">
                              <LogOut size={16} /> Chiqish
                          </button>
                      </motion.div>
                  )}
                </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6 relative scroll-smooth custom-scrollbar">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 animate-grid-pan opacity-60" />
              <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-[radial-gradient(circle,var(--color-brand-primary)_0%,transparent_70%)] opacity-10 blur-3xl animate-drift" />
              <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full bg-[radial-gradient(circle,var(--color-brand-secondary)_0%,transparent_70%)] opacity-10 blur-3xl animate-drift-reverse" />
              <div className="absolute top-1/2 right-1/3 w-[30vw] h-[30vw] rounded-full bg-[radial-gradient(circle,var(--color-status-safe-text)_0%,transparent_70%)] opacity-5 blur-3xl animate-drift" />
            </div>
            <div className="relative z-10 h-full">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentView}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="min-h-full"
                  >
                      {currentView === 'dashboard'          && <Dashboard globalSearchTerm={globalSearchTerm} />}
                      {currentView === 'users'             && <UserManagement globalSearchTerm={globalSearchTerm} />}
                      {currentView === 'logs'              && <AttendanceLogViewer globalSearchTerm={globalSearchTerm} />}
                      {currentView === 'cameras'           && <CamerasView />}
                      {currentView === 'map'               && <AreaMapView />}
                      {currentView === 'builder'           && <DigitalTwinBuilder />}
                      {currentView === 'settings'          && <SettingsView />}
                      {currentView === 'identity_fusion'   && <IdentityFusionConsole />}
                      {currentView === 'appearance_intel'  && <AppearanceIntelligenceConsole />}
                      {currentView === 'multi_modal_intel' && <MultiModalIdentityConsole />}
                      {currentView === 'event_timeline'    && <SOCEventTimeline />}
                      {currentView === 'investigation'     && <SOCInvestigationCenter />}
                      {currentView === 'resources'         && <SOCResourceManager />}
                      {currentView === 'multi_site'        && <SOCMultiSite />}
                      {currentView === 'reports'           && <SOCReports />}
                      {currentView === 'identities'        && (
                        <LivePersonsMonitor
                          onNavigateCopilot={(query) => {
                            setIsAIPanelOpen(true);
                            // Store query for copilot to pick up
                            (window as any).__copilotPendingQuery = query;
                          }}
                        />
                      )}
                  </motion.div>
                </AnimatePresence>
            </div>
        </main>

        {/* AI Panel — right-side drawer */}
        <AIPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          currentView={currentView}
          onNavigate={(v) => setCurrentView(v as any)}
        />

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-app-panel/90 backdrop-blur-xl border-t border-border flex justify-around items-center h-16 px-1 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.3)] transition-colors duration-300">
          {[
            { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
            { id: 'cameras', label: t('nav.cameras'), icon: Video },
            { id: 'map', label: t('nav.areaMap'), icon: MapIcon },
            { id: '__ai__', label: 'AI', icon: Sparkles },
            { id: 'settings', label: t('nav.settings'), icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === '__ai__') {
                    setIsAIPanelOpen(v => !v);
                  } else {
                    setCurrentView(item.id as any);
                    setIsSidebarOpen(false);
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 h-full relative group transition-all duration-300 ${
                  item.id === '__ai__'
                    ? isAIPanelOpen ? 'text-cyan-400' : 'text-text-secondary hover:text-text-primary'
                    : isActive ? 'text-brand-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className={`p-1 rounded-lg transition-all duration-300 ${
                  item.id === '__ai__' ? (isAIPanelOpen ? 'bg-cyan-500/15' : '') : (isActive ? 'bg-brand-primary/10' : '')
                }`}>
                  <Icon size={20} className={isActive || (item.id === '__ai__' && isAIPanelOpen) ? 'scale-110' : 'group-hover:scale-105'} />
                </div>
                <span className="text-[10px] mt-1 font-bold tracking-tight truncate max-w-[64px] transition-all">{item.label}</span>
                {isActive && item.id !== '__ai__' && (
                  <motion.div layoutId="mobile-nav-pill" className="absolute -top-px left-1/4 right-1/4 h-1 bg-brand-primary rounded-b-full shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
        <LanguageProvider>
            <PersonProfileProvider>
                <AppContent />
            </PersonProfileProvider>
        </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
