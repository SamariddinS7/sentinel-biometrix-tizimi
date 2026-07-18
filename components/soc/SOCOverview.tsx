import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Shield, Camera, AlertTriangle, FileText, Users, Activity, Cpu, HardDrive,
  CheckCircle2, AlertCircle, Clock, TrendingUp, Zap, MapPin, Eye, ArrowUpRight,
  RefreshCw, Radio, Monitor, Server, Database
} from 'lucide-react';
import { authService } from '../../services/authService';
import { vmsEventService, VmsEvent } from '../../services/vmsEventService';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewStats {
  cameras: { total: number; online: number; offline: number };
  alarms: { total: number; pending: number; critical: number };
  incidents: { total: number; open: number; critical: number };
  system: { cpu: number; ram: number; gpu: number; uptime: number };
  personnel: { total: number; deployed: number };
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
  onClick?: () => void;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard: React.FC<StatCardProps> = ({
  label, value, sub, icon: Icon, iconColor, alert, onClick
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-app-panel border rounded-xl p-4 space-y-2 ${alert ? 'border-red-500/40 shadow-red-500/10 shadow-lg' : 'border-border'} ${onClick ? 'cursor-pointer hover:border-brand-primary/40 transition-all' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor}`}>
        <Icon size={14} className="text-white" />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <span className={`text-2xl font-black ${alert ? 'text-red-400' : 'text-text-primary'}`}>{value}</span>
      {sub && <span className="text-[10px] text-text-muted pb-1">{sub}</span>}
    </div>
    {alert && (
      <div className="flex items-center gap-1 text-[9px] text-red-400 font-bold uppercase">
        <AlertCircle size={10} /> Requires attention
      </div>
    )}
  </motion.div>
);

// ── MiniGauge ─────────────────────────────────────────────────────────────────

const MiniGauge: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-bold text-text-secondary">
      <span>{label}</span>
      <span className={value > 85 ? 'text-red-400' : value > 65 ? 'text-amber-400' : 'text-emerald-400'}>
        {value}%
      </span>
    </div>
    <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

// ── EventFeed (mini) ──────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<VmsEvent['severity'], string> = {
  CRITICAL: 'bg-red-500',
  WARNING: 'bg-amber-500',
  INFO: 'bg-blue-500',
  SUCCESS: 'bg-emerald-500',
};

// ── SOCOverview ───────────────────────────────────────────────────────────────

export const SOCOverview: React.FC<{ onNavigate?: (module: string) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState<OverviewStats>({
    cameras: { total: 0, online: 0, offline: 0 },
    alarms: { total: 0, pending: 0, critical: 0 },
    incidents: { total: 0, open: 0, critical: 0 },
    system: { cpu: 0, ram: 0, gpu: 0, uptime: 0 },
    personnel: { total: 0, deployed: 0 },
  });
  const [recentEvents, setRecentEvents] = useState<VmsEvent[]>([]);
  const [eventChart, setEventChart] = useState<{ time: string; events: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    const token = authService.getToken?.() ?? '';
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const [camRes, alarmRes, incRes, sysRes, staffRes] = await Promise.allSettled([
        fetch('/api/cameras', { headers }),
        fetch('/api/security/alerts', { headers }),
        fetch('/api/incidents', { headers }),
        fetch('/api/telemetry', { headers }),
        fetch('/api/resources/staff', { headers }),
      ]);

      const cameras = camRes.status === 'fulfilled' && camRes.value.ok ? await camRes.value.json() : [];
      const camList = Array.isArray(cameras) ? cameras : (cameras.cameras ?? []);

      const alarmsData = alarmRes.status === 'fulfilled' && alarmRes.value.ok ? await alarmRes.value.json() : [];
      const alarmList = Array.isArray(alarmsData) ? alarmsData : (alarmsData.alerts ?? []);

      const incsData = incRes.status === 'fulfilled' && incRes.value.ok ? await incRes.value.json() : [];
      const incList = Array.isArray(incsData) ? incsData : (incsData.incidents ?? []);

      const sys = sysRes.status === 'fulfilled' && sysRes.value.ok ? await sysRes.value.json() : {};

      const staffData = staffRes.status === 'fulfilled' && staffRes.value.ok ? await staffRes.value.json() : {};
      const staffList = Array.isArray(staffData) ? staffData : (staffData.staff ?? []);

      setStats({
        cameras: {
          total: camList.length,
          online: camList.filter((c: any) => c.status === 'ONLINE' || c.status === 'online' || !c.status).length,
          offline: camList.filter((c: any) => c.status === 'OFFLINE' || c.status === 'offline').length,
        },
        alarms: {
          total: alarmList.length,
          pending: alarmList.filter((a: any) => a.status === 'ACTIVE' || a.status === 'PENDING').length,
          critical: alarmList.filter((a: any) => a.severity === 'CRITICAL').length,
        },
        incidents: {
          total: incList.length,
          open: incList.filter((i: any) => i.status === 'OPEN' || i.status === 'INVESTIGATING').length,
          critical: incList.filter((i: any) => i.priority === 'CRITICAL').length,
        },
        system: {
          cpu: sys.cpuUsage ?? 0,
          ram: sys.ramUsagePercentage ?? 0,
          gpu: sys.gpuUsage ?? 0,
          uptime: sys.uptimeSec ?? 0,
        },
        personnel: {
          total: staffList.length,
          deployed: staffList.filter((s: any) => s.status === 'DISPATCHED' || s.status === 'ON_PATROL').length,
        },
      });
    } catch {
      // Non-fatal — keep previous stats
    }

    // Recent events from the event bus
    const history = vmsEventService.getHistory();
    setRecentEvents(history.slice(0, 10));

    // Build chart data: group last 12 events into buckets by minute
    const buckets: Record<string, number> = {};
    history.slice(0, 60).forEach(e => {
      const min = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      buckets[min] = (buckets[min] || 0) + 1;
    });
    setEventChart(
      Object.entries(buckets).reverse().slice(-12).map(([time, events]) => ({ time, events }))
    );

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  // Subscribe to live events for real-time updates
  useEffect(() => {
    return vmsEventService.subscribeToAll(evt => {
      setRecentEvents(prev => [evt, ...prev].slice(0, 10));
    });
  }, []);

  const uptimeStr = (() => {
    const s = stats.system.uptime;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  })();

  return (
    <div className="space-y-6 pb-6">
      {/* Top header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-text-primary flex items-center gap-2">
            <Radio size={18} className="text-red-400 animate-pulse" /> SOC Overview
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Last updated: {lastRefresh.toLocaleTimeString()} · All systems monitored in real-time
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-border bg-app-panel text-text-muted hover:text-text-primary transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cameras"
          value={stats.cameras.online}
          sub={`/ ${stats.cameras.total} total`}
          icon={Camera}
          iconColor="bg-cyan-600"
          alert={stats.cameras.offline > 0}
          onClick={() => onNavigate?.('video_wall')}
        />
        <StatCard
          label="Pending Alarms"
          value={stats.alarms.pending}
          sub={stats.alarms.critical > 0 ? `${stats.alarms.critical} critical` : 'all clear'}
          icon={AlertTriangle}
          iconColor={stats.alarms.pending > 0 ? 'bg-red-600' : 'bg-emerald-600'}
          alert={stats.alarms.critical > 0}
          onClick={() => onNavigate?.('alarms')}
        />
        <StatCard
          label="Open Incidents"
          value={stats.incidents.open}
          sub={`${stats.incidents.total} total`}
          icon={FileText}
          iconColor={stats.incidents.critical > 0 ? 'bg-red-600' : 'bg-brand-primary'}
          alert={stats.incidents.critical > 0}
          onClick={() => onNavigate?.('incidents')}
        />
        <StatCard
          label="Personnel Deployed"
          value={stats.personnel.deployed}
          sub={`/ ${stats.personnel.total} staff`}
          icon={Users}
          iconColor="bg-purple-600"
          onClick={() => onNavigate?.('resources')}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* System health */}
        <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Server size={13} /> System Health
          </h3>
          <MiniGauge label="CPU" value={stats.system.cpu} color="bg-cyan-500" />
          <MiniGauge label="RAM" value={stats.system.ram} color="bg-emerald-500" />
          <MiniGauge label="GPU" value={stats.system.gpu} color="bg-amber-500" />
          <div className="pt-2 border-t border-border text-[10px] text-text-muted flex justify-between">
            <span>System Uptime</span>
            <span className="text-emerald-400 font-bold">{uptimeStr}</span>
          </div>
          <button
            onClick={() => onNavigate?.('health')}
            className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-app-primary border border-border text-text-muted hover:text-text-primary flex items-center justify-center gap-1 transition-all"
          >
            Full Health Monitor <ArrowUpRight size={11} />
          </button>
        </div>

        {/* Event chart */}
        <div className="bg-app-panel border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={13} /> Event Rate (last 12 min)
          </h3>
          <div className="h-36">
            {eventChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventChart} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-panel, #1e293b)', border: '1px solid var(--color-border, #334155)', borderRadius: 8, fontSize: 10 }}
                  />
                  <Area type="monotone" dataKey="events" stroke="#0ea5e9" fill="url(#evtGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-xs">
                Collecting event data...
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate?.('event_timeline')}
            className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-app-primary border border-border text-text-muted hover:text-text-primary flex items-center justify-center gap-1 transition-all"
          >
            Full Event Timeline <ArrowUpRight size={11} />
          </button>
        </div>

        {/* Live event feed */}
        <div className="bg-app-panel border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Zap size={13} className="text-brand-primary" /> Live Events
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-[10px] text-text-muted text-center py-6">Awaiting events...</p>
            ) : (
              recentEvents.map(evt => (
                <div key={evt.id} className="flex items-center gap-2 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[evt.severity]}`} />
                  <span className="text-text-secondary truncate flex-1">{evt.source}</span>
                  <span className="text-text-muted font-mono flex-shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => onNavigate?.('event_timeline')}
            className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-app-primary border border-border text-text-muted hover:text-text-primary flex items-center justify-center gap-1 transition-all"
          >
            View All Events <ArrowUpRight size={11} />
          </button>
        </div>
      </div>

      {/* Quick-access module grid */}
      <div>
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { id: 'video_wall',    label: 'Video Wall',      icon: Monitor,   color: 'text-cyan-400' },
            { id: 'digital_twin',  label: 'Digital Twin',    icon: Eye,       color: 'text-blue-400' },
            { id: 'event_timeline',label: 'Event Timeline',  icon: Activity,  color: 'text-brand-primary' },
            { id: 'investigation', label: 'Investigation',   icon: MapPin,    color: 'text-purple-400' },
            { id: 'evidence',      label: 'Evidence',        icon: Database,  color: 'text-amber-400' },
            { id: 'health',        label: 'Health Monitor',  icon: Cpu,       color: 'text-emerald-400' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className="bg-app-panel border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-brand-primary/40 transition-all group"
              >
                <Icon size={18} className={`${item.color} group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-bold text-text-muted text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
