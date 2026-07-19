import React, { useState, useEffect } from 'react';
import { 
  Shield, UserCheck, Users, Search, RefreshCw, Layers, ArrowRight, ArrowLeftRight, 
  MapPin, CheckCircle2, AlertTriangle, UserMinus, UserPlus, Fingerprint, Calendar, 
  Clock, Eye, HelpCircle, Activity, Info, BarChart3, Database, Sparkles, Filter, Check, Play, Sliders
} from 'lucide-react';
import { identityFusionEngine, FusedIdentity, AppearanceDescriptor, FusionEvidence } from '../services/ai/IdentityFusionEngine';
import { userService } from '../services/userService';
import { useLanguage } from '../services/i18n';
import { motion, AnimatePresence } from 'motion/react';

export const IdentityFusionConsole: React.FC = () => {
  const { t } = useLanguage();
  const [identities, setIdentities] = useState<FusedIdentity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [upperColorFilter, setUpperColorFilter] = useState<string>('ALL');
  const [clothingTypeFilter, setClothingTypeFilter] = useState<string>('ALL');
  const [hasBackpack, setHasBackpack] = useState<boolean | null>(null);
  const [hasHelmet, setHasHelmet] = useState<boolean | null>(null);
  const [hasVest, setHasVest] = useState<boolean | null>(null);

  // Merge/Split dialog states
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [targetMergeId, setTargetMergeId] = useState<string>('');
  const [operatorName, setOperatorName] = useState('Admin Operator');

  // Interactive Test Runner States
  const [testSuiteActive, setTestSuiteActive] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{ name: string; status: 'PASS' | 'RUNNING' | 'PENDING'; details: string }>>([]);

  const loadIdentities = () => {
    const data = identityFusionEngine.getAllIdentities();
    setIdentities([...data]);
    if (data.length > 0 && !selectedId) {
      setSelectedId(data[0].id);
    }
  };

  useEffect(() => {
    loadIdentities();
    const interval = setInterval(loadIdentities, 3000); // Polling update
    return () => clearInterval(interval);
  }, []);

  const selectedIdentity = identities.find(i => i.id === selectedId);

  // Compute stats
  const totalActive = identities.filter(i => i.status !== 'merged' && i.status !== 'archived').length;
  const verifiedCount = identities.filter(i => i.status === 'verified').length;
  const unknownCount = identities.filter(i => i.status === 'unknown').length;
  const avgConfidence = identities.length > 0 
    ? (identities.reduce((acc, curr) => acc + curr.confidence, 0) / identities.length) * 100 
    : 0;

  // Filtered List
  const filteredIdentities = identities.filter(identity => {
    if (identity.status === 'merged' || identity.status === 'archived') return false;

    const matchesSearch = identity.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          identity.label.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || identity.status === statusFilter.toLowerCase();
    
    const matchesUpperColor = upperColorFilter === 'ALL' || 
                              identity.appearance?.upperClothingColor?.toUpperCase() === upperColorFilter.toUpperCase();
    
    const matchesClothingType = clothingTypeFilter === 'ALL' || 
                                identity.appearance?.clothingType?.toUpperCase() === clothingTypeFilter.toUpperCase();

    const matchesBackpack = hasBackpack === null || identity.appearance?.backpack === hasBackpack;
    const matchesHelmet = hasHelmet === null || identity.appearance?.helmet === hasHelmet;
    const matchesVest = hasVest === null || identity.appearance?.vest === hasVest;

    return matchesSearch && matchesStatus && matchesUpperColor && matchesClothingType && matchesBackpack && matchesHelmet && matchesVest;
  });

  const handleMerge = async () => {
    if (!selectedId || !targetMergeId) return;
    const success = await identityFusionEngine.requestMerge(selectedId, targetMergeId, operatorName);
    if (success) {
      setIsMergeModalOpen(false);
      setTargetMergeId('');
      loadIdentities();
    } else {
      alert('Birlashtirish amalga oshmadi. Identifikatorlarni qayta tekshiring.');
    }
  };

  const handleSplit = async () => {
    if (!selectedId) return;
    const successNewId = await identityFusionEngine.requestSplit(selectedId, operatorName);
    if (successNewId) {
      setSelectedId(successNewId);
      loadIdentities();
    } else {
      alert('Ushbu shaxsni bo\'lish imkoni yo\'q (faqat bitta kamera kuzatuvi mavjud).');
    }
  };

  const runVerificationTests = async (suite: string) => {
    setTestSuiteActive(suite);
    
    // Set initial RUNNING states for UX
    if (suite === 'consistency') {
      setTestResults([
        { name: 'Multi-Camera Spatial Calibration', status: 'RUNNING', details: 'Checking coordinate transforms...' },
        { name: 'ReID Visual Consistency', status: 'PENDING', details: 'Waiting...' },
        { name: 'Temporal Coherence Limits', status: 'PENDING', details: 'Waiting...' }
      ]);
    } else {
      setTestResults([
        { name: 'Automatic Merge Engine Test', status: 'RUNNING', details: 'Fusing duplicate traces...' },
        { name: 'Split Partition Protection', status: 'PENDING', details: 'Waiting...' }
      ]);
    }

    await new Promise(r => setTimeout(r, 1200));
    
    const results = await identityFusionEngine.runVerificationTests(suite);
    setTestResults(results as any);

    await new Promise(r => setTimeout(r, 1500));
    setTestSuiteActive(null);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-status-safe-bg text-status-safe-text border-status-safe-text/20';
      case 'persistent': return 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';
      case 'temporary': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-text-muted/10 text-text-muted border-text-muted/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Doimiy Shaxslar (Persistent IDs)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{totalActive}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-status-safe-bg text-status-safe-text rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tasdiqlangan Profiler (Verified)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{verifiedCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-status-safe-bg/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Noma'lum Shaxslar (Unresolved)</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{unknownCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
            <Fingerprint className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">O'rtacha Birlashish Sifati</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{avgConfidence.toFixed(1)}%</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Identity Registry Sidebar */}
        <div className="xl:col-span-4 bg-app-panel border border-border rounded-2xl flex flex-col h-[750px] overflow-hidden">
          <div className="p-4 border-b border-border bg-app-panel shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Shield size={18} className="text-brand-primary" /> Shaxslar Reyestri
              </h3>
              <button 
                onClick={loadIdentities}
                className="p-1.5 hover:bg-app-surface text-text-muted hover:text-text-primary rounded-lg transition-colors"
                title="Yangilash"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="ID yoki Ism bo'yicha qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {/* Basic Filters row */}
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 bg-app-primary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-brand-primary"
              >
                <option value="ALL">Barcha Holatlar</option>
                <option value="VERIFIED">Tasdiqlangan</option>
                <option value="PERSISTENT">Kuzatuvda</option>
                <option value="UNKNOWN">Noma'lum</option>
              </select>
              <select
                value={upperColorFilter}
                onChange={(e) => setUpperColorFilter(e.target.value)}
                className="flex-1 bg-app-primary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-brand-primary"
              >
                <option value="ALL">Kiyim rangi (Barchasi)</option>
                <option value="Red">Qizil</option>
                <option value="Navy Blue">To'q ko'k</option>
                <option value="Dark Charcoal">To'q kulrang</option>
                <option value="White">Oq</option>
                <option value="Forest Green">Yashil</option>
              </select>
            </div>
          </div>

          {/* List area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border custom-scrollbar">
            {filteredIdentities.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm space-y-2">
                <Info size={24} className="mx-auto text-text-muted/50" />
                <p>Qidiruv bo'yicha hech qanday shaxs topilmadi.</p>
              </div>
            ) : (
              filteredIdentities.map((identity) => {
                const isSelected = identity.id === selectedId;
                return (
                  <button
                    key={identity.id}
                    onClick={() => setSelectedId(identity.id)}
                    className={`w-full text-left p-4 hover:bg-app-surface transition-colors flex flex-col gap-2 relative border-l-2
                      ${isSelected ? 'bg-app-surface border-brand-primary' : 'border-transparent'}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-mono text-xs text-text-muted uppercase tracking-wider font-bold">
                        {identity.id}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(identity.status)}`}>
                        {identity.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-text-primary text-sm truncate">
                      {identity.label}
                    </h4>

                    <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span className="bg-app-primary px-2 py-0.5 rounded font-medium border border-border">
                        {identity.appearance?.upperClothingColor} kiyim
                      </span>
                      <span className="bg-app-primary px-2 py-0.5 rounded font-medium border border-border">
                        {identity.appearance?.clothingType}
                      </span>
                      {identity.appearance?.backpack && (
                        <span className="bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded font-bold border border-brand-primary/20">
                          Ryukzak
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-text-muted font-mono mt-1 pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {new Date(identity.lastSeen).toLocaleTimeString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> Cam {identity.lastCameraId.split('-')[1] || identity.lastCameraId}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center Panel: Identity Fusion workspace detail */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {selectedIdentity ? (
            <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
              
              {/* Profile Card Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary shadow-xl">
                    <Fingerprint size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-text-muted font-bold tracking-widest">{selectedIdentity.id}</span>
                      <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(selectedIdentity.status)}`}>
                        {selectedIdentity.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-text-primary mt-1">{selectedIdentity.label}</h2>
                    <p className="text-xs text-text-muted font-medium mt-1">
                      Kuzatuvga olingan: <span className="font-mono">{new Date(selectedIdentity.firstSeen).toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* Operator Actions */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsMergeModalOpen(true)}
                    className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-xs px-4 py-2 rounded-xl border border-brand-primary/20 flex items-center gap-2 transition-all active:scale-95"
                  >
                    <ArrowLeftRight size={14} /> Shaxsni Birlashtirish
                  </button>
                  <button 
                    onClick={handleSplit}
                    className="bg-app-surface hover:bg-border/30 text-text-secondary font-bold text-xs px-4 py-2 rounded-xl border border-border flex items-center gap-2 transition-all active:scale-95"
                    title="Bo'lish"
                  >
                    <UserMinus size={14} /> Trassani Bo'lish
                  </button>
                </div>
              </div>

              {/* Grid Layout of Submodules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual Appearance Attributes */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <Sliders size={14} className="text-brand-primary" /> Visual Tashqi Ko'rinish Atributlari
                  </h4>
                  <div className="bg-app-primary border border-border p-4 rounded-xl space-y-3.5">
                    <div className="grid grid-cols-2 gap-3.5 text-sm">
                      <div className="bg-app-panel p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider">Ustki kiyim rangi</span>
                        <span className="font-semibold text-text-primary mt-1 block">{selectedIdentity.appearance?.upperClothingColor}</span>
                      </div>
                      <div className="bg-app-panel p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider">Pastki kiyim rangi</span>
                        <span className="font-semibold text-text-primary mt-1 block">{selectedIdentity.appearance?.lowerClothingColor}</span>
                      </div>
                      <div className="bg-app-panel p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider">Kiyim turi</span>
                        <span className="font-semibold text-text-primary mt-1 block">{selectedIdentity.appearance?.clothingType}</span>
                      </div>
                      <div className="bg-app-panel p-2.5 rounded-lg border border-border">
                        <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider">Poyabzal rangi</span>
                        <span className="font-semibold text-text-primary mt-1 block">{selectedIdentity.appearance?.shoes}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2
                        ${selectedIdentity.appearance?.backpack ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-app-panel border-border text-text-muted'}`}>
                        <span>Ryukzak bor</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2
                        ${selectedIdentity.appearance?.helmet ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-app-panel border-border text-text-muted'}`}>
                        <span>Kaska bor</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2
                        ${selectedIdentity.appearance?.vest ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-app-panel border-border text-text-muted'}`}>
                        <span>Nimcha bor</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spatial trajectory map summary */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={14} className="text-brand-primary" /> Harakat Tarixi & Raqamli Egizak
                  </h4>
                  <div className="bg-app-primary border border-border p-4 rounded-xl flex flex-col h-[220px]">
                    <div className="flex-1 relative bg-app-panel border border-border/60 rounded-lg overflow-hidden flex items-center justify-center">
                      {/* Grid representation */}
                      <div className="absolute inset-0 bg-grid-panning opacity-10" />
                      
                      {/* Trajectory visualization lines */}
                      <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100">
                        {selectedIdentity.movementHistory?.map((m, idx, arr) => {
                          if (idx === 0) return null;
                          const prev = arr[idx - 1];
                          const x1 = 50 + prev.position.x * 3.5;
                          const y1 = 50 + prev.position.z * 3.5;
                          const x2 = 50 + m.position.x * 3.5;
                          const y2 = 50 + m.position.z * 3.5;
                          return (
                            <line 
                              key={idx} 
                              x1={x1} y1={y1} x2={x2} y2={y2} 
                              stroke="var(--color-brand-primary)" 
                              strokeWidth="2" 
                              strokeDasharray="1 1"
                            />
                          );
                        })}
                        {selectedIdentity.movementHistory?.map((m, idx) => {
                          const x = 50 + m.position.x * 3.5;
                          const y = 50 + m.position.z * 3.5;
                          const isLast = idx === selectedIdentity.movementHistory?.length - 1;
                          return (
                            <circle 
                              key={idx} 
                              cx={x} cy={y} 
                              r={isLast ? 4 : 2} 
                              fill={isLast ? 'var(--color-brand-primary)' : 'var(--color-text-muted)'} 
                            />
                          );
                        })}
                      </svg>
                      
                      <div className="absolute top-2 left-2 bg-app-primary/80 px-2 py-0.5 rounded border border-border text-[10px] text-text-muted font-mono">
                        Xarita Traektoriya Proeksiyasi
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Fusion Evidence timeline */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Database size={14} className="text-brand-primary" /> Fuzion Isbot-Dalillar Tarixi (Evidence Log)
                </h4>
                <div className="bg-app-primary border border-border rounded-xl divide-y divide-border/60 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {selectedIdentity.evidenceHistory?.map((evidence, idx) => (
                    <div key={idx} className="p-3 text-xs flex items-start gap-3 hover:bg-app-panel transition-colors">
                      <div className="p-1.5 bg-brand-primary/10 text-brand-primary rounded font-bold text-[10px]">
                        {evidence.sourceType}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-text-primary font-medium">{evidence.description}</p>
                        <p className="text-[10px] text-text-muted font-mono">
                          Ishonchlilik: <span className="text-brand-primary">{(evidence.confidence * 100).toFixed(1)}%</span> • 
                          Kamera: {evidence.cameraId} • {new Date(evidence.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-app-panel border border-border rounded-2xl p-12 text-center text-text-muted space-y-4">
              <Shield size={48} className="mx-auto text-text-muted/40 animate-pulse" />
              <h3>Batafsil ma'lumotlarni ko'rish uchun shaxsni tanlang</h3>
            </div>
          )}

          {/* Verification and Testing Suite Controls */}
          <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Sparkles size={18} className="text-brand-primary" /> Avtomatlashtirilgan Tekshiruv & Sinov Stendi (Enterprise Verification)
              </h3>
              <span className="text-[10px] bg-brand-primary/10 text-brand-primary font-bold px-2 py-0.5 rounded-full border border-brand-primary/25">
                QA STANDARDS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-app-primary border border-border p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Multi-kamerali ReID & Spatial Verification</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Yuz ko'rinmagan holatlarda spatial va visual atributlar orqali odam izchilligi va koordinatalar integratsiyasini simulyatsiya qiladi.
                  </p>
                </div>
                <button
                  disabled={testSuiteActive !== null}
                  onClick={() => runVerificationTests('consistency')}
                  className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2 px-3 rounded-lg shadow-lg shadow-brand-primary/20 mt-4 self-start flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Play size={12} /> Testni Boshlash
                </button>
              </div>

              <div className="bg-app-primary border border-border p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Split & Merge Integrity Suite</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Trassalarni qo'lda yoki avtomatik bo'lish va birlashtirish jarayonlarida ma'lumotlar yaxlitligini va referensial barqarorligini sinovdan o'tkazadi.
                  </p>
                </div>
                <button
                  disabled={testSuiteActive !== null}
                  onClick={() => runVerificationTests('merge_split')}
                  className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2 px-3 rounded-lg shadow-lg shadow-brand-primary/20 mt-4 self-start flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Play size={12} /> Testni Boshlash
                </button>
              </div>
            </div>

            {/* Test Results Display */}
            {testResults.length > 0 && (
              <div className="bg-app-primary border border-border p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase">
                  <Activity size={14} className="text-brand-primary animate-pulse" /> Sinov Natijalari
                </div>
                <div className="space-y-2">
                  {testResults.map((res, i) => (
                    <div key={i} className="flex justify-between items-start text-xs bg-app-panel p-2.5 rounded-lg border border-border">
                      <div className="space-y-1">
                        <span className="font-bold text-text-primary">{res.name}</span>
                        <p className="text-text-muted">{res.details}</p>
                      </div>
                      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border
                        ${res.status === 'PASS' ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/20' : 
                          res.status === 'RUNNING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse' : 
                          'bg-text-muted/10 text-text-muted border-text-muted/20'}`}>
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Merge Dialog Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-app-panel border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
              <Layers className="text-brand-primary" /> Qo'lda Shaxsni Birlashtirish
            </h3>
            
            <p className="text-xs text-text-muted leading-relaxed">
              Agar operator bir xil shaxs ikki xil vaqtda yoki boshqa kiyimda turli kamera oqimlarida yangi identifikator olganligini tasdiqlasa, ushbu jarayon orqali ular bitta persistent shaxs qatoriga birlashtiriladi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Tanlangan Asosiy Shaxs ID</label>
                <input 
                  type="text" 
                  value={selectedId || ''} 
                  disabled
                  className="w-full bg-app-primary border border-border rounded-lg p-2 text-sm text-text-primary font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Birlashtiriluvchi Shaxs (Target ID)</label>
                <select
                  value={targetMergeId}
                  onChange={(e) => setTargetMergeId(e.target.value)}
                  className="w-full bg-app-primary border border-border rounded-lg p-2 text-sm text-text-primary outline-none focus:border-brand-primary"
                >
                  <option value="">Birlashtiriladigan ID ni tanlang</option>
                  {identities
                    .filter(i => i.id !== selectedId && i.status !== 'merged' && i.status !== 'archived')
                    .map(i => (
                      <option key={i.id} value={i.id}>{i.id} - {i.label}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">Operator Ismi</label>
                <input 
                  type="text" 
                  value={operatorName} 
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-app-primary border border-border rounded-lg p-2 text-sm text-text-primary outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="flex-1 bg-app-surface hover:bg-border/30 text-text-secondary font-bold text-xs py-2.5 rounded-xl border border-border transition-all"
              >
                Bekor Qilish
              </button>
              <button
                onClick={handleMerge}
                disabled={!targetMergeId}
                className="flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-brand-primary/10 transition-all disabled:opacity-50"
              >
                Birlashtirishni Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
