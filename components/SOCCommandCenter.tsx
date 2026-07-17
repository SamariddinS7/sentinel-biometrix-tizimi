import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, Layers, Sparkles, Filter, Check, Play, Sliders, Info, Eye, 
  Activity, Database, CheckCircle2, AlertTriangle, RefreshCw, User, Cpu, 
  AlertCircle, Bookmark, Radio, Navigation, Network, Zap, Settings, TrendingUp,
  Clock, Compass, Users, Share2, ArrowRight, AlertOctagon, Fingerprint, FileText, PlusCircle,
  Search, Trash2, ShieldAlert, ScanFace, Download, ShieldCheck, Mail, Calendar, MapPin, 
  Lock, ArrowDownLeft, ArrowUpRight, BarChart3, HelpCircle, EyeOff, LayoutGrid, Monitor,
  Volume2, ShieldX, BellRing, PhoneCall, RadioTower, HardDrive, ListChecks, CheckCircle,
  Clock3, Send, ChevronRight, PlayCircle, Minimize2, Maximize2, AlertOctagon as DangerIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera } from '../types';
import { cameraService } from '../services/cameraService';
import { vmsAuditService } from '../services/vmsAuditService';
import { authService } from '../services/authService';
import { movementIntelligenceEngine } from '../services/ai/MovementIntelligenceEngine';
import { multiModalIdentityEngine } from '../services/ai/MultiModalIdentityEngine';
import { IdentityCard } from './IdentityCard';
import { PersonTimeline } from './PersonTimeline';
import { PersonSearchModal } from './PersonSearchModal';
import type { PersonProfile } from '../services/personIntel/types/PersonProfile';

// Interfaces for SOC structures
interface Alarm {
  id: string;
  source: string;
  cameraId: string;
  category: 'FIRE' | 'INTRUSION' | 'PPE_VIOLATION' | 'LOITERING' | 'WEAPON' | 'CROWD';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
  assignedTo?: string;
  notes?: string[];
}

interface Incident {
  id: string;
  title: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  creationTime: Date;
  assignedTeam: string;
  associatedCameras: string[];
  evidenceFiles: string[];
  sopStepCompleted: number;
}

interface Personnel {
  id: string;
  name: string;
  role: 'GUARD' | 'OFFICER' | 'SERGEANT' | 'CHIEF';
  status: 'IDLE' | 'ON_PATROL' | 'DISPATCHED' | 'OFFLINE';
  location: string;
  radioChannel: string;
  battery: number;
}

