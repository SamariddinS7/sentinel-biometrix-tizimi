import React, { useEffect, useState } from 'react';
import { Skeleton } from './Skeleton';
import { 
  Terminal, ShieldCheck, Filter, Search, Trash2, 
  RefreshCw, AlertCircle, PlayCircle, Lock, Download,
  CheckCircle, ShieldAlert, Activity, User, Globe
} from 'lucide-react';

interface AuditLogEntry {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  timestamp: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: string;
}

interface VmsEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: any;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
}

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [events, setEvents] = useState<VmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'LIVE_EVENTS'>('AUDIT');

  const fetchLogs = async () => {
    try {
      const resLogs = await fetch('/api/system/audit-logs');
      if (resLogs.ok && resLogs.headers.get("content-type")?.includes("application/json")) {
        const data = await resLogs.json();
        setLogs(data);
      }

      const resEvents = await fetch('/api/system/events');
      if (resEvents.ok && resEvents.headers.get("content-type")?.includes("application/json")) {
        const data = await resEvents.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching VMS compliance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Live events puller simulating a socket
    const interval = setInterval(fetchLogs, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleClearEvents = async () => {
    if (window.confirm('Haqiqatdan ham barcha jonli tizim hodisalari tarixini o`chirmoqchimisiz?')) {
      try {
        const res = await fetch('/api/system/events/clear', { method: 'POST' });
        if (res.ok) {
          setEvents([]);
        }
      } catch (e) {
        console.error('Failed to clear events:', e);
      }
    }
  };

  // Extract unique modules for filtering
  const modules = ['ALL', ...new Set(logs.map(log => log.module))];

  // Filtering logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = selectedModule === 'ALL' || log.module === selectedModule;
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;

    return matchesSearch && matchesModule && matchesStatus;
  });

  const getStatusBadgeClass = (status: AuditLogEntry['status']) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
      case 'FAILURE':
        return 'bg-red-950/40 text-red-400 border border-red-500/20';
      case 'WARNING':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-slate-850 text-slate-300';
    }
  };

  const getSeverityBadgeClass = (severity: VmsEvent['severity']) => {
    switch (severity) {
      case 'SUCCESS':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
      case 'CRITICAL':
        return 'bg-red-950/40 text-red-400 border border-red-500/20';
      case 'WARNING':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" /> Xavfsizlik Audit va Tizim Loglari
          </h2>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Tizimdagi barcha operator harakatlari, ruxsatnomalar o'zgarishi va xavfsizlik hodisalarining immutable jurnali.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'LIVE_EVENTS' && (
            <button
              onClick={handleClearEvents}
              className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
            >
              <Trash2 size={13} /> Tarixni Tozalash
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
          >
            <RefreshCw size={13} /> Yangilash
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
            activeTab === 'AUDIT' 
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Compliance Audit Trails (Tizim Jurnali)
        </button>
        <button
          onClick={() => setActiveTab('LIVE_EVENTS')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'LIVE_EVENTS' 
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          Live Event Broker Log (Jonli Hodisalar)
        </button>
      </div>

      {activeTab === 'AUDIT' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-app-panel p-4 border border-border rounded-xl">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Amal, operator yoki tafsilotlar bo'yicha qidirish..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-text-primary"
              />
            </div>

            {/* Module Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-lg px-2 py-2 text-xs focus:outline-none text-text-secondary font-mono"
              >
                {modules.map((m, idx) => (
                  <option key={idx} value={m}>{m === 'ALL' ? 'Barcha Modullar' : m}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-app-primary border border-border rounded-lg px-2 py-2 text-xs focus:outline-none text-text-secondary font-mono"
              >
                <option value="ALL">Barcha Holatlar</option>
                <option value="SUCCESS">SUCCESS (Muvaffaqiyatli)</option>
                <option value="FAILURE">FAILURE (Xatolik)</option>
                <option value="WARNING">WARNING (Ogohlantirish)</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Terminal View */}
          <div className="bg-[#05070c] border border-border rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-slate-950/80 px-4 py-2 border-b border-border flex items-center justify-between text-[11px] font-mono text-text-muted">
              <div className="flex items-center gap-1.5">
                <Terminal size={14} className="text-emerald-400" /> SECURE AUDIT TRACE SHELL
              </div>
              <div>Jurnalda jami: {filteredLogs.length} ta yozuv</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-text-muted uppercase text-[9px] bg-slate-950/40">
                    <th className="py-2.5 px-4">Vaqt</th>
                    <th className="py-2.5 px-4">Operator</th>
                    <th className="py-2.5 px-4">Modul</th>
                    <th className="py-2.5 px-4">Harakat</th>
                    <th className="py-2.5 px-4">Tafsilotlar</th>
                    <th className="py-2.5 px-4">IP Manzil</th>
                    <th className="py-2.5 px-4">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-full" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-16" /></td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-text-muted italic">
                        Qidiruv bo'yicha hech qanday xavfsizlik audit logi topilmadi.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-indigo-950/10 transition-all">
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('uz-UZ')}
                        </td>
                        <td className="py-3 px-4 font-bold text-text-primary flex items-center gap-1.5">
                          <User size={12} className="text-indigo-400" /> {log.userName}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{log.module}</td>
                        <td className="py-3 px-4 font-bold text-indigo-300">{log.action}</td>
                        <td className="py-3 px-4 text-text-muted max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-3 px-4 text-text-muted font-mono flex items-center gap-1">
                          <Globe size={11} className="text-slate-500" /> {log.ipAddress}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getStatusBadgeClass(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Live Events Log View */
        <div className="space-y-4">
          <div className="bg-slate-950 border border-border rounded-xl p-4 font-mono text-xs text-text-secondary h-120 overflow-y-auto space-y-2 flex flex-col-reverse">
            {events.length === 0 ? (
              <p className="text-center text-text-muted italic py-16">
                Hozircha hech qanday tizim hodisalari olinmadi. Live stream ishlamoqda...
              </p>
            ) : (
              events.map((evt, idx) => (
                <div key={idx} className="border-l-2 border-indigo-500/40 pl-3 py-1.5 bg-indigo-950/5 rounded-r-md flex items-start justify-between gap-4 text-[11px] animate-in slide-in-from-left duration-250">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text-muted">[{new Date(evt.timestamp).toLocaleTimeString()}]</span>
                      <span className="text-indigo-300 font-bold uppercase tracking-wider text-[9px] bg-indigo-950/40 px-1 py-0.5 rounded">
                        {evt.source}
                      </span>
                      <span className="font-bold text-text-primary">{evt.type}</span>
                    </div>
                    <p className="text-text-muted leading-relaxed text-[10px]">
                      {typeof evt.payload === 'object' ? JSON.stringify(evt.payload) : evt.payload}
                    </p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getSeverityBadgeClass(evt.severity)}`}>
                    {evt.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
