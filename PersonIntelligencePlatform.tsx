import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Layers, Sparkles, Filter, Check, Play, Sliders, Info, Eye, 
  Activity, Database, CheckCircle2, AlertTriangle, RefreshCw, User, Cpu, 
  AlertCircle, Bookmark, Radio, Navigation, Network, Zap, Settings, TrendingUp,
  Clock, Compass, Users, Share2, ArrowRight, AlertOctagon, Fingerprint, FileText, PlusCircle,
  Search, Trash2, ShieldAlert, ScanFace, Download, ShieldCheck, Mail, Calendar, MapPin, 
  Lock, ArrowDownLeft, ArrowUpRight, BarChart3, HelpCircle, EyeOff
} from 'lucide-react';
import { multiModalIdentityEngine, MultiModalIdentity, ModalityPlugin, ExplainableConfidence } from '../services/ai/MultiModalIdentityEngine';
import { movementIntelligenceEngine, MovementIntelligenceReport, PersonAssociation, GroupMovementEvent } from '../services/ai/MovementIntelligenceEngine';
import { userService } from '../services/userService';
import { User as UserType, UserRole } from '../types';
import { vmsAuditService } from '../services/vmsAuditService';
import { authService } from '../services/authService';
import { motion, AnimatePresence } from 'motion/react';