export const SOCCommandCenter: React.FC = () => {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'VIDEO_WALL' | 'INCIDENTS' | 'RESOURCES' | 'DIAGNOSTICS' | 'PERSON_INTEL'>('VIDEO_WALL');
  // Person Intel state
  const [intelPerson, setIntelPerson] = useState<PersonProfile | null>(null);
  const [showPersonSearch, setShowPersonSearch] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string>('Tashkent Campus HQ');
  const [isLockdownMode, setIsLockdownMode] = useState<boolean>(false);
  const [isBuzzerActive, setIsBuzzerActive] = useState<boolean>(false);
  
  // Real time VMS Services arrays
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  // Video Wall configuration state
  const [wallLayout, setWallLayout] = useState<'1X1' | '2X2' | '3X3' | '1X5'>('2X2');
  const [videoSlots, setVideoSlots] = useState<string[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  
  // Form input/interactive states
  const [alarmFilter, setAlarmFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED'>('PENDING');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [newIncidentTitle, setNewIncidentTitle] = useState('');
  const [newIncidentCategory, setNewIncidentCategory] = useState('Intrusion Detection');
  const [newIncidentPriority, setNewIncidentPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newIncidentTeam, setNewIncidentTeam] = useState('Alpha Tactical Response');
  const [sopLogs, setSopLogs] = useState<Record<string, boolean[]>>({});
  
  // System utilization stats — populated from /api/system/health telemetry.
  // Initial values are zero; real data loads via the useEffect below.
  const [systemUtilization, setSystemUtilization] = useState({
    cpu: 0,
    gpu: 0,
    ram: 0,
    bandwidthMbps: 0,
    rtspLoss: 0,
    gpuTemp: 0,
    recordingDaysRemaining: 0,
  });

  // Load cameras from the data service on mount
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const list = await cameraService.getAllCameras();
        setCameras(list || []);

        // Seed default video slots
        if (list && list.length > 0) {
          setVideoSlots([
            list[0]?.id || '',
            list[1 % list.length]?.id || '',
            list[2 % list.length]?.id || '',
            list[3 % list.length]?.id || '',
            list[4 % list.length]?.id || '',
            list[5 % list.length]?.id || '',
          ]);
        }
      } catch (err) {
        console.warn('Failed to load cameras in SOC view', err);
      }
    };

    fetchCameras();

    // Load live security alerts from the API
    const fetchAlarmsAndPersonnel = async () => {
      try {
        const token = authService.getToken?.() || '';
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        const alarmsRes = await fetch('/api/security/alerts', { headers });
        if (alarmsRes.ok) {
          const data = await alarmsRes.json();
          const raw: any[] = Array.isArray(data) ? data : (data.alerts || []);
          setAlarms(raw.map((a: any) => ({
            id: a.id,
            source: a.source || a.cameraId || 'Unknown',
            cameraId: a.cameraId || '',
            category: a.type || a.category || 'UNKNOWN',
            severity: a.severity || 'MEDIUM',
            timestamp: new Date(a.timestamp || Date.now()),
            status: a.status || 'PENDING',
            assignedTo: a.assignedTo,
            notes: Array.isArray(a.notes) ? a.notes : (a.description ? [a.description] : []),
          })));
        }

        // Load security personnel from users list filtered by security roles
        const usersRes = await fetch('/api/users', { headers });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const allUsers: any[] = usersData.users || (Array.isArray(usersData) ? usersData : []);
          const securityRoles = new Set(['GUARD', 'OFFICER', 'SERGEANT', 'SUPERVISOR', 'ADMIN']);
          const secPersonnel = allUsers
            .filter((u: any) => securityRoles.has(u.role))
            .map((u: any) => ({
              id: u.id,
              name: u.fullName || u.email,
              role: u.role,
              status: 'IDLE' as const,
              location: u.department || 'Unassigned',
              radioChannel: 'CH-1',
              battery: 100,
            }));
          if (secPersonnel.length > 0) setPersonnel(secPersonnel);
        }
      } catch {
        // Network unavailable — lists remain empty; operator can still create incidents manually
      }
    };

    fetchAlarmsAndPersonnel();

    // Logging initial entrance into SOC console (Auditing)
    const currentUser = authService.getCurrentUser();
    vmsAuditService.log({
      userId: currentUser?.id || 'operator_01',
      userName: currentUser?.fullName || 'Navbatchi Operator',
      action: `ENTER_SOC_COMMAND_CENTER`,
      module: `SOC Unified Orchestration Layer`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator accessed Unified SOC Command Center environment.`
    });

  }, []);

  // Remove simulated stats flux to comply with production requirements
  // Poll real system telemetry from /api/telemetry every 10 seconds
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const token = authService.getToken?.() || '';
        const res = await fetch('/api/telemetry', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) return;
        const data = await res.json();
        setSystemUtilization(prev => ({
          ...prev,
          cpu: data.cpuUsage ?? prev.cpu,
          ram: data.ramUsagePercentage ?? prev.ram,
          gpu: data.gpuUsage ?? prev.gpu,
          gpuTemp: data.gpuTemperature ?? prev.gpuTemp,
          bandwidthMbps: data.networkInboundKbps != null
            ? Math.round((data.networkInboundKbps + (data.networkOutboundKbps || 0)) / 1000)
            : prev.bandwidthMbps,
        }));
      } catch {
        // Telemetry unavailable — retain last values
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Standard Operating Procedures template based on Incident Type
  const sopTemplates = {
    'Fire & Safety Outbreak': [
      'Trigger Local Audio & Visual Evacuation Buzzer',
      'Deploy Automatic Aerosol Fire Suppression triggers',
      'Notify local Fire Brigade emergency dispatchers',
      'Check evacuations on Camera 03 & Camera 02 corridors'
    ],
    'Intrusion Detection': [
      'Locate and lock target coordinates on spatiotemporal trace',
      'Dispatch nearest tactical officer or security personnel',
      'Enable strict structural lock-down of exit access gates',
      'Acknowledge threat and notify police or security chief'
    ],
    'Medical Outbreak': [
      'Contact immediate medical dispatch team (103)',
      'Guide personnel with medical bag to victim location',
      'Focus primary workspace camera streams on incident spot',
      'Maintain crowd boundaries and security buffer corridors'
    ]
  };

  // Switch slots cameras
  const handleAssignCameraToSlot = (cameraId: string) => {
    setVideoSlots(prev => {
      const updated = [...prev];
      updated[selectedSlotIndex] = cameraId;
      return updated;
    });

    const targetCamera = cameras.find(c => c.id === cameraId);
    const currentUser = authService.getCurrentUser();
    
    vmsAuditService.log({
      userId: currentUser?.id || 'operator_01',
      userName: currentUser?.fullName || 'Navbatchi Operator',
      action: `ASSIGN_CAM_TO_VIDEO_WALL_SLOT`,
      module: `SOC Video Wall`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator routed live feed of ${targetCamera?.name || cameraId} to grid slot ${selectedSlotIndex + 1}`
    });
  };

  // Alarm Actions
  const handleAcknowledgeAlarm = async (alarmId: string) => {
    setAlarms(prev => prev.map(a => {
      if (a.id === alarmId) {
        return { 
          ...a, 
          status: 'ACKNOWLEDGED', 
          assignedTo: authService.getCurrentUser()?.fullName || 'Sardor Rustamov'
        };
      }
      return a;
    }));

    const targetAlarm = alarms.find(a => a.id === alarmId);
    
    // Log Audit Trail
    await vmsAuditService.log({
      userId: authService.getCurrentUser()?.id || 'operator_01',
      userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
      action: `ACKNOWLEDGE_SECURITY_ALARM`,
      module: `SOC Alarm Console`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator acknowledged severity: ${targetAlarm?.severity} alarm ID: ${alarmId} triggered at ${targetAlarm?.source}`
    });
  };

  const handleResolveAlarm = async (alarmId: string) => {
    setAlarms(prev => prev.map(a => {
      if (a.id === alarmId) return { ...a, status: 'RESOLVED' };
      return a;
    }));

    const targetAlarm = alarms.find(a => a.id === alarmId);

    await vmsAuditService.log({
      userId: authService.getCurrentUser()?.id || 'operator_01',
      userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
      action: `RESOLVE_SECURITY_ALARM`,
      module: `SOC Alarm Console`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator resolved alarm ID: ${alarmId}. Verified situation status as safe.`
    });
  };

  // Create Incident
  const handleCreateIncident = async () => {
    if (!newIncidentTitle.trim()) return;

    const newId = `INC-${200 + incidents.length + 1}`;
    const newInc: Incident = {
      id: newId,
      title: newIncidentTitle,
      category: newIncidentCategory,
      priority: newIncidentPriority,
      status: 'OPEN',
      creationTime: new Date(),
      assignedTeam: newIncidentTeam,
      associatedCameras: [videoSlots[0] || 'CAM-01'],
      evidenceFiles: [],
      sopStepCompleted: 0
    };

    setIncidents(prev => [newInc, ...prev]);
    setSopLogs(prev => ({
      ...prev,
      [newId]: [false, false, false, false]
    }));
    setSelectedIncidentId(newId);
    setNewIncidentTitle('');

    await vmsAuditService.log({
      userId: authService.getCurrentUser()?.id || 'operator_01',
      userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
      action: `CREATE_SOC_INCIDENT_DOSSIER`,
      module: `SOC Incident Management`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator instantiated official security incident dossier. ID: ${newId}. Title: "${newIncidentTitle}". Assigned: ${newIncidentTeam}`
    });
  };

  // SOP Checklist Toggles
  const handleToggleSopStep = (incidentId: string, index: number) => {
    setSopLogs(prev => {
      const logs = prev[incidentId] ? [...prev[incidentId]] : [false, false, false, false];
      logs[index] = !logs[index];
      
      // Update the incident's completed step count
      const completedCount = logs.filter(Boolean).length;
      setIncidents(incPrev => incPrev.map(inc => {
        if (inc.id === incidentId) {
          return { ...inc, sopStepCompleted: completedCount };
        }
        return inc;
      }));

      // Log the operational audit trail
      vmsAuditService.log({
        userId: authService.getCurrentUser()?.id || 'operator_01',
        userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
        action: `UPDATE_INCIDENT_SOP_CHECKLIST`,
        module: `SOC Incident Management`,
        status: `SUCCESS`,
        ipAddress: window.location.hostname || 'unknown',
        details: `Operator updated SOP step ${index + 1} on incident ${incidentId} to: ${logs[index] ? 'COMPLETED' : 'PENDING'}`
      });

      return {
        ...prev,
        [incidentId]: logs
      };
    });
  };

  // Lockdown & Emergency Controls
  const handleLockdownTrigger = async () => {
    const nextState = !isLockdownMode;
    setIsLockdownMode(nextState);

    await vmsAuditService.log({
      userId: authService.getCurrentUser()?.id || 'operator_01',
      userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
      action: nextState ? `ACTIVATE_EMERGENCY_LOCKDOWN` : `DEACTIVATE_EMERGENCY_LOCKDOWN`,
      module: `SOC Emergency Controls`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: nextState 
        ? `CRITICAL EVENT: Operator activated full campus structural lock-down. Mag-locks locked, fire shutters standby.`
        : `CRITICAL EVENT: Operator cleared campus lockdown status. Normal access control resumed.`
    });
  };

  const handleBuzzerTrigger = () => {
    setIsBuzzerActive(!isBuzzerActive);
  };

  // Dispatch Security personnel
  const handleDispatchOfficer = async (personnelId: string, location: string) => {
    setPersonnel(prev => prev.map(p => {
      if (p.id === personnelId) {
        return { ...p, status: 'DISPATCHED', location };
      }
      return p;
    }));

    const targetOfficer = personnel.find(p => p.id === personnelId);

    await vmsAuditService.log({
      userId: authService.getCurrentUser()?.id || 'operator_01',
      userName: authService.getCurrentUser()?.fullName || 'Navbatchi Operator',
      action: `DISPATCH_FIELD_SECURITY_PERSONNEL`,
      module: `SOC Operator Dispatch`,
      status: `SUCCESS`,
      ipAddress: window.location.hostname || 'unknown',
      details: `Operator dispatched officer ${targetOfficer?.name} (ID: ${personnelId}) to location: ${location} on radio channel: ${targetOfficer?.radioChannel}`
    });
  };

  // Filtering Alarms
  const filteredAlarms = useMemo(() => {
    return alarms.filter(a => {
      if (alarmFilter === 'ALL') return true;
      return a.status === alarmFilter;
    });
  }, [alarms, alarmFilter]);

  // Filtering Incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      return inc.title.toLowerCase().includes(incidentSearch.toLowerCase()) || 
             inc.id.toLowerCase().includes(incidentSearch.toLowerCase()) || 
             inc.category.toLowerCase().includes(incidentSearch.toLowerCase());
    });
  }, [incidents, incidentSearch]);

  const activeIncident = incidents.find(inc => inc.id === selectedIncidentId);

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-1 pb-10 custom-scrollbar animate-in fade-in duration-300">
      
      {/* Top SOC Operation Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-app-panel border border-border p-6 rounded-2xl relative overflow-hidden">
        
        {/* Right Gradient Glow for Emergency indicators */}
        <div className={`absolute top-0 right-0 w-60 h-full pointer-events-none transition-all duration-700 opacity-20
          ${isLockdownMode ? 'bg-red-600/30 blur-2xl' : 'bg-brand-primary/5 blur-xl'}`} />

        <div className="z-10 space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest font-mono text-red-400">UNIFIED OPERATIONS COMMAND</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white">SOC Command Center</h2>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="bg-app-primary border border-border/80 text-xs font-bold text-text-secondary px-2.5 py-1 rounded-lg focus:outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="Tashkent Campus HQ">Tashkent Campus HQ</option>
              <option value="Samarkand Tech Hub">Samarkand Tech Hub</option>
              <option value="HQ Server Farm">HQ Server Farm</option>
            </select>
          </div>
          <p className="text-xs text-text-muted max-w-2xl">
            Tizim datchiklari fuziyasi (Fusion), spatiotemporal marshrutlar, real vaqtda videodecoderlar va favqulodda vaziyatlar SOPlarini yagona boshqaruv pulti orqali boshqaring.
          </p>
        </div>

        {/* Emergency System Hot-Buttons */}
        <div className="flex items-center gap-3 z-10 w-full sm:w-auto">
          {/* Buzzer Button */}
          <button
            onClick={handleBuzzerTrigger}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all duration-300 shadow-sm
              ${isBuzzerActive 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-bounce' 
                : 'bg-app-primary hover:bg-app-surface border-border text-text-secondary'}`}
          >
            <Volume2 size={15} />
            Buzzer: {isBuzzerActive ? 'ON' : 'OFF'}
          </button>

          {/* Lockdown Button */}
          <button
            onClick={handleLockdownTrigger}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-500 shadow-lg
              ${isLockdownMode 
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse shadow-red-900/30' 
                : 'bg-red-950/40 hover:bg-red-950 border border-red-900/30 text-red-400'}`}
          >
            <ShieldAlert size={15} />
            Lockdown: {isLockdownMode ? 'ACTIVE' : 'READY'}
          </button>
        </div>

      </div>

      {/* Primary HUD Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-app-panel border border-border p-4 rounded-xl space-y-1.5">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Decoder FPS</span>
          <h5 className="text-lg font-black text-white">25.0 FPS <span className="text-xs text-emerald-400 font-semibold">(Nominal)</span></h5>
        </div>

        <div className="bg-app-panel border border-border p-4 rounded-xl space-y-1.5">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RTSP Latency</span>
          <h5 className="text-lg font-black text-white">82 ms <span className="text-xs text-emerald-400 font-semibold">(Stable)</span></h5>
        </div>

        <div className="bg-app-panel border border-border p-4 rounded-xl space-y-1.5">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Pending Alarms</span>
          <h5 className={`text-lg font-black ${alarms.filter(a => a.status === 'PENDING').length > 0 ? 'text-red-400' : 'text-white'}`}>
            {alarms.filter(a => a.status === 'PENDING').length} alerts
          </h5>
        </div>

        <div className="bg-app-panel border border-border p-4 rounded-xl space-y-1.5">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Active Incidents</span>
          <h5 className="text-lg font-black text-white">
            {incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length} dossiers
          </h5>
        </div>

        <div className="bg-app-panel border border-border p-4 rounded-xl space-y-1.5 col-span-2 md:col-span-1">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Dispatch Personnel</span>
          <h5 className="text-lg font-black text-white">
            {personnel.filter(p => p.status === 'DISPATCHED' || p.status === 'ON_PATROL').length} deployed
          </h5>
        </div>

      </div>

      {/* Main Command Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Interactive Panel (Alarms & Personnel Dispatch) */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Section: Alarm Queue Board */}
          <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/80">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <BellRing size={16} className="text-red-500 animate-bounce" /> Real-time Alarm Board
              </h3>
              
              {/* Filter */}
              <div className="flex gap-1">
                {['PENDING', 'RESOLVED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setAlarmFilter(f as any)}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all
                      ${alarmFilter === f ? 'bg-brand-primary text-white' : 'bg-app-primary text-text-muted'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Alarm List Items */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {filteredAlarms.length === 0 ? (
                <div className="py-12 text-center text-text-muted space-y-1.5">
                  <CheckCircle size={20} className="mx-auto text-emerald-400" />
                  <p className="text-xs">Ushbu holatda barcha datchiklar xavfsiz holatda.</p>
                </div>
              ) : (
                filteredAlarms.map(alarm => (
                  <div
                    key={alarm.id}
                    className={`p-3 rounded-xl border bg-app-primary border-border relative overflow-hidden transition-all hover:border-brand-primary/40
                      ${alarm.severity === 'CRITICAL' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-yellow-500'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded border uppercase
                          ${alarm.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/15' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/15'}`}>
                          {alarm.category} - {alarm.severity}
                        </span>
                        <h4 className="font-bold text-text-primary text-xs mt-1.5 flex items-center gap-1">
                          <MapPin size={11} className="text-text-muted" /> {alarm.source}
                        </h4>
                      </div>
                      <span className="font-mono text-[9px] text-text-muted">{new Date(alarm.timestamp).toLocaleTimeString()}</span>
                    </div>

                    {alarm.notes && alarm.notes.length > 0 && (
                      <p className="text-[10px] text-text-muted italic mt-1.5 leading-relaxed bg-app-surface p-1.5 rounded border border-border/50">
                        * {alarm.notes[0]}
                      </p>
                    )}

                    {/* Operational Actions */}
                    <div className="flex gap-2 mt-3 pt-2.5 border-t border-border/50">
                      {alarm.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleAcknowledgeAlarm(alarm.id)}
                            className="flex-1 py-1 bg-brand-primary hover:bg-brand-secondary text-white text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1"
                          >
                            <Check size={11} /> Qabul qilish
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSlotIndex(0);
                              handleAssignCameraToSlot(alarm.cameraId);
                            }}
                            className="p-1 bg-app-surface hover:bg-app-primary border border-border text-text-secondary rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                            title="Focus Stream on Video Wall"
                          >
                            <Eye size={12} /> Live
                          </button>
                        </>
                      ) : alarm.status === 'ACKNOWLEDGED' ? (
                        <button
                          onClick={() => handleResolveAlarm(alarm.id)}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1"
                        >
                          <CheckCircle size={11} /> Hal etildi deb belgilash
                        </button>
                      ) : (
                        <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 uppercase bg-emerald-500/10 py-0.5 px-2 rounded w-fit">
                          <CheckCircle size={11} /> Resolvlandi
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Dispatch Field Operations */}
          <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2 border-b border-border/80 pb-2">
              <PhoneCall size={16} className="text-cyan-400" /> Tactical Dispatch Hub
            </h3>

            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
              {personnel.map(guard => (
                <div key={guard.id} className="p-3 bg-app-primary border border-border rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-text-primary block">{guard.name}</span>
                      <span className="text-[9px] text-text-muted font-mono bg-app-surface px-1.5 py-0.5 rounded border border-border/50">
                        {guard.radioChannel}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted mt-1 block">Zonasi: <strong className="text-text-secondary">{guard.location}</strong></span>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase
                      ${guard.status === 'DISPATCHED' ? 'bg-red-500/10 text-red-400 border-red-500/15 animate-pulse' : 
                        guard.status === 'ON_PATROL' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15' : 'bg-slate-500/10 text-text-secondary border-border'}`}>
                      {guard.status}
                    </span>

                    {/* Dispatch quick location trigger */}
                    {guard.status !== 'DISPATCHED' ? (
                      <button
                        onClick={() => handleDispatchOfficer(guard.id, 'Main Server Gate Corridor')}
                        className="bg-red-950/40 hover:bg-red-950 border border-red-900/30 text-red-400 font-bold text-[9px] px-2 py-0.5 rounded transition-all"
                      >
                        Yuborish (Server)
                      </button>
                    ) : (
                      <span className="text-[9px] text-text-muted">Yo'lda (Battery: {guard.battery}%)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Active Workspace Panel (Interactive Video Wall / SOP incident Dossiers) */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* Tab Selection */}
          <div className="flex bg-app-panel border border-border p-1.5 rounded-xl gap-2 text-xs font-bold">
            <button
              onClick={() => setActiveTab('VIDEO_WALL')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5
                ${activeTab === 'VIDEO_WALL' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <LayoutGrid size={14} /> Video Wall & Live Grids
            </button>
            <button
              onClick={() => setActiveTab('INCIDENTS')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5
                ${activeTab === 'INCIDENTS' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <FileText size={14} /> Incident Dossiers & SOPs
            </button>
            <button
              onClick={() => setActiveTab('DIAGNOSTICS')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5
                ${activeTab === 'DIAGNOSTICS' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <Cpu size={14} /> Decoder & AI Diagnostics
            </button>
            <button
              onClick={() => setActiveTab('PERSON_INTEL')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5
                ${activeTab === 'PERSON_INTEL' ? 'bg-brand-primary text-white shadow' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <ScanFace size={14} /> Person Intel
            </button>
          </div>

          {/* TAB 1: Real-time Video Wall */}
          {activeTab === 'VIDEO_WALL' && (
            <div className="bg-app-panel border border-border rounded-xl p-5 space-y-5">
              
              {/* Video Grid Header controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/80">
                <div>
                  <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                    <Monitor size={16} className="text-brand-primary" /> Matrix Live Streams Decoders
                  </h3>
                  <p className="text-[10px] text-text-muted mt-0.5">Select a grid layout and assign specific RTSP cams below.</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Grid Selector */}
                  <div className="flex border border-border bg-app-primary p-0.5 rounded-lg text-[10px] font-black">
                    {(['1X1', '2X2', '3X3', '1X5'] as const).map(lay => (
                      <button
                        key={lay}
                        onClick={() => setWallLayout(lay)}
                        className={`px-3 py-1 rounded transition-all
                          ${wallLayout === lay ? 'bg-brand-primary text-white' : 'text-text-muted hover:text-text-secondary'}`}
                      >
                        {lay}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10 uppercase">
                    hardware acceleration: enabled
                  </span>
                </div>
              </div>

              {/* Video Wall Grid Viewport */}
              <div className={`grid gap-4 bg-app-surface border border-border p-4 rounded-xl min-h-[360px]
                ${wallLayout === '1X1' ? 'grid-cols-1' : 
                  wallLayout === '2X2' ? 'grid-cols-2' : 
                  wallLayout === '3X3' ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-4'}`}
              >
                {/* Dynamically render slots based on layout selection */}
                {Array.from({ length: wallLayout === '1X1' ? 1 : wallLayout === '2X2' ? 4 : wallLayout === '3X3' ? 9 : 6 }).map((_, idx) => {
                  const activeCamId = videoSlots[idx];
                  const activeCam = cameras.find(c => c.id === activeCamId);
                  const isSelectedSlot = selectedSlotIndex === idx;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlotIndex(idx)}
                      className={`relative aspect-video bg-app-primary border rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col group
                        ${isSelectedSlot ? 'border-2 border-brand-primary ring-2 ring-brand-primary/10 shadow-lg' : 'border-border hover:border-brand-primary/30'}`}
                    >
                      {/* Video Stream Simulation layer using standard HTML canvas/boxes */}
                      {activeCam ? (
                        <div className="flex-1 w-full h-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
                          {/* Live stream details badge */}
                          <div className="absolute top-2 left-2 z-10 bg-black/70 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-white flex items-center gap-1.5 uppercase border border-white/5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            {activeCam.name}
                          </div>

                          <div className="absolute top-2 right-2 z-10 bg-black/70 px-2 py-0.5 rounded text-[8px] font-mono text-cyan-400 border border-white/5">
                            {activeCam.resolution} | {activeCam.fps}fps
                          </div>

                          {/* Dynamic bounding boxes / OCR plates overlay on video simulation */}
                          {idx === 0 && (
                            <div className="absolute top-[30%] left-[25%] w-[18%] h-[35%] border-2 border-emerald-400 rounded flex flex-col justify-end p-0.5">
                              <span className="text-[7px] font-bold bg-emerald-400 text-black px-1 py-0.5 rounded-sm truncate">
                                Xodim: Alisher Q. (98%)
                              </span>
                            </div>
                          )}

                          {idx === 1 && (
                            <div className="absolute bottom-[20%] right-[30%] w-[25%] h-[20%] border-2 border-amber-500 rounded flex flex-col justify-end p-0.5">
                              <span className="text-[7px] font-bold bg-amber-500 text-black px-1 py-0.5 rounded-sm truncate">
                                Plate: 01A777AA (94%)
                              </span>
                            </div>
                          )}

                          {isLockdownMode && (
                            <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center pointer-events-none z-10">
                              <div className="text-center font-bold text-red-500 text-[10px] border border-red-500/30 bg-red-950/80 px-3 py-1 rounded animate-pulse uppercase tracking-wider">
                                lockdown active
                              </div>
                            </div>
                          )}

                          {/* Dynamic waveform simulation under stream */}
                          <div className="w-12 h-12 rounded-full border-2 border-brand-primary/25 flex items-center justify-center animate-ping pointer-events-none" />

                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-text-muted">
                          <EyeOff size={18} className="text-text-muted/40 mb-1" />
                          <span className="text-[10px] font-bold">SLOT {idx + 1} EMPTY</span>
                          <span className="text-[8px] text-text-muted mt-0.5">Kamerani biriktirish uchun bosing</span>
                        </div>
                      )}

                      {/* Selector footprint footer */}
                      <div className="bg-app-surface/60 px-2.5 py-1 text-[9px] font-mono border-t border-border/40 flex justify-between items-center text-text-secondary">
                        <span>Slot: {idx + 1}</span>
                        <span>{activeCam ? 'H.265 Main' : 'unassigned'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cameras inventory for wall assignment */}
              <div className="space-y-3">
                <h4 className="font-bold text-text-secondary text-xs uppercase tracking-wider">
                  Sinflangan RTSP Kameralar Ro'yxati (Ushbu Slot {selectedSlotIndex + 1} ga biriktirish)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {cameras.map(cam => {
                    const isAlreadyOnWall = videoSlots.includes(cam.id);
                    return (
                      <button
                        key={cam.id}
                        onClick={() => handleAssignCameraToSlot(cam.id)}
                        className={`p-2.5 rounded-lg border text-left flex justify-between items-center transition-all text-xs
                          ${isAlreadyOnWall ? 'bg-brand-primary/5 border-brand-primary/30 text-white' : 'bg-app-primary border-border hover:border-brand-primary/20 text-text-secondary'}`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold block truncate">{cam.name}</span>
                          <span className="text-[9px] text-text-muted font-mono">{cam.id}</span>
                        </div>
                        <PlusCircle size={14} className="text-text-muted hover:text-brand-primary ml-1 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Incident dossiers & SOP Response Engine */}
          {activeTab === 'INCIDENTS' && (
            <div className="bg-app-panel border border-border rounded-xl p-5 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Dossier select sub-column */}
                <div className="md:col-span-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider">Incidents Log</h4>
                    <span className="text-[9px] font-mono text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
                      {filteredIncidents.length} Records
                    </span>
                  </div>

                  {/* Search inside dossiers */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      value={incidentSearch}
                      onChange={(e) => setIncidentSearch(e.target.value)}
                      placeholder="Dossier nomi, ID..." 
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-app-primary border border-border text-text-primary text-xs focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
                    />
                  </div>

                  {/* Incident dossiers lists */}
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {filteredIncidents.map(inc => {
                      const isSelected = inc.id === selectedIncidentId;
                      return (
                        <div
                          key={inc.id}
                          onClick={() => setSelectedIncidentId(inc.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5
                            ${isSelected ? 'bg-app-surface border-brand-primary' : 'bg-app-primary border-border hover:border-brand-primary/20'}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-[9px] text-text-muted">{inc.id}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border uppercase
                              ${inc.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/15' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/15'}`}>
                              {inc.priority}
                            </span>
                          </div>

                          <h5 className="font-bold text-text-primary text-xs leading-snug">{inc.title}</h5>
                          
                          <div className="flex justify-between items-center text-[10px] mt-1 text-text-muted">
                            <span>Team: {inc.assignedTeam}</span>
                            <span>{new Date(inc.creationTime).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Instantiate new Incident trigger */}
                  <div className="bg-app-surface/50 border border-border border-dashed p-4 rounded-xl space-y-3.5">
                    <span className="font-bold text-text-secondary uppercase text-[10px] block">Yangi hodisa (Dossier) yaratish</span>
                    
                    <input 
                      type="text"
                      value={newIncidentTitle}
                      onChange={(e) => setNewIncidentTitle(e.target.value)}
                      placeholder="Yangi hodisa nomi..."
                      className="w-full bg-app-primary border border-border p-2 rounded-lg text-text-primary text-xs focus:outline-none focus:border-brand-primary placeholder:text-text-muted"
                    />

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                      <div>
                        <label className="text-text-muted uppercase tracking-wider block mb-1">Toifasi</label>
                        <select
                          value={newIncidentCategory}
                          onChange={(e) => setNewIncidentCategory(e.target.value)}
                          className="w-full bg-app-primary border border-border p-1.5 rounded-lg text-text-secondary focus:outline-none focus:border-brand-primary"
                        >
                          <option value="Fire & Safety Outbreak">Fire & Safety</option>
                          <option value="Intrusion Detection">Intrusion</option>
                          <option value="Medical Outbreak">Medical Outbreak</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-text-muted uppercase tracking-wider block mb-1">Muhimlik darajasi</label>
                        <select
                          value={newIncidentPriority}
                          onChange={(e) => setNewIncidentPriority(e.target.value as any)}
                          className="w-full bg-app-primary border border-border p-1.5 rounded-lg text-text-secondary focus:outline-none focus:border-brand-primary"
                        >
                          <option value="CRITICAL">CRITICAL</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleCreateIncident}
                      className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle size={14} /> Dossier qo'shish
                    </button>
                  </div>

                </div>

                {/* SOP Actions and Incidents Checklist */}
                <div className="md:col-span-7 bg-app-primary border border-border p-5 rounded-xl space-y-5">
                  {activeIncident ? (
                    <div className="space-y-5">
                      
                      <div className="flex justify-between items-start pb-2 border-b border-border/80">
                        <div>
                          <span className="font-mono text-[9px] text-brand-primary font-bold uppercase block">ACTIVE EMERGENCY DOSSIER</span>
                          <h4 className="font-black text-white text-sm sm:text-base mt-0.5">{activeIncident.title}</h4>
                        </div>
                        <span className={`text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded`}>
                          {activeIncident.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-app-surface p-2.5 rounded border border-border">
                          <span className="text-[10px] text-text-muted font-bold block">Assigned team:</span>
                          <strong className="text-text-secondary mt-0.5 block">{activeIncident.assignedTeam}</strong>
                        </div>
                        <div className="bg-app-surface p-2.5 rounded border border-border">
                          <span className="text-[10px] text-text-muted font-bold block">Dossier Category:</span>
                          <strong className="text-text-secondary mt-0.5 block">{activeIncident.category}</strong>
                        </div>
                      </div>

                      {/* SOP Instructions checklists */}
                      <div className="space-y-3 pt-1">
                        <span className="text-[10px] text-text-muted uppercase font-black block tracking-wider">
                          Standard Operating Procedures (SOP) Checklist
                        </span>

                        <div className="space-y-2">
                          {(sopTemplates[activeIncident.category as keyof typeof sopTemplates] || sopTemplates['Intrusion Detection']).map((step, idx) => {
                            const isCompleted = sopLogs[activeIncident.id]?.[idx] || false;
                            return (
                              <div
                                key={idx}
                                onClick={() => handleToggleSopStep(activeIncident.id, idx)}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all
                                  ${isCompleted ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' : 'bg-app-surface border-border hover:border-brand-primary/20 text-text-secondary'}`}
                              >
                                <span className="text-xs font-semibold leading-relaxed">{idx + 1}. {step}</span>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2
                                  ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'}`}>
                                  {isCompleted && <Check size={11} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Evidence Files List */}
                      <div className="space-y-2.5">
                        <span className="text-[10px] text-text-muted uppercase font-black block tracking-wider">Attached Evidence Files (VMS System Logs)</span>
                        <div className="flex gap-2">
                          {activeIncident.evidenceFiles.length > 0 ? (
                            activeIncident.evidenceFiles.map((file, fIdx) => (
                              <span key={fIdx} className="text-[10px] font-mono font-bold text-brand-primary bg-brand-primary/5 border border-brand-primary/10 px-2.5 py-1 rounded flex items-center gap-1">
                                <FileText size={11} /> {file}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-text-muted italic">Hech qanday dalil fayli biriktirilmagan. VideoWall-dan clipping orqali qo'shish mumkin.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="py-24 text-center text-xs text-text-muted space-y-2">
                      <Bookmark size={28} className="mx-auto text-text-muted/40 animate-bounce" />
                      <p className="font-semibold">Batafsil SOP va operator nazorat ro'yxatini boshqarish uchun chap ro'yxatdan hodisa dossier-ini tanlang.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: AI Decoders & System Diagnostics */}
          {activeTab === 'DIAGNOSTICS' && (
            <div className="bg-app-panel border border-border rounded-xl p-5 space-y-6">
              
              {/* Core hardware monitor section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="bg-app-primary border border-border p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-text-secondary">
                    <span>CPU Core Utilization</span>
                    <span>{systemUtilization.cpu}%</span>
                  </div>
                  <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${systemUtilization.cpu}%` }} />
                  </div>
                  <span className="text-[9px] text-text-muted font-mono block">16-Cores Intel Xeon Virtualized</span>
                </div>

                <div className="bg-app-primary border border-border p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-text-secondary">
                    <span>GPU Tesla T4 AI Matrix</span>
                    <span>{systemUtilization.gpu}%</span>
                  </div>
                  <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${systemUtilization.gpu}%` }} />
                  </div>
                  <span className="text-[9px] text-text-muted font-mono block">Core Temp: {systemUtilization.gpuTemp}°C (Optimized)</span>
                </div>

                <div className="bg-app-primary border border-border p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-text-secondary">
                    <span>Decoders Video RAM</span>
                    <span>{systemUtilization.ram}%</span>
                  </div>
                  <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${systemUtilization.ram}%` }} />
                  </div>
                  <span className="text-[9px] text-text-muted font-mono block">Active VRAM: 8.16 GB of 16 GB</span>
                </div>

              </div>

              {/* Streaming metrics detail table */}
              <div className="bg-app-primary border border-border rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 text-brand-primary">
                  <Database size={14} /> Active RTSP Stream Decoders Diagnostics (26 Attributes / PPE / ReID)
                </h4>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {cameras.map(cam => (
                    <div key={cam.id} className="p-3 bg-app-surface border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-text-primary block">{cam.name}</span>
                        <span className="text-[10px] text-text-muted font-mono mt-0.5 block">IP: 192.168.12.{cam.id.split('-')[1] || '10'} | Codec: H.265</span>
                      </div>

                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <span className="text-[9px] text-text-muted uppercase font-bold block">Bitrate</span>
                          <span className="font-mono font-bold text-cyan-400">{(4.2 + (parseInt(cam.id.split('-')[1]) || 1) * 0.4).toFixed(1)} Mbps</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-text-muted uppercase font-bold block">Frame Loss</span>
                          <span className="font-mono font-bold text-emerald-400">0.00%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-text-muted uppercase font-bold block">Health Index</span>
                          <span className="font-mono font-black text-emerald-500">99.8%</span>
                        </div>
                        <div className="h-6 w-0.5 bg-border" />
                        <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded uppercase">
                          AI Live
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: Person Intelligence */}
          {activeTab === 'PERSON_INTEL' && (
            <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-teal-400" />
                  <span className="font-semibold text-sm text-white">Live Person Investigation</span>
                </div>
                <button
                  onClick={() => setShowPersonSearch(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-teal-500/20 border border-teal-500/40 text-teal-400 hover:bg-teal-500/30 transition-colors"
                >
                  <Search size={12} /> Search Person
                </button>
              </div>

              {!intelPerson ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <ScanFace className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium mb-1">No person selected for investigation</p>
                  <p className="text-xs text-gray-700 mb-4">Search by name, ID, appearance, or natural language</p>
                  <button
                    onClick={() => setShowPersonSearch(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm transition-colors"
                  >
                    <Search size={14} /> Open Person Search
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Person card */}
                  <IdentityCard
                    profile={intelPerson}
                    selected
                    onSelect={() => {}}
                    onInvestigate={() => setShowPersonSearch(true)}
                    onWatchlist={async () => {
                      await fetch(`/api/persons/${intelPerson.personId}/watchlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    }}
                  />

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-blue-400">{intelPerson.totalDetections ?? 0}</div>
                      <div className="text-[9px] text-gray-500">Detections</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-teal-400">{intelPerson.totalRecognitions ?? 0}</div>
                      <div className="text-[9px] text-gray-500">Recognised</div>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-purple-400">{intelPerson.cameraHistory?.length ?? 0}</div>
                      <div className="text-[9px] text-gray-500">Cameras</div>
                    </div>
                  </div>

                  {/* Live timeline */}
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                      <Clock size={12} /> Recent Activity
                    </div>
                    <PersonTimeline
                      personId={intelPerson.personId}
                      maxHeight="320px"
                      showFilters={false}
                    />
                  </div>

                  {/* Change subject */}
                  <button
                    onClick={() => setIntelPerson(null)}
                    className="w-full text-xs py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Clear subject
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Person Search Modal */}
      <PersonSearchModal
        open={showPersonSearch}
        onClose={() => setShowPersonSearch(false)}
        onSelect={(profile) => {
          setIntelPerson(profile);
          setActiveTab('PERSON_INTEL');
          setShowPersonSearch(false);
        }}
      />

    </div>
  );
};
