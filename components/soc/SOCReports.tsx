import React, { useState, useCallback } from 'react';
import {
  FileText, Download, RefreshCw, ChevronDown, AlertTriangle,
  CheckCircle, Clock, Camera, Activity, BarChart3, Shield,
  History, Loader2
} from 'lucide-react';
import { authService } from '../../services/authService';

type ReportType = 'INCIDENT' | 'ALARM' | 'OPERATIONAL' | 'HEALTH' | 'EXECUTIVE' | 'ANALYTICS' | 'CAMERA';
type Period = '24h' | '7d' | '30d';

interface ReportMeta {
  id: string;
  reportType: ReportType;
  generatedAt: string;
  period: Period;
  generatedBy: string;
}

interface GeneratedReport {
  meta: ReportMeta;
  data: any;
}

const getHeaders = () => {
  const token = authService.getToken?.() || '';
  return token
    ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' } as Record<string, string>;
};

const REPORT_TYPES: ReportType[] = ['INCIDENT', 'ALARM', 'OPERATIONAL', 'HEALTH', 'EXECUTIVE', 'ANALYTICS', 'CAMERA'];
const PERIODS: { label: string; value: Period }[] = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-950/60 text-red-400 border border-red-500/30',
  HIGH: 'bg-orange-950/60 text-orange-400 border border-orange-500/30',
  MEDIUM: 'bg-amber-950/60 text-amber-400 border border-amber-500/30',
  LOW: 'bg-slate-800 text-slate-400 border border-slate-600/30',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-950/60 text-red-400',
  ACTIVE: 'bg-amber-950/60 text-amber-400',
  RESOLVED: 'bg-emerald-950/60 text-emerald-400',
  CLOSED: 'bg-slate-800 text-slate-400',
  ONLINE: 'bg-emerald-950/60 text-emerald-400',
  OFFLINE: 'bg-red-950/60 text-red-400',
  DEGRADED: 'bg-amber-950/60 text-amber-400',
  NEW: 'bg-blue-950/60 text-blue-400',
};

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-950/60 text-red-400 border border-red-500/30',
  HIGH: 'bg-orange-950/60 text-orange-400 border border-orange-500/30',
  MEDIUM: 'bg-amber-950/60 text-amber-400 border border-amber-500/30',
  LOW: 'bg-slate-800 text-slate-400 border border-slate-500/30',
};

const reportTypeIcons: Record<ReportType, React.ReactNode> = {
  INCIDENT: <Shield className="w-3.5 h-3.5" />,
  ALARM: <AlertTriangle className="w-3.5 h-3.5" />,
  OPERATIONAL: <Activity className="w-3.5 h-3.5" />,
  HEALTH: <CheckCircle className="w-3.5 h-3.5" />,
  EXECUTIVE: <BarChart3 className="w-3.5 h-3.5" />,
  ANALYTICS: <BarChart3 className="w-3.5 h-3.5" />,
  CAMERA: <Camera className="w-3.5 h-3.5" />,
};

