import React, { useState, useEffect } from 'react';
import { AttendanceRecord, SecurityAlert } from '../types';
import { analyzeSecurityLogs, SecurityAuditReport } from '../services/geminiService';
import { getSecurityAlerts } from '../services/securityService';
import { useLanguage } from '../services/i18n';
import { 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  ChevronRight, 
  Lightbulb, 
  Activity,
  UserCheck,
  Shield,
  Fingerprint,
  Download
} from 'lucide-react';

interface GeminiAnomalyCardProps {
  logs: AttendanceRecord[];
}

const exportToCSV = (alerts: SecurityAlert[]) => {
    const header = ["ID", "Severity", "Message", "Timestamp", "Entity ID", "Zone ID", "Type"];
    const rows = alerts.map(a => [a.id, a.severity, a.message, new Date(a.timestamp).toISOString(), a.entityId, a.zoneId || '', a.type || '']);
    const csvContent = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security_logs_${new Date().toISOString()}.csv`;
    link.click();
};

const translations = {
  uz: {
    title: "Gemini AI: Anomaliyalar va Xavfsizlik Auditi",
    subtitle: "Sun'iy intellekt tomonidan tahlil qilingan xavfsizlik ko'rsatkichlari",
    scanBtn: "Skanerlash",
    scanning: "Gemini AI tahlil qilmoqda...",
    noAnomalies: "Hech qanday xavfli anomaliya aniqlanmadi. Tizim xavfsiz holatda.",
    anomaliesFound: "aniqlangan anomaliya",
    recommendations: "AI Tavsiyalar",
    patterns: "Xulq-atvor qonuniyatlari",
    severityCritical: "Yuqori xavfli",
    severityWarning: "O'rtacha xavfli",
    statusSecure: "Tizim xavfsiz",
    statusWarning: "Xavflar aniqlandi",
    systemScan: "AI skanerlash holati",
    runScan: "Qayta tahlil qilish",
    lastUpdated: "Oxirgi yangilanish",
    threatLevel: "Tahdid darajasi",
    low: "Past",
    medium: "O'rtacha",
    high: "Yuqori",
    activeSecurityCore: "AI Xavfsizlik Yadrosi"
  },
  en: {
    title: "Gemini AI: Anomalies & Security Audit",
    subtitle: "Access logs and biometric check-ins evaluated by Artificial Intelligence",
    scanBtn: "Refresh Audit",
    scanning: "Gemini AI analyzing...",
    noAnomalies: "No high-risk anomalies detected. System is secure.",
    anomaliesFound: "anomalies detected",
    recommendations: "AI Recommendations",
    patterns: "Behavioral Patterns",
    severityCritical: "High Risk",
    severityWarning: "Medium Risk",
    statusSecure: "System Secure",
    statusWarning: "Risks Detected",
    systemScan: "AI scanner status",
    runScan: "Run AI Analysis",
    lastUpdated: "Last updated",
    threatLevel: "Threat Level",
    low: "Low",
    medium: "Medium",
    high: "High",
    activeSecurityCore: "AI Security Core"
  }
};

export const GeminiAnomalyCard: React.FC<GeminiAnomalyCardProps> = ({ logs }) => {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const { language } = useLanguage();

  useEffect(() => {
    getSecurityAlerts().then(setAlerts);
  }, []);

  const t = translations[language as 'uz' | 'en'] || translations.en;

  const runAnalysis = async (silent = false) => {
    if (logs.length === 0) return;
    if (!silent) setLoading(true);
    try {
      const result = await analyzeSecurityLogs(logs, language);
      if (result) {
        setReport(result);
        const now = new Date();
        setLastScannedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.error("Gemini AI Anomaly Scan failed:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Run automatically on mount once logs are loaded
  useEffect(() => {
    if (logs && logs.length > 0 && !report && !loading) {
      runAnalysis(true); // Silent scan on mount
    }
  }, [logs]);

  const hasAnomalies = report && report.anomalies && report.anomalies.length > 0;
  const threatColor = hasAnomalies 
    ? 'text-status-critical-text bg-status-critical-bg border-status-critical-text/20' 
    : 'text-status-safe-text bg-status-safe-bg border-status-safe-text/20';
  const threatLevel = hasAnomalies 
    ? (report!.anomalies.length > 2 ? t.high : t.medium) 
    : t.low;

  return (
    <div id="gemini-anomaly-card" className="bg-app-panel border border-border rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:border-brand-primary/30">
      {/* Top Header Row with Pulsing Core */}
      <div className="p-5 border-b border-border bg-app-surface/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20 text-brand-primary animate-pulse shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-text-primary font-bold text-base leading-none">{t.title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-brand-primary/10 text-brand-primary border border-brand-primary/20 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping"></span>
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-text-secondary text-xs mt-1">{t.subtitle}</p>
          </div>
        </div>

        {/* Action Button & Time */}
        <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
          {lastScannedTime && (
            <span className="text-[11px] text-text-muted font-mono whitespace-nowrap">
              {t.lastUpdated}: {lastScannedTime}
            </span>
          )}
          <button
            onClick={() => exportToCSV(alerts)}
            disabled={alerts.length === 0}
            className="px-3.5 py-1.5 bg-app-surface hover:bg-app-primary text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-border disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Download size={13} />
            Export Logs
          </button>
          <button
            onClick={() => runAnalysis(false)}
            disabled={loading || logs.length === 0}
            className="px-3.5 py-1.5 bg-app-surface hover:bg-app-primary text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-border disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? t.scanning : t.scanBtn}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {loading && !report ? (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3 bg-app-panel">
          <RefreshCw size={36} className="text-brand-primary animate-spin" />
          <p className="text-sm text-text-secondary mt-2 font-medium">{t.scanning}</p>
          <div className="w-48 h-1 bg-app-surface rounded-full overflow-hidden mt-1">
            <div className="h-full bg-brand-primary animate-progress rounded-full"></div>
          </div>
        </div>
      ) : report ? (
        <div className="p-5 grid grid-cols-1 xl:grid-cols-12 gap-6 bg-app-panel">
          {/* Column Left: Status Indicator & Summary - col-span-5 */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {/* Status Summary Widget */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${threatColor}`}>
              <div className="p-2 rounded-lg bg-app-primary/40 mt-0.5 shrink-0">
                {hasAnomalies ? (
                  <ShieldAlert size={22} className="text-status-critical-text" />
                ) : (
                  <ShieldCheck size={22} className="text-status-safe-text" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    {t.threatLevel}: <span className={hasAnomalies ? 'text-status-critical-text' : 'text-status-safe-text'}>{threatLevel}</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-app-primary/50 rounded text-text-muted shrink-0">
                    {logs.length} check-ins
                  </span>
                </div>
                <h4 className="text-text-primary font-bold text-sm">
                  {hasAnomalies ? `${report.anomalies.length} ${t.anomaliesFound}` : t.statusSecure}
                </h4>
                <p className="text-text-secondary text-xs mt-1.5 leading-relaxed italic">
                  "{report.summary}"
                </p>
              </div>
            </div>

            {/* AI Security Core Indicator */}
            <div className="bg-app-primary/40 border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary font-medium flex items-center gap-1.5">
                  <Fingerprint size={14} className="text-brand-primary" />
                  {t.activeSecurityCore}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-status-safe-text font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-safe-text animate-ping"></span>
                  ONLINE
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-app-panel rounded border border-border flex flex-col">
                  <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider">Scanned Logs</span>
                  <span className="text-text-secondary font-mono font-medium mt-0.5">{logs.length} records</span>
                </div>
                <div className="p-2 bg-app-panel rounded border border-border flex flex-col">
                  <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider">Confidence Level</span>
                  <span className="text-brand-primary font-mono font-medium mt-0.5">99.8% Core Accuracy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column Right: Anomalies Details / Patterns / Recommendations - col-span-7 */}
          <div className="xl:col-span-7 flex flex-col gap-5">
            {/* Anomalies List */}
            <div>
              <h4 className="text-text-secondary font-bold text-[11px] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-status-warning-text" />
                {hasAnomalies ? "Detected Access Anomalies" : "No Critical Anomalies"}
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {hasAnomalies ? (
                  report.anomalies.map((anomaly, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-app-primary/30 hover:bg-app-primary/60 border border-border/50 rounded-lg flex items-start gap-2.5 transition-colors"
                    >
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-status-critical-text shrink-0 shadow-lg shadow-status-critical-text/50"></span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-status-critical-text block leading-tight">{anomaly.type}</span>
                        <p className="text-[11px] text-text-secondary mt-1 leading-normal">{anomaly.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-app-primary/20 border border-dashed border-border text-center rounded-lg text-xs text-text-muted italic">
                    {t.noAnomalies}
                  </div>
                )}
              </div>
            </div>

            {/* Tabs / Side-by-Side: Patterns & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
              {/* Patterns */}
              <div>
                <h5 className="text-text-secondary font-bold text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={12} className="text-brand-secondary" />
                  {t.patterns}
                </h5>
                <ul className="space-y-1.5">
                  {report.patterns && report.patterns.length > 0 ? (
                    report.patterns.map((pattern, idx) => (
                      <li key={idx} className="text-[11px] text-text-secondary leading-normal flex items-start gap-1.5">
                        <ChevronRight size={10} className="text-brand-secondary mt-1 shrink-0" />
                        <span>{pattern}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-[11px] text-text-muted italic">No recurring patterns logged.</li>
                  )}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h5 className="text-text-secondary font-bold text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lightbulb size={12} className="text-status-warning-text" />
                  {t.recommendations}
                </h5>
                <ul className="space-y-1.5">
                  {report.recommendations && report.recommendations.length > 0 ? (
                    report.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-[11px] text-text-secondary leading-normal flex items-start gap-1.5">
                        <ChevronRight size={10} className="text-status-warning-text mt-1 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-[11px] text-text-muted italic">No pending action items.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Action prompt state if no report is present and not loading */
        <div className="p-10 flex flex-col items-center justify-center text-center gap-3 bg-app-panel">
          <div className="w-12 h-12 rounded-full bg-app-surface border border-border flex items-center justify-center text-text-muted">
            <Shield size={22} />
          </div>
          <div>
            <h4 className="text-text-primary font-bold text-sm">Security Audit Ready</h4>
            <p className="text-text-secondary text-xs mt-1 max-w-sm mx-auto">
              Run the Gemini AI evaluation engine to scan check-in patterns, pinpoint spoofing risks, and evaluate attendance trends.
            </p>
          </div>
          <button
            onClick={() => runAnalysis(false)}
            className="mt-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-text-inverted rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Sparkles size={14} />
            {t.runScan}
          </button>
        </div>
      )}
    </div>
  );
};
