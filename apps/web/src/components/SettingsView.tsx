
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Settings, Save, RotateCcw, Shield, Camera, Users, 
    Activity, Bell, Database, Globe, Server, Cpu, CheckCircle2, AlertTriangle, Download, Loader2, Lock, Trash2, Siren, Share2, Info,
    ShieldCheck, Terminal, Filter, Search, RefreshCw, AlertCircle, User
} from 'lucide-react';
import { settingsService } from '../services/settingsService';
import { SystemSettings } from '../types';
import { useLanguage } from '../services/i18n';

// ── Audit log types ──────────────────────────────────────────────────────────
interface AuditLogEntry {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  timestamp: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: string;
}

interface VmsEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: any;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
}

// --- Reusable UI Components ---

const SectionHeader = ({ title, description }: { title: string, description: string }) => (
    <div className="mb-6 pb-4 border-b border-border">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-text-primary0">{description}</p>
    </div>
);

const Toggle = ({ label, checked, onChange, help }: any) => (
    <div className="flex items-center justify-between py-3">
        <div className="pr-4">
            <label className="text-sm font-medium text-text-secondary block">{label}</label>
            {help && <p className="text-xs text-text-primary0 mt-0.5">{help}</p>}
        </div>
        <button 
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-cyan-600' : 'bg-slate-700'}`}
        >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    </div>
);

const Slider = ({ label, value, min, max, step, onChange, unit, help }: any) => (
    <div className="py-3">
        <div className="flex justify-between mb-2">
            <div>
                <label className="text-sm font-medium text-text-secondary">{label}</label>
                {help && <p className="text-xs text-text-primary0">{help}</p>}
            </div>
            <span className="text-sm font-mono text-cyan-400 bg-cyan-950/30 px-2 rounded border border-cyan-900/50">
                {value}{unit}
            </span>
        </div>
        <input 
            type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-app-surface rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
    </div>
);

