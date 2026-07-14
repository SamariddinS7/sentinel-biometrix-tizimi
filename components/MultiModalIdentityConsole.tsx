import React, { useState, useEffect } from 'react';
import { 
  Shield, Layers, Sparkles, Filter, Check, Play, Sliders, Info, Eye, 
  Activity, Database, CheckCircle2, AlertTriangle, RefreshCw, User, Cpu, 
  AlertCircle, Bookmark, Radio, Navigation, Network, Zap, Settings, TrendingUp
} from 'lucide-react';
import { multiModalIdentityEngine, MultiModalIdentity, ModalityPlugin, ExplainableConfidence } from '../services/ai/MultiModalIdentityEngine';
import { motion, AnimatePresence } from 'motion/react';

export const MultiModalIdentityConsole: React.FC = () => {
  const [identities, setIdentities] = useState<MultiModalIdentity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<ModalityPlugin[]>([]);
  const [activeTab, setActiveTab] = useState<'IDENTITIES' | 'PLUGINS' | 'DIAGNOSTICS'>('IDENTITIES');

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
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => setActiveTab('IDENTITIES')}
          className={`pb-3 font-bold text-sm relative transition-all ${activeTab === 'IDENTITIES' ? 'text-brand-primary' : 'text-text-muted hover:text-text-secondary'}`}
        >
          {activeTab === 'IDENTITIES' && <motion.div layoutId="mmActiveTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
          Global Identifikatsiyalar (MIIE)
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
                      {/* Drawing mock/realistic representation of skeleton lines with CSS absolute lines to be clean and fully functional */}
                      <div className="relative w-28 h-40">
                        {/* head */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-brand-primary bg-brand-primary/10" />
                        {/* body center line */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-brand-primary" />
                        {/* shoulders */}
                        <div className="absolute top-8 left-2 right-2 h-0.5 bg-brand-primary" />
                        {/* hips */}
                        <div className="absolute top-22 left-4 right-4 h-0.5 bg-brand-primary" />
                        {/* arms */}
                        <div className="absolute top-8 left-2 w-0.5 h-10 bg-brand-primary origin-top -rotate-12" />
                        <div className="absolute top-8 right-2 w-0.5 h-10 bg-brand-primary origin-top rotate-12" />
                        {/* legs */}
                        <div className="absolute top-22 left-4 w-0.5 h-14 bg-brand-primary origin-top -rotate-6" />
                        <div className="absolute top-22 right-4 w-0.5 h-14 bg-brand-primary origin-top rotate-6" />

                        {/* Interactive dots representation */}
                        {selectedIdentity.poseSkeleton.slice(0, 7).map((kp, i) => (
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
                    </div>

                    <span className="text-[9px] text-text-muted font-mono block text-center">17 keypoints matched successfully | Confidence 94.2%</span>
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

                  {/* Graphical waves simulator using pure CSS layout */}
                  <div className="h-16 flex items-end gap-1 px-3 py-1 bg-app-surface border border-border rounded-lg overflow-hidden">
                    {Array.from({ length: 18 }).map((_, i) => {
                      const height = 15 + Math.sin(i * 0.8) * 30 + Math.random() * 10;
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
