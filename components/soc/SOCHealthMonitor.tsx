import React, { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '../Skeleton';
import {
  Cpu, Database, Activity, Server, Camera, HardDrive,
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Zap,
  Network, Clock, BarChart3, Brain, Archive
} from 'lucide-react';
import { authService } from '../../services/authService';

interface Telemetry {
  cpuUsage: number;
  cpuTemperature: number;
  ramTotalMb: number;
  ramUsedMb: number;
  ramUsagePercentage: number;
  networkInboundKbps: number;
  networkOutboundKbps: number;
  gpuUsage?: number;
  gpuTemperature?: number;
  uptimeSec: number;
}

interface ServiceState {
  serviceName: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  threadCount: number;
  memoryUsageMb: number;
  restartCount: number;
}

interface CameraInfo {
  id: string;
  name: string;
  status: string;
  location?: string;
  zone?: string;
  fps?: number;
  resolution?: string;
  lastActive?: string;
}

interface AIStats {
  personsTracked?: number;
  detectionsLastMinute?: number;
  framesProcessed?: number;
  modelName?: string;
  modelStatus?: string;
}

interface StorageInfo {
  usedBytes?: number;
  totalBytes?: number;
  usagePercentage?: number;
  recordingsCount?: number;
  volumes?: any[];
}

interface EventBus {
  totalEvents?: number;
  byType?: Record<string, number>;
}

const getHeaders = () => {
  const token = authService.getToken?.() || '';
  return token ? { Authorization: 'Bearer ' + token } : {} as Record<string, string>;
};

const formatUptime = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const relativeTime = (iso: string) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    ONLINE: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30',
    OFFLINE: 'bg-red-950/60 text-red-400 border border-red-500/30',
    DEGRADED: 'bg-amber-950/60 text-amber-400 border border-amber-500/30',
    ERROR: 'bg-red-950/60 text-red-400 border border-red-500/30',
    ACTIVE: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${colorMap[status] || 'bg-slate-800 text-slate-400'}`}>
      {status}
    </span>
  );
};

const ProgressBar: React.FC<{ value: number; color?: string; height?: string }> = ({
  value, color = 'bg-brand-primary', height = 'h-2'
}) => (
  <div className={`w-full bg-border/40 ${height} rounded-full overflow-hidden`}>
    <div
      className={`${color} ${height} rounded-full transition-all duration-700`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  progress?: number;
  progressColor?: string;
}> = ({ icon, label, value, sub, color = 'text-brand-primary', progress, progressColor }) => (
  <div className="bg-app-panel border border-border rounded-xl p-4 space-y-2">
    <div className="flex items-center gap-2">
      <span className={color}>{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-text-muted font-mono font-bold">{label}</span>
    </div>
    <p className={`text-2xl font-bold font-mono text-text-primary`}>{value}</p>
    {progress !== undefined && (
      <ProgressBar value={progress} color={progressColor || 'bg-brand-primary'} />
    )}
    {sub && <p className="text-[10px] text-text-muted font-mono">{sub}</p>}
  </div>
);

export const SOCHealthMonitor: React.FC = () => {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [eventBus, setEventBus] = useState<EventBus | null>(null);
  const [restartingService, setRestartingService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = getHeaders();

  // --- Fetchers ---
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry', { headers });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (e) { console.error('Telemetry fetch error:', e); }
  }, []);

  const fetchServiceHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/system/health', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.services) setServices(data.services);
        if (data.telemetry) setTelemetry(data.telemetry);
      }
    } catch (e) { console.error('Service health fetch error:', e); }
  }, []);

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/cameras', { headers });
      if (res.ok) {
        const data = await res.json();
        setCameras(Array.isArray(data) ? data : data.cameras || []);
      }
    } catch (e) { console.error('Camera fetch error:', e); }
  }, []);

  const fetchAI = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/stats', { headers });
      if (res.ok) {
        const data = await res.json();
        setAiStats(data);
      }
    } catch (e) { console.error('AI stats fetch error:', e); }
  }, []);

  const fetchStorage = useCallback(async () => {
    try {
      const [storRes, evidRes] = await Promise.allSettled([
        fetch('/api/system/storage', { headers }),
        fetch('/api/evidence', { headers }),
      ]);
      if (storRes.status === 'fulfilled' && storRes.value.ok) {
        const data = await storRes.value.json();
        setStorage(data);
      }
      if (evidRes.status === 'fulfilled' && evidRes.value.ok) {
        const data = await evidRes.value.json();
        setEvidenceCount(Array.isArray(data) ? data.length : data.count ?? data.total ?? 0);
      }
    } catch (e) { console.error('Storage fetch error:', e); }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/system/events', { headers });
      if (res.ok) {
        const data = await res.json();
        setEventBus(data);
      }
    } catch (e) { console.error('Events fetch error:', e); }
  }, []);

  const initialLoad = useCallback(async () => {
    await Promise.allSettled([
      fetchTelemetry(),
      fetchServiceHealth(),
      fetchCameras(),
      fetchAI(),
      fetchStorage(),
      fetchEvents(),
    ]);
    setLoading(false);
  }, [fetchTelemetry, fetchServiceHealth, fetchCameras, fetchAI, fetchStorage, fetchEvents]);

  useEffect(() => {
    initialLoad();

    const t5s = setInterval(fetchTelemetry, 5000);
    const t10s = setInterval(fetchAI, 10000);
    const t15s_services = setInterval(fetchServiceHealth, 15000);
    const t15s_cameras = setInterval(fetchCameras, 15000);
    const t15s_events = setInterval(fetchEvents, 15000);
    const t30s = setInterval(fetchStorage, 30000);

    return () => {
      clearInterval(t5s);
      clearInterval(t10s);
      clearInterval(t15s_services);
      clearInterval(t15s_cameras);
      clearInterval(t15s_events);
      clearInterval(t30s);
    };
  }, [initialLoad, fetchTelemetry, fetchAI, fetchServiceHealth, fetchCameras, fetchEvents, fetchStorage]);

  const handleRestartService = async (name: string) => {
    setRestartingService(name);
    try {
      const res = await fetch('/api/system/health/restart-service', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setServices(prev => prev.map(s => s.serviceName === name ? { ...s, status: 'OFFLINE', memoryUsageMb: 0 } : s));
        setTimeout(fetchServiceHealth, 2000);
      }
    } catch (e) { console.error('Restart error:', e); }
    finally { setTimeout(() => setRestartingService(null), 2500); }
  };

  // Derived values
  const servicesOnline = services.filter(s => s.status === 'ONLINE').length;
  const servicesDegraded = services.filter(s => s.status === 'DEGRADED').length;
  const servicesOffline = services.filter(s => s.status === 'OFFLINE').length;

  const sortedCameras = [...cameras].sort((a, b) => {
    const order: Record<string, number> = { OFFLINE: 0, ERROR: 1, DEGRADED: 2, ONLINE: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });
  const camerasOnline = cameras.filter(c => c.status === 'ONLINE' || c.status === 'ACTIVE').length;
  const camerasOffline = cameras.filter(c => c.status === 'OFFLINE').length;
  const camerasError = cameras.filter(c => c.status === 'ERROR').length;

  const storageUsed = storage?.usedBytes ?? 0;
  const storageTotal = storage?.totalBytes ?? 0;
  const storagePct = storageTotal > 0 ? Math.round((storageUsed / storageTotal) * 100) : (storage?.usagePercentage ?? 0);

  const topEventTypes = eventBus?.byType
    ? Object.entries(eventBus.byType).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];
  const maxEventCount = topEventTypes.length > 0 ? topEventTypes[0][1] : 1;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="border-b border-border pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-app-panel border border-border/40 rounded-xl p-4 flex items-center gap-4 animate-pulse">
              <div className="bg-slate-800 h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-app-panel border border-border/40 rounded-xl p-4 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-app-panel border border-border/40 rounded-xl p-4 space-y-4">
              <Skeleton className="h-5 w-32" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border/20">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Activity className="text-brand-primary w-5 h-5" /> System Health Monitor
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          Real-time telemetry, service health, camera status, AI pipeline, and storage monitoring
        </p>
      </div>

      {/* SECTION 1: Hardware Telemetry */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" /> Hardware Telemetry
          <span className="text-text-muted font-normal normal-case">(polling every 5s)</span>
        </h3>
        {!telemetry ? (
          <div className="bg-app-panel border border-border rounded-xl p-6 text-center text-text-muted text-sm font-mono">
            No telemetry data available
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* CPU */}
            <MetricCard
              icon={<Cpu className="w-4 h-4" />}
              label="CPU Usage"
              value={`${telemetry.cpuUsage}%`}
              sub={`Temp: ${telemetry.cpuTemperature}°C`}
              color="text-indigo-400"
              progress={telemetry.cpuUsage}
              progressColor={telemetry.cpuUsage > 85 ? 'bg-red-500' : telemetry.cpuUsage > 60 ? 'bg-amber-500' : 'bg-indigo-500'}
            />
            {/* RAM */}
            <MetricCard
              icon={<Database className="w-4 h-4" />}
              label="RAM Usage"
              value={`${telemetry.ramUsagePercentage}%`}
              sub={`${Math.round(telemetry.ramUsedMb / 1024)}/${Math.round(telemetry.ramTotalMb / 1024)} GB`}
              color="text-emerald-400"
              progress={telemetry.ramUsagePercentage}
              progressColor={telemetry.ramUsagePercentage > 85 ? 'bg-red-500' : 'bg-emerald-500'}
            />
            {/* GPU */}
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="GPU Usage"
              value={`${telemetry.gpuUsage ?? 0}%`}
              sub={telemetry.gpuTemperature ? `Temp: ${telemetry.gpuTemperature}°C` : 'No GPU data'}
              color="text-cyan-400"
              progress={telemetry.gpuUsage ?? 0}
              progressColor="bg-cyan-500"
            />
            {/* Network */}
            <MetricCard
              icon={<Network className="w-4 h-4" />}
              label="Network In"
              value={`${(telemetry.networkInboundKbps / 1024).toFixed(1)} Mbps`}
              sub={`Out: ${(telemetry.networkOutboundKbps / 1024).toFixed(1)} Mbps`}
              color="text-pink-400"
              progress={Math.min(100, (telemetry.networkInboundKbps / 30000) * 100)}
              progressColor="bg-pink-500"
            />
            {/* Uptime */}
            <MetricCard
              icon={<Clock className="w-4 h-4" />}
              label="Uptime"
              value={formatUptime(telemetry.uptimeSec)}
              color="text-violet-400"
            />
          </div>
        )}
      </section>

      {/* SECTION 2: Service Health */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <Server className="w-4 h-4 text-brand-primary" /> Service Health
          <span className="text-text-muted font-normal normal-case">(polling every 15s)</span>
        </h3>
        <div className="bg-app-panel border border-border rounded-xl overflow-hidden">
          {/* Summary */}
          <div className="flex gap-4 px-4 py-3 border-b border-border text-xs font-mono">
            <span className="text-emerald-400 font-bold">{servicesOnline} online</span>
            {servicesDegraded > 0 && <span className="text-amber-400 font-bold">{servicesDegraded} degraded</span>}
            {servicesOffline > 0 && <span className="text-red-400 font-bold">{servicesOffline} offline</span>}
          </div>
          {services.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm font-mono">No service data</div>
          ) : (
            <div className="divide-y divide-border/50">
              {services.map((svc, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-4 px-4 py-3 text-xs font-mono ${
                    svc.status === 'OFFLINE' ? 'bg-red-950/10' : svc.status === 'DEGRADED' ? 'bg-amber-950/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      svc.status === 'ONLINE' ? 'bg-emerald-400' :
                      svc.status === 'DEGRADED' ? 'bg-amber-400 animate-pulse' :
                      'bg-red-400 animate-pulse'
                    }`} />
                    <span className="font-bold text-text-primary truncate">{svc.serviceName}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-text-muted hidden sm:block">
                      <span className="text-text-secondary">{svc.memoryUsageMb}</span> MB
                    </span>
                    <span className="text-text-muted hidden sm:block">
                      <span className="text-text-secondary">{svc.threadCount}</span> threads
                    </span>
                    {svc.restartCount > 0 && (
                      <span className="text-amber-400 hidden md:block">{svc.restartCount} restarts</span>
                    )}
                    <StatusBadge status={svc.status} />
                    <button
                      onClick={() => handleRestartService(svc.serviceName)}
                      disabled={restartingService === svc.serviceName}
                      className="flex items-center gap-1 px-2 py-1 bg-app-surface border border-border rounded text-[10px] text-text-secondary hover:border-brand-primary/40 hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${restartingService === svc.serviceName ? 'animate-spin' : ''}`} />
                      {restartingService === svc.serviceName ? 'Restarting…' : 'Restart'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: Camera Health */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand-primary" /> Camera Health
          <span className="text-text-muted font-normal normal-case">(polling every 15s)</span>
        </h3>
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: cameras.length, color: 'text-text-primary' },
            { label: 'Online', value: camerasOnline, color: 'text-emerald-400' },
            { label: 'Offline', value: camerasOffline, color: 'text-red-400' },
            { label: 'Error', value: camerasError, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-app-panel border border-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              <p className="text-[10px] text-text-muted uppercase font-mono mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-app-panel border border-border rounded-xl overflow-hidden">
          {cameras.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm font-mono">No camera data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-text-muted bg-app-surface/50">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3 hidden sm:table-cell">Location</th>
                    <th className="text-left py-2 px-3 hidden md:table-cell">FPS</th>
                    <th className="text-left py-2 px-3 hidden md:table-cell">Resolution</th>
                    <th className="text-left py-2 px-3">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedCameras.map((cam, i) => (
                    <tr
                      key={cam.id || i}
                      className={`${
                        cam.status === 'OFFLINE' || cam.status === 'ERROR'
                          ? 'bg-red-950/10'
                          : 'hover:bg-app-surface/30'
                      } transition-colors`}
                    >
                      <td className="py-2 px-3 text-text-primary font-bold">{cam.name}</td>
                      <td className="py-2 px-3"><StatusBadge status={cam.status} /></td>
                      <td className="py-2 px-3 text-text-secondary hidden sm:table-cell">{cam.location || cam.zone || '—'}</td>
                      <td className="py-2 px-3 text-text-muted hidden md:table-cell">{cam.fps ?? '—'}</td>
                      <td className="py-2 px-3 text-text-muted hidden md:table-cell">{cam.resolution || '—'}</td>
                      <td className="py-2 px-3 text-text-muted">{cam.lastActive ? relativeTime(cam.lastActive) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: AI Pipeline */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" /> AI Pipeline
          <span className="text-text-muted font-normal normal-case">(polling every 10s)</span>
        </h3>
        {!aiStats ? (
          <div className="bg-app-panel border border-border rounded-xl p-6 text-center text-text-muted text-sm font-mono">
            No AI stats available
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              icon={<Activity className="w-4 h-4" />}
              label="Persons Tracked"
              value={aiStats.personsTracked ?? 0}
              color="text-violet-400"
            />
            <MetricCard
              icon={<Zap className="w-4 h-4" />}
              label="Detections / min"
              value={aiStats.detectionsLastMinute ?? 0}
              color="text-cyan-400"
            />
            <MetricCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Frames Processed"
              value={(aiStats.framesProcessed ?? 0).toLocaleString()}
              color="text-indigo-400"
            />
            <MetricCard
              icon={<Brain className="w-4 h-4" />}
              label="Model"
              value={aiStats.modelName ?? 'N/A'}
              sub={aiStats.modelStatus ? `Status: ${aiStats.modelStatus}` : undefined}
              color="text-pink-400"
            />
          </div>
        )}
      </section>

      {/* SECTION 5: Storage */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-amber-400" /> Storage
          <span className="text-text-muted font-normal normal-case">(polling every 30s)</span>
        </h3>
        <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted">Used Storage</span>
              <span className="text-text-primary font-bold">
                {storageTotal > 0
                  ? `${formatBytes(storageUsed)} / ${formatBytes(storageTotal)}`
                  : `${storagePct}% used`}
              </span>
            </div>
            <ProgressBar
              value={storagePct}
              color={storagePct > 85 ? 'bg-red-500' : storagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}
              height="h-3"
            />
            <p className="text-[10px] text-text-muted font-mono">{storagePct}% capacity used</p>
          </div>
          <div className="flex gap-6 text-xs font-mono">
            <div>
              <span className="text-text-muted">Recordings:</span>{' '}
              <span className="text-text-primary font-bold">{storage?.recordingsCount ?? '—'}</span>
            </div>
            <div>
              <span className="text-text-muted">Evidence Clips:</span>{' '}
              <span className="text-text-primary font-bold">{evidenceCount}</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Event Bus */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-2">
          <Archive className="w-4 h-4 text-brand-primary" /> Event Bus
          <span className="text-text-muted font-normal normal-case">(polling every 15s)</span>
        </h3>
        {!eventBus ? (
          <div className="bg-app-panel border border-border rounded-xl p-6 text-center text-text-muted text-sm font-mono">
            No event bus data
          </div>
        ) : (
          <div className="bg-app-panel border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-text-muted">Total Events:</span>
              <span className="text-2xl font-bold text-text-primary font-mono">
                {(eventBus.totalEvents ?? 0).toLocaleString()}
              </span>
            </div>
            {topEventTypes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-mono font-bold">Top Event Types</p>
                {topEventTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-text-muted w-36 truncate">{type}</span>
                    <div className="flex-1 bg-border/40 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-primary h-full rounded-full transition-all duration-700"
                        style={{ width: `${(count / maxEventCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-text-primary font-bold w-12 text-right">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