const Badge: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${className || 'bg-slate-800 text-slate-300'}`}>
    {text}
  </span>
);

const MetricCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-app-surface border border-border rounded-lg p-4 space-y-1">
    <p className="text-[10px] uppercase tracking-wider text-text-muted font-mono">{label}</p>
    <p className="text-2xl font-bold text-text-primary font-mono">{value}</p>
    {sub && <p className="text-[10px] text-text-muted font-mono">{sub}</p>}
  </div>
);

// ---- Sub-renders for each report type ----

const IncidentReport: React.FC<{ data: any }> = ({ data }) => {
  const rows: any[] = Array.isArray(data?.incidents) ? data.incidents :
    Array.isArray(data) ? data : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="text-left py-2 px-2">ID</th>
            <th className="text-left py-2 px-2">Title</th>
            <th className="text-left py-2 px-2">Priority</th>
            <th className="text-left py-2 px-2">Status</th>
            <th className="text-left py-2 px-2">Category</th>
            <th className="text-left py-2 px-2">Created</th>
            <th className="text-left py-2 px-2">Team</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.length === 0 && (
            <tr><td colSpan={7} className="text-center py-6 text-text-muted italic">No incidents found</td></tr>
          )}
          {rows.map((inc: any) => (
            <tr key={inc.id} className="hover:bg-app-surface/50 transition-colors">
              <td className="py-2 px-2 text-text-muted text-[10px]">{inc.id?.slice(0, 8)}…</td>
              <td className="py-2 px-2 text-text-primary font-bold max-w-[180px] truncate">{inc.title}</td>
              <td className="py-2 px-2"><Badge text={inc.priority} className={priorityColors[inc.priority]} /></td>
              <td className="py-2 px-2"><Badge text={inc.status} className={statusColors[inc.status]} /></td>
              <td className="py-2 px-2 text-text-secondary">{inc.category}</td>
              <td className="py-2 px-2 text-text-muted">{new Date(inc.createdAt).toLocaleString()}</td>
              <td className="py-2 px-2 text-text-secondary">{inc.team || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AlarmReport: React.FC<{ data: any }> = ({ data }) => {
  const rows: any[] = Array.isArray(data?.alerts) ? data.alerts :
    Array.isArray(data) ? data : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="text-left py-2 px-2">ID</th>
            <th className="text-left py-2 px-2">Severity</th>
            <th className="text-left py-2 px-2">Type</th>
            <th className="text-left py-2 px-2">Status</th>
            <th className="text-left py-2 px-2">Timestamp</th>
            <th className="text-left py-2 px-2">Camera</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-center py-6 text-text-muted italic">No alarms found</td></tr>
          )}
          {rows.map((a: any) => (
            <tr key={a.id} className="hover:bg-app-surface/50 transition-colors">
              <td className="py-2 px-2 text-text-muted text-[10px]">{a.id?.slice(0, 8)}…</td>
              <td className="py-2 px-2"><Badge text={a.severity} className={severityColors[a.severity]} /></td>
              <td className="py-2 px-2 text-text-secondary">{a.type}</td>
              <td className="py-2 px-2"><Badge text={a.status} className={statusColors[a.status]} /></td>
              <td className="py-2 px-2 text-text-muted">{new Date(a.timestamp).toLocaleString()}</td>
              <td className="py-2 px-2 text-text-secondary">{a.cameraId || a.camera || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const HealthReport: React.FC<{ data: any }> = ({ data }) => {
  const services: any[] = Array.isArray(data?.services) ? data.services : [];
  const tel = data?.telemetry || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="CPU %" value={tel.cpuUsage ?? '—'} sub={`Temp: ${tel.cpuTemperature ?? '—'}°C`} />
        <MetricCard label="RAM %" value={tel.ramUsagePercentage ?? '—'} sub={`${Math.round((tel.ramUsedMb || 0) / 1024)}/${Math.round((tel.ramTotalMb || 0) / 1024)} GB`} />
        <MetricCard label="GPU %" value={tel.gpuUsage ?? 0} sub={`Temp: ${tel.gpuTemperature ?? '—'}°C`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left py-2 px-2">Service</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Memory (MB)</th>
              <th className="text-left py-2 px-2">Threads</th>
              <th className="text-left py-2 px-2">Restarts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {services.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-text-muted italic">No service data</td></tr>
            )}
            {services.map((svc: any, i: number) => (
              <tr key={i} className="hover:bg-app-surface/50">
                <td className="py-2 px-2 text-text-primary font-bold">{svc.serviceName}</td>
                <td className="py-2 px-2"><Badge text={svc.status} className={statusColors[svc.status]} /></td>
                <td className="py-2 px-2 text-text-secondary">{svc.memoryUsageMb}</td>
                <td className="py-2 px-2 text-text-secondary">{svc.threadCount}</td>
                <td className="py-2 px-2 text-text-muted">{svc.restartCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AnalyticsReport: React.FC<{ data: any }> = ({ data }) => {
  const stats = data?.statistics || data || {};
  const byType: Record<string, number> = stats.byType || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Events" value={stats.totalEvents ?? '—'} />
        <MetricCard label="Detections" value={stats.detections ?? stats.totalDetections ?? '—'} />
        <MetricCard label="Heatmap Points" value={stats.heatmapPoints ?? '—'} />
        <MetricCard label="Unique Persons" value={stats.uniquePersons ?? '—'} />
      </div>
      {Object.keys(byType).length > 0 && (
        <div className="bg-app-surface border border-border rounded-lg p-4">
          <h5 className="text-xs font-bold text-text-secondary uppercase font-mono mb-3">Events by Type</h5>
          <div className="space-y-2">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3 text-xs font-mono">
                <span className="text-text-muted w-32 truncate">{type}</span>
                <div className="flex-1 bg-border/40 h-2 rounded overflow-hidden">
                  <div
                    className="bg-brand-primary h-full rounded"
                    style={{ width: `${Math.min(100, (count / (stats.totalEvents || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-text-primary font-bold w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OperationalReport: React.FC<{ data: any; type: ReportType }> = ({ data, type }) => {
  const metrics = data?.metrics || data?.summary || data || {};
  const entries = typeof metrics === 'object' && !Array.isArray(metrics) ? Object.entries(metrics) : [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.length === 0 && (
        <div className="col-span-4 text-center py-6 text-text-muted text-sm font-mono italic">No summary metrics available</div>
      )}
      {entries.map(([key, val]) => (
        <MetricCard key={key} label={key} value={typeof val === 'object' ? JSON.stringify(val) : String(val)} />
      ))}
    </div>
  );
};

const CameraReport: React.FC<{ data: any }> = ({ data }) => {
  const rows: any[] = Array.isArray(data?.cameras) ? data.cameras :
    Array.isArray(data) ? data : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="text-left py-2 px-2">Name</th>
            <th className="text-left py-2 px-2">Location</th>
            <th className="text-left py-2 px-2">Status</th>
            <th className="text-left py-2 px-2">FPS</th>
            <th className="text-left py-2 px-2">Resolution</th>
            <th className="text-left py-2 px-2">Last Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.length === 0 && (
            <tr><td colSpan={6} className="text-center py-6 text-text-muted italic">No camera data</td></tr>
          )}
          {rows.map((cam: any, i: number) => (
            <tr key={cam.id || i} className="hover:bg-app-surface/50">
              <td className="py-2 px-2 text-text-primary font-bold">{cam.name}</td>
              <td className="py-2 px-2 text-text-secondary">{cam.location || cam.zone || '—'}</td>
              <td className="py-2 px-2"><Badge text={cam.status} className={statusColors[cam.status]} /></td>
              <td className="py-2 px-2 text-text-secondary">{cam.fps ?? '—'}</td>
              <td className="py-2 px-2 text-text-muted">{cam.resolution || '—'}</td>
              <td className="py-2 px-2 text-text-muted">{cam.lastActive ? new Date(cam.lastActive).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---- Main Component ----

export const SOCReports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('INCIDENT');
  const [period, setPeriod] = useState<Period>('24h');
  const [cameraId, setCameraId] = useState<string>('');
  const [cameras, setCameras] = useState<any[]>([]);
  const [camerasLoaded, setCamerasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<GeneratedReport | null>(null);
  const [history, setHistory] = useState<GeneratedReport[]>([]);

  const headers = getHeaders();

  const loadCameras = useCallback(async () => {
    if (camerasLoaded) return;
    try {
      const res = await fetch('/api/cameras', { headers });
      if (res.ok) {
        const data = await res.json();
        setCameras(Array.isArray(data) ? data : data.cameras || []);
      }
    } catch (e) { console.error('Failed to load cameras:', e); }
    finally { setCamerasLoaded(true); }
  }, [camerasLoaded]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = { reportType, period };
      if (cameraId) body.cameraId = cameraId;

      // Generate via API
      const res = await fetch('/api/soc/reports/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      let reportData: any = {};
      if (res.ok) {
        reportData = await res.json();
      } else {
        // Fallback: fetch relevant data directly
        if (reportType === 'INCIDENT') {
          const r = await fetch('/api/incidents?limit=50', { headers });
          if (r.ok) reportData = await r.json();
        } else if (reportType === 'ALARM') {
          const r = await fetch('/api/security/alerts', { headers });
          if (r.ok) reportData = await r.json();
        } else if (reportType === 'HEALTH') {
          const r = await fetch('/api/system/health', { headers });
          if (r.ok) reportData = await r.json();
        } else if (reportType === 'ANALYTICS') {
          const r = await fetch('/api/analytics/statistics', { headers });
          if (r.ok) reportData = await r.json();
        } else if (reportType === 'CAMERA') {
          const r = await fetch('/api/cameras', { headers });
          if (r.ok) reportData = await r.json();
        }
      }

      const meta: ReportMeta = reportData.meta || reportData.report || {
        id: `RPT-${Date.now().toString(36).toUpperCase()}`,
        reportType,
        generatedAt: new Date().toISOString(),
        period,
        generatedBy: 'SOC Operator',
      };

      const generated: GeneratedReport = {
        meta: { ...meta, reportType, period, generatedAt: meta.generatedAt || new Date().toISOString() },
        data: reportData.data || reportData,
      };

      setCurrentReport(generated);
      setHistory(prev => [generated, ...prev].slice(0, 10));
    } catch (e) {
      console.error('Report generation error:', e);
    } finally {
      setLoading(false);
    }
  }, [reportType, period, cameraId, headers]);

  const exportReport = () => {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${currentReport.meta.reportType}-${currentReport.meta.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderResults = (report: GeneratedReport) => {
    const { meta, data } = report;
    return (
      <div className="space-y-4">
        {/* Report Header */}
        <div className="bg-app-surface border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-muted font-mono">Report ID:</span>
              <code className="font-mono text-brand-primary text-xs bg-app-panel px-2 py-0.5 rounded">{meta.id}</code>
              <Badge
                text={meta.reportType}
                className="bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] font-mono text-text-muted">
              <span>Generated: <strong className="text-text-secondary">{new Date(meta.generatedAt).toLocaleString()}</strong></span>
              <span>Period: <strong className="text-text-secondary">{meta.period}</strong></span>
              <span>By: <strong className="text-text-secondary">{meta.generatedBy}</strong></span>
            </div>
          </div>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-3 py-2 bg-app-panel border border-border rounded-lg text-xs font-mono text-text-secondary hover:text-text-primary hover:border-brand-primary/50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
        </div>

        {/* Report Data */}
        <div className="bg-app-panel border border-border rounded-xl p-4">
          {meta.reportType === 'INCIDENT' && <IncidentReport data={data} />}
          {meta.reportType === 'ALARM' && <AlarmReport data={data} />}
          {meta.reportType === 'HEALTH' && <HealthReport data={data} />}
          {meta.reportType === 'ANALYTICS' && <AnalyticsReport data={data} />}
          {(meta.reportType === 'OPERATIONAL' || meta.reportType === 'EXECUTIVE') && <OperationalReport data={data} type={meta.reportType} />}
          {meta.reportType === 'CAMERA' && <CameraReport data={data} />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <FileText className="text-brand-primary w-5 h-5" /> Report Generation
        </h2>
        <p className="text-xs text-text-muted mt-1 font-mono">
          Generate operational, security, and executive reports for the SOC
        </p>
      </div>

      {/* Controls */}
      <div className="bg-app-panel border border-border rounded-xl p-5 space-y-5">
        {/* Report Type */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-text-muted font-mono font-bold block mb-2">Report Type</label>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  reportType === type
                    ? 'bg-brand-primary text-white'
                    : 'bg-app-surface border border-border text-text-secondary hover:border-brand-primary/40 hover:text-text-primary'
                }`}
              >
                {reportTypeIcons[type]} {type}
              </button>
            ))}
          </div>
        </div>

        {/* Period + Camera Filter */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-mono font-bold block mb-2">Period</label>
            <div className="flex gap-2">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    period === p.value
                      ? 'bg-app-surface border border-brand-primary text-brand-primary'
                      : 'bg-app-surface border border-border text-text-secondary hover:border-brand-primary/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-mono font-bold block mb-2">Camera Filter (optional)</label>
            <div className="relative">
              <select
                value={cameraId}
                onChange={e => setCameraId(e.target.value)}
                onFocus={loadCameras}
                className="bg-app-surface border border-border text-text-secondary text-xs font-mono rounded-lg px-3 py-1.5 pr-7 appearance-none focus:outline-none focus:border-brand-primary/50 min-w-[180px]"
              >
                <option value="">All Cameras</option>
                {cameras.map((cam: any) => (
                  <option key={cam.id} value={cam.id}>{cam.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg text-xs font-mono font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Results */}
      {currentReport && renderResults(currentReport)}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-app-panel border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase font-mono flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-brand-primary" /> Report History (Last {history.length})
          </h3>
          <div className="space-y-1.5">
            {history.map((r, i) => (
              <div
                key={`${r.meta.id}-${i}`}
                onClick={() => setCurrentReport(r)}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition-colors ${
                  currentReport?.meta.id === r.meta.id
                    ? 'bg-brand-primary/10 border border-brand-primary/30'
                    : 'bg-app-surface border border-border hover:border-brand-primary/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {reportTypeIcons[r.meta.reportType]}
                  <span className="text-text-primary font-bold">{r.meta.reportType}</span>
                  <code className="text-text-muted text-[10px]">{r.meta.id}</code>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(r.meta.generatedAt).toLocaleTimeString()}</span>
                  <span className="text-text-muted">{r.meta.period}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
