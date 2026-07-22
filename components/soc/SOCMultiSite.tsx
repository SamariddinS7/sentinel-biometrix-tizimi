import React, { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '../Skeleton';
import {
  Globe, MapPin, Clock, Camera, Bell, ChevronDown, ChevronRight,
  Building2, Layers, RefreshCw, Users, AlertTriangle, Shield,
  CheckCircle, XCircle, AlertCircle, BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { authService } from '../../services/authService';

interface Site {
  id: string;
  name: string;
  city: string;
  country: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  lastSync: string;
  cameraCount: number;
  alarmCount: number;
  coordinates?: { lat: number; lng: number };
  timezone?: string;
}

interface Alert {
  id: string;
  severity: string;
  type: string;
  status: string;
  timestamp: string;
  cameraId?: string;
}

interface Incident {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
  team?: string;
}

interface StaffMember {
  id: string;
  status: 'IDLE' | 'DISPATCHED' | 'ON_PATROL' | string;
}

interface TreeNode {
  label: string;
  children?: TreeNode[];
}

const getHeaders = () => {
  const token = authService.getToken?.() || '';
  return token ? { Authorization: 'Bearer ' + token } : {} as Record<string, string>;
};

const relativeTime = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const statusColors: Record<string, string> = {
  ONLINE: 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30',
  DEGRADED: 'bg-amber-950/50 text-amber-400 border border-amber-500/30',
  OFFLINE: 'bg-red-950/50 text-red-400 border border-red-500/30',
};

const statusDot: Record<string, string> = {
  ONLINE: 'bg-emerald-400',
  DEGRADED: 'bg-amber-400',
  OFFLINE: 'bg-red-400',
};

const TreeNodeView: React.FC<{ node: TreeNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-app-surface text-xs font-mono ${depth === 0 ? 'text-brand-primary font-bold' : 'text-text-secondary'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => setOpen(o => !o)}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
        ) : <span className="w-3 h-3 shrink-0" />}
        <span className="truncate">{node.label}</span>
      </div>
      {open && hasChildren && node.children!.map((child, i) => (
        <TreeNodeView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};

export const SOCMultiSite: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const headers = getHeaders();

  const fetchAll = useCallback(async () => {
    try {
      const [sitesRes, alertsRes, incidentsRes, camerasRes, staffRes] = await Promise.allSettled([
        fetch('/api/sites', { headers }),
        fetch('/api/security/alerts', { headers }),
        fetch('/api/incidents?limit=5', { headers }),
        fetch('/api/cameras', { headers }),
        fetch('/api/resources/staff', { headers }),
      ]);

      if (sitesRes.status === 'fulfilled' && sitesRes.value.ok) {
        const data = await sitesRes.value.json();
        setSites(Array.isArray(data) ? data : data.sites || []);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const data = await alertsRes.value.json();
        setAlerts(Array.isArray(data) ? data : data.alerts || []);
      }
      if (incidentsRes.status === 'fulfilled' && incidentsRes.value.ok) {
        const data = await incidentsRes.value.json();
        setIncidents(Array.isArray(data) ? data : data.incidents || []);
      }
      if (camerasRes.status === 'fulfilled' && camerasRes.value.ok) {
        const data = await camerasRes.value.json();
        setCameras(Array.isArray(data) ? data : data.cameras || []);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        const data = await staffRes.value.json();
        setStaff(Array.isArray(data) ? data : data.staff || []);
      }
    } catch (e) {
      console.error('SOCMultiSite fetch error:', e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totalSites = sites.length;
  const onlineSites = sites.filter(s => s.status === 'ONLINE').length;
  const degradedSites = sites.filter(s => s.status === 'DEGRADED').length;
  const offlineSites = sites.filter(s => s.status === 'OFFLINE').length;
  const activeAlarms = alerts.filter(a => a.status === 'ACTIVE' || a.status === 'NEW').length;
  const openIncidents = incidents.filter(i => i.status === 'OPEN').length;
  const staffOnline = staff.filter(s => ['IDLE', 'DISPATCHED', 'ON_PATROL'].includes(s.status)).length;

  // Build incident category chart data
  const incidentByCategory = incidents.reduce<Record<string, number>>((acc, inc) => {
    const cat = inc.category || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(incidentByCategory).map(([name, count]) => ({ name, count }));

  // Build org hierarchy tree from sites
  const buildTree = (): TreeNode => {
    const byCountry: Record<string, Record<string, string[]>> = {};
    sites.forEach(s => {
      if (!byCountry[s.country]) byCountry[s.country] = {};
      if (!byCountry[s.country][s.city]) byCountry[s.country][s.city] = [];
      byCountry[s.country][s.city].push(s.name);
    });
    return {
      label: 'Organization',
      children: Object.entries(byCountry).map(([country, cities]) => ({
        label: country,
        children: Object.entries(cities).map(([city, campuses]) => ({
          label: city,
          children: campuses.map(name => ({
            label: name,
            children: [
              { label: 'Campus A', children: [{ label: 'Building 1', children: [{ label: 'Floor 1' }, { label: 'Floor 2' }] }] }
            ]
          }))
        }))
      }))
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-4">
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
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-app-panel border border-border/40 rounded-xl p-4 space-y-4">
              <Skeleton className="h-5 w-32" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-app-panel border border-border/40 rounded-xl p-4 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const orgTree = buildTree();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Globe className="text-brand-primary w-5 h-5" /> Multi-Site Operations
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Global facility monitoring across all connected sites
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <Clock className="w-3.5 h-3.5" />
          Last refresh: {lastRefresh.toLocaleTimeString()}
          <button
            onClick={fetchAll}
            className="ml-2 p-1.5 rounded bg-app-panel border border-border hover:bg-app-surface transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sites', value: totalSites, icon: Globe, color: 'text-brand-primary' },
          { label: 'Online', value: onlineSites, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Degraded', value: degradedSites, icon: AlertCircle, color: 'text-amber-400' },
          { label: 'Offline', value: offlineSites, icon: XCircle, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-app-panel border border-border rounded-xl p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color} shrink-0`} />
            <div>
              <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global Stats Bar */}
      <div className="bg-app-panel border border-border rounded-xl p-3 flex flex-wrap gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand-primary" />
          <span className="text-text-muted">Cameras:</span>
          <span className="text-text-primary font-bold">{cameras.length}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-text-muted">Active Alarms:</span>
          <span className="text-amber-400 font-bold">{activeAlarms}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-text-muted">Open Incidents:</span>
          <span className="text-red-400 font-bold">{openIncidents}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="text-text-muted">Staff Online:</span>
          <span className="text-emerald-400 font-bold">{staffOnline}</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sites Grid */}
        <div className="flex-1 space-y-4">
          {sites.length === 0 ? (
            <div className="bg-app-panel border border-border rounded-xl p-8 text-center text-text-muted text-sm font-mono">
              No sites configured
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sites.map(site => (
                <div
                  key={site.id}
                  className={`bg-app-panel border rounded-xl p-4 cursor-pointer transition-all hover:border-brand-primary/50 space-y-3 ${
                    selectedSite?.id === site.id ? 'border-brand-primary/60 ring-1 ring-brand-primary/20' : 'border-border'
                  }`}
                  onClick={() => setSelectedSite(selectedSite?.id === site.id ? null : site)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-text-primary text-sm truncate">{site.name}</p>
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {site.city}, {site.country}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${statusColors[site.status] || statusColors.OFFLINE}`}>
                      {site.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot[site.status] || 'bg-gray-400'}`} />
                    Last sync: {site.lastSync ? relativeTime(site.lastSync) : 'N/A'}
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Camera className="w-3.5 h-3.5 text-brand-primary" />
                      <span className="font-mono font-bold">{site.cameraCount ?? 0}</span>
                      <span className="text-text-muted">cameras</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono font-bold">{site.alarmCount ?? 0}</span>
                      <span className="text-text-muted">alarms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail Panel */}
          {selectedSite && (
            <div className="bg-app-panel border border-brand-primary/30 rounded-xl p-5 space-y-5 mt-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-primary" /> {selectedSite.name} — Detail View
                </h3>
                <button
                  onClick={() => setSelectedSite(null)}
                  className="text-text-muted hover:text-text-primary text-xs font-mono px-2 py-1 rounded hover:bg-app-surface transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {/* Site Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-app-surface rounded-lg p-3 space-y-1">
                  <p className="text-text-muted uppercase text-[10px] tracking-wider">City</p>
                  <p className="text-text-primary font-bold">{selectedSite.city}</p>
                </div>
                <div className="bg-app-surface rounded-lg p-3 space-y-1">
                  <p className="text-text-muted uppercase text-[10px] tracking-wider">Country</p>
                  <p className="text-text-primary font-bold">{selectedSite.country}</p>
                </div>
                {selectedSite.coordinates && (
                  <div className="bg-app-surface rounded-lg p-3 space-y-1">
                    <p className="text-text-muted uppercase text-[10px] tracking-wider">Coordinates</p>
                    <p className="text-text-primary font-bold">{selectedSite.coordinates.lat.toFixed(4)}, {selectedSite.coordinates.lng.toFixed(4)}</p>
                  </div>
                )}
                {selectedSite.timezone && (
                  <div className="bg-app-surface rounded-lg p-3 space-y-1">
                    <p className="text-text-muted uppercase text-[10px] tracking-wider">Timezone</p>
                    <p className="text-text-primary font-bold">{selectedSite.timezone}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Live Alarm Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" /> Live Alarm Summary
                  </h4>
                  {alerts.length === 0 ? (
                    <p className="text-xs text-text-muted font-mono italic">No active alarms</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {alerts.slice(0, 5).map(alert => (
                        <div key={alert.id} className="bg-app-surface rounded-lg px-3 py-2 flex items-center justify-between text-xs font-mono">
                          <span className="text-text-secondary truncate">{alert.type || 'Alert'}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              alert.severity === 'CRITICAL' ? 'bg-red-950/50 text-red-400' :
                              alert.severity === 'HIGH' ? 'bg-orange-950/50 text-orange-400' :
                              'bg-amber-950/50 text-amber-400'
                            }`}>{alert.severity}</span>
                            <span className="text-text-muted text-[10px]">{relativeTime(alert.timestamp)}</span>
                          </div>
                        </div>
                      ))}
                      {alerts.length > 5 && (
                        <p className="text-[10px] text-text-muted font-mono text-center">+{alerts.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent Incidents */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-red-400" /> Recent Incidents — Tashkent HQ
                  </h4>
                  {incidents.length === 0 ? (
                    <p className="text-xs text-text-muted font-mono italic">No recent incidents</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {incidents.slice(0, 5).map(inc => (
                        <div key={inc.id} className="bg-app-surface rounded-lg px-3 py-2 text-xs font-mono">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-text-primary font-bold truncate">{inc.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              inc.priority === 'CRITICAL' ? 'bg-red-950/50 text-red-400' :
                              inc.priority === 'HIGH' ? 'bg-orange-950/50 text-orange-400' :
                              'bg-amber-950/50 text-amber-400'
                            }`}>{inc.priority}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                            <span>{inc.category}</span>
                            <span>•</span>
                            <span>{relativeTime(inc.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Incident Category Chart */}
              {chartData.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5 mb-3">
                    <BarChart3 className="w-3.5 h-3.5 text-brand-primary" /> Incidents by Category
                  </h4>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                        <YAxis stroke="#64748b" fontSize={9} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', fontSize: '11px', fontFamily: 'monospace' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Org Hierarchy Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-app-panel border border-border rounded-xl p-3 sticky top-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5 mb-3 pb-2 border-b border-border">
              <Layers className="w-3.5 h-3.5 text-brand-primary" /> Org Hierarchy
            </h3>
            {sites.length === 0 ? (
              <p className="text-[10px] text-text-muted font-mono italic">No sites loaded</p>
            ) : (
              <div className="overflow-y-auto max-h-96">
                <TreeNodeView node={orgTree} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