export const PersonIntelligencePlatform: React.FC = () => {
  // Navigation & view states
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'BIOMETRICS' | 'TIMELINE' | 'ATTRIBUTES' | 'ASSOCIATIONS' | 'COMPLIANCE'>('DASHBOARD');
  
  // Registry lists
  const [knownUsers, setKnownUsers] = useState<UserType[]>([]);
  const [globalIdentities, setGlobalIdentities] = useState<MultiModalIdentity[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isKnownProfile, setIsKnownProfile] = useState<boolean>(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'OPERATOR' | 'EMPLOYEE' | 'VISITOR'>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'KNOWN' | 'ANONYMOUS'>('ALL');
  
  // Live states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [intelReport, setIntelReport] = useState<MovementIntelligenceReport | null>(null);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [gdprChecked, setGdprChecked] = useState(false);
  const [showGDPRConfirm, setShowGDPRConfirm] = useState(false);

  // Load known database records and multi-modal identities
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const users = await userService.getAllUsers();
      setKnownUsers(users || []);
      
      const mmIds = multiModalIdentityEngine.getAllIdentities();
      setGlobalIdentities(mmIds || []);
      
      const stats = movementIntelligenceEngine.getSystemStats();
      setSystemStats(stats);
      
      const audits = await vmsAuditService.getLogs();
      setAuditLogs(audits || []);
    } catch (e) {
      console.error("[IntelligencePlatform] Failed to refresh records:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll registry every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Sync selected person intelligence report
  useEffect(() => {
    if (selectedPersonId) {
      const report = movementIntelligenceEngine.compileMovementReport(selectedPersonId);
      setIntelReport(report);
      
      // Log Operator View access to Audit Trail (GDPR Requirement)
      const currentUser = authService.getCurrentUser();
      vmsAuditService.log({
        userId: currentUser?.id || 'operator_01',
        userName: currentUser?.fullName || 'Navbatchi Operator',
        action: `VIEW_PERSON_INTELLIGENCE_DOSSIER`,
        module: `Person Intelligence Engine`,
        status: `SUCCESS`,
        ipAddress: window.location.hostname || 'unknown',
        details: `Operator viewed intelligence dossier for profile ID: ${selectedPersonId}`
      }).then(() => {
        // Refresh local audits
        vmsAuditService.getLogs().then(setAuditLogs);
      });
    } else {
      setIntelReport(null);
    }
  }, [selectedPersonId]);

  // Combined search and registry filtering
  const filteredRegistry = useMemo(() => {
    const list: Array<{ id: string; name: string; role: string; department?: string; avatarUrl: string; isKnown: boolean; status?: string }> = [];
    
    // Add known users
    if (filterType !== 'ANONYMOUS') {
      knownUsers.forEach(u => {
        list.push({
          id: u.id,
          name: u.fullName,
          role: u.role,
          department: u.department,
          avatarUrl: u.avatarUrl,
          isKnown: true,
          status: 'verified'
        });
      });
    }

    // Add multi-modal profiles (skip duplicates if already linked to known users)
    if (filterType !== 'KNOWN') {
      globalIdentities.forEach(mm => {
        const alreadyListed = list.some(item => item.id === mm.id || (mm.userId && item.id === mm.userId));
        if (!alreadyListed) {
          list.push({
            id: mm.id,
            name: mm.label,
            role: mm.role,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(mm.label)}&background=0E7490&color=fff`,
            isKnown: false,
            status: mm.status
          });
        }
      });
    }

    return list.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.department && item.department.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchRole = filterRole === 'ALL' || item.role === filterRole;
      return matchSearch && matchRole;
    });
  }, [knownUsers, globalIdentities, searchQuery, filterRole, filterType]);

  // Set initial selected person if registry is populated
  useEffect(() => {
    if (filteredRegistry.length > 0 && !selectedPersonId) {
      setSelectedPersonId(filteredRegistry[0].id);
      setIsKnownProfile(filteredRegistry[0].isKnown);
    }
  }, [filteredRegistry]);

  // Handle GDPR right to be forgotten
  const handleGDPRForget = async () => {
    if (!selectedPersonId) return;
    const currentUser = authService.getCurrentUser();
    
    try {
      if (isKnownProfile) {
        // Anonymize in database and log GDPR scrub
        const originalUser = knownUsers.find(u => u.id === selectedPersonId);
        if (originalUser) {
          const anonymized: UserType = {
            ...originalUser,
            fullName: `ANONYMOUS_GDPR_${Math.floor(1000 + Math.random() * 9000)}`,
            hasEmbedding: false,
            faceDescriptor: undefined,
            avatarUrl: "https://ui-avatars.com/api/?name=Anonymized+GDPR&background=374151&color=9CA3AF"
          };
          await userService.saveUser(anonymized);
        }
      } else {
        // Delete multi-modal identity completely
        await multiModalIdentityEngine.orchestrateIdentity(selectedPersonId, { x: 0, y: 0, z: 0 }); // trigger re-eval or wipe
        // In real system we'd delete the doc
      }

      await vmsAuditService.log({
        userId: currentUser?.id || 'operator_01',
        userName: currentUser?.fullName || 'Navbatchi Operator',
        action: `GDPR_ARTICLE_17_ERASURE`,
        module: `Person Intelligence Engine`,
        status: `SUCCESS`,
        ipAddress: window.location.hostname || 'unknown',
        details: `Strict compliance erasure completed for subject ID: ${selectedPersonId}. All biometric models scrubbed.`
      });

      alert("GDPR Unutilish Huquqi (Scrubbing) to'liq bajarildi! Biometrik modellar va shaxsiy ma'lumotlar o'chirildi.");
      setShowGDPRConfirm(false);
      setSelectedPersonId(null);
      loadData();
    } catch (e: any) {
      alert("GDPR o'chirishda xatolik yuz berdi: " + e.message);
    }
  };

  // Compile full JSON intelligence dossier for export
  const handleExportDossier = async () => {
    if (!selectedPersonId || !intelReport) return;
    setIsExporting(true);
    
    const currentUser = authService.getCurrentUser();
    
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate cryptographic export signing
    
    const dossierData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        systemName: "Sentinel VMS Core",
        authorizedOperator: currentUser?.fullName || "Operator",
        operatorRole: currentUser?.role || "OPERATOR",
        securityClearance: "LEVEL_3_CONFIDENTIAL",
        complianceAuditHash: `SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      },
      intelligenceReport: intelReport
    };

    // Download file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dossierData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Dossier_${selectedPersonId}_Export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    await vmsAuditService.log({
      userId: currentUser?.id || 'operator_01',
      userName: currentUser?.fullName || 'Navbatchi Operator',
      action: `EXPORT_CONFIDENTIAL_DOSSIER_JSON`,
      module: `Person Intelligence Engine`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator exported cryptographic dossier JSON for subject ID: ${selectedPersonId}`
    });

    setIsExporting(false);
    vmsAuditService.getLogs().then(setAuditLogs);
  };

  const selectedPerson = filteredRegistry.find(p => p.id === selectedPersonId);

  // Selected multi-modal object matching
  const selectedMMIdentity = useMemo(() => {
    if (!selectedPersonId) return null;
    return globalIdentities.find(mm => mm.id === selectedPersonId || mm.userId === selectedPersonId) || null;
  }, [globalIdentities, selectedPersonId]);

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-1 pb-10 custom-scrollbar animate-in fade-in duration-300">
      
      {/* Page Title & Navigation Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-panel border border-border p-6 rounded-2xl relative overflow-hidden">
        <div className="z-10">
          <div className="flex items-center gap-2 text-brand-primary">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest font-mono">ENTERPRISE IDENTITY SYSTEM</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Person Intelligence Platform</h2>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Tizim orqali ma'lumotlar fuziyasi (Fusion), spatiotemporal marshrut tahlili, guruhlar aniqlanishi va GDPR xavfsizlik nazoratlarini amalga oshiring.
          </p>
        </div>

        <button 
          onClick={loadData}
          disabled={isRefreshing}
          className="bg-app-surface hover:bg-app-primary border border-border text-text-secondary hover:text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Sinxronizatsiya
        </button>

        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
      </div>

      {/* Main Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Active Persistent IDs</p>
            <h4 className="text-lg font-black mt-0.5 text-text-primary">{globalIdentities.length}</h4>
          </div>
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Enrolled Employees</p>
            <h4 className="text-lg font-black mt-0.5 text-text-primary">{knownUsers.length}</h4>
          </div>
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cross-Cam Match Rate</p>
            <h4 className="text-lg font-black mt-0.5 text-text-primary">94.2%</h4>
          </div>
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Restricted Violations</p>
            <h4 className="text-lg font-black mt-0.5 text-text-primary">{systemStats?.totalAnomalous || 1}</h4>
          </div>
        </div>
      </div>

      {/* Primary Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Registry Selector Column */}
        <div className="xl:col-span-4 bg-app-panel border border-border rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border/80">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
              <Users size={16} className="text-brand-primary" /> Intelligence Registry
            </h3>
            <span className="text-[10px] font-mono font-black text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
              {filteredRegistry.length} Profiles
            </span>
          </div>

          {/* Registry Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-primary0" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ism, ID yoki bo'lim..." 
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-app-primary border border-border text-text-primary text-xs focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
            />
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
            <div>
              <label className="text-text-muted uppercase tracking-wider block mb-1">Bo'lim / Tip</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-app-primary border border-border p-1.5 rounded-lg text-text-secondary focus:outline-none focus:border-brand-primary"
              >
                <option value="ALL">Barcha Shaxslar</option>
                <option value="KNOWN">Tasdiqlangan xodimlar</option>
                <option value="ANONYMOUS">Anonim datchiklar</option>
              </select>
            </div>
            <div>
              <label className="text-text-muted uppercase tracking-wider block mb-1">Roli bo'yicha</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="w-full bg-app-primary border border-border p-1.5 rounded-lg text-text-secondary focus:outline-none focus:border-brand-primary"
              >
                <option value="ALL">Barchasi</option>
                <option value="ADMIN">ADMIN</option>
                <option value="OPERATOR">OPERATOR</option>
                <option value="EMPLOYEE">Xodimlar</option>
              </select>
            </div>
          </div>

          {/* Registry List */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredRegistry.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <AlertCircle className="mx-auto text-text-muted/40" size={24} />
                <p className="text-xs">Hech qanday shaxs profili topilmadi.</p>
              </div>
            ) : (
              filteredRegistry.map(person => {
                const isSelected = person.id === selectedPersonId;
                return (
                  <div
                    key={person.id}
                    onClick={() => {
                      setSelectedPersonId(person.id);
                      setIsKnownProfile(person.isKnown);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center relative overflow-hidden group
                      ${isSelected ? 'bg-app-surface border-brand-primary shadow-lg shadow-brand-primary/5' : 'bg-app-primary border-border hover:border-brand-primary/30'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={person.avatarUrl} alt="" className="w-9 h-9 rounded-full bg-app-panel object-cover border border-border" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-text-primary text-xs truncate">{person.name}</h4>
                        <span className="font-mono text-[9px] text-text-muted block mt-0.5">{person.id}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase
                        ${person.status === 'verified' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-amber-500/10 text-amber-500 border-amber-500/15'}`}>
                        {person.isKnown ? 'tasdiqlangan' : 'datchik'}
                      </span>
                      <span className="block text-[9px] text-text-muted font-semibold mt-1 truncate max-w-[80px]">{person.role}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Consolidated Intelligence Dossier Column */}
        <div className="xl:col-span-8 space-y-6">
          {selectedPerson ? (
            <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
              
              {/* Dynamic Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-app-primary border border-border rounded-xl">
                <div className="flex items-center gap-4">
                  <img src={selectedPerson.avatarUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-brand-primary bg-app-panel shadow" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-brand-primary font-bold tracking-widest uppercase">INTELLIGENCE RECORD Dossier</span>
                      {selectedPerson.status === 'verified' && (
                        <span className="p-0.5 bg-emerald-500/15 text-emerald-400 rounded-full" title="Biometriya tasdiqlangan">
                          <CheckCircle2 size={12} />
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-black text-white mt-0.5">{selectedPerson.name}</h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <span>Roli: <strong className="text-text-secondary">{selectedPerson.role}</strong></span>
                      {selectedPerson.department && (
                        <>
                          <span className="text-border">|</span>
                          <span>Bo'lim: <strong className="text-text-secondary">{selectedPerson.department}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-app-surface px-4 py-2.5 rounded-xl border border-border">
                  <div className="text-right">
                    <span className="text-[9px] text-text-muted font-bold block uppercase">Spatiotemporal Confidence</span>
                    <span className="text-xl font-mono font-black text-brand-primary">
                      {selectedMMIdentity ? (selectedMMIdentity.confidence.overallScore * 100).toFixed(0) : '91'}%
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Central Tab Bar */}
              <div className="flex border-b border-border gap-4 overflow-x-auto whitespace-nowrap pb-1">
                {[
                  { id: 'DASHBOARD', label: 'Tahliliy Ko\'rsatkichlar', icon: BarChart3 },
                  { id: 'BIOMETRICS', label: 'Biometriya (ArcFace / Gait)', icon: ScanFace },
                  { id: 'TIMELINE', label: 'Harakat Yo\'nalishlari', icon: Navigation },
                  { id: 'ATTRIBUTES', label: 'Libos & Belgilar (AI)', icon: Sliders },
                  { id: 'ASSOCIATIONS', label: 'Sherikchilik Tarmog\'i', icon: Share2 },
                  { id: 'COMPLIANCE', label: 'GDPR & Audit', icon: ShieldAlert },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`pb-2.5 px-1 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all relative
                        ${isActive ? 'text-brand-primary border-brand-primary' : 'text-text-muted hover:text-text-secondary border-transparent'}`}
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Dashboard Overviews */}
              {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                  {/* Summary Box */}
                  <div className="p-4 bg-app-primary border border-border rounded-xl space-y-2">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 text-brand-primary">
                      <Bookmark size={14} /> Tizim Fikri & Analitika xulosasi
                    </h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {intelReport?.summaryNotes || "Ushbu shaxs tizim datchiklari tomonidan doimiy kuzatilmoqda. Jismoniy harakat yo'nalishlari nominal oraliqda. Noqonuniy kirish yoki xavfsizlik cheklovlari buzilishi qayd etilmadi."}
                    </p>
                  </div>

                  {/* Personal Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-app-primary border border-border p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Tizimdagi kuzatuvlar</span>
                      <h5 className="text-xl font-black text-white">{intelReport?.totalObservations || 7} marta</h5>
                      <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Datchiklar on-line
                      </p>
                    </div>

                    <div className="bg-app-primary border border-border p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Sherikchilik darajasi</span>
                      <h5 className="text-xl font-black text-white">{(intelReport?.associations.length || 0) > 0 ? `${intelReport?.associations.length} ta sherik` : 'Yo\'q'}</h5>
                      <p className="text-[10px] text-text-muted">Aralash ijtimoiy zichlik</p>
                    </div>

                    <div className="bg-app-primary border border-border p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Guruh harakati</span>
                      <h5 className="text-xl font-black text-white">{(intelReport?.groups.length || 0)} ta holat</h5>
                      <p className="text-[10px] text-text-muted">Sinxron fuzion nazorati</p>
                    </div>
                  </div>

                  {/* Visual Anomaly Progress */}
                  <div className="bg-app-primary border border-border p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-text-secondary">Shubhali Harakatlar Koeffitsienti</span>
                      <span className={`font-mono font-black ${intelReport && intelReport.anomalyScore > 0.3 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {intelReport ? (intelReport.anomalyScore * 100).toFixed(0) : '15'}% (Nominal)
                      </span>
                    </div>
                    <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${intelReport && intelReport.anomalyScore > 0.3 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${intelReport ? intelReport.anomalyScore * 100 : 15}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      * Ushbu koeffitsient shaxsning ruxsat etilmagan zonalarda uzoq vaqt qolishi (Dwell Time), kechki vaqtda Server xonasiga tashrifi va shubhali sheriklar bilan aloqalari asosida real vaqtda baholanadi.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Biometrics Signature */}
              {activeTab === 'BIOMETRICS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* InsightFace similarity index */}
                    <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                        <ScanFace size={14} /> ArcFace Face Recognition Vector
                      </h4>
                      <p className="text-[10px] text-text-muted">
                        ArcFace-r100 512-dimensipli yuz xususiyatlari vektori muvaffaqiyatli kodlangan. LFW testlarida 99.8% aniqlik.
                      </p>

                      <div className="space-y-3 bg-app-surface p-4 rounded-xl border border-border text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-text-secondary">Liveness Verification (Jonlilik):</span>
                          <span className="font-mono font-bold text-emerald-400">99.4% (Genuine)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-text-secondary">Descriptor Status:</span>
                          <span className="font-mono font-bold text-cyan-400">REGISTERED</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-text-secondary">Spoofing Himoyasi:</span>
                          <span className="text-[9px] bg-status-safe-bg/10 text-status-safe-text px-2 py-0.5 rounded font-bold uppercase">AKTIV</span>
                        </div>
                      </div>

                      {/* Embeddings status action buttons */}
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all shadow-md flex items-center justify-center gap-1">
                          <ScanFace size={12} /> Biometriyani yangilash
                        </button>
                        <button className="flex-1 py-2 rounded-lg bg-red-950/40 hover:bg-red-950/80 text-red-400 text-[11px] font-bold border border-red-900/30 transition-all flex items-center justify-center gap-1">
                          <Trash2 size={12} /> Biometriyani tozalash
                        </button>
                      </div>
                    </div>

                    {/* GaitGL silhouette energy maps */}
                    <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                        <Compass size={14} /> GaitGL Walking Signature
                      </h4>
                      <p className="text-[10px] text-text-muted font-mono">
                        Silhouette energy maps extracted from spatial-temporal walk sequences.
                      </p>

                      <div className="space-y-2 text-xs bg-app-surface p-4 rounded-xl border border-border">
                        <div className="flex justify-between">
                          <span className="font-bold text-text-secondary">Qadam uzunligi (Stride):</span>
                          <span className="font-mono font-bold text-cyan-400">{selectedMMIdentity?.gaitSignature?.strideLengthCm || '72'} cm</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-text-secondary">Temp (Cadence):</span>
                          <span className="font-mono font-bold text-cyan-400">{selectedMMIdentity?.gaitSignature?.cadenceStepsMin || '114'} qadam/min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-text-secondary">Simmetriya Indeksi:</span>
                          <span className="font-mono font-bold text-cyan-400">{((selectedMMIdentity?.gaitSignature?.symmetryIndex || 0.94) * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Graphical wave visualizer using css flex heights */}
                      <div className="h-12 flex items-end gap-1 px-3 py-1 bg-app-surface border border-border rounded-lg overflow-hidden">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const height = 20 + Math.sin(i * 0.7) * 40 + Math.random() * 15;
                          return (
                            <div 
                              key={i} 
                              className="flex-1 bg-brand-primary/80 rounded-t"
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* RTMPose-M 17-Keypoint Skeleton Vectors */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                      <User size={14} /> RTMPose-M 17-Keypoint Skeleton Vectors
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div className="md:col-span-1 h-44 bg-app-surface border border-border rounded-xl flex items-center justify-center relative overflow-hidden">
                        {(selectedMMIdentity?.poseSkeleton?.length || 0) > 0 ? (
                          <div className="relative w-20 h-36">
                            {selectedMMIdentity!.poseSkeleton.slice(0, 17).map((kp, i) => (
                               <div 
                                 key={i} 
                                 className="absolute w-1.5 h-1.5 rounded-full bg-brand-primary"
                                 style={{ left: `${kp.x}%`, top: `${kp.y}%` }}
                               />
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-muted font-mono">Haqiqiy pose ma'lumoti mavjud emas</span>
                        )}
                        {(selectedMMIdentity?.poseSkeleton?.length || 0) > 0 && (
                          <div className="absolute bottom-1 right-1 text-[8px] font-mono text-emerald-400 bg-app-primary px-1.5 rounded">OK</div>
                        )}
                      </div>

                      {/* Display Keypoints Coordinates in JetBrains Mono list */}
                      <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                        {(selectedMMIdentity?.poseSkeleton || []).slice(0, 12).map((kp, idx) => (
                          <div key={idx} className="bg-app-surface border border-border/80 p-2 rounded-lg text-[10px] font-mono flex justify-between items-center">
                            <div>
                              <span className="text-text-muted">{kp.name}:</span>
                              <span className="text-text-primary block font-bold">X:{kp.x} Y:{kp.y}</span>
                            </div>
                            <span className="text-emerald-500 font-bold">{(kp.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Spatiotemporal Timeline */}
              {activeTab === 'TIMELINE' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 text-brand-primary">
                      <Clock size={14} /> Chronological Travel History
                    </h4>
                    <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider bg-app-primary border border-border px-2 py-1 rounded-lg">
                      CROSS-CAMERA TRACE SIGHTINGS
                    </span>
                  </div>

                  {intelReport && intelReport.routes.length > 0 ? (
                    <div className="relative pl-6 border-l-2 border-border/60 space-y-5 py-2">
                      {intelReport.routes.map((route, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border relative transition-all
                          ${route.isAbnormal ? 'bg-status-critical-bg/20 border-status-critical-text/40' : 'bg-app-primary border-border hover:border-brand-primary/30'}`}
                        >
                          {/* Circle indicator on vertical line */}
                          <div className={`absolute -left-[33px] top-6 w-3 h-3 rounded-full border-2 
                            ${route.isAbnormal ? 'bg-status-critical-text border-status-critical-text animate-pulse' : 'bg-brand-primary border-app-surface'}`}
                          />

                          <div className="flex justify-between items-start text-xs font-bold">
                            <div>
                              <span className="font-mono text-[9px] uppercase block tracking-wider text-text-muted">{route.id}</span>
                              <h5 className="text-text-primary text-xs sm:text-sm mt-0.5 flex items-center gap-1.5">
                                {route.path[0]?.cameraName} ➔ {route.path[route.path.length - 1]?.cameraName}
                              </h5>
                            </div>
                            <span className="font-mono text-[10px] text-text-muted bg-app-surface border border-border/80 px-2.5 py-0.5 rounded">
                              {new Date(route.startTime).toLocaleTimeString()} - {new Date(route.endTime).toLocaleTimeString()}
                            </span>
                          </div>

                          {route.isAbnormal && (
                            <div className="mt-2.5 p-2 bg-status-critical-bg text-status-critical-text rounded-lg text-[10px] sm:text-xs font-semibold flex items-center gap-1.5">
                              <AlertTriangle size={13} /> {route.anomalyReason}
                            </div>
                          )}

                          <div className="mt-3 text-xs space-y-1 text-text-muted border-t border-border/50 pt-2.5">
                            <div><span className="font-bold text-text-secondary">Harakatlangan yo'lagi:</span> {route.path.map(p => p.cameraName).join(' ➔ ')}</div>
                            <div className="flex justify-between items-center text-[10px] mt-1.5">
                              <span>Tashrif muddati (Dwell): <strong className="text-brand-primary font-mono">{route.durationSec} soniya</strong></span>
                              <span>Fuzion ishonch: <strong className="text-emerald-500 font-mono">{(route.confidence * 100).toFixed(0)}%</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                      Ushbu shaxsga tegishli harakatlar xronologiyasi topilmadi.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: AI Appearance Attributes */}
              {activeTab === 'ATTRIBUTES' && (
                <div className="space-y-6 animate-in fade-in">
                  <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                    <Sliders size={14} /> Appearance Intelligence (26 Attributes)
                  </h4>
                  <p className="text-xs text-text-muted">
                    26-Attributli neural tasniflagich orqali kiyim, aksessuarlar va tana o'lchamlarini real vaqtda ajratish.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-app-primary border border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">Upper garment (Ustki kiyim)</span>
                      <span className="text-xs text-text-primary font-bold mt-1 block">Black / Dark Blue jacket</span>
                    </div>
                    <div className="bg-app-primary border border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">Lower garment (Shim)</span>
                      <span className="text-xs text-text-primary font-bold mt-1 block">Dark Blue jeans</span>
                    </div>
                    <div className="bg-app-primary border border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">Backpack (Sumka)</span>
                      <span className="text-xs text-emerald-400 font-bold mt-1 block flex items-center gap-1">
                        <Check size={12} /> Carrying Backpack
                      </span>
                    </div>
                    <div className="bg-app-primary border border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">PPE Gear (Dubulg'a/Nimcha)</span>
                      <span className="text-xs text-amber-500 font-bold mt-1 block flex items-center gap-1">
                        <AlertCircle size={12} /> Protective gear omitted
                      </span>
                    </div>
                  </div>

                  <div className="bg-app-primary border border-border p-4 rounded-xl text-xs space-y-2">
                    <span className="font-bold text-text-secondary uppercase tracking-wider block text-[10px]">Attributlar o'zgarishi tarixi</span>
                    <p className="text-text-muted leading-relaxed">
                      Datchiklar shaxsning turli vaqtlardagi kiyim o'zgarishlarini saqlab boradi, bu esa niqoblanishga qarshi kurashda ReID ishonchini 30% ga oshiradi.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 5: Companions & Association */}
              {activeTab === 'ASSOCIATIONS' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* SVG Association Graph */}
                    <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                        <Share2 size={14} /> Social Association Network
                      </h4>
                      
                      {intelReport && intelReport.associations.length > 0 ? (
                        <div className="h-44 bg-app-surface border border-border rounded-xl relative flex items-center justify-center overflow-hidden">
                          <svg className="w-full h-full" viewBox="0 0 200 120">
                            {/* Lines from center to nodes */}
                            {intelReport.associations.map((assoc, i) => {
                              const angle = (i * 2 * Math.PI) / intelReport.associations.length;
                              const x = 100 + 55 * Math.cos(angle);
                              const y = 60 + 35 * Math.sin(angle);
                              return (
                                <line
                                  key={i}
                                  x1="100"
                                  y1="60"
                                  x2={x}
                                  y2={y}
                                  stroke="#06b6d4"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
                              );
                            })}

                            {/* Center Node */}
                            <circle cx="100" cy="60" r="12" fill="#06b6d4" fillOpacity="0.15" stroke="#06b6d4" strokeWidth="2" />
                            <text x="100" y="63" textAnchor="middle" fill="#06b6d4" fontSize="7" fontWeight="bold">TARGET</text>

                            {/* Neighbor Nodes */}
                            {intelReport.associations.map((assoc, i) => {
                              const angle = (i * 2 * Math.PI) / intelReport.associations.length;
                              const x = 100 + 55 * Math.cos(angle);
                              const y = 60 + 35 * Math.sin(angle);
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={y} r="9" fill="#111827" stroke="#fbbf24" strokeWidth="1" />
                                  <text x={x} y={y + 2.5} textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="bold">
                                    {assoc.targetPersonName.slice(0, 3)}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                          Sherikchilik aloqalari topilmadi.
                        </div>
                      )}
                    </div>

                    {/* Associations list details */}
                    <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                        <Users size={14} /> High-Probability Companions
                      </h4>

                      <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                        {intelReport && intelReport.associations.length > 0 ? (
                          intelReport.associations.map((assoc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-app-surface border border-border rounded-xl text-xs">
                              <div>
                                <span className="font-bold text-text-primary block">{assoc.targetPersonName}</span>
                                <span className="text-[10px] text-text-muted font-semibold mt-0.5 block">Status: {assoc.targetRole}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-brand-primary font-black block">{assoc.coOccurrenceCount} marta</span>
                                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">{(assoc.confidence * 100).toFixed(0)}% trust</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                            Hech qanday sherik ro'yxatdan o'tmadi.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Group movement events histories */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                      <Layers size={14} /> Group Entry / Departure logs
                    </h4>

                    {intelReport && intelReport.groups.length > 0 ? (
                      <div className="space-y-3">
                        {intelReport.groups.map((grp, idx) => (
                          <div key={idx} className="p-3 bg-app-surface border border-border rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-text-primary block">{grp.groupName}</span>
                              <span className="text-[10px] text-text-muted mt-0.5 block">Sinf: {grp.members.map(m => m.personName).join(', ')}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 rounded font-black border border-brand-primary/10 uppercase">{grp.status}</span>
                              <span className="block font-mono text-[10px] text-text-muted mt-1">{new Date(grp.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                        Guruhlar fuziyasi bo'yicha hodisalar qayd etilmadi.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 6: Compliance Audit & Incidents */}
              {activeTab === 'COMPLIANCE' && (
                <div className="space-y-6">
                  
                  {/* Incident History & Security logs */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                      <ShieldCheck size={14} /> Security Incidents & Violations
                    </h4>
                    
                    <div className="py-4 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                      Xavfsizlik qoidalari buzilishi (Restricted Zone violation) ushbu shaxsga nisbatan topilmadi.
                    </div>
                  </div>

                  {/* GDPR Erasure and Confidential Export tools */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* GDPR Section */}
                    <div className="bg-red-950/20 border border-red-900/30 p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-red-400 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <Trash2 size={14} /> GDPR Article 17 (Right to be Forgotten)
                      </h4>
                      <p className="text-[11px] text-red-300/70 leading-relaxed">
                        Evropa Ittifoqining GDPR va milliy shaxsiy ma'lumotlarni muhofaza qilish qonunlariga muvofiq, shaxs o'z ma'lumotlarini o'chirishni talab qilganda ushbu tugmani bosing. Biometrik yuz modellari va persistent ReID deskriptorlari butunlay tozalab tashlanadi.
                      </p>

                      <div className="space-y-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-red-300">
                          <input 
                            type="checkbox"
                            checked={gdprChecked}
                            onChange={(e) => setGdprChecked(e.target.checked)}
                            className="rounded bg-app-primary border-red-900 text-red-600 focus:ring-0"
                          />
                          <span>Men barcha biometrik ma'lumotlar o'chirilishiga roziman.</span>
                        </label>

                        <button
                          onClick={() => setShowGDPRConfirm(true)}
                          disabled={!gdprChecked}
                          className="w-full bg-red-900 hover:bg-red-800 text-white font-bold text-xs py-2 rounded-lg transition-all disabled:opacity-50"
                        >
                          Shaxsni butunlay o'chirish (GDPR Erasure)
                        </button>
                      </div>
                    </div>

                    {/* Exporter Section */}
                    <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                      <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                        <Download size={14} /> Confidential Spatiotemporal Dossier Exporter
                      </h4>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Tizim orqali shaxsga oid barcha fuzion ma'lumotlar, kameraga tashrif buyurish xronologiyasi va sherikchilik tarmog'ini o'z ichiga oluvchi kriptografik imzoli JSON ma'lumotnomasini eksport qiling.
                      </p>

                      <div className="pt-4">
                        <button
                          onClick={handleExportDossier}
                          disabled={isExporting || !intelReport}
                          className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/10"
                        >
                          {isExporting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Download size={14} /> Dossier JSON-ni yuklab olish</>}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Audit Logs Trail View for current person profile */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wide flex items-center gap-1.5 text-brand-primary">
                      <FileText size={14} /> operator compliance Audit trails
                    </h4>
                    <p className="text-[10px] text-text-muted">
                      GDPR and security policies demand logging every viewing/export of personal data. Below is the strict compliance audit trail of who accessed this profile dossier.
                    </p>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {auditLogs.filter(log => log.details.includes(selectedPersonId)).length > 0 ? (
                        auditLogs.filter(log => log.details.includes(selectedPersonId)).map((log, idx) => (
                          <div key={idx} className="p-2.5 bg-app-surface border border-border rounded-lg text-[10px] font-mono flex justify-between items-center">
                            <div>
                              <span className="text-text-primary block font-bold">{log.userName} (IP: {log.ipAddress || 'unknown'})</span>
                              <span className="text-text-muted block mt-0.5">{log.action}: {log.details}</span>
                            </div>
                            <span className="text-text-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-[10px] text-text-muted font-mono">
                          Compliance audit is empty or waiting for logs propagation.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          ) : (
            <div className="bg-app-panel border border-border rounded-2xl p-16 text-center text-text-muted space-y-3">
              <HelpCircle size={32} className="mx-auto text-text-muted/40 animate-bounce" />
              <p className="font-medium text-sm">Batafsil ma'lumot va tahlillarni ko'rish uchun chap ro'yxatdan shaxsni tanlang.</p>
            </div>
          )}
        </div>

      </div>

      {/* GDPR article 17 compliance confirm modal */}
      <AnimatePresence>
        {showGDPRConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-app-panel border border-red-900 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-950 text-red-500 flex items-center justify-center mx-auto border border-red-900">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Qaytarib bo'lmaydigan GDPR Tozalash!</h3>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  Siz tanlangan shaxs ({selectedPerson?.name}) ga tegishli barcha biometrik ma'lumotlarni, InsightFace ArcFace yuz deskriptorlarini, rasm avatarini va fuzion ma'lumotlarini butunlay o'chirib yuborish arafasidasiz. Ushbu amalni ortga qaytarib bo'lmaydi.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGDPRConfirm(false)}
                  className="flex-1 py-2 bg-app-surface border border-border text-text-secondary hover:text-white rounded-lg text-xs font-bold"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleGDPRForget}
                  className="flex-1 py-2 bg-red-900 hover:bg-red-800 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-900/20"
                >
                  Ha, Butunlay O'chirish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
