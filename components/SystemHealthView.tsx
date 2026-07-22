import React, { useEffect, useState } from 'react';
import { Skeleton } from './Skeleton';
import { 
  Cpu, Server, HardDrive, Activity, RefreshCw, 
  CheckCircle, AlertTriangle, ShieldAlert, CpuIcon,
  Flame, Network, Terminal, Database, Play, Lock, Unlock
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

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

interface StorageVolume {
  mountPoint: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercentage: number;
  type: 'SSD' | 'HDD' | 'CLOUD';
}

interface EvidenceClip {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  durationSec: number;
  fileSizeBytes: number;
  filePath: string;
  triggerEvent: string;
  isLocked: boolean;
}

export const SystemHealthView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [services, setServices] = useState<ServiceState[]>([]);
  const [volumes, setVolumes] = useState<StorageVolume[]>([]);
  const [evidence, setEvidence] = useState<EvidenceClip[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restartingService, setRestartingService] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  // Fetch full telemetry, services, and storage
  const fetchHealthData = async () => {
    try {
      const resHealth = await fetch('/api/system/health');
      if (resHealth.ok && resHealth.headers.get("content-type")?.includes("application/json")) {
        const data = await resHealth.json();
        if (data && data.telemetry) setTelemetry(data.telemetry);
        if (data && data.services) setServices(data.services);

        if (data && data.telemetry) {
          // Update real-time metric chart data buffer
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setChartData(prev => {
            const updated = [...prev, {
              time: now,
              cpu: data.telemetry.cpuUsage,
              ram: data.telemetry.ramUsagePercentage,
              gpu: data.telemetry.gpuUsage || 0,
              network: data.telemetry.networkInboundKbps / 1024 // Mbps
            }];
            return updated.slice(-15); // Maintain last 15 ticks
          });
        }
      }

      const resStorage = await fetch('/api/system/storage/volumes');
      if (resStorage.ok && resStorage.headers.get("content-type")?.includes("application/json")) {
        const data = await resStorage.json();
        if (data && data.volumes) setVolumes(data.volumes);
        if (data && data.evidence) setEvidence(data.evidence);
      }
    } catch (error) {
      console.error('Error fetching VMS health state:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRestartService = async (serviceName: string) => {
    setRestartingService(serviceName);
    try {
      const res = await fetch('/api/system/health/restart-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serviceName })
      });
      if (res.ok) {
        // Trigger intermediate local update
        setServices(prev => prev.map(s => s.serviceName === serviceName ? { ...s, status: 'OFFLINE', memoryUsageMb: 0 } : s));
        setTimeout(fetchHealthData, 1600);
      }
    } catch (error) {
      console.error('Failed to restart service:', error);
    } finally {
      setTimeout(() => setRestartingService(null), 2000);
    }
  };

  const handleToggleLock = async (clipId: string) => {
    try {
      const res = await fetch(`/api/system/storage/evidence/${clipId}/toggle-lock`, {
        method: 'POST'
      });
      if (res.ok) {
        setEvidence(prev => prev.map(c => c.id === clipId ? { ...c, isLocked: !c.isLocked } : c));
      }
    } catch (e) {
      console.error('Failed to toggle lock:', e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  if (loading && !telemetry) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
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
    <div className="space-y-6">
      {/* Header and Core Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Activity className="text-indigo-400" /> Tizim Salomatligi va Monitoringi
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Enterprise VMS serverlari va tarmoq yuklamasining real vaqt rejimidagi monitoringi.
          </p>
        </div>
        {telemetry && (
          <div className="flex gap-4 text-xs font-mono">
            <div className="bg-app-panel border border-border px-3 py-2 rounded-lg">
              <span className="text-text-muted">Uptime:</span>
              <p className="text-text-primary font-bold mt-0.5">{formatUptime(telemetry.uptimeSec)}</p>
            </div>
            <div className="bg-app-panel border border-border px-3 py-2 rounded-lg">
              <span className="text-text-muted">GCP DB:</span>
              <p className="text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ONLINE
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Live Metrics Gauges */}
      {telemetry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CPU Gauge */}
          <div className="bg-gradient-to-br from-indigo-950/20 via-app-panel to-slate-950/20 border border-indigo-500/10 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-indigo-500/10 p-3 rounded-lg text-indigo-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-text-muted tracking-wider uppercase font-mono">CPU Yuklamasi</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-text-primary font-mono">{telemetry.cpuUsage}%</span>
                <span className="text-xs text-amber-400 font-mono flex items-center gap-0.5">
                  <Flame className="w-3.5 h-3.5" /> {telemetry.cpuTemperature}°C
                </span>
              </div>
              <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-1000" 
                  style={{ width: `${telemetry.cpuUsage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* RAM Gauge */}
          <div className="bg-gradient-to-br from-emerald-950/20 via-app-panel to-slate-950/20 border border-emerald-500/10 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-text-muted tracking-wider uppercase font-mono">Tezkor Xotira (RAM)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-text-primary font-mono">{telemetry.ramUsagePercentage}%</span>
                <span className="text-xs text-text-muted font-mono">
                  {Math.round(telemetry.ramUsedMb / 1024)}/{Math.round(telemetry.ramTotalMb / 1024)} GB
                </span>
              </div>
              <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-1000" 
                  style={{ width: `${telemetry.ramUsagePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* GPU Gauge */}
          <div className="bg-gradient-to-br from-cyan-950/20 via-app-panel to-slate-950/20 border border-cyan-500/10 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-cyan-500/10 p-3 rounded-lg text-cyan-400">
              <CpuIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-text-muted tracking-wider uppercase font-mono">GPU AI Tezlartgich</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-text-primary font-mono">{telemetry.gpuUsage}%</span>
                {telemetry.gpuTemperature && (
                  <span className="text-xs text-cyan-400 font-mono flex items-center gap-0.5">
                    <Flame className="w-3.5 h-3.5" /> {telemetry.gpuTemperature}°C
                  </span>
                )}
              </div>
              <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-1000" 
                  style={{ width: `${telemetry.gpuUsage || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Network Ingestion Rate */}
          <div className="bg-gradient-to-br from-pink-950/20 via-app-panel to-slate-950/20 border border-pink-500/10 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-pink-500/10 p-3 rounded-lg text-pink-400">
              <Network className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-text-muted tracking-wider uppercase font-mono">Kamera Oqimlari (Inbound)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-text-primary font-mono">
                  {(telemetry.networkInboundKbps / 1024).toFixed(1)} <span className="text-xs">Mbps</span>
                </span>
                <span className="text-[10px] text-pink-400 font-mono">
                  {(telemetry.networkOutboundKbps / 1024).toFixed(1)} Out
                </span>
              </div>
              <div className="w-full bg-border/40 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-pink-500 h-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (telemetry.networkInboundKbps / 30000) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Analytics Area Chart */}
      {chartData.length > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase font-mono mb-4 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-400" /> Tizim Faolligi Grafikasi (Real-Time Telemetry Trend)
          </h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNetwork" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', color: '#f8fafc', fontSize: '10px', fontFamily: 'monospace' }} />
                <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke="#6366f1" fillOpacity={1} fill="url(#colorCpu)" />
                <Area type="monotone" dataKey="network" name="Tarmoq (Mbps)" stroke="#ec4899" fillOpacity={1} fill="url(#colorNetwork)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Services and Storage Volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* VMS Microservices State */}
        <div className="bg-app-panel border border-border rounded-xl p-4 lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5 border-b border-border pb-3">
            <Server className="w-4 h-4 text-indigo-400" /> VMS Mustaqil Mikroxizmatlar holati (Microservices Hub)
          </h3>
          <div className="divide-y divide-border/60">
            {services.map((service, index) => (
              <div key={index} className="py-3 flex items-center justify-between gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary text-xs">{service.serviceName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      service.status === 'ONLINE' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20' : 'bg-red-950/50 text-red-400 border border-red-500/20'
                    }`}>
                      {service.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    <span>Threads: <strong className="text-text-secondary">{service.threadCount}</strong></span>
                    <span>Xotira: <strong className="text-text-secondary">{service.memoryUsageMb} MB</strong></span>
                    {service.restartCount > 0 && (
                      <span className="text-amber-400 font-bold">Resta-larki: {service.restartCount}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleRestartService(service.serviceName)}
                  disabled={restartingService === service.serviceName}
                  className="flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${restartingService === service.serviceName ? 'animate-spin' : ''}`} />
                  {restartingService === service.serviceName ? 'Qayta yuklanmoqda...' : 'Restart'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Disk Volumes and Evidence Locker */}
        <div className="space-y-4">
          {/* Volumes card */}
          <div className="bg-app-panel border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5 border-b border-border pb-3">
              <HardDrive className="w-4 h-4 text-indigo-400" /> Tizim Disk Xotiralari (Storage Volumes)
            </h3>
            <div className="space-y-4">
              {volumes.map((vol, index) => (
                <div key={index} className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between font-bold">
                    <span className="text-text-secondary text-[11px] truncate" title={vol.mountPoint}>{vol.mountPoint}</span>
                    <span className="text-text-primary text-[11px]">{vol.usagePercentage}%</span>
                  </div>
                  <div className="w-full bg-border/40 h-2 rounded overflow-hidden">
                    <div 
                      className={`h-full ${vol.usagePercentage > 85 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                      style={{ width: `${vol.usagePercentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>Turi: <strong className="text-text-secondary">{vol.type}</strong></span>
                    <span>Bo'sh: <strong className="text-text-secondary">{formatBytes(vol.freeBytes)}</strong> / {formatBytes(vol.totalBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Locker Mini Monitor */}
          <div className="bg-app-panel border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5 border-b border-border pb-2">
              <Terminal className="w-4 h-4 text-indigo-400" /> Dalillar Ombori (Evidence Locker)
            </h3>
            {evidence.length === 0 ? (
              <p className="text-[10px] text-text-muted italic">Hech qanday dalil saqlanmadi.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {evidence.map((clip, index) => (
                  <div key={index} className="bg-slate-900/30 p-2 border border-border/50 rounded flex items-center justify-between gap-3 text-[10px] font-mono">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-text-primary font-bold truncate">{clip.cameraName}</p>
                      <p className="text-text-muted text-[8px]">{clip.id} | {clip.triggerEvent}</p>
                    </div>
                    <button
                      onClick={() => handleToggleLock(clip.id)}
                      className={`p-1 rounded cursor-pointer transition-all ${
                        clip.isLocked ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-text-muted hover:text-text-primary'
                      }`}
                      title={clip.isLocked ? 'Dalil bloklangan (FIFO da o`chirilmaydi)' : 'FIFO uchun ochiq'}
                    >
                      {clip.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
