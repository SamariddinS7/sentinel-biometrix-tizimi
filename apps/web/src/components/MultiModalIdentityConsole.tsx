import React, { useState, useEffect } from 'react';
import { 
  Shield, Layers, Sparkles, Filter, Check, Play, Sliders, Info, Eye, 
  Activity, Database, CheckCircle2, AlertTriangle, RefreshCw, User, Cpu, 
  AlertCircle, Bookmark, Radio, Navigation, Network, Zap, Settings, TrendingUp,
  Clock, Compass, Users, Share2, ArrowRight, AlertOctagon, Fingerprint, FileText, PlusCircle
} from 'lucide-react';
import { multiModalIdentityEngine, MultiModalIdentity, ModalityPlugin, ExplainableConfidence } from '../services/ai/MultiModalIdentityEngine';
import { movementIntelligenceEngine, MovementIntelligenceReport } from '../services/ai/MovementIntelligenceEngine';
import { motion, AnimatePresence } from 'motion/react';

export const MultiModalIdentityConsole: React.FC = () => {
  const [identities, setIdentities] = useState<MultiModalIdentity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<ModalityPlugin[]>([]);
  const [activeTab, setActiveTab] = useState<'IDENTITIES' | 'INTELLIGENCE' | 'PLUGINS' | 'DIAGNOSTICS'>('IDENTITIES');

  // Movement & Relationship Intelligence State
  const [intelReport, setIntelReport] = useState<MovementIntelligenceReport | null>(null);
  const [intelStats, setIntelStats] = useState<any>(null);
  const [isObserving, setIsObserving] = useState(false);
  const [observationForm, setObservationForm] = useState({
    cameraId: 'cam_03',
    cameraName: 'Server Xonasi Kirish',
    zoneId: 'zone_restricted',
    zoneName: 'Server Xonasi (Cheklangan Hudud)'
  });

  // Interactive diagnostic tests
  const [diagnosticActive, setDiagnosticActive] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{ testName: string; status: 'SUCCESS' | 'FAILURE'; log: string }>>([]);

  const loadData = () => {
    const list = multiModalIdentityEngine.getAllIdentities();
    setIdentities(list);
    setPlugins([...multiModalIdentityEngine.getPlugins()]);

    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
    }
  };

  useEffect(() => {
    // Sync Movement Intelligence statistics and current person report
    const stats = movementIntelligenceEngine.getSystemStats();
    setIntelStats(stats);

    if (selectedId) {
      const report = movementIntelligenceEngine.compileMovementReport(selectedId);
      setIntelReport(report);
    }
  }, [selectedId, activeTab]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePlugin = (pluginId: string) => {
    multiModalIdentityEngine.togglePlugin(pluginId);
    loadData();
  };

  const runSystemDiagnostics = async () => {
    setDiagnosticActive(true);
    setDiagnosticLogs([]);
    await new Promise(r => setTimeout(r, 800)); // Short artificial delay for UX

    const logs = multiModalIdentityEngine.runDiagnosticTests();

    setDiagnosticLogs(logs);
    setDiagnosticActive(false);
  };

  const selectedIdentity = identities.find(id => id.id === selectedId);

  // Stats calculation
  const totalMM = identities.length;
  const verifiedCount = identities.filter(id => id.status === 'verified').length;
  const avgConfidence = totalMM > 0 
    ? (identities.reduce((acc, curr) => acc + curr.confidence.overallScore, 0) / totalMM * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Enterprise Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Multi-Modal Global IDs</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{totalMM}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-brand-primary/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-status-safe-bg text-status-safe-text rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Tasdiqlangan shaxslar</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{verifiedCount}</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-status-safe-bg/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">O'rtacha ishonch darajasi</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">{avgConfidence}%</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Faol AI modalliklari</p>
            <h4 className="text-2xl font-black mt-1 text-text-primary">8 / 8</h4>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none" />
        </div>
      </div>

      {/* Primary Section Switcher */}
      <div className="flex border-b border-border/80 gap-6 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('IDENTITIES')}
          className={`pb-3 font-bold text-sm relative transition-all ${activeTab === 'IDENTITIES' ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {activeTab === 'IDENTITIES' && <motion.div layoutId="mmActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
          Global Identifikatsiyalar (MIIE)
        </button>
        <button
          onClick={() => setActiveTab('INTELLIGENCE')}
          className={`pb-3 font-bold text-sm relative transition-all ${activeTab === 'INTELLIGENCE' ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {activeTab === 'INTELLIGENCE' && <motion.div layoutId="mmActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
          Harakat & Munosabatlar Tahlili (Intelligence)
        </button>
        <button
          onClick={() => setActiveTab('PLUGINS')}
          className={`pb-3 font-bold text-sm relative transition-all ${activeTab === 'PLUGINS' ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {activeTab === 'PLUGINS' && <motion.div layoutId="mmActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
          AI Modallik Plaginlari ({plugins.length})
        </button>
        <button
          onClick={() => setActiveTab('DIAGNOSTICS')}
          className={`pb-3 font-bold text-sm relative transition-all ${activeTab === 'DIAGNOSTICS' ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {activeTab === 'DIAGNOSTICS' && <motion.div layoutId="mmActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
          Modallik Integratsiyasi Diagnostikasi
        </button>
      </div>

      {activeTab === 'IDENTITIES' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Active Global MM Profiles */}
          <div className="xl:col-span-4 bg-app-panel border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
              <Radio size={16} className="text-brand-primary animate-pulse" /> Global Persistent Registry
            </h3>

            {identities.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <AlertCircle className="mx-auto text-text-muted/40" size={28} />
                <p className="text-xs">Tizimda hozircha global persistent shaxslar mavjud emas. Kamera oqimidan ob'ektlar aniqlanganda yaratiladi.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {identities.map(identity => {
                  const isSelected = identity.id === selectedId;
                  return (
                    <div
                      key={identity.id}
                      onClick={() => setSelectedId(identity.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group flex justify-between items-center
                        ${isSelected ? 'bg-app-surface border-brand-primary ring-1 ring-brand-primary/10' : 'bg-app-primary border-border hover:border-brand-primary/40'}`}
                    >
                      <div>
                        <span className="font-mono text-[9px] font-bold tracking-widest text-text-muted uppercase">{identity.id}</span>
                        <h4 className="font-bold text-text-primary text-sm mt-0.5">{identity.label}</h4>
                        <span className="text-[10px] text-text-muted block mt-1">So'nggi kamera: Camera {identity.lastCameraId}</span>
                      </div>

                      <div className="text-right space-y-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border block w-max ml-auto
                          ${identity.status === 'verified' ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/10' : 
                            identity.status === 'temporary' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/10' : 
                            'bg-app-primary border-border text-text-muted'}`}>
                          {identity.status === 'verified' ? 'Tasdiqlangan' : identity.status === 'temporary' ? 'Vaqtincha' : identity.status}
                        </span>
                        
                        <div className="text-[11px] font-mono font-black text-brand-primary">
                          {(identity.confidence.overallScore * 100).toFixed(0)}% Match
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Integrated multi-modal metrics detail */}
          <div className="xl:col-span-8 space-y-6">
            {selectedIdentity ? (
              <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
                
                {/* ID Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-app-primary border border-border rounded-xl">
                  <div>
                    <span className="font-mono text-[10px] text-brand-primary font-bold tracking-widest block uppercase">GLOBAL MULTI-MODAL PROFILE</span>
                    <h2 className="text-xl font-black text-text-primary mt-0.5">{selectedIdentity.label} ({selectedIdentity.id})</h2>
                    <span className="text-xs text-text-muted">Birinchi ko'rish: {new Date(selectedIdentity.firstSeen).toLocaleTimeString()} | Rol: {selectedIdentity.role}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-bold uppercase tracking-wider block text-right">Fuzion ishonch:</span>
                    <span className="text-2xl font-black text-brand-primary font-mono bg-brand-primary/5 px-3 py-1.5 rounded-lg border border-brand-primary/15">
                      {(selectedIdentity.confidence.overallScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Confidence Breakdown Bars */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-text-primary text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <Sliders size={14} className="text-brand-primary" /> Modallik bo'yicha ishonch tahlili
                    </h4>

                    <div className="space-y-2.5 text-xs">
                      {[
                        { label: 'Face Score (InsightFace)', val: selectedIdentity.confidence.faceScore },
                        { label: 'ReID Score (OSNet)', val: selectedIdentity.confidence.reidScore },
                        { label: 'Appearance Score (26 Attr)', val: selectedIdentity.confidence.appearanceScore },
                        { label: 'Pose Score (RTMPose)', val: selectedIdentity.confidence.poseScore },
                        { label: 'Gait Score (OpenGait)', val: selectedIdentity.confidence.gaitScore },
                        { label: 'Movement Score (Markov)', val: selectedIdentity.confidence.movementScore },
                        { label: 'Historical Continuity', val: selectedIdentity.confidence.historicalScore },
                        { label: 'Sensor Signal Quality', val: selectedIdentity.confidence.qualityScore },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between font-medium text-text-secondary text-[11px]">
                            <span>{item.label}</span>
                            <span className="font-mono font-bold">{(item.val * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-border/40 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-brand-primary h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.val * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RTMPose 17-Keypoint Human Skeleton Simulation */}
                  <div className="bg-app-primary border border-border p-5 rounded-xl space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-text-primary text-xs flex items-center gap-1.5 uppercase tracking-wide">
                        <User size={14} className="text-brand-primary" /> RTMPose-M Skeletons (17 Keypoints)
                      </h4>
                      <p className="text-[10px] text-text-muted mt-1">Shaxsning tana holati va harakati 3D fazoda real vaqtda kuzatilmoqda.</p>
                    </div>

                    <div className="h-48 bg-app-surface border border-border rounded-lg relative flex items-center justify-center p-3 overflow-hidden">
                      {selectedIdentity.poseSkeleton.length > 0 ? (
                        <div className="relative w-28 h-40">
                          {selectedIdentity.poseSkeleton.slice(0, 17).map((kp, i) => (
                            <div 
                              key={i} 
                              className="absolute w-2 h-2 rounded-full bg-status-safe-text border border-white shadow animate-ping"
                              style={{ 
                                left: `${kp.x}%`, 
                                top: `${kp.y}%` 
                              }}
                              title={`${kp.name}: ${(kp.confidence * 100).toFixed(0)}% confidence`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-text-muted font-mono block text-center">Haqiqiy pose ma'lumoti mavjud emas</span>
                      )}
                    </div>

                    {selectedIdentity.poseSkeleton.length > 0 && (
                      <span className="text-[9px] text-text-muted font-mono block text-center">{selectedIdentity.poseSkeleton.length} keypoints matched successfully</span>
                    )}
                  </div>

                </div>

                {/* Gait Signature Waveform Detail */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-app-primary border border-border rounded-xl items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">GaitGL Walking Signature</span>
                    <h4 className="font-bold text-text-primary text-sm">Yurish biometrikasi (Gait)</h4>
                    <p className="text-[11px] text-text-muted leading-relaxed">Masofaviy yoki yuz ko'rinmagan holatlarda shaxsni tasdiqlash uchun yurish dinamikasi.</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div><span className="font-bold text-text-secondary">Qadam uzunligi (Stride):</span> <span className="font-mono font-bold text-brand-primary">{selectedIdentity.gaitSignature.strideLengthCm} cm</span></div>
                    <div><span className="font-bold text-text-secondary">Temp (Cadence):</span> <span className="font-mono font-bold text-brand-primary">{selectedIdentity.gaitSignature.cadenceStepsMin} qadam/min</span></div>
                    <div><span className="font-bold text-text-secondary">Simmetriya indeksi:</span> <span className="font-mono font-bold text-brand-primary">{(selectedIdentity.gaitSignature.symmetryIndex * 100).toFixed(0)}%</span></div>
                  </div>

                  <div className="h-16 flex items-end gap-1 px-3 py-1 bg-app-surface border border-border rounded-lg overflow-hidden">
                    {selectedIdentity.gaitSignature.signatureVector.length > 0 ? (
                      selectedIdentity.gaitSignature.signatureVector.slice(0, 18).map((val, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-brand-primary/80 rounded-t"
                          style={{ height: `${Math.max(10, val * 100)}%` }}
                        />
                      ))
                    ) : (
                      <span className="text-[10px] text-text-muted font-mono m-auto">Haqiqiy gait ma'lumoti mavjud emas</span>
                    )}
                  </div>
                </div>

                {/* Spatiotemporal and cross-camera mapping status */}
                <div className="flex flex-wrap gap-4 justify-between items-center pt-4 border-t border-border/60">
                  <div className="flex gap-4 text-xs text-text-muted">
                    <div>
                      <span className="font-bold text-text-secondary">Bog'langan regional fuzionlar:</span>
                      <div className="flex gap-1.5 mt-1">
                        {selectedIdentity.associatedFusions.map((f, i) => (
                          <span key={i} className="bg-app-primary border border-border px-2.5 py-0.5 rounded font-mono text-[10px] text-text-primary font-bold">{f}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-text-secondary">Tashrif buyurilgan hududlar (Cameras):</span>
                      <div className="flex gap-1 mt-1">
                        {selectedIdentity.visitedZones.map((z, i) => (
                          <span key={i} className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded font-mono text-[10px] font-bold">Cam {z}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider bg-app-primary border border-border px-2.5 py-1 rounded-lg">
                    Spatiotemporal coordinates updated live
                  </span>
                </div>

              </div>
            ) : (
              <div className="bg-app-panel border border-border rounded-2xl p-16 text-center text-text-muted space-y-3">
                <AlertCircle size={32} className="mx-auto text-text-muted/40" />
                <p className="font-medium text-sm">Batafsil ma'lumot olish uchun shaxs profilini tanlang.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'INTELLIGENCE' && (
        <div className="space-y-6">
          {/* Spatiotemporal Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Umumiy Detections</p>
                <h4 className="text-xl font-black mt-0.5 text-text-primary">{intelStats?.totalDetections || 0}</h4>
              </div>
            </div>

            <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Aniqlangan Guruhlar</p>
                <h4 className="text-xl font-black mt-0.5 text-text-primary">{intelStats?.totalGroups || 0}</h4>
              </div>
            </div>

            <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Harakatlanish Yo'nalishlari</p>
                <h4 className="text-xl font-black mt-0.5 text-text-primary">{intelStats?.totalRoutes || 0}</h4>
              </div>
            </div>

            <div className="bg-app-panel border border-border p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden">
              <div className={`p-3 rounded-xl ${intelStats?.totalAnomalous > 0 ? 'bg-status-critical-bg text-status-critical-text' : 'bg-status-safe-bg text-status-safe-text'}`}>
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Shubhali Harakatlar</p>
                <h4 className="text-xl font-black mt-0.5 text-text-primary">{intelStats?.totalAnomalous || 0} ({intelStats?.anomalyRatio?.toFixed(1) || '0.0'}%)</h4>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Relationship Mapping & Sighting Simulator */}
            <div className="xl:col-span-5 space-y-6">
              
              {/* Relationship Network Graph Card */}
              <div className="bg-app-panel border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                  <Share2 size={16} className="text-brand-primary" /> Sherikchilik va Aloqalar Diagrammasi
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Kameradan olingan ob'ektlarning vaqt va makon bo'yicha bog'lanishlarini ko'rsatuvchi diagramma.
                </p>

                {intelReport && intelReport.associations.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-44 bg-app-surface border border-border rounded-xl relative flex items-center justify-center overflow-hidden">
                      {/* SVG Relationship Graph */}
                      <svg className="w-full h-full" viewBox="0 0 200 120">
                        {/* Lines from center to nodes */}
                        {intelReport.associations.map((assoc, i) => {
                          const angle = (i * 2 * Math.PI) / intelReport.associations.length;
                          const x = 100 + 60 * Math.cos(angle);
                          const y = 60 + 40 * Math.sin(angle);
                          return (
                            <line
                              key={i}
                              x1="100"
                              y1="60"
                              x2={x}
                              y2={y}
                              stroke="#fbbf24"
                              strokeWidth="1.5"
                              strokeDasharray="2,2"
                            />
                          );
                        })}

                        {/* Center Node */}
                        <circle cx="100" cy="60" r="14" fill="#fbbf24" fillOpacity="0.2" stroke="#fbbf24" strokeWidth="2" />
                        <text x="100" y="63" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="bold">ID</text>

                        {/* Neighbor Nodes */}
                        {intelReport.associations.map((assoc, i) => {
                          const angle = (i * 2 * Math.PI) / intelReport.associations.length;
                          const x = 100 + 60 * Math.cos(angle);
                          const y = 60 + 40 * Math.sin(angle);
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="10" fill="#1f2937" stroke="#fbbf24" strokeWidth="1.5" />
                              <text x={x} y={y + 3} textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="bold">
                                {assoc.targetPersonName.slice(0, 3)}..
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Sheriklar ro'yxati</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {intelReport.associations.map((assoc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-app-primary border border-border rounded-xl text-xs">
                            <div>
                              <div className="font-bold text-text-primary">{assoc.targetPersonName}</div>
                              <div className="text-[10px] text-text-muted">Roli: {assoc.targetRole} | So'nggi sighting: {new Date(assoc.lastObserved).toLocaleTimeString()}</div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-brand-primary block">{assoc.coOccurrenceCount} marta</span>
                              <span className="text-[9px] text-status-safe-text bg-status-safe-bg/10 px-1.5 py-0.5 rounded font-bold uppercase">{(assoc.confidence * 100).toFixed(0)}% ishonch</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                    Bu obyekt bilan birga ko'p marta harakatlangan boshqa biror sherik aniqlanmadi.
                  </div>
                )}
              </div>

              {/* Sighting Simulator Box */}
              <div className="bg-app-panel border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                  <PlusCircle size={16} className="text-brand-primary" /> Kamera Kuzatuvini Simulyatsiya Qilish
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Ushbu shaxsni real vaqtda biror kamerada aniqlangan deb belgilang. Tizim harakat yo'nalishlarini, guruhlarni va shubhali tahlillarni darhol yangilaydi.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1">Kamerani Tanlang</label>
                    <select
                      value={observationForm.cameraId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cams: Record<string, { name: string; zoneId: string; zoneName: string }> = {
                          'cam_01': { name: 'Asosiy Kirish (Sharqiy Darvoza)', zoneId: 'zone_entrance', zoneName: 'Kirish Nazorati' },
                          'cam_02': { name: 'Xavfsiz Hudud Koridor (B Blok)', zoneId: 'zone_corridor', zoneName: 'Asosiy Koridor' },
                          'cam_03': { name: 'Server Xonasi Kirish', zoneId: 'zone_restricted', zoneName: 'Server Xonasi (Cheklangan Hudud)' },
                          'cam_04': { name: 'Konferentsiya Zali', zoneId: 'zone_corridor', zoneName: 'Konferentsiya Hududi' },
                          'cam_05': { name: 'G\'arbiy Chiqish Yo\'lagi', zoneId: 'zone_exit', zoneName: 'Chiqish Darvozasi' }
                        };
                        setObservationForm({
                          cameraId: val,
                          cameraName: cams[val].name,
                          zoneId: cams[val].zoneId,
                          zoneName: cams[val].zoneName
                        });
                      }}
                      className="w-full bg-app-surface border border-border p-2 rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                    >
                      <option value="cam_01">Asosiy Kirish (Kamera 1)</option>
                      <option value="cam_02">Asosiy Koridor (Kamera 2)</option>
                      <option value="cam_03">Server Xonasi Kirish (Kamera 3 - CHEKLANGAN)</option>
                      <option value="cam_04">Konferentsiya Zali (Kamera 4)</option>
                      <option value="cam_05">G'arbiy Chiqish Yo'lagi (Kamera 5)</option>
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      if (!selectedIdentity) return;
                      setIsObserving(true);
                      try {
                        const response = await fetch('/api/intelligence/observe', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            personId: selectedIdentity.id,
                            personName: selectedIdentity.label,
                            role: selectedIdentity.role,
                            cameraId: observationForm.cameraId,
                            cameraName: observationForm.cameraName,
                            zoneId: observationForm.zoneId,
                            zoneName: observationForm.zoneName,
                            timestamp: new Date().toISOString()
                          })
                        });
                        if (response.ok) {
                          alert(`Kuzatuv muvaffaqiyatli qayd etildi: ${selectedIdentity.label} -> ${observationForm.cameraName}`);
                          const stats = movementIntelligenceEngine.getSystemStats();
                          setIntelStats(stats);
                          const report = movementIntelligenceEngine.compileMovementReport(selectedIdentity.id);
                          setIntelReport(report);
                        }
                      } catch (err) {
                        console.error("Failed to log observation:", err);
                      } finally {
                        setIsObserving(false);
                      }
                    }}
                    disabled={isObserving || !selectedIdentity}
                    className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2.5 rounded-xl transition-all disabled:opacity-50"
                  >
                    {isObserving ? 'Hisoblanmoqda...' : 'Sightingni Qayd Etish'}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Route timeline & frequent patterns */}
            <div className="xl:col-span-7 space-y-6">
              {intelReport ? (
                <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
                  {/* Summary & Anomaly Index card */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 bg-app-primary border border-border rounded-xl">
                    <div className="space-y-1">
                      <span className="text-[10px] text-brand-primary font-bold uppercase tracking-widest block">INTEL SUMMARY REPORT</span>
                      <h4 className="text-sm font-bold text-text-primary">{intelReport.personName} ({intelReport.personId})</h4>
                      <p className="text-xs text-text-muted leading-relaxed">{intelReport.summaryNotes}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-text-muted block uppercase">Xulq-atvor Shubha Koeffitsienti</span>
                      <span className={`text-2xl font-black font-mono block mt-1 ${intelReport.anomalyScore > 0.3 ? 'text-status-critical-text' : 'text-status-safe-text'}`}>
                        {(intelReport.anomalyScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Frequent Route Patterns Flow Chart */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Compass size={14} className="text-brand-primary" /> Takrorlanuvchi Harakat Marshrutlari
                    </h4>
                    
                    {intelReport.frequentRoutes.length > 0 ? (
                      <div className="space-y-3">
                        {intelReport.frequentRoutes.map((route, idx) => (
                          <div key={idx} className="p-3 bg-app-primary border border-border rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-text-primary">Marshrut {idx + 1}</span>
                              <span className="text-[11px] font-mono font-bold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
                                {route.frequency} marta kuzatildi | O'rtacha {route.avgDurationSec} sek
                              </span>
                            </div>
                            
                            {/* Horizontal visual arrow nodes */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {route.cameras.map((node, i) => (
                                <React.Fragment key={i}>
                                  <span className="bg-app-surface border border-border px-2.5 py-1 rounded text-[11px] font-semibold text-text-secondary">
                                    {node}
                                  </span>
                                  {i < route.cameras.length - 1 && (
                                    <ArrowRight size={12} className="text-text-muted" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                        Marshrutlar aniqlanishi uchun ko'proq kuzatuvlar to'planishi lozim.
                      </div>
                    )}
                  </div>

                  {/* Chronological Vertical Sighting Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-brand-primary" /> Batafsil Harakatlar Xronologiyasi
                    </h4>

                    {intelReport.routes.length > 0 ? (
                      <div className="relative pl-6 border-l border-border/80 space-y-5 py-2">
                        {intelReport.routes.map((route, idx) => (
                          <div key={idx} className={`p-4 rounded-xl border relative transition-all
                            ${route.isAbnormal ? 'bg-status-critical-bg/20 border-status-critical-text/40' : 'bg-app-primary border-border hover:border-brand-primary/30'}`}
                          >
                            {/* Marker dot on the vertical line */}
                            <div className={`absolute -left-[31px] top-6 w-3 h-3 rounded-full border-2 
                              ${route.isAbnormal ? 'bg-status-critical-text border-status-critical-text' : 'bg-brand-primary border-app-surface'}`}
                            />

                            <div className="flex justify-between items-start text-xs font-bold">
                              <div>
                                <span className="font-mono text-[9px] uppercase block tracking-wider text-text-muted">{route.id}</span>
                                <h5 className="text-text-primary text-sm mt-0.5">
                                  {route.path[0]?.cameraName} ➔ {route.path[route.path.length - 1]?.cameraName}
                                </h5>
                              </div>
                              <span className="font-mono text-[10px] text-text-muted">
                                {new Date(route.startTime).toLocaleTimeString()} - {new Date(route.endTime).toLocaleTimeString()}
                              </span>
                            </div>

                            {route.isAbnormal && (
                              <div className="mt-2.5 p-2 bg-status-critical-bg text-status-critical-text rounded-lg text-xs font-semibold flex items-center gap-1.5">
                                <AlertTriangle size={13} /> {route.anomalyReason}
                              </div>
                            )}

                            <div className="mt-3 text-xs space-y-1 text-text-muted">
                              <div><span className="font-bold text-text-secondary">Harakatlangan yo'lagi:</span> {route.path.map(p => p.cameraName).join(' ➔ ')}</div>
                              <div><span className="font-bold text-text-secondary">Dwell Time (Tashrif muddati):</span> <span className="font-mono">{route.durationSec} soniya</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-text-muted border border-border border-dashed rounded-xl">
                        Kronologiya bo'sh. Simulyator orqali harakat qo'shing.
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="bg-app-panel border border-border rounded-2xl p-16 text-center text-text-muted space-y-3">
                  <Fingerprint size={32} className="mx-auto text-text-muted/40" />
                  <p className="font-medium text-sm">Harakatlar tahlilini ko'rish uchun chap tomondan global persistant shaxsni tanlang.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PLUGINS' && (
        <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Settings size={18} className="text-brand-primary" /> Modular AI Modality Plugins
            </h3>
            <span className="text-xs bg-app-primary border border-border px-2.5 py-1 rounded-lg text-text-muted font-mono">
              DYNAMIC GPU SCHEDULER ACTIVE
            </span>
          </div>

          <p className="text-xs text-text-muted leading-relaxed max-w-3xl">
            Tizim butunlay plugin-ga asoslangan. Istalgan modal plaginni boshqasiga almashtirish yoki yangilash mumkin. Plagin o'chirilgan holatda MIIE fuzion ishonch formulasi boshqa faol signallarni ko'proq inobatga oladi.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map(plugin => (
              <div 
                key={plugin.id} 
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 relative overflow-hidden
                  ${plugin.status === 'ACTIVE' ? 'bg-app-surface border-brand-primary/30' : 'bg-app-primary border-border opacity-70'}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[9px] text-text-muted font-bold block uppercase">{plugin.modalityType}</span>
                    <span className="text-[9px] bg-app-primary border border-border px-1.5 py-0.5 rounded font-mono">{plugin.version}</span>
                  </div>
                  <h4 className="font-bold text-text-primary text-sm mt-1">{plugin.name}</h4>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                  <div className="font-mono text-[10px] text-text-muted space-y-0.5">
                    <div>Runtime: <span className="font-bold text-text-secondary">{plugin.runtime}</span></div>
                    <div>Inference: <span className="font-bold text-brand-primary">{plugin.latencyMs}ms</span></div>
                  </div>

                  <button
                    onClick={() => handleTogglePlugin(plugin.id)}
                    className={`font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all
                      ${plugin.status === 'ACTIVE' 
                        ? 'bg-status-safe-bg text-status-safe-text border border-status-safe-text/15 hover:bg-status-safe-bg/80' 
                        : 'bg-border text-text-muted border border-border hover:bg-border/80'}`}
                  >
                    {plugin.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'DIAGNOSTICS' && (
        <div className="bg-app-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text-primary flex items-center gap-2">
              <Cpu size={18} className="text-brand-primary" /> Modallik Integratsiyasi Diagnostika Stendi
            </h3>
            <button
              onClick={runSystemDiagnostics}
              disabled={diagnosticActive}
              className="bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Play size={12} /> Diagnostika Testlarini Boshlash
            </button>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            MIIE tizimining barcha integratsiya bo'g'inlarini, 8 ta modallikning to'g'ri ishlashini va real vaqtdagi fuzion koeffitsientlarni sinovdan o'tkazing.
          </p>

          {diagnosticLogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosticLogs.map((log, i) => (
                <div key={i} className="bg-app-primary border border-border p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-text-primary text-sm">{log.testName}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
                      ${log.status === 'SUCCESS' ? 'bg-status-safe-bg text-status-safe-text border-status-safe-text/15' : 
                        'bg-status-critical-bg text-status-critical-text border-status-critical-text/15'}`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted font-mono leading-relaxed">{log.log}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 border border-border border-dashed rounded-xl text-center text-text-muted text-xs space-y-2">
              <AlertCircle size={28} className="mx-auto text-text-muted/30 animate-pulse" />
              <p>Hozircha hech qanday integratsiya diagnostika testi o'tkazilmadi.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
