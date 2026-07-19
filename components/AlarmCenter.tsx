import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Flame, Wind, Activity, Bell, CheckCircle2, User, 
  ArrowUpRight, Users, Play, Clock, AlertTriangle, Hammer, HelpCircle, ShieldAlert as AlertIcon, Lock, Unlock, Server, RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { cameraService } from '../services/cameraService';

interface SecurityAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  timestamp: number;
  entityId: string;
  zoneId?: string;
  type?: string;
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
  assignedTo?: string;
  resolutionNotes?: string;
  escalatedAt?: number;
  resolvedAt?: number;
  notesHistory?: Array<{ timestamp: number; operator: string; text: string; action: string }>;
}

export const AlarmCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [resolutionInput, setResolutionInput] = useState('');
  const [statistics, setStatistics] = useState({
    totals: { fire: 0, smoke: 0, gas: 0, leaks: 0, others: 0, total: 0 },
    dailyTrend: []
  });
  
  const [activeTab, setActiveTab] = useState<'alarms' | 'commission' | 'stats'>('alarms');
  const [commissionedMap, setCommissionedMap] = useState<Record<string, string[]>>({});
  const [operatorName, setOperatorName] = useState('Operator Admin');
  const [loading, setLoading] = useState(false);

  const [cameras, setCameras] = useState<Array<{ id: string; name: string; zone: string }>>([]);

  const hazardTypes = [
    { id: 'fire', label: 'Flame Trigger', icon: Flame, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
    { id: 'smoke', label: 'Smoke Plume', icon: Wind, color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
    { id: 'gasLeak', label: 'Gas Leak IR', icon: Activity, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    { id: 'explosion', label: 'Flash Explosion', icon: AlertTriangle, color: 'text-red-600 bg-red-600/10 border-red-600/20' },
    { id: 'flood', label: 'Water Flooding', icon: ShieldAlert, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' }
  ];

  // Fetch all alerts and analytical statistics from the backend
  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, statsRes] = await Promise.all([
        fetch('/api/security/alerts'),
        fetch('/api/security/statistics')
      ]);
      
      let alertsData: SecurityAlert[] = [];
      let statsData = null;
      
      if (alertsRes.ok && alertsRes.headers.get("content-type")?.includes("application/json")) {
        alertsData = await alertsRes.json();
      } else {
        console.warn("Non-JSON or error response from alerts endpoint.");
      }
      
      if (statsRes.ok && statsRes.headers.get("content-type")?.includes("application/json")) {
        statsData = await statsRes.json();
      } else {
        console.warn("Non-JSON or error response from statistics endpoint.");
      }
      
      setAlerts(alertsData || []);
      if (statsData) {
        setStatistics(statsData);
      }
      
      // Keep selected alert up-to-date with current database state
      if (selectedAlert && alertsData && Array.isArray(alertsData)) {
        const updated = alertsData.find((a: SecurityAlert) => a.id === selectedAlert.id);
        if (updated) setSelectedAlert(updated);
      }
    } catch (e) {
      console.error('Error fetching Alarm Center data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Sync commissioned QA toggles for each camera from backend state
  const fetchCommissioned = async (camsList?: Array<{ id: string; name: string; zone: string }>) => {
    const camsToFetch = camsList || cameras;
    const updatedMap: Record<string, string[]> = {};
    for (const cam of camsToFetch) {
      try {
        const res = await fetch(`/api/security/commission/${cam.id}`);
        if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json();
          updatedMap[cam.id] = data.commissioned || [];
        } else {
          updatedMap[cam.id] = [];
        }
      } catch (e) {
        console.error(`Failed to fetch commissioned for ${cam.id}`, e);
        updatedMap[cam.id] = [];
      }
    }
    setCommissionedMap(updatedMap);
  };

  useEffect(() => {
    const loadCameras = async () => {
      try {
        const cams = await cameraService.getAllCameras();
        const mapped = (cams || []).map(c => ({
          id: c.id,
          name: c.name,
          zone: c.location || 'Tashqi Hudud'
        }));
        setCameras(mapped);
        fetchCommissioned(mapped);
      } catch (e) {
        console.error("Failed to load cameras in AlarmCenter:", e);
      }
    };

    fetchData();
    loadCameras();
    
    // Auto-refresh stats and alerts every 4 seconds to maintain real-time monitoring
    const interval = setInterval(() => {
      fetchData();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Action: Acknowledge
  const handleAcknowledge = async (id: string) => {
    try {
      const res = await fetch(`/api/security/alerts/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Assign
  const handleAssign = async (id: string) => {
    if (!assigneeInput.trim()) return;
    try {
      const res = await fetch(`/api/security/alerts/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeName: assigneeInput, operatorName })
      });
      if (res.ok) {
        setAssigneeInput('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Escalate
  const handleEscalate = async (id: string) => {
    try {
      const res = await fetch(`/api/security/alerts/${id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Action: Resolve
  const handleResolve = async (id: string) => {
    if (!resolutionInput.trim()) return;
    try {
      const res = await fetch(`/api/security/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes: resolutionInput, operatorName })
      });
      if (res.ok) {
        setResolutionInput('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // QA Tool: Toggle dry-run commissioning
  const toggleCommissioning = async (cameraId: string, hazardType: string) => {
    const isActive = commissionedMap[cameraId]?.includes(hazardType);
    try {
      const res = await fetch('/api/security/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId, hazardType, active: !isActive })
      });
      if (res.ok) {
        fetchCommissioned();
        setTimeout(fetchData, 800); // Give the event loop a split-second to insert the alarm
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Upper Widgets: Real-Time Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-panel p-5 rounded-xl border border-border flex items-center justify-between shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-rose-500">
            <Flame size={48} />
          </div>
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Active Hazard Incidents</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-text-primary mt-1">
              {alerts.filter(a => a.status !== 'RESOLVED').length}
            </h3>
            <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              Requires physical verification
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Flame size={24} className="text-rose-500" />
          </div>
        </div>

        <div className="bg-app-panel p-5 rounded-xl border border-border flex items-center justify-between shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-gray-400">
            <Wind size={48} />
          </div>
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Fire Alarms</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-text-primary mt-1">{statistics.totals?.fire || 0}</h3>
            <p className="text-xs text-text-muted mt-1">Cumulative registered cases</p>
          </div>
          <div className="p-3 rounded-xl bg-gray-400/10 border border-gray-400/20 flex items-center justify-center">
            <Flame size={24} className="text-amber-500" />
          </div>
        </div>

        <div className="bg-app-panel p-5 rounded-xl border border-border flex items-center justify-between shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-sky-500">
            <Activity size={48} />
          </div>
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Smoke & Leak Alarms</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-text-primary mt-1">
              {(statistics.totals?.smoke || 0) + (statistics.totals?.leaks || 0)}
            </h3>
            <p className="text-xs text-text-muted mt-1">Optical flow verified alerts</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Wind size={24} className="text-sky-500" />
          </div>
        </div>

        <div className="bg-app-panel p-5 rounded-xl border border-border flex items-center justify-between shadow-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-500">
            <CheckCircle2 size={48} />
          </div>
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Resolved Alarms</p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-text-primary mt-1">
              {alerts.filter(a => a.status === 'RESOLVED').length}
            </h3>
            <p className="text-xs text-status-safe-text mt-1 font-bold">100% case clearance rate</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 shrink-0">
        <button 
          onClick={() => setActiveTab('alarms')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'alarms' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Bell size={16} /> Active Incidents ({alerts.filter(a => a.status !== 'RESOLVED').length})
        </button>
        <button 
          onClick={() => setActiveTab('commission')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'commission' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Hammer size={16} /> Sentinel Commissioning Engine (QA Tool)
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === 'stats' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          <Activity size={16} /> Temporal Incident Trends
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'alarms' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
            {/* Left/Middle: Alarm List */}
            <div className="lg:col-span-2 flex flex-col h-full min-h-0 bg-app-panel rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-app-surface/40 flex items-center justify-between shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Incident Command Center</h4>
                <button onClick={fetchData} className="p-1.5 hover:bg-app-surface rounded-lg transition-colors text-text-muted hover:text-text-primary">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold">Tizimda faol xavf signallari mavjud emas.</p>
                    <p className="text-xs text-text-muted mt-1">Use the Commissioning tab to dry-run test the system pipeline.</p>
                  </div>
                ) : (
                  alerts.map(alarm => {
                    const isSelected = selectedAlert?.id === alarm.id;
                    const isActive = alarm.status !== 'RESOLVED';
                    return (
                      <div 
                        key={alarm.id}
                        onClick={() => setSelectedAlert(alarm)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected ? 'bg-brand-primary/5 border-brand-primary' : 'bg-app-primary border-border hover:border-brand-primary/40'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              alarm.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                              alarm.status === 'ESCALATED' ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}>
                              <Flame size={18} />
                            </div>
                            <div>
                              <h5 className="font-extrabold text-sm text-text-primary">{alarm.type} EMERGENCY</h5>
                              <p className="text-xs text-text-muted mt-0.5">{alarm.message}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              alarm.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' : 
                              alarm.status === 'ACKNOWLEDGED' ? 'bg-sky-500/10 text-sky-500' :
                              alarm.status === 'ESCALATED' ? 'bg-red-500/10 text-red-500 font-extrabold' : 'bg-rose-500/10 text-rose-500 animate-pulse'
                            }`}>
                              {alarm.status || 'ACTIVE'}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">{new Date(alarm.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-text-muted font-mono">
                          <span className="flex items-center gap-1"><Server size={12} /> Camera: {alarm.entityId}</span>
                          <span className="flex items-center gap-1"><User size={12} /> Assignee: {alarm.assignedTo || 'Unassigned'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Panel: Detail view & Actions */}
            <div className="flex flex-col h-full min-h-0 bg-app-panel rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-app-surface/40 shrink-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Emergency Controller Command Panel</h4>
              </div>

              {selectedAlert ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col justify-between">
                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-text-muted">Incident Reference ID</span>
                      <h3 className="text-lg font-mono font-extrabold text-text-primary mt-1">{selectedAlert.id}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-app-primary p-3 rounded-xl border border-border">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-text-muted">Camera Sector</span>
                        <p className="text-xs text-text-primary font-bold mt-0.5">{selectedAlert.entityId}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-text-muted">Event Type</span>
                        <p className="text-xs text-text-primary font-bold mt-0.5">{selectedAlert.type}</p>
                      </div>
                    </div>

                    {/* Operator Inputs / Actions */}
                    {selectedAlert.status !== 'RESOLVED' && (
                      <div className="space-y-4 pt-2 border-t border-border">
                        {/* Acknowledge Action */}
                        {selectedAlert.status === 'ACTIVE' && (
                          <button 
                            onClick={() => handleAcknowledge(selectedAlert.id)}
                            className="w-full bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold py-2.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Acknowledge Emergency
                          </button>
                        )}

                        {/* Assign Action */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-text-muted">Assign Field Responder</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={assigneeInput}
                              onChange={(e) => setAssigneeInput(e.target.value)}
                              placeholder="e.g. Inspector Alisherov"
                              className="flex-1 bg-app-primary border border-border text-xs rounded-lg px-3 py-2 text-text-primary focus:border-brand-primary outline-none"
                            />
                            <button 
                              onClick={() => handleAssign(selectedAlert.id)}
                              className="bg-app-surface border border-border hover:border-brand-primary/50 text-text-primary px-3 rounded-lg text-xs font-bold transition-colors"
                            >
                              Assign
                            </button>
                          </div>
                        </div>

                        {/* Escalate Action */}
                        {selectedAlert.status !== 'ESCALATED' && (
                          <button 
                            onClick={() => handleEscalate(selectedAlert.id)}
                            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <ShieldAlert size={16} className="animate-pulse" /> Escalate to Emergency Services (Fire / Police)
                          </button>
                        )}

                        {/* Resolve Action */}
                        <div className="space-y-1.5 pt-2 border-t border-border/50">
                          <label className="text-[10px] font-bold uppercase text-text-muted">Resolution Intervention Report</label>
                          <textarea 
                            value={resolutionInput}
                            onChange={(e) => setResolutionInput(e.target.value)}
                            placeholder="State corrective intervention notes... (e.g. Extinguished minor trashbin fire, sector safe)."
                            rows={3}
                            className="w-full bg-app-primary border border-border text-xs rounded-lg p-3 text-text-primary focus:border-brand-primary outline-none resize-none"
                          />
                          <button 
                            onClick={() => handleResolve(selectedAlert.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Resolve & Close Incident File
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Historical Audit Trail for this specific Alert */}
                    <div className="pt-4 border-t border-border">
                      <span className="text-[10px] font-bold uppercase text-text-muted block mb-2">Incident Event & Action Audit Trail</span>
                      <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {selectedAlert.notesHistory?.map((history, i) => (
                          <div key={i} className="bg-app-primary/60 p-2.5 rounded-lg border border-border text-[10.5px] relative">
                            <div className="flex justify-between items-center text-text-muted mb-1">
                              <span className="font-extrabold flex items-center gap-1">
                                <User size={12} className="text-brand-primary" /> {history.operator}
                              </span>
                              <span className="font-mono text-[9px]">{new Date(history.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-text-primary font-medium">{history.text}</p>
                            <span className="absolute top-1.5 right-1.5 text-[8px] font-bold uppercase tracking-widest text-brand-primary/60">{history.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-6">
                  <ShieldAlert size={36} className="text-text-muted/40 mb-2" />
                  <p className="text-sm font-semibold">Incident Details</p>
                  <p className="text-xs text-text-muted text-center mt-1">Select any active or historical alarm from the command queue to inspect, assign, escalate, or write resolution logs.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'commission' && (
          <div className="bg-app-panel rounded-xl border border-border p-6 h-full overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <div className="max-w-2xl">
              <h3 className="text-base font-extrabold text-text-primary flex items-center gap-2">
                <Hammer className="text-brand-primary" /> Sentinel Commissioning & Verification Console
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                This is a real **Dry-Run Commissioning and QA verification module** for physical deployment testing. Toggling any hazard simulation switch sends an API command to the backend `HazardDetectorPlugin`, forcing structural pipeline cycles.
              </p>
              <div className="bg-brand-primary/10 border border-brand-primary/20 p-3 rounded-lg text-xs text-brand-primary mt-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Real-time Pipeline Integration:</strong> Toggling triggers real events: `FIRE_DETECTED` / `SMOKE_DETECTED` &rarr; Alarm Broker creates database records &rarr; `recordingService` launches a 15-sec pre/post emergency recording chunk &rarr; evidence video is written and locked.
                </div>
              </div>
            </div>

            {/* Camera Commissioning Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              {cameras.map(camera => {
                const activeHazards = commissionedMap[camera.id] || [];
                return (
                  <div key={camera.id} className="bg-app-primary p-5 rounded-xl border border-border space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-sm text-text-primary">{camera.name}</h4>
                        <p className="text-xs text-text-muted font-mono mt-0.5">{camera.id} • {camera.zone}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-app-surface border border-border text-brand-primary font-mono shrink-0">
                        Active Toggles: {activeHazards.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {hazardTypes.map(hazard => {
                        const isSimulating = activeHazards.includes(hazard.id);
                        const Icon = hazard.icon;
                        return (
                          <button
                            key={hazard.id}
                            onClick={() => toggleCommissioning(camera.id, hazard.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all active:scale-95 ${
                              isSimulating 
                                ? 'bg-rose-500/10 border-rose-500 text-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.15)]' 
                                : 'bg-app-panel border-border text-text-secondary hover:text-text-primary hover:border-border/80'
                            }`}
                          >
                            <Icon size={14} className={isSimulating ? 'animate-bounce' : 'text-text-muted'} />
                            <span>{hazard.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="bg-app-panel rounded-xl border border-border p-6 h-full overflow-y-auto custom-scrollbar flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="text-base font-extrabold text-text-primary">Hazard Event Analytical Intelligence</h3>
                <p className="text-xs text-text-muted mt-1">Spatio-temporal analysis of registered fire, smoke, and leak alarms.</p>
              </div>
            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[300px]">
              {/* Chart 1: Bar Chart of totals */}
              <div className="bg-app-primary p-5 rounded-xl border border-border flex flex-col">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4">Total Alarm Distribution</h4>
                <div className="flex-1 w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Fire Flame', count: statistics.totals?.fire || 0, fill: '#ef4444' },
                        { name: 'Smoke Plume', count: statistics.totals?.smoke || 0, fill: '#9ca3af' },
                        { name: 'Gas Leak', count: statistics.totals?.gas || 0, fill: '#f59e0b' },
                        { name: 'Fluid Leak', count: statistics.totals?.leaks || 0, fill: '#0ea5e9' }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-normal)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border-normal)', borderRadius: '8px' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={45}>
                        {/* Custom individual colors */}
                        <Area type="monotone" dataKey="count" stroke="none" fill="currentColor" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Area Chart of daily trends */}
              <div className="bg-app-primary p-5 rounded-xl border border-border flex flex-col">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4">Daily Incident Chronology</h4>
                <div className="flex-1 w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={statistics.dailyTrend || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-normal)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border-normal)', borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="fire" name="Fire Alarms" stroke="#ef4444" fill="#ef4444" fillOpacity={0.06} strokeWidth={2.5} />
                      <Area type="monotone" dataKey="smoke" name="Smoke Alarms" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.06} strokeWidth={2.5} />
                      <Area type="monotone" dataKey="leaks" name="Fluid Leaks" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.06} strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