const Select = ({ label, value, options, onChange, help }: any) => (
    <div className="py-3">
        <label className="text-sm font-medium text-text-secondary block mb-1">{label}</label>
        {help && <p className="text-xs text-text-primary0 mb-2">{help}</p>}
        <select 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-app-panel border border-border text-text-primary text-sm rounded-lg p-2.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        >
            {options.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

const Input = ({ label, type = "text", value, onChange, placeholder, help }: any) => (
    <div className="py-3">
        <label className="text-sm font-medium text-text-secondary block mb-1">{label}</label>
        {help && <p className="text-xs text-text-primary0 mb-2">{help}</p>}
        <input 
            type={type}
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
            placeholder={placeholder}
            className="w-full bg-app-panel border border-border text-text-primary text-sm rounded-lg p-2.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        />
    </div>
);

// --- Main Component ---

export const SettingsView: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
    const [activeTab, setActiveTab] = useState('general');
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const { t, setLanguage } = useLanguage();

    // ── Audit log state ──────────────────────────────────────────────────────
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [vmsEvents, setVmsEvents] = useState<VmsEvent[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditModule, setAuditModule] = useState('ALL');
    const [auditStatus, setAuditStatus] = useState('ALL');
    const [auditSubTab, setAuditSubTab] = useState<'AUDIT' | 'LIVE_EVENTS'>('AUDIT');

    // ── Audit log helpers ────────────────────────────────────────────────────
    const fetchAuditLogs = useCallback(async () => {
        setAuditLoading(true);
        try {
            const [resLogs, resEvents] = await Promise.all([
                fetch('/api/system/audit-logs'),
                fetch('/api/system/events'),
            ]);
            if (resLogs.ok && resLogs.headers.get('content-type')?.includes('application/json')) {
                setAuditLogs(await resLogs.json());
            }
            if (resEvents.ok && resEvents.headers.get('content-type')?.includes('application/json')) {
                setVmsEvents(await resEvents.json());
            }
        } catch (e) {
            console.error('Audit log fetch error:', e);
        } finally {
            setAuditLoading(false);
        }
    }, []);

    const handleClearEvents = async () => {
        if (!window.confirm('Haqiqatdan ham barcha jonli tizim hodisalari tarixini o\'chirmoqchimisiz?')) return;
        try {
            const res = await fetch('/api/system/events/clear', { method: 'POST' });
            if (res.ok) setVmsEvents([]);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (activeTab === 'audit_view') {
            fetchAuditLogs();
            const iv = setInterval(fetchAuditLogs, 3500);
            return () => clearInterval(iv);
        }
    }, [activeTab, fetchAuditLogs]);

    const auditModules = ['ALL', ...new Set(auditLogs.map(l => l.module))];
    const filteredAuditLogs = auditLogs.filter(log => {
        const q = auditSearch.toLowerCase();
        return (
            (log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q) || log.userName.toLowerCase().includes(q)) &&
            (auditModule === 'ALL' || log.module === auditModule) &&
            (auditStatus === 'ALL' || log.status === auditStatus)
        );
    });

    const statusBadge = (s: AuditLogEntry['status']) =>
        s === 'SUCCESS' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
        : s === 'FAILURE' ? 'bg-red-950/40 text-red-400 border border-red-500/20'
        : 'bg-amber-950/40 text-amber-400 border border-amber-500/20';

    const severityBadge = (s: VmsEvent['severity']) =>
        s === 'SUCCESS' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
        : s === 'CRITICAL' ? 'bg-red-950/40 text-red-400 border border-red-500/20'
        : s === 'WARNING' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
        : 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20';

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const loaded = await settingsService.getSettings();
        setSettings(loaded);
        if (loaded) {
            setOriginalSettings(JSON.parse(JSON.stringify(loaded)));
        }
    };

    useEffect(() => {
        if (settings && originalSettings) {
            setIsDirty(JSON.stringify(settings) !== JSON.stringify(originalSettings));
        }
    }, [settings, originalSettings]);

    const handleSave = async () => {
        if (!settings) return;
        setSaveStatus('saving');
        
        await settingsService.saveSettings(settings);
        
        // Apply immediate effects
        if (settings.general.language) {
            setLanguage(settings.general.language as any);
        }
        
        if (settings) {
            setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        }
        setIsDirty(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleReset = () => {
        if (confirm("Saqlanmagan o'zgarishlar bekor qilinsinmi?")) {
        if (originalSettings) {
            setSettings(JSON.parse(JSON.stringify(originalSettings)));
        }
        }
    };

    const handleRestoreDefaults = async () => {
        if (confirm("Ishonchingiz komilmi? Bu harakat zavod sozlamalarini tiklaydi va buni bekor qilib bo'lmaydi.")) {
            const defaults = await settingsService.resetDefaults();
            setSettings(defaults);
            if (defaults) {
                setOriginalSettings(JSON.parse(JSON.stringify(defaults)));
            }
        }
    };

    if (!settings) return <div className="h-full flex items-center justify-center text-text-primary0 gap-2"><Loader2 className="animate-spin"/> Konfiguratsiya Yuklanmoqda...</div>;

    const tabs = [
        { id: 'general', label: t('settings.general'), icon: Globe },
        { id: 'facerec', label: t('settings.biometrics'), icon: Activity },
        { id: 'liveness', label: t('settings.liveness'), icon: Shield },
        { id: 'camera', label: t('settings.hardware'), icon: Camera },
        { id: 'rules', label: t('settings.attendance'), icon: Users },
        { id: 'security', label: t('settings.security'), icon: Lock },
        { id: 'performance', label: t('settings.performance'), icon: Cpu },
        { id: 'notifications', label: t('settings.alerts'), icon: Siren },
        { id: 'logging', label: t('settings.logs'), icon: Server },
        { id: 'backup', label: t('settings.backup'), icon: Database },
        { id: 'audit_view', label: 'Xavfsizlik Auditi', icon: ShieldCheck },
    ];

    const update = (category: keyof SystemSettings, field: string, value: any) => {
        setSettings(prev => {
            if (!prev) return null;
            return { ...prev, [category]: { ...prev[category], [field]: value } };
        });
    };

    return (
        <div className="flex flex-col lg:flex-row h-full bg-app-primary rounded-xl overflow-hidden border border-border">
            {/* Sidebar */}
            <div className="w-full lg:w-64 bg-app-panel border-b lg:border-b-0 lg:border-r border-border flex flex-col shrink-0">
                <div className="p-4 border-b border-border">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <Settings size={20} className="text-cyan-400" />
                        {t('settings.title')}
                    </h2>
                </div>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto py-2 lg:py-4 scrollbar-none shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex lg:w-full items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2.5 lg:py-3 text-xs lg:text-sm font-medium transition-colors border-b-2 lg:border-b-0 lg:border-l-2 whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'bg-app-surface text-cyan-400 border-cyan-400' 
                                : 'text-text-secondary hover:bg-app-surface/50 hover:text-text-primary border-transparent'
                            }`}
                        >
                            <tab.icon size={16} className="lg:w-[18px] lg:h-[18px]" />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="p-3 lg:p-4 border-t border-border flex justify-center shrink-0">
                    <button onClick={handleRestoreDefaults} className="flex items-center justify-center gap-2 text-xs text-text-primary0 hover:text-rose-400 transition-colors">
                        <RotateCcw size={14} /> Standart Sozlamalar
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-app-primary relative">
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-24">
                    
                    {/* --- GENERAL SETTINGS --- */}
                    {activeTab === 'general' && (
                         <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title={t('config.general.title')} description={t('config.general.desc')} />
                            <Input label={t('config.sysName')} value={settings.general.systemName} onChange={(v:any) => update('general', 'systemName', v)} />
                            <Input label={t('config.orgName')} value={settings.general.organizationName} onChange={(v:any) => update('general', 'organizationName', v)} />
                            <Select label={t('config.timezone')} value={settings.general.timezone} options={[{value:'UTC', label:'UTC'}, {value:'America/New_York', label:'EST (New York)'}, {value:'Asia/Tashkent', label:'Tashkent (UZ)'}]} onChange={(v:any) => update('general', 'timezone', v)} />
                            <Select label={t('config.language')} value={settings.general.language} options={[{value:'en-US', label:'English'}, {value:'es', label:'Español'}, {value:'uz', label:'O\'zbek'}]} onChange={(v:any) => update('general', 'language', v)} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input type="time" label={t('config.workStart')} value={settings.general.workStart} onChange={(v:any) => update('general', 'workStart', v)} />
                                <Input type="time" label={t('config.workEnd')} value={settings.general.workEnd} onChange={(v:any) => update('general', 'workEnd', v)} />
                            </div>
                        </div>
                    )}

                    {/* --- FACE RECOGNITION --- */}
                    {activeTab === 'facerec' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Biometrik Dvigatelni Sozlash" description="Aniqlash va tanib olish aniqligi uchun chegaralarni belgilang." />
                            <Select label="Tanib Olish Modeli" value={settings.faceRec.modelType} options={[{value:'ArcFace', label:'ArcFace (Standart)'}, {value:'FaceNet', label:'FaceNet (Eski)'}, {value:'SsdMobileNet', label:'MobileNet (Tezkor)'}]} onChange={(v:any) => update('faceRec', 'modelType', v)} help="Eng yuqori aniqlik uchun ArcFace tavsiya etiladi."/>
                            <Slider label="Aniqlash Ishonchliligi (Detection Confidence)" value={settings.faceRec.detectionThreshold} min={0.1} max={0.99} step={0.01} onChange={(v:any) => update('faceRec', 'detectionThreshold', v)} unit="" help="Detektor uchun minimal ishonchlilik darajasi." />
                            <Slider label="O'xshashlik Chegarasi (Similarity Threshold)" value={settings.faceRec.similarityThreshold} min={0.1} max={0.99} step={0.01} onChange={(v:any) => update('faceRec', 'similarityThreshold', v)} unit="" help="Yuzni moslashtirish qat'iyligi. Yuqori = kamroq xato musbatlar." />
                            <Slider label="Minimal Yuz Sifati" value={settings.faceRec.minFaceQuality} min={0.1} max={0.99} step={0.01} onChange={(v:any) => update('faceRec', 'minFaceQuality', v)} unit="" help="Xira yoki qorong'i rasmlarni rad etish." />
                            <Toggle label="Yuzni To'g'rilash (Align Faces)" checked={settings.faceRec.alignFaces} onChange={(v:any) => update('faceRec', 'alignFaces', v)} help="Tanib olishdan oldin 5 nuqtali moslashtirishni amalga oshirish." />
                        </div>
                    )}

                    {/* --- LIVENESS --- */}
                    {activeTab === 'liveness' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title={t('config.liveness.title')} description={t('config.liveness.desc')} />
                            <Toggle label={t('config.liveness.enable')} checked={settings.liveness.enabled} onChange={(v:any) => update('liveness', 'enabled', v)} />
                            <div className={`pl-4 border-l-2 border-border transition-opacity ${!settings.liveness.enabled && 'opacity-50 pointer-events-none'}`}>
                                <Toggle label={t('config.liveness.eyeBlink')} checked={settings.liveness.checkEyeBlink} onChange={(v:any) => update('liveness', 'checkEyeBlink', v)} help={t('config.liveness.eyeBlinkHelp')} />
                                <Toggle label={t('config.liveness.headMove')} checked={settings.liveness.checkHeadMove} onChange={(v:any) => update('liveness', 'checkHeadMove', v)} help={t('config.liveness.headMoveHelp')} />
                                <Slider label={t('config.liveness.threshold')} value={settings.liveness.confidenceThreshold} min={0.5} max={0.99} step={0.01} onChange={(v:any) => update('liveness', 'confidenceThreshold', v)} unit="" />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input type="number" label={t('config.liveness.maxAttempts')} value={settings.liveness.maxAttempts} onChange={(v:any) => update('liveness', 'maxAttempts', v)} help={t('config.liveness.maxAttemptsHelp')} />
                                    <Input type="number" label={t('config.liveness.lockout')} value={settings.liveness.lockoutDuration} onChange={(v:any) => update('liveness', 'lockoutDuration', v)} help={t('config.liveness.lockoutHelp')} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CAMERA --- */}
                    {activeTab === 'camera' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title={t('config.camera.title')} description={t('config.camera.desc')} />
                            <Select label={t('config.camera.resolution')} value={settings.camera.resolution} options={[{value:'640x480', label:'VGA (640x480)'}, {value:'1280x720', label:'HD (1280x720)'}, {value:'1920x1080', label:'FHD (1920x1080)'}]} onChange={(v:any) => update('camera', 'resolution', v)} />
                            <Slider label={t('config.camera.fps')} value={settings.camera.fpsLimit} min={5} max={60} step={1} onChange={(v:any) => update('camera', 'fpsLimit', v)} unit=" FPS" help={t('config.camera.fpsHelp')} />
                            <Toggle label={t('config.camera.exposure')} checked={settings.camera.autoExposure} onChange={(v:any) => update('camera', 'autoExposure', v)} />
                            <Input type="number" label={t('config.camera.health')} value={settings.camera.healthCheckInterval} onChange={(v:any) => update('camera', 'healthCheckInterval', v)} />
                        </div>
                    )}

                    {/* --- RULES --- */}
                    {activeTab === 'rules' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Davomat Mantiqiy Qoidalari" description="Kelish va kechikish qanday hisoblanishini belgilang." />
                            <Select label="Rejim" value={settings.rules.mode} options={[{value:'CheckIn_Only', label:'Faqat Kelish'}, {value:'CheckIn_CheckOut', label:'Kelish va Ketish'}]} onChange={(v:any) => update('rules', 'mode', v)} />
                            <Input type="number" label="Imtiyozli Davr (Daqiqa)" value={settings.rules.gracePeriod} onChange={(v:any) => update('rules', 'gracePeriod', v)} help="Ish boshlangandan keyin kechikish deb hisoblanmaydigan vaqt." />
                            <Input type="number" label="Kechikish Chegarasi (Daqiqa)" value={settings.rules.lateThreshold} onChange={(v:any) => update('rules', 'lateThreshold', v)} />
                            <Input type="time" label="Avtomatik Ketish Vaqti" value={settings.rules.autoCheckout} onChange={(v:any) => update('rules', 'autoCheckout', v)} help="Ochiq sessiyalarni ushbu vaqtda avtomatik yopish." />
                            <Input type="number" label="Takrorlanishni Oldini Olish (Daqiqa)" value={settings.rules.preventDuplicateInterval} onChange={(v:any) => update('rules', 'preventDuplicateInterval', v)} help="Ushbu vaqt oralig'ida qayta tanishni e'tiborsiz qoldirish." />
                        </div>
                    )}

                    {/* --- SECURITY --- */}
                    {activeTab === 'security' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Xavfsizlik va Maxfiylik Siyosati" description="Shifrlash, ma'lumotlarni saqlash va qoidalarni sozlash." />
                            
                            <div className="bg-app-panel border border-border rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                                    <Lock size={16} /> Tinch Holatda Shifrlash Faol
                                </h4>
                                <p className="text-xs text-text-primary0">
                                    Barcha biometrik vektorlar saqlashdan oldin AES-256 (Fernet) yordamida shifrlanadi. Kalitlar xavfsiz backend tomonidan boshqariladi.
                                </p>
                            </div>

                            <Slider 
                                label="Biometrik Ma'lumotlarni Saqlash Siyosati" 
                                value={settings.security.dataRetentionDays} 
                                min={30} max={1095} step={30} 
                                onChange={(v:any) => update('security', 'dataRetentionDays', v)} 
                                unit=" Kun" 
                                help="Faoliyatsizlikdan keyin biometrik profillarni avtomatik o'chirish (GDPR mosligi)." 
                            />
                            
                            <Toggle 
                                label="'Unutish Huquqi'ni Yoqish (GDPR Erasure)" 
                                checked={settings.security.gdprCompliance}
                                onChange={(v:any) => update('security', 'gdprCompliance', v)} 
                                help="Foydalanuvchilar uchun 'Shaxsni Unutish' API va UI boshqaruvini yoqish."
                            />

                             <Toggle 
                                label="Ro'yxatdan O'tish Uchun Admin Tasdig'i Talab Qilinadi" 
                                checked={settings.security.requireAdminApprovalForEnrollment} 
                                onChange={(v:any) => update('security', 'requireAdminApprovalForEnrollment', v)} 
                            />

                            <Input 
                                label="Parol Muddati (Kun)" 
                                type="number"
                                value={settings.security.adminPasswordExpiry} 
                                onChange={(v:any) => update('security', 'adminPasswordExpiry', v)} 
                            />
                        </div>
                    )}

                    {/* --- PERFORMANCE --- */}
                    {activeTab === 'performance' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Tizimni Optimallashtirish" description="Dvigatelni apparat imkoniyatlaringizga moslang." />
                            <Toggle label="GPU Tezlashtirish" checked={settings.performance.gpuEnabled} onChange={(v:any) => update('performance', 'gpuEnabled', v)} help="NVIDIA CUDA o'rnatilgan bo'lishi kerak." />
                            <Slider label="Tanib Olish Oralig'i (ms)" value={settings.performance.recognitionInterval} min={50} max={1000} step={50} onChange={(v:any) => update('performance', 'recognitionInterval', v)} unit=" ms" help="Past = tezroq javob, lekin yuqori CPU sarfi." />
                            <Slider label="Maksimal Ishchi Oqimlar (Worker Threads)" value={settings.performance.maxThreads} min={1} max={16} step={1} onChange={(v:any) => update('performance', 'maxThreads', v)} unit="" />
                            <Select label="Paket Hajmi (Batch Size)" value={settings.performance.batchSize} options={[{value:1, label:'1 (Past Kechikish)'}, {value:4, label:'4 (Muvozanatli)'}, {value:8, label:'8 (Yuqori O\'tkazuvchanlik)'}]} onChange={(v:any) => update('performance', 'batchSize', parseInt(v))} />
                        </div>
                    )}

                    {/* --- NOTIFICATIONS & ALERTS --- */}
                    {activeTab === 'notifications' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Xavfsizlik Bildirishnomalari va Webhooklar" description="Signallarni qachon va qayerga yuborishni sozlang." />
                            
                            <div className="bg-app-panel border border-border rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2 mb-1">
                                    <Bell size={16} /> Bildirishnoma Kanallari
                                </h4>
                                <p className="text-xs text-text-secondary">
                                    Qaysi kanallar orqali xabarnomalar olishni xohlayotganingizni belgilang.
                                </p>
                            </div>

                            <Toggle 
                                label="Push-xabarnomalar (Brauzer)" 
                                checked={settings.notifications.enablePush} 
                                onChange={(v:any) => update('notifications', 'enablePush', v)} 
                                help="Muhim hodisalar haqida brauzerda qalqib chiquvchi xabarlar."
                            />

                            <Toggle 
                                label="Email Xabarnomalar" 
                                checked={settings.notifications.enableEmail} 
                                onChange={(v:any) => update('notifications', 'enableEmail', v)} 
                            />

                            {settings.notifications.enableEmail && (
                                <Input 
                                    label="Email Qabul Qiluvchilar" 
                                    value={settings.notifications.emailRecipients} 
                                    onChange={(v:any) => update('notifications', 'emailRecipients', v)}
                                    placeholder="admin@company.com, manager@company.com"
                                    help="Vergul bilan ajratilgan email manzillar ro'yxati."
                                />
                            )}

                            <div className="my-6 border-t border-border" />

                            <SectionHeader title="Hodisa Turlari" description="Qaysi hodisalar uchun ogohlantirish olishni tanlang." />

                            <Toggle 
                                label="Tizim Xatoliklari (Critical)" 
                                checked={settings.notifications.alertOnSystemError} 
                                onChange={(v:any) => update('notifications', 'alertOnSystemError', v)} 
                                help="Server uzilishi, kamera nosozligi yoki xavfsizlik buzilishi."
                            />

                            <Toggle 
                                label="Noma'lum Shaxs Aniqlanganda" 
                                checked={settings.notifications.alertOnUnknown} 
                                onChange={(v:any) => update('notifications', 'alertOnUnknown', v)} 
                            />

                            <Toggle 
                                label="Kechikishlar (Late Arrival)" 
                                checked={settings.notifications.alertOnLate} 
                                onChange={(v:any) => update('notifications', 'alertOnLate', v)} 
                            />

                            <Toggle 
                                label="Erta Ketishlar (Early Departure)" 
                                checked={settings.notifications.alertOnEarlyLeave} 
                                onChange={(v:any) => update('notifications', 'alertOnEarlyLeave', v)} 
                            />

                            <div className="my-6 border-t border-border" />

                            <SectionHeader title="Webhook Integratsiyasi" description="Xavfsizlik hodisalarini tashqi tizimlarga yuborish." />
                            
                            <Toggle 
                                label="Webhooklarni Yoqish" 
                                checked={settings.notifications.enableWebhook} 
                                onChange={(v:any) => update('notifications', 'enableWebhook', v)} 
                            />
                            
                            {settings.notifications.enableWebhook && (
                                <Input 
                                    label="Webhook Endpoint URL" 
                                    value={settings.notifications.webhookUrl} 
                                    onChange={(v:any) => update('notifications', 'webhookUrl', v)}
                                    placeholder="https://api.security-center.com/hooks/v1"
                                />
                            )}
                        </div>
                    )}

                    {/* --- LOGGING --- */}
                    {activeTab === 'logging' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Audit Jurnallari" description="Tizim batafsilligi va ma'lumotlarni saqlashni boshqaring." />
                            <Select label="Log Darajasi" value={settings.logging.logLevel} options={[{value:'INFO', label:'INFO'}, {value:'WARN', label:'WARN'}, {value:'ERROR', label:'ERROR'}, {value:'DEBUG', label:'DEBUG'}]} onChange={(v:any) => update('logging', 'logLevel', v)} />
                            <Input type="number" label="Jurnalni Saqlash (Kun)" value={settings.logging.retentionDays} onChange={(v:any) => update('logging', 'retentionDays', v)} />
                            <Toggle label="O'zgarmas Audit Izi (Immutable Audit Trail)" checked={settings.logging.auditTrailEnabled} onChange={(v:any) => update('logging', 'auditTrailEnabled', v)} help="Xavfsizlik jurnallarini o'chirishni taqiqlash." />
                            <div className="mt-4">
                                <button onClick={() => settingsService.exportSettings()} className="flex items-center gap-2 px-4 py-2 bg-app-surface hover:bg-app-surface text-text-secondary rounded-lg text-xs font-bold transition-colors">
                                    <Download size={14} /> Konfiguratsiyani Eksport Qilish (JSON)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- BACKUP --- */}
                    {activeTab === 'backup' && (
                        <div className="max-w-3xl space-y-2 animate-in fade-in duration-300">
                            <SectionHeader title="Falokatdan Qutqarish" description="Ma'lumotlar bazasini avtomatik zaxiralash." />
                            <Toggle label="Avto-Zaxiralash Yoqilgan" checked={settings.backup.autoBackup} onChange={(v:any) => update('backup', 'autoBackup', v)} />
                            <Select label="Oraliq" value={settings.backup.backupInterval} options={[{value:'Daily', label:'Kunlik'}, {value:'Weekly', label:'Haftalik'}]} onChange={(v:any) => update('backup', 'backupInterval', v)} />
                            <Toggle label="Zaxira Fayllarini Shifrlash" checked={settings.backup.encryptBackups} onChange={(v:any) => update('backup', 'encryptBackups', v)} />
                            {settings.backup.lastBackupDate && (
                                <p className="text-xs text-text-primary0 mt-2">Oxirgi Zaxira: {settings.backup.lastBackupDate}</p>
                            )}
                        </div>
                    )}

                    {/* --- AUDIT VIEW --- */}
                    {activeTab === 'audit_view' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <ShieldCheck className="text-emerald-400" /> Xavfsizlik Audit va Tizim Loglari
                                    </h3>
                                    <p className="text-xs text-text-muted mt-1 font-mono">
                                        Barcha operator harakatlari, ruxsatnomalar va xavfsizlik hodisalarining immutable jurnali.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {auditSubTab === 'LIVE_EVENTS' && (
                                        <button onClick={handleClearEvents} className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs transition-all">
                                            <Trash2 size={13} /> Tarixni Tozalash
                                        </button>
                                    )}
                                    <button onClick={fetchAuditLogs} disabled={auditLoading} className="flex items-center gap-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs transition-all">
                                        <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} /> Yangilash
                                    </button>
                                </div>
                            </div>

                            {/* Sub-tabs */}
                            <div className="flex border-b border-border gap-2">
                                <button
                                    onClick={() => setAuditSubTab('AUDIT')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all ${auditSubTab === 'AUDIT' ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                                >
                                    Compliance Audit Trails
                                </button>
                                <button
                                    onClick={() => setAuditSubTab('LIVE_EVENTS')}
                                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all flex items-center gap-1.5 ${auditSubTab === 'LIVE_EVENTS' ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                    Live Event Broker Log
                                </button>
                            </div>

                            {auditSubTab === 'AUDIT' ? (
                                <div className="space-y-4">
                                    {/* Filters */}
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-app-panel p-4 border border-border rounded-xl">
                                        <div className="relative sm:col-span-2">
                                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
                                            <input
                                                type="text"
                                                placeholder="Amal, operator yoki tafsilotlar bo'yicha qidirish..."
                                                value={auditSearch}
                                                onChange={e => setAuditSearch(e.target.value)}
                                                className="w-full bg-app-primary border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-text-primary"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                            <select value={auditModule} onChange={e => setAuditModule(e.target.value)} className="w-full bg-app-primary border border-border rounded-lg px-2 py-2 text-xs focus:outline-none text-text-secondary font-mono">
                                                {auditModules.map((m, i) => <option key={i} value={m}>{m === 'ALL' ? 'Barcha Modullar' : m}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                            <select value={auditStatus} onChange={e => setAuditStatus(e.target.value)} className="w-full bg-app-primary border border-border rounded-lg px-2 py-2 text-xs focus:outline-none text-text-secondary font-mono">
                                                <option value="ALL">Barcha Holatlar</option>
                                                <option value="SUCCESS">SUCCESS</option>
                                                <option value="FAILURE">FAILURE</option>
                                                <option value="WARNING">WARNING</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-[#05070c] border border-border rounded-xl overflow-hidden shadow-2xl">
                                        <div className="bg-slate-950/80 px-4 py-2 border-b border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
                                            <div className="flex items-center gap-1.5"><Terminal size={14} className="text-emerald-400" /> SECURE AUDIT TRACE SHELL</div>
                                            <div>Jami: {filteredAuditLogs.length} ta yozuv</div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs font-mono">
                                                <thead>
                                                    <tr className="border-b border-border text-text-muted uppercase text-[9px] bg-slate-950/40">
                                                        <th className="py-2.5 px-4">Vaqt</th>
                                                        <th className="py-2.5 px-4">Operator</th>
                                                        <th className="py-2.5 px-4">Modul</th>
                                                        <th className="py-2.5 px-4">Harakat</th>
                                                        <th className="py-2.5 px-4">Tafsilotlar</th>
                                                        <th className="py-2.5 px-4">IP</th>
                                                        <th className="py-2.5 px-4">Holat</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/30">
                                                    {filteredAuditLogs.length === 0 ? (
                                                        <tr><td colSpan={7} className="py-10 text-center text-text-muted italic">{auditLoading ? 'Yuklanmoqda...' : 'Hech qanday audit logi topilmadi.'}</td></tr>
                                                    ) : filteredAuditLogs.map((log, i) => (
                                                        <tr key={i} className="hover:bg-indigo-950/10 transition-all">
                                                            <td className="py-3 px-4 text-text-muted whitespace-nowrap">{new Date(log.timestamp).toLocaleString('uz-UZ')}</td>
                                                            <td className="py-3 px-4 font-bold text-text-primary">
                                                                <span className="flex items-center gap-1.5"><User size={12} className="text-indigo-400" />{log.userName}</span>
                                                            </td>
                                                            <td className="py-3 px-4 text-text-secondary">{log.module}</td>
                                                            <td className="py-3 px-4 font-bold text-indigo-300">{log.action}</td>
                                                            <td className="py-3 px-4 text-text-muted max-w-xs truncate" title={log.details}>{log.details}</td>
                                                            <td className="py-3 px-4 text-text-muted">{log.ipAddress}</td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusBadge(log.status)}`}>{log.status}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Live Events */
                                <div className="bg-slate-950 border border-border rounded-xl p-4 font-mono text-xs text-text-secondary h-[520px] overflow-y-auto space-y-2 flex flex-col-reverse">
                                    {vmsEvents.length === 0 ? (
                                        <p className="text-center text-text-muted italic py-16">Live stream ishlamoqda — hodisalar kutilmoqda...</p>
                                    ) : vmsEvents.map((evt, i) => (
                                        <div key={i} className="border-l-2 border-indigo-500/40 pl-3 py-1.5 bg-indigo-950/5 rounded-r-md flex items-start justify-between gap-4 text-[11px] animate-in slide-in-from-left duration-250">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-text-muted">[{new Date(evt.timestamp).toLocaleTimeString()}]</span>
                                                    <span className="text-indigo-300 font-bold uppercase tracking-wider text-[9px] bg-indigo-950/40 px-1 py-0.5 rounded">{evt.source}</span>
                                                    <span className="font-bold text-text-primary">{evt.type}</span>
                                                </div>
                                                <p className="text-text-muted leading-relaxed text-[10px]">
                                                    {typeof evt.payload === 'object' ? JSON.stringify(evt.payload) : evt.payload}
                                                </p>
                                            </div>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 ${severityBadge(evt.severity)}`}>{evt.severity}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Save Bar */}
                {isDirty && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-app-panel border border-border shadow-2xl shadow-black rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 z-50">
                        <span className="text-sm font-medium text-text-secondary">{t('settings.unsaved')}</span>
                        <div className="h-4 w-px bg-slate-700" />
                        <button onClick={handleReset} className="text-sm font-medium text-text-secondary hover:text-white transition-colors">
                            {t('settings.reset')}
                        </button>
                        <button onClick={handleSave} disabled={saveStatus === 'saving'} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all disabled:opacity-50">
                            {saveStatus === 'saving' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />}
                            {saveStatus === 'saving' ? 'Qo\'llanilmoqda...' : t('settings.save')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
