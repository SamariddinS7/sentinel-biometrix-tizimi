import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Shield, Flame, Car, Users, Eye,
  AlertTriangle, TrendingUp, BarChart2, Search,
  CheckCircle, XCircle, Clock, Camera,
  Zap, Waves, Package, ArrowRightLeft, FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyticsStats {
  platform: { frameCount: number; totalEventCount: number; recentEventCount: number; pluginCount: number };
  period:   { since: string; eventCount: number };
  byType:   Record<string, number>;
  plugins:  Array<{ id: string; name: string; version: string; enabled: boolean }>;
}

interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  location: string;
  confidence: number;
  modelVersion: string;
  data: Record<string, unknown>;
}

interface PluginHealth {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  health?: { status: string; latencyMs: number; frameCount: number; eventCount: number; lastError?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  FIRE_DETECTED:             { label: 'Fire',            color: '#ef4444', icon: Flame },
  SMOKE_DETECTED:            { label: 'Smoke',           color: '#f97316', icon: Flame },
  EXPLOSION_DETECTED:        { label: 'Explosion',       color: '#dc2626', icon: Zap },
  PPE_VIOLATION:             { label: 'PPE Violation',   color: '#f59e0b', icon: Shield },
  HELMET_MISSING:            { label: 'No Helmet',       color: '#d97706', icon: Shield },
  VEST_MISSING:              { label: 'No Vest',         color: '#b45309', icon: Shield },
  VEHICLE_DETECTED:          { label: 'Vehicle',         color: '#3b82f6', icon: Car },
  PLATE_RECOGNIZED:          { label: 'Plate Read',      color: '#2563eb', icon: Car },
  CROWD_DETECTED:            { label: 'Crowd',           color: '#8b5cf6', icon: Users },
  PEOPLE_COUNT_UPDATED:      { label: 'People Count',    color: '#7c3aed', icon: Users },
  OCCUPANCY_UPDATED:         { label: 'Occupancy',       color: '#6d28d9', icon: Users },
  LOITERING_DETECTED:        { label: 'Loitering',       color: '#ec4899', icon: Clock },
  INTRUSION_DETECTED:        { label: 'Intrusion',       color: '#f43f5e', icon: AlertTriangle },
  ABANDONED_OBJECT_DETECTED: { label: 'Abandoned Obj',  color: '#14b8a6', icon: Package },
  REMOVED_OBJECT_DETECTED:   { label: 'Removed Obj',    color: '#0d9488', icon: Package },
  FLOOD_DETECTED:            { label: 'Flood',           color: '#0ea5e9', icon: Waves },
  WATER_LEAK_DETECTED:       { label: 'Water Leak',      color: '#0284c7', icon: Waves },
  LINE_CROSSED:              { label: 'Line Crossed',    color: '#84cc16', icon: ArrowRightLeft },
  OCR_COMPLETED:             { label: 'OCR',             color: '#10b981', icon: Eye },
  HEATMAP_UPDATED:           { label: 'Heatmap',         color: '#6366f1', icon: BarChart2 },
};

function eventMeta(type: string) {
  return EVENT_LABELS[type] ?? { label: type.replace(/_/g, ' '), color: '#6b7280', icon: Activity };
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  WARNING:  '#f59e0b',
  INFO:     '#3b82f6',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.FC<any>; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const { label, color, icon: Icon } = eventMeta(type);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}22`, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#3b82f6';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'events' | 'fire' | 'ppe' | 'vehicles' | 'crowd' | 'plugins' | 'search';

export default function AnalyticsDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [plugins, setPlugins] = useState<PluginHealth[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/analytics/statistics');
      const j = await r.json();
      if (j.success) setStats(j.data);
    } catch { setError('Failed to load statistics'); }
  }, []);

  const fetchEvents = useCallback(async (type?: string) => {
    setLoading(true);
    try {
      const url = type ? `/api/analytics/events?type=${type}&limit=50` : '/api/analytics/events?limit=50';
      const r   = await fetch(url);
      const j   = await r.json();
      if (j.success) setEvents(j.data.events ?? []);
    } catch { setError('Failed to load events'); } finally { setLoading(false); }
  }, []);

  const fetchPlugins = useCallback(async () => {
    try {
      const r = await fetch('/api/analytics/plugins');
      const j = await r.json();
      if (j.success) setPlugins(j.data.plugins ?? []);
    } catch {}
  }, []);

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/analytics/search?text=${encodeURIComponent(searchQuery)}&limit=30`);
      const j = await r.json();
      if (j.success) setSearchResults(j.data.events ?? []);
    } catch { setError('Search failed'); } finally { setLoading(false); }
  }, [searchQuery]);

  const togglePlugin = useCallback(async (id: string, enabled: boolean) => {
    const action = enabled ? 'disable' : 'enable';
    await fetch(`/api/analytics/plugins/${id}/${action}`, { method: 'POST' });
    fetchPlugins();
  }, [fetchPlugins]);

  const generateReport = useCallback(async (period: string) => {
    const r = await fetch('/api/analytics/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period, cameraId: 'all' }),
    });
    const j = await r.json();
    if (j.success) alert(`Report generated: ${j.data.report.reportId}`);
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 15_000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  useEffect(() => {
    if (tab === 'overview' || tab === 'events') fetchEvents();
    if (tab === 'fire')     fetchEvents('FIRE_DETECTED');
    if (tab === 'ppe')      fetchEvents('PPE_VIOLATION');
    if (tab === 'vehicles') fetchEvents('VEHICLE_DETECTED');
    if (tab === 'crowd')    fetchEvents('CROWD_DETECTED');
    if (tab === 'plugins')  fetchPlugins();
  }, [tab, fetchEvents, fetchPlugins]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    background: '#0f172a',
    color: '#e2e8f0',
    minHeight: '100vh',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: '8px 24px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    overflowX: 'auto',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px 8px 0 0',
    background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
    color:       active ? '#a5b4fc' : '#94a3b8',
    border:      'none',
    cursor:      'pointer',
    fontSize:    13,
    fontWeight:  active ? 600 : 400,
    borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    whiteSpace:  'nowrap',
  });

  const TABS: { key: Tab; label: string; icon: React.FC<any> }[] = [
    { key: 'overview',  label: 'Overview',  icon: BarChart2  },
    { key: 'events',    label: 'Events',    icon: Activity   },
    { key: 'fire',      label: 'Fire & Safety', icon: Flame  },
    { key: 'ppe',       label: 'PPE',       icon: Shield     },
    { key: 'vehicles',  label: 'Vehicles',  icon: Car        },
    { key: 'crowd',     label: 'Crowd',     icon: Users      },
    { key: 'plugins',   label: 'Plugins',   icon: Zap        },
    { key: 'search',    label: 'Search',    icon: Search     },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Enterprise Analytics Platform</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Real-time AI safety & operational intelligence</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['daily', 'weekly', 'monthly'].map(p => (
            <button key={p} onClick={() => generateReport(p)}
              style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <FileText size={11} /> {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>
            <Icon size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            {label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: '12px 24px', padding: '10px 16px', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '20px 24px' }}>
        <AnimatePresence mode="wait">

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && stats && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              <StatCard label="Total Frames Analysed" value={stats.platform.frameCount.toLocaleString()} icon={Camera} color="#6366f1" />
              <StatCard label="Total Events Generated" value={stats.platform.totalEventCount.toLocaleString()} icon={Activity} color="#10b981" />
              <StatCard label="Events (Buffer)" value={stats.platform.recentEventCount} icon={TrendingUp} color="#f59e0b" />
              <StatCard label="Active Plugins" value={stats.platform.pluginCount} icon={Zap} color="#8b5cf6" />
              <StatCard label="Events (Last 24h)" value={stats.period.eventCount} icon={BarChart2} color="#3b82f6" />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 16, color: '#cbd5e1' }}>Event Distribution (Last 24h)</div>
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([type, count]) => {
                  const { label, color, icon: Icon } = eventMeta(type);
                  const max = Math.max(...Object.values(stats.byType));
                  return (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 160, fontSize: 12, color: '#94a3b8' }}>{label}</div>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                        <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </div>
                      <div style={{ minWidth: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{count}</div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ── EVENTS ───────────────────────────────────────────────────────── */}
        {(tab === 'events' || tab === 'fire' || tab === 'ppe' || tab === 'vehicles' || tab === 'crowd') && (
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {loading && <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Loading events…</div>}
            {!loading && events.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>
                <Activity size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div>No events yet. Analytics events will appear here once cameras are streaming.</div>
              </div>
            )}
            {!loading && events.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 100px 120px', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Type</span><span>Camera</span><span>Time</span><span>Confidence</span><span>Location</span>
                </div>
                <AnimatePresence initial={false}>
                {events.map((evt, i) => (
                  <motion.div key={evt.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.15, delay: i < 10 ? i * 0.03 : 0 }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 100px 120px', alignItems: 'center', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <EventBadge type={evt.type} />
                    <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.cameraName || evt.cameraId}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    <ConfidenceBar value={evt.confidence} />
                    <span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.location}</span>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}

        {/* ── PLUGINS ──────────────────────────────────────────────────────── */}
        {tab === 'plugins' && (
          <motion.div key="plugins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {plugins.map(p => {
              const h = p.health;
              const statusColor = h?.status === 'HEALTHY' ? '#10b981' : h?.status === 'DEGRADED' ? '#f59e0b' : '#ef4444';
              return (
                <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.id} · v{p.version}</div>
                    </div>
                    <button onClick={() => togglePlugin(p.id, p.enabled)}
                      style={{ padding: '4px 12px', borderRadius: 6, background: p.enabled ? '#10b98122' : '#ef444422', border: `1px solid ${p.enabled ? '#10b98144' : '#ef444444'}`, color: p.enabled ? '#34d399' : '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  {h && (
                    <div style={{ fontSize: 12, display: 'flex', gap: 16 }}>
                      <span style={{ color: statusColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {h.status === 'HEALTHY' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {h.status}
                      </span>
                      <span style={{ color: '#64748b' }}>{h.frameCount?.toLocaleString()} frames</span>
                      <span style={{ color: '#64748b' }}>{h.eventCount?.toLocaleString()} events</span>
                    </div>
                  )}
                  {h?.lastError && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#f87171', background: '#ef444411', padding: '4px 8px', borderRadius: 5 }}>{h.lastError}</div>
                  )}
                </div>
              );
            })}
            {plugins.length === 0 && (
              <div style={{ color: '#64748b', padding: 32 }}>No plugins registered yet. Start the server to initialise.</div>
            )}
          </motion.div>
        )}

        {/* ── SEARCH ───────────────────────────────────────────────────────── */}
        {tab === 'search' && (
          <motion.div key="search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search events — text, plate number, track ID…"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', fontSize: 14, outline: 'none' }}
              />
              <button onClick={doSearch}
                style={{ padding: '10px 20px', borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={14} /> Search
              </button>
            </div>
            {loading && <div style={{ color: '#64748b', padding: 16 }}>Searching…</div>}
            {!loading && searchResults.length === 0 && searchQuery && (
              <div style={{ color: '#64748b', padding: 32, textAlign: 'center' }}>No results found for "{searchQuery}"</div>
            )}
            <AnimatePresence initial={false}>
            {!loading && searchResults.map((evt, i) => (
              <motion.div key={evt.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.14, delay: i * 0.04 }}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                <EventBadge type={evt.type} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{evt.cameraName || evt.cameraId}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{new Date(evt.timestamp).toLocaleString()}</span>
                <ConfidenceBar value={evt.confidence} />
                <code style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(evt.data)}</code>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}
