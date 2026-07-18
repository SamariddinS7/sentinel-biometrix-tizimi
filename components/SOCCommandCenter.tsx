/**
 * Enterprise Security Operations Center (SOC) — Unified Command Shell
 *
 * This is the top-level operational interface of the platform.
 * It unifies every subsystem into one command environment through
 * a left-nav module panel. No business logic lives here — this is
 * pure orchestration and navigation.
 *
 * Module list mirrors the architecture spec from PROMPT 8.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Shield, Radio, Search, Bell, ChevronRight, Volume2, ShieldAlert,
  LayoutDashboard, Monitor, Eye, Map, Activity, AlertTriangle,
  FileText, ScanLine, FolderOpen, Fingerprint, BarChart3, Users,
  Globe, ClipboardList, Cpu, Terminal, BellRing, Settings, Zap,
  ChevronLeft, AlertCircle, CheckCircle, Camera, Lock, Unlock,
  RefreshCw, X, User as UserIcon
} from 'lucide-react';
import { motion as m } from 'motion/react';

// ── Sub-component imports ─────────────────────────────────────────────────────
import { SOCOverview }            from './soc/SOCOverview';
import { SOCVideoWall }           from './soc/SOCVideoWall';
import { DigitalTwinView }        from './DigitalTwinView';
import { AreaMapView }            from './AreaMapView';
import { SOCEventTimeline }       from './soc/SOCEventTimeline';
import { AlarmCenter }            from './AlarmCenter';
import { SOCIncidentCenter }      from './soc/SOCIncidentCenter';
import { SOCInvestigationCenter } from './soc/SOCInvestigationCenter';
import { SOCEvidenceManager }     from './soc/SOCEvidenceManager';
import { PersonIntelligencePlatform } from './PersonIntelligencePlatform';
import AnalyticsDashboard         from './AnalyticsDashboard';
import { SOCResourceManager }     from './soc/SOCResourceManager';
import { SOCMultiSite }           from './soc/SOCMultiSite';
import { SOCReports }             from './soc/SOCReports';
import { SOCHealthMonitor }       from './soc/SOCHealthMonitor';
import { AuditLogsView }          from './AuditLogsView';
import { NotificationCenter }     from './NotificationCenter';

// NotificationCenter wrapper (it requires isOpen/onClose but SOC embeds it inline)
const InlineNotificationCenter: React.FC = () => {
  const [open, setOpen] = React.useState(true);
  return <NotificationCenter isOpen={open} onClose={() => setOpen(false)} />;
};

import { authService }     from '../services/authService';
import { vmsAuditService } from '../services/vmsAuditService';
import { vmsEventService, VmsEvent } from '../services/vmsEventService';

// ── Module definition ─────────────────────────────────────────────────────────

type ModuleId =
  | 'overview' | 'video_wall' | 'digital_twin' | 'area_map'
  | 'event_timeline' | 'alarms' | 'incidents' | 'investigation'
  | 'evidence' | 'person_intel' | 'analytics' | 'resources'
  | 'multi_site' | 'reports' | 'health' | 'audit' | 'notifications';

interface SocModule {
  id: ModuleId;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: 'ops' | 'intel' | 'mgmt' | 'sys';
  badgeKey?: 'alarms' | 'incidents' | 'events';
}

const MODULES: SocModule[] = [
  // Operational
  { id: 'overview',        label: 'SOC Overview',         sublabel: 'Command Dashboard',      icon: LayoutDashboard,  group: 'ops' },
  { id: 'video_wall',      label: 'Video Wall',           sublabel: 'Live Camera Grid',       icon: Monitor,          group: 'ops' },
  { id: 'digital_twin',    label: 'Digital Twin',         sublabel: '3D Facility View',       icon: Eye,              group: 'ops' },
  { id: 'area_map',        label: 'Area Map',             sublabel: '2D Floor Plans',         icon: Map,              group: 'ops' },
  { id: 'event_timeline',  label: 'AI Event Timeline',    sublabel: 'Live Detection Feed',    icon: Activity,         group: 'ops', badgeKey: 'events' },
  // Intelligence
  { id: 'alarms',          label: 'Alarm Center',         sublabel: 'Alarm Management',       icon: AlertTriangle,    group: 'intel', badgeKey: 'alarms' },
  { id: 'incidents',       label: 'Incident Center',      sublabel: 'Incident Lifecycle',     icon: FileText,         group: 'intel', badgeKey: 'incidents' },
  { id: 'investigation',   label: 'Investigation',        sublabel: 'Cross-Camera Forensics', icon: ScanLine,         group: 'intel' },
  { id: 'evidence',        label: 'Evidence Manager',     sublabel: 'Digital Chain of Custody', icon: FolderOpen,     group: 'intel' },
  { id: 'person_intel',    label: 'Person Intelligence',  sublabel: 'Identity & Tracking',    icon: Fingerprint,      group: 'intel' },
  // Management
  { id: 'analytics',       label: 'Analytics',            sublabel: 'Enterprise Analytics',   icon: BarChart3,        group: 'mgmt' },
  { id: 'resources',       label: 'Resources',            sublabel: 'Staff & Equipment',      icon: Users,            group: 'mgmt' },
  { id: 'multi_site',      label: 'Multi-Site Ops',       sublabel: 'Cross-Site Monitoring',  icon: Globe,            group: 'mgmt' },
  { id: 'reports',         label: 'Reports',              sublabel: 'Generate Reports',       icon: ClipboardList,    group: 'mgmt' },
  // System
  { id: 'health',          label: 'Health Monitor',       sublabel: 'System & Services',      icon: Cpu,              group: 'sys' },
  { id: 'audit',           label: 'Audit Console',        sublabel: 'Operator Audit Trail',   icon: Terminal,         group: 'sys' },
  { id: 'notifications',   label: 'Notifications',        sublabel: 'Alerts & Messaging',     icon: BellRing,         group: 'sys' },
];

const GROUP_LABELS: Record<SocModule['group'], string> = {
  ops:   'Operations',
  intel: 'Intelligence',
  mgmt:  'Management',
  sys:   'System',
};

// ── Live badges (event bus) ───────────────────────────────────────────────────

interface LiveBadges {
  alarms: number;
  incidents: number;
  events: number;
}

// ── ModuleNav item ────────────────────────────────────────────────────────────

const NavItem: React.FC<{
  module: SocModule;
  active: boolean;
  badge?: number;
  collapsed: boolean;
  onClick: () => void;
}> = ({ module, active, badge, collapsed, onClick }) => {
  const Icon = module.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? module.label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group relative
        ${active
          ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/25'
          : 'text-text-muted hover:text-text-primary hover:bg-app-surface'
        }`}
    >
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <Icon size={15} />
      </div>
      {!collapsed && (
        <span className="text-xs font-semibold truncate flex-1">{module.label}</span>
      )}
      {badge && badge > 0 ? (
        <span className={`flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full
          ${active ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
};

// ── Global search ─────────────────────────────────────────────────────────────

interface SearchResult {
  type: 'camera' | 'incident' | 'alarm' | 'person';
  label: string;
  sub: string;
  module: ModuleId;
}

const GlobalSearch: React.FC<{ onNavigate: (m: ModuleId) => void; onClose: () => void }> = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const token = authService.getToken?.() ?? '';
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/soc/search?q=${encodeURIComponent(query)}&limit=8`, { headers });
        if (res.ok) {
          const data = await res.json();
          const mapped: SearchResult[] = [];
          (data.cameras ?? []).forEach((c: any) => mapped.push({ type: 'camera', label: c.name, sub: c.location ?? c.type, module: 'video_wall' }));
          (data.incidents ?? []).forEach((i: any) => mapped.push({ type: 'incident', label: i.title, sub: i.category, module: 'incidents' }));
          (data.alerts ?? []).forEach((a: any) => mapped.push({ type: 'alarm', label: a.type ?? a.category, sub: a.source, module: 'alarms' }));
          (data.persons ?? []).forEach((p: any) => mapped.push({ type: 'person', label: p.fullName ?? p.label, sub: 'Person', module: 'person_intel' }));
          setResults(mapped);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    camera: Camera, incident: FileText, alarm: AlertTriangle, person: Fingerprint,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-app-panel border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cameras, incidents, alarms, persons…"
            className="flex-1 bg-transparent text-text-primary text-sm focus:outline-none placeholder:text-text-muted"
          />
          {loading && <RefreshCw size={14} className="text-text-muted animate-spin" />}
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>
        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {results.map((r, i) => {
              const Icon = TYPE_ICON[r.type] ?? Search;
              return (
                <button
                  key={i}
                  onClick={() => { onNavigate(r.module); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-surface text-left transition-colors"
                >
                  <Icon size={14} className="text-text-muted flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{r.label}</p>
                    <p className="text-[10px] text-text-muted">{r.sub}</p>
                  </div>
                  <ChevronRight size={12} className="text-text-muted ml-auto" />
                </button>
              );
            })}
          </div>
        )}
        {query.length >= 2 && !loading && results.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">No results found for "{query}"</p>
        )}
      </div>
    </div>
  );
};

// ── Main SOCCommandCenter ─────────────────────────────────────────────────────

export const SOCCommandCenter: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isLockdown, setIsLockdown] = useState(false);
  const [isBuzzer, setIsBuzzer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [badges, setBadges] = useState<LiveBadges>({ alarms: 0, incidents: 0, events: 0 });
  const [site, setSite] = useState('Tashkent Campus HQ');

  const navigate = useCallback((id: ModuleId) => {
    setActiveModule(id);
  }, []);

  // ── Load live badge counts ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const token = authService.getToken?.() ?? '';
      const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const [alarmRes, incRes] = await Promise.allSettled([
          fetch('/api/security/alerts', { headers: h }),
          fetch('/api/incidents', { headers: h }),
        ]);
        const alarmList = alarmRes.status === 'fulfilled' && alarmRes.value.ok
          ? (await alarmRes.value.json()) : [];
        const incList = incRes.status === 'fulfilled' && incRes.value.ok
          ? (await incRes.value.json()) : [];
        const alarms = Array.isArray(alarmList) ? alarmList : (alarmList.alerts ?? []);
        const incs = Array.isArray(incList) ? incList : (incList.incidents ?? []);
        setBadges(prev => ({
          ...prev,
          alarms: alarms.filter((a: any) => a.status === 'ACTIVE' || a.status === 'PENDING').length,
          incidents: incs.filter((i: any) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length,
        }));
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  // ── Subscribe to event bus for live event badge ───────────────────────────
  useEffect(() => {
    const unsub = vmsEventService.subscribeToAll(() => {
      setBadges(prev => ({ ...prev, events: prev.events + 1 }));
    });
    return unsub;
  }, []);

  // Clear event badge when navigating to timeline
  useEffect(() => {
    if (activeModule === 'event_timeline') {
      setBadges(prev => ({ ...prev, events: 0 }));
    }
  }, [activeModule]);

  // ── Audit log on entry ────────────────────────────────────────────────────
  useEffect(() => {
    const user = authService.getCurrentUser();
    vmsAuditService.log({
      userId: user?.id ?? 'operator',
      userName: user?.fullName ?? 'SOC Operator',
      action: 'ENTER_SOC_COMMAND_CENTER',
      module: 'SOC Unified Command',
      status: 'SUCCESS',
      ipAddress: window.location.hostname,
      details: 'Operator entered SOC Unified Command Center.',
    });
  }, []);

  const handleLockdown = async () => {
    const next = !isLockdown;
    setIsLockdown(next);
    const user = authService.getCurrentUser();
    await vmsAuditService.log({
      userId: user?.id ?? 'operator',
      userName: user?.fullName ?? 'SOC Operator',
      action: next ? 'ACTIVATE_LOCKDOWN' : 'DEACTIVATE_LOCKDOWN',
      module: 'SOC Emergency Controls',
      status: 'SUCCESS',
      ipAddress: window.location.hostname,
      details: next
        ? 'CRITICAL: Campus lockdown activated. Mag-locks engaged, fire shutters on standby.'
        : 'Campus lockdown cleared. Normal access control resumed.',
    });
  };

  const handleBuzzer = () => setIsBuzzer(v => !v);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  // ── Render active module ──────────────────────────────────────────────────
  const renderModule = () => {
    switch (activeModule) {
      case 'overview':       return <SOCOverview onNavigate={id => navigate(id as ModuleId)} />;
      case 'video_wall':     return <SOCVideoWall />;
      case 'digital_twin':   return <div className="h-full"><DigitalTwinView /></div>;
      case 'area_map':       return <AreaMapView />;
      case 'event_timeline': return <SOCEventTimeline />;
      case 'alarms':         return <AlarmCenter />;
      case 'incidents':      return <SOCIncidentCenter />;
      case 'investigation':  return <SOCInvestigationCenter />;
      case 'evidence':       return <SOCEvidenceManager />;
      case 'person_intel':   return <PersonIntelligencePlatform />;
      case 'analytics':      return <AnalyticsDashboard />;
      case 'resources':      return <SOCResourceManager />;
      case 'multi_site':     return <SOCMultiSite />;
      case 'reports':        return <SOCReports />;
      case 'health':         return <SOCHealthMonitor />;
      case 'audit':          return <AuditLogsView />;
      case 'notifications':  return <InlineNotificationCenter />;
      default:               return null;
    }
  };

  const activeModuleMeta = MODULES.find(m => m.id === activeModule);

  // Group modules for nav
  const groups = (['ops', 'intel', 'mgmt', 'sys'] as const).map(g => ({
    key: g,
    label: GROUP_LABELS[g],
    items: MODULES.filter(m => m.group === g),
  }));

  return (
    <div className={`flex h-full w-full overflow-hidden relative ${isLockdown ? 'ring-2 ring-red-500/30' : ''}`}>

      {/* Global search overlay */}
      <AnimatePresence>
        {showSearch && (
          <GlobalSearch onNavigate={id => { navigate(id); setShowSearch(false); }} onClose={() => setShowSearch(false)} />
        )}
      </AnimatePresence>

      {/* ── Left navigation panel ─────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: navCollapsed ? 56 : 220 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-shrink-0 h-full bg-app-panel border-r border-border flex flex-col overflow-hidden z-10"
      >
        {/* Nav header */}
        <div className={`flex items-center ${navCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-3 border-b border-border`}>
          {!navCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center flex-shrink-0">
                <Shield size={13} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-text-primary truncate">SOC Command</p>
                <p className="text-[8px] text-text-muted">Unified Operations</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setNavCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-app-surface transition-all flex-shrink-0"
          >
            {navCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 space-y-1 px-2">
          {groups.map(group => (
            <div key={group.key}>
              {!navCollapsed && (
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest px-2 py-2">
                  {group.label}
                </p>
              )}
              {navCollapsed && <div className="h-2" />}
              {group.items.map(mod => (
                <NavItem
                  key={mod.id}
                  module={mod}
                  active={activeModule === mod.id}
                  badge={mod.badgeKey ? badges[mod.badgeKey] : undefined}
                  collapsed={navCollapsed}
                  onClick={() => navigate(mod.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Bottom status */}
        {!navCollapsed && (
          <div className="px-3 py-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 font-bold">LIVE</span>
              <span className="text-text-muted">{site.split(' ')[0]}</span>
            </div>
          </div>
        )}
      </motion.aside>

      {/* ── Right: header + module panel ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top command bar ────────────────────────────────────────────── */}
        <div className={`flex-shrink-0 bg-app-panel border-b border-border px-4 py-2.5 flex items-center gap-3 ${isLockdown ? 'bg-red-950/30 border-red-500/30' : ''}`}>

          {/* Site selector + module name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Radio size={12} className={isLockdown ? 'text-red-400 animate-pulse' : 'text-text-muted'} />
              <h1 className="text-sm font-bold text-text-primary truncate">{activeModuleMeta?.label}</h1>
              {activeModuleMeta?.sublabel && (
                <span className="text-[10px] text-text-muted hidden sm:inline">{activeModuleMeta.sublabel}</span>
              )}
            </div>
            <select
              value={site}
              onChange={e => setSite(e.target.value)}
              className="mt-0.5 text-[9px] font-bold text-text-muted bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              <option>Tashkent Campus HQ</option>
              <option>Samarkand Tech Hub</option>
              <option>HQ Server Farm</option>
              <option>Namangan Industrial</option>
            </select>
          </div>

          {/* Lockdown indicator */}
          {isLockdown && (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-lg text-red-400 text-[10px] font-black uppercase animate-pulse">
              <Lock size={10} /> LOCKDOWN ACTIVE
            </div>
          )}

          {/* Global search */}
          <button
            onClick={() => setShowSearch(true)}
            className="hidden sm:flex items-center gap-2 bg-app-primary border border-border rounded-lg px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-brand-primary/40 transition-all"
          >
            <Search size={12} />
            <span>Search…</span>
            <kbd className="text-[9px] bg-app-surface border border-border rounded px-1 font-mono">⌘K</kbd>
          </button>

          {/* Emergency controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBuzzer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[10px] transition-all
                ${isBuzzer
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-bounce'
                  : 'bg-app-primary border-border text-text-muted hover:text-text-primary'}`}
            >
              <Volume2 size={12} />
              <span className="hidden sm:inline">Buzzer</span>
              {isBuzzer && <span>ON</span>}
            </button>

            <button
              onClick={handleLockdown}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all
                ${isLockdown
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/30 animate-pulse'
                  : 'bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-950'}`}
            >
              {isLockdown ? <Lock size={12} /> : <ShieldAlert size={12} />}
              <span className="hidden sm:inline">{isLockdown ? 'Unlock' : 'Lockdown'}</span>
            </button>
          </div>
        </div>

        {/* ── Module panel ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className={`h-full ${
                // Full-height modules that manage their own scrolling
                ['digital_twin', 'area_map', 'video_wall'].includes(activeModule)
                  ? 'overflow-hidden'
                  : 'p-5 pb-10'
              }`}
            >
              {renderModule()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
