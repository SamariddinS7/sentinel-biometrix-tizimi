/**
 * Enterprise Architecture Platform — Sections 53–64
 *
 * 53 — Enterprise System Architecture
 * 54 — High Availability
 * 55 — Performance Engineering
 * 56 — Observability Platform
 * 57 — Security & Zero Trust
 * 58 — Data Governance & Privacy
 * 59 — Testing & Quality Assurance
 * 60 — Disaster Recovery & Backup
 * 61 — Compliance & Audit
 * 62 — Release Management
 * 63 — Enterprise Deployment
 * 64 — Master AI Directive
 */
import React, { useState } from 'react';
import {
  Server, Shield, Zap, Eye, Lock, Database, FileText,
  RefreshCw, GitBranch, Globe, Cpu, Activity, Bell,
  CheckCircle2, AlertTriangle, ChevronRight, Play,
  Network, HardDrive, Layers, BarChart3, Package,
  Boxes, Brain, Radio, Gauge, Users, Key, Terminal,
  Camera, Workflow, Rocket, Cloud, Monitor, Mic,
  TrendingUp, Search, BookOpen, Fingerprint, ClipboardList,
  Archive, Settings, RotateCcw, FlaskConical, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchSection =
  | 'arch' | 'ha' | 'perf' | 'obs' | 'sec' | 'data'
  | 'qa'   | 'dr' | 'compliance' | 'release' | 'deploy' | 'directive';

type ItemStatus = 'active' | 'standby' | 'offline' | 'pending';

// ─── Shared UI ────────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: ItemStatus }> = ({ status }) => {
  const cls =
    status === 'active'  ? 'bg-emerald-400' :
    status === 'standby' ? 'bg-yellow-400' :
    status === 'pending' ? 'bg-blue-400 animate-pulse' :
                           'bg-white/20';
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />;
};

const StatusBadge: React.FC<{ status: ItemStatus; label?: string }> = ({ status, label }) => {
  const cfg: Record<ItemStatus, { cls: string; text: string }> = {
    active:  { cls: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400', text: label ?? 'Faol' },
    standby: { cls: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400',   text: label ?? 'Kutish' },
    pending: { cls: 'bg-blue-500/15 border-blue-500/25 text-blue-400',         text: label ?? 'Ulanyapti' },
    offline: { cls: 'bg-white/5 border-white/10 text-white/30',                text: label ?? 'Oflayn' },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border ${c.cls}`}>
      <StatusDot status={status} />
      {c.text}
    </span>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-sm font-bold text-white/85 flex items-center gap-2">
      <span className="text-cyan-400">{icon}</span>
      {title}
    </h3>
    <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">{subtitle}</p>
  </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/4 border border-white/8 rounded-xl p-3 ${className}`}>
    {children}
  </div>
);

const Tag: React.FC<{ label: string; color?: string }> = ({ label, color = 'text-white/40 bg-white/5 border-white/8' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>
    {label}
  </span>
);

const CapList: React.FC<{ items: string[]; icon?: React.ReactNode }> = ({ items, icon }) => (
  <ul className="space-y-1">
    {items.map(item => (
      <li key={item} className="flex items-center gap-2 text-[11px] text-white/55">
        <span className="text-cyan-400/60 shrink-0">{icon ?? <ChevronRight size={10} />}</span>
        {item}
      </li>
    ))}
  </ul>
);

const TwoCol: React.FC<{ left: React.ReactNode; right: React.ReactNode }> = ({ left, right }) => (
  <div className="grid grid-cols-2 gap-3">{left}{right}</div>
);

// ─── Section 53: Architecture ─────────────────────────────────────────────────

const ArchSection: React.FC = () => {
  const principles = [
    'Loose Coupling', 'High Cohesion', 'Horizontal Scalability',
    'Fault Isolation', 'Event Driven', 'API First',
    'Plugin Based', 'Stateless Services',
  ];
  const services: Array<{ name: string; icon: React.ReactNode; status: ItemStatus }> = [
    { name: 'Authentication Service',   icon: <Lock size={12} />,        status: 'active'  },
    { name: 'Authorization Service',    icon: <Shield size={12} />,      status: 'active'  },
    { name: 'Camera Service',           icon: <Camera size={12} />,      status: 'active'  },
    { name: 'Streaming Service',        icon: <Radio size={12} />,       status: 'active'  },
    { name: 'Recording Service',        icon: <HardDrive size={12} />,   status: 'active'  },
    { name: 'Playback Service',         icon: <Play size={12} />,        status: 'active'  },
    { name: 'AI Inference Service',     icon: <Brain size={12} />,       status: 'active'  },
    { name: 'Tracking Service',         icon: <Eye size={12} />,         status: 'active'  },
    { name: 'Face Recognition Service', icon: <Fingerprint size={12} />, status: 'active'  },
    { name: 'OCR Service',              icon: <FileText size={12} />,    status: 'active'  },
    { name: 'Search Service',           icon: <Search size={12} />,      status: 'active'  },
    { name: 'Vector Database Service',  icon: <Database size={12} />,    status: 'active'  },
    { name: 'Incident Service',         icon: <AlertTriangle size={12} />,status: 'active' },
    { name: 'Evidence Service',         icon: <Archive size={12} />,     status: 'active'  },
    { name: 'Notification Service',     icon: <Bell size={12} />,        status: 'active'  },
    { name: 'Reporting Service',        icon: <BarChart3 size={12} />,   status: 'active'  },
    { name: 'Digital Twin Service',     icon: <Boxes size={12} />,       status: 'active'  },
    { name: 'Audit Service',            icon: <ClipboardList size={12} />,status: 'active' },
    { name: 'Configuration Service',    icon: <Settings size={12} />,    status: 'active'  },
    { name: 'Health Monitoring Service',icon: <Activity size={12} />,    status: 'active'  },
    { name: 'Plugin Service',           icon: <Package size={12} />,     status: 'active'  },
  ];
  const exposes = [
    'Health Endpoint', 'Metrics', 'Distributed Traces',
    'Version', 'OpenAPI Specification', 'Structured Logging',
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Workflow size={15} />} title="Korporativ Tizim Arxitekturasi"
        subtitle="Modulli, servis-oriented arxitektura. Har bir servis mustaqil va almashtiriladigan." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Arxitektura tamoyillari</p>
        <div className="flex flex-wrap gap-1.5">
          {principles.map(p => <Tag key={p} label={p} color="text-cyan-300/70 bg-cyan-500/8 border-cyan-500/15" />)}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">
          Asosiy Servislar ({services.length})
        </p>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {services.map(s => (
            <div key={s.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/3">
              <span className="text-cyan-400/60 shrink-0">{s.icon}</span>
              <span className="text-[11px] text-white/70 flex-1">{s.name}</span>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Har bir servis chiqaradi</p>
        <CapList items={exposes} icon={<Server size={10} />} />
      </Card>
    </div>
  );
};

// ─── Section 54: High Availability ───────────────────────────────────────────

const HASection: React.FC = () => {
  const features = [
    '24/7 Ishlash', 'Avtomatik Failover', 'Yukni Balanslash',
    'Redundant Servislar', 'Rolling Yangilanishlar', 'Zero-Downtime Deploy',
  ];
  const failureHandling = [
    { item: 'Ishlamagan Workerni Qayta Ishga Tushirish', icon: <RefreshCw size={11} /> },
    { item: 'Kameralarni Qayta Ulash',                   icon: <Camera size={11} />    },
    { item: 'Yozib Olishni Davom Ettirish',              icon: <HardDrive size={11} /> },
    { item: "O\u2019tkazib Yuborilgan Hodisalarni Qayta Ijro", icon: <Play size={11} /> },
    { item: 'AI Pipelinelarni Tiklash',                  icon: <Brain size={11} />     },
    { item: "Xabar Navbatlarini Tiklash",                icon: <Network size={11} />   },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Activity size={15} />} title="Yuqori Mavjudlik (High Availability)"
        subtitle="Platforma biron bir servis xatoligida to\u2019liq to\u2019xtatilmasligi kerak." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Qo\u2019llab-quvvatlanadigan imkoniyatlar</p>
        <div className="grid grid-cols-2 gap-1.5">
          {features.map(f => (
            <div key={f} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] text-white/70">{f}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Xatolikni boshqarish</p>
        <div className="space-y-1.5">
          {failureHandling.map(f => (
            <div key={f.item} className="flex items-center gap-2">
              <span className="text-cyan-400/60 shrink-0">{f.icon}</span>
              <span className="text-[11px] text-white/60">{f.item}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <p className="text-[11px] text-emerald-400/80 italic">
          Biron bir servis xatoligi butun platformani to\u2019xtatmasligi kerak.
        </p>
      </Card>
    </div>
  );
};

// ─── Section 55: Performance ──────────────────────────────────────────────────

const PerfSection: React.FC = () => {
  const optimizes = [
    { label: 'GPU Usage',          icon: <Cpu size={12} />,       color: 'text-purple-400' },
    { label: 'CPU Usage',          icon: <Activity size={12} />,  color: 'text-blue-400'   },
    { label: 'Memory Usage',       icon: <Database size={12} />,  color: 'text-cyan-400'   },
    { label: 'Disk Usage',         icon: <HardDrive size={12} />, color: 'text-yellow-400' },
    { label: 'Network Usage',      icon: <Network size={12} />,   color: 'text-green-400'  },
    { label: 'Storage IO',         icon: <Archive size={12} />,   color: 'text-orange-400' },
    { label: 'Inference Latency',  icon: <Zap size={12} />,       color: 'text-pink-400'   },
  ];
  const techniques = [
    'Batch Inference', 'Dynamic Scheduling', 'GPU Sharing',
    'Frame Skipping Policies', 'Adaptive Frame Rate',
    'Model Caching', 'Embedding Cache', 'Vector Cache',
  ];
  const goals = [
    { g: 'Low Latency',             icon: <Zap size={12} />,        color: 'text-cyan-400'    },
    { g: 'High Throughput',         icon: <TrendingUp size={12} />,  color: 'text-emerald-400' },
    { g: 'Predictable Response',    icon: <Gauge size={12} />,       color: 'text-blue-400'    },
    { g: 'Efficient Resource Usage',icon: <Activity size={12} />,    color: 'text-purple-400'  },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Zap size={15} />} title="Unumdorlik Muhandisligi (Performance)"
        subtitle="Platforma GPU, CPU, xotira va tarmoqdan samarali foydalanadi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Optimallashtiriladigan resurslar</p>
        <div className="grid grid-cols-2 gap-1.5">
          {optimizes.map(o => (
            <div key={o.label} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/3">
              <span className={`${o.color} shrink-0`}>{o.icon}</span>
              <span className="text-[11px] text-white/65">{o.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Optimallashtirish texnikalari</p>
        <div className="flex flex-wrap gap-1.5">
          {techniques.map(t => <Tag key={t} label={t} color="text-purple-300/70 bg-purple-500/8 border-purple-500/15" />)}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Unumdorlik maqsadlari</p>
        <div className="grid grid-cols-2 gap-2">
          {goals.map(g => (
            <div key={g.g} className="flex items-center gap-2">
              <span className={`${g.color} shrink-0`}>{g.icon}</span>
              <span className="text-[11px] text-white/65">{g.g}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section 56: Observability ────────────────────────────────────────────────

const ObsSection: React.FC = () => {
  const componentExposes = ['Metrics', 'Logs', 'Distributed Traces', 'Health Status'];
  const metrics = [
    { m: 'FPS',              val: '25–30',   color: 'text-emerald-400' },
    { m: 'Camera Latency',   val: '<50ms',   color: 'text-cyan-400'    },
    { m: 'AI Latency',       val: '<100ms',  color: 'text-blue-400'    },
    { m: 'GPU Usage',        val: '0–100%',  color: 'text-purple-400'  },
    { m: 'CPU Usage',        val: '0–100%',  color: 'text-yellow-400'  },
    { m: 'RAM Usage',        val: '0–100%',  color: 'text-orange-400'  },
    { m: 'Storage',          val: 'GB/TB',   color: 'text-pink-400'    },
    { m: 'Recording Rate',   val: 'MB/s',    color: 'text-green-400'   },
    { m: 'Inference Time',   val: 'ms',      color: 'text-cyan-400'    },
    { m: 'Queue Length',     val: '0–N',     color: 'text-blue-400'    },
    { m: 'API Response Time',val: '<200ms',  color: 'text-emerald-400' },
  ];
  const alertLevels = [
    { level: 'Critical', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    { level: 'High',     cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { level: 'Medium',   cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { level: 'Low',      cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Eye size={15} />} title="Kuzatuv Platformasi (Observability)"
        subtitle="Har bir komponent metrikalar, loglar va izlar bilan kuzatiladi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Har komponent chiqaradi</p>
        <div className="grid grid-cols-2 gap-1.5">
          {componentExposes.map(e => (
            <div key={e} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
              <Eye size={11} className="text-cyan-400 shrink-0" />
              <span className="text-[11px] text-white/70">{e}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Metrikalar ({metrics.length})</p>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {metrics.map(m => (
            <div key={m.m} className="flex items-center gap-2 px-2 py-1 rounded bg-white/3">
              <Gauge size={10} className="text-white/25 shrink-0" />
              <span className="text-[11px] text-white/65 flex-1">{m.m}</span>
              <span className={`text-[10px] font-mono font-semibold ${m.color}`}>{m.val}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Ogohlantirish darajalari</p>
        <div className="flex flex-col gap-1.5">
          {alertLevels.map(a => (
            <div key={a.level} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${a.cls}`}>
              <Bell size={11} className="shrink-0" />
              <span className="text-[11px] font-semibold">{a.level}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section 57: Security & Zero Trust ───────────────────────────────────────

const SecSection: React.FC = () => {
  const [tab, setTab] = useState<'features' | 'events'>('features');
  const features = [
    { f: 'RBAC',                    icon: <Users size={12} />,       color: 'text-cyan-400'    },
    { f: 'ABAC',                    icon: <Shield size={12} />,      color: 'text-blue-400'    },
    { f: 'Multi-Factor Auth (MFA)', icon: <Fingerprint size={12} />, color: 'text-purple-400'  },
    { f: 'SSO',                     icon: <Key size={12} />,         color: 'text-yellow-400'  },
    { f: 'JWT',                     icon: <Lock size={12} />,        color: 'text-emerald-400' },
    { f: 'OAuth2',                  icon: <Globe size={12} />,       color: 'text-orange-400'  },
    { f: 'TLS',                     icon: <Network size={12} />,     color: 'text-pink-400'    },
    { f: 'AES-256 Encryption',      icon: <Lock size={12} />,        color: 'text-cyan-400'    },
    { f: 'Secret Management',       icon: <Archive size={12} />,     color: 'text-blue-400'    },
    { f: 'API Signing',             icon: <FileText size={12} />,    color: 'text-purple-400'  },
    { f: 'Key Rotation',            icon: <RefreshCw size={12} />,   color: 'text-emerald-400' },
  ];
  const events = [
    'Login', 'Logout', 'Ruxsat o\u2019zgarishi', 'Autentifikatsiya xatosi',
    'Konfiguratsiya o\u2019zgarishi', 'Dalillarni eksport qilish',
    'Kameraga kirish', 'Tizimni qayta ishga tushirish',
  ];
  const zeroPrinciples = [
    "Hech qanday so\u2019rovga ishonma",
    "Har bir identifikatorni tekshir",
    "Har bir qurilmani tekshir",
    "Har bir API ni tekshir",
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Shield size={15} />} title="Zero Trust Xavfsizlik"
        subtitle="Hech qanday so\u2019rovga sukut bo\u2019yicha ishonilmaydi. Har bir kirish tasdiqlanadi." />
      <Card className="border-cyan-500/20 bg-cyan-500/5">
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Zero Trust tamoyillari</p>
        <CapList items={zeroPrinciples} icon={<Shield size={10} />} />
      </Card>
      <div className="flex gap-1 p-1 bg-white/4 rounded-xl border border-white/8">
        {([
          { id: 'features' as const, label: 'Xavfsizlik xususiyatlari' },
          { id: 'events'   as const, label: 'Xavfsizlik hodisalari'    },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              tab === t.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/25' : 'text-white/35 hover:text-white/60'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'features' && (
        <div className="space-y-1.5">
          {features.map(f => (
            <Card key={f.f} className="flex items-center gap-2.5 py-2">
              <span className={`${f.color} shrink-0`}>{f.icon}</span>
              <span className="text-[12px] text-white/75 font-medium">{f.f}</span>
              <StatusBadge status="active" />
            </Card>
          ))}
        </div>
      )}
      {tab === 'events' && (
        <Card>
          <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Auditlanadigan hodisalar</p>
          <CapList items={events} icon={<FileText size={10} />} />
          <p className="mt-2.5 text-[10px] text-orange-400/70 border-t border-white/5 pt-2">
            Har bir hodisa auditlanishi shart.
          </p>
        </Card>
      )}
    </div>
  );
};

// ─── Section 58: Data Governance & Privacy ────────────────────────────────────

const DataSection: React.FC = () => {
  const govPolicies = [
    "Saqlash muddatlari (Retention Periods)",
    "Dalillarni saqlash (Evidence Retention)",
    "Yozib olishni saqlash (Recording Retention)",
    "Arxiv siyosatlari (Archive Policies)",
    "O\u2019chirishni tasdiqlash (Deletion Approval)",
    "Ma\u2019lumotlarni tasniflash (Data Classification)",
  ];
  const privacyFeatures = [
    { f: 'Yuz xiralashtirish (Face Blur)',           icon: <Eye size={12} />,      color: 'text-cyan-400'    },
    { f: 'Davlat raqamini xiralashtirish',            icon: <Camera size={12} />,   color: 'text-blue-400'    },
    { f: 'Mintaqa maskalash (Region Masking)',        icon: <Shield size={12} />,   color: 'text-purple-400'  },
    { f: 'Eksport suv belgisi (Export Watermarks)',   icon: <FileText size={12} />, color: 'text-yellow-400'  },
    { f: 'Audit suv belgisi (Audit Watermarks)',      icon: <ClipboardList size={12} />, color: 'text-emerald-400' },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Database size={15} />} title="Ma\u2019lumot Boshqaruvi va Maxfiylik"
        subtitle="Konfiguratsiya qilinadigan tashkiliy va tartibga soluvchi talablar." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Boshqaruv siyosatlari</p>
        <CapList items={govPolicies} icon={<Archive size={10} />} />
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Maxfiylik xususiyatlari</p>
        <div className="space-y-2">
          {privacyFeatures.map(f => (
            <div key={f.f} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/3">
              <span className={`${f.color} shrink-0`}>{f.icon}</span>
              <span className="text-[11px] text-white/65">{f.f}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border-blue-500/20 bg-blue-500/5">
        <p className="text-[10px] text-blue-400/70 italic">Barcha maxfiylik xususiyatlari konfiguratsiya qilinishi mumkin.</p>
      </Card>
    </div>
  );
};

// ─── Section 59: Testing & QA ─────────────────────────────────────────────────

const QASection: React.FC = () => {
  const testLevels = [
    { t: 'Unit Tests',           icon: <Terminal size={12} />,     color: 'text-cyan-400'    },
    { t: 'Integration Tests',    icon: <Network size={12} />,      color: 'text-blue-400'    },
    { t: 'System Tests',         icon: <Monitor size={12} />,      color: 'text-purple-400'  },
    { t: 'Performance Tests',    icon: <Zap size={12} />,          color: 'text-yellow-400'  },
    { t: 'Load Tests',           icon: <TrendingUp size={12} />,   color: 'text-orange-400'  },
    { t: 'Stress Tests',         icon: <Activity size={12} />,     color: 'text-red-400'     },
    { t: 'Recovery Tests',       icon: <RefreshCw size={12} />,    color: 'text-emerald-400' },
    { t: 'Security Tests',       icon: <Shield size={12} />,       color: 'text-pink-400'    },
    { t: 'Regression Tests',     icon: <GitBranch size={12} />,    color: 'text-blue-400'    },
    { t: 'AI Validation Tests',  icon: <Brain size={12} />,        color: 'text-cyan-400'    },
  ];
  const releaseReqs = [
    'Avtomatlashtirilgan test', 'Qo\u2019lda tekshirish',
    'Unumdorlik validatsiyasi', 'Xavfsizlik validatsiyasi', 'AI aniqligi validatsiyasi',
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<FlaskConical size={15} />} title="Test va Sifat Ta\u2019minoti (QA)"
        subtitle="Har bir nashr avtomatlashtirilgan va qo\u2019lda tekshirishdan o\u2019tishi kerak." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Test darajalari ({testLevels.length})</p>
        <div className="space-y-1.5">
          {testLevels.map(t => (
            <div key={t.t} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/3">
              <span className={`${t.color} shrink-0`}>{t.icon}</span>
              <span className="text-[11px] text-white/70">{t.t}</span>
              <CheckCircle2 size={11} className="text-emerald-400/50 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Har bir nashr uchun talab</p>
        <CapList items={releaseReqs} icon={<CheckCircle2 size={10} />} />
      </Card>
    </div>
  );
};

// ─── Section 60: Disaster Recovery ───────────────────────────────────────────

const DRSection: React.FC = () => {
  const backups = [
    { b: 'Database Backup',      icon: <Database size={12} />,  status: 'active'  as ItemStatus },
    { b: 'Configuration Backup', icon: <Settings size={12} />,  status: 'active'  as ItemStatus },
    { b: 'Evidence Backup',      icon: <Archive size={12} />,   status: 'active'  as ItemStatus },
    { b: 'Recording Backup',     icon: <HardDrive size={12} />, status: 'active'  as ItemStatus },
    { b: 'Model Backup',         icon: <Brain size={12} />,     status: 'standby' as ItemStatus },
    { b: 'Plugin Backup',        icon: <Package size={12} />,   status: 'standby' as ItemStatus },
  ];
  const recovery = [
    "Nuqtaviy Tiklash (Point-in-Time Restore)",
    "To\u2019liq Tiklash (Full Restore)",
    "Qisman Tiklash (Partial Restore)",
    "Servis Tiklash (Service Recovery)",
    "Klaster Tiklash (Cluster Recovery)",
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<RotateCcw size={15} />} title="Falokat Tiklash va Zaxira"
        subtitle="Tiklash protsedurasi hujjatlashtirilishi, sinovdan o\u2019tkazilishi va vaqti-vaqti bilan tekshirilishi shart." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Zaxira turlari</p>
        <div className="space-y-1.5">
          {backups.map(b => (
            <div key={b.b} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/3">
              <span className="text-cyan-400/60 shrink-0">{b.icon}</span>
              <span className="text-[11px] text-white/70 flex-1">{b.b}</span>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Tiklash rejimlari</p>
        <CapList items={recovery} icon={<RefreshCw size={10} />} />
      </Card>
    </div>
  );
};

// ─── Section 61: Compliance & Audit ──────────────────────────────────────────

const ComplianceSection: React.FC = () => {
  const auditFields = [
    { f: 'Kim (Who)',             icon: <Users size={12} />,       color: 'text-cyan-400'    },
    { f: 'Qachon (When)',        icon: <FileText size={12} />,    color: 'text-blue-400'    },
    { f: 'Nima (What)',          icon: <Eye size={12} />,         color: 'text-purple-400'  },
    { f: 'Nima uchun (Why)',     icon: <BookOpen size={12} />,    color: 'text-yellow-400'  },
    { f: 'Qayerda (Where)',      icon: <Globe size={12} />,       color: 'text-emerald-400' },
    { f: 'Oldingi holat (Before State)', icon: <RotateCcw size={12} />, color: 'text-orange-400' },
    { f: 'Keyingi holat (After State)',  icon: <Play size={12} />,      color: 'text-pink-400'   },
    { f: 'Natija (Result)',      icon: <CheckCircle2 size={12} />, color: 'text-emerald-400' },
  ];
  const logProps = ['Immutable (Mutlaq)', 'Searchable (Qidiriladigan)',
    'Exportable (Eksport qilinadigan)', 'Tamper-Evident (Buzilishga chidamli)'];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<ClipboardList size={15} />} title="Muvofiqlik va Audit"
        subtitle="Konfiguratsiya qilinadigan tashkiliy va tartibga soluvchi talablar. Audit yozuvlari o\u2019zgartirib bo\u2019lmaydi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Audit yozuvi maydonlari</p>
        <div className="space-y-1.5">
          {auditFields.map(f => (
            <div key={f.f} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/3">
              <span className={`${f.color} shrink-0`}>{f.icon}</span>
              <span className="text-[11px] text-white/65">{f.f}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Audit loglari xususiyatlari</p>
        <div className="grid grid-cols-2 gap-1.5">
          {logProps.map(p => (
            <div key={p} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] text-white/65">{p}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section 62: Release Management ──────────────────────────────────────────

const ReleaseSection: React.FC = () => {
  const envs = ['Development', 'Testing', 'Staging', 'Production'];
  const strategies = [
    { s: 'Blue-Green',    icon: <Layers size={12} />,    color: 'text-cyan-400'    },
    { s: 'Rolling',       icon: <RefreshCw size={12} />, color: 'text-blue-400'    },
    { s: 'Canary',        icon: <TrendingUp size={12} />,color: 'text-yellow-400'  },
    { s: 'Feature Flags', icon: <Settings size={12} />,  color: 'text-purple-400'  },
  ];
  const rollback = [
    "Bir zumda rollback (Instant Rollback)",
    "DB migratsiya rollback",
    "Konfiguratsiya rollback",
    "Plagin rollback",
    "Model rollback",
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Rocket size={15} />} title="Nashr Boshqaruvi (Release Management)"
        subtitle="Turli muhit va strategiyalar bilan xavfsiz deploy." />
      <TwoCol
        left={
          <Card>
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Deploy muhitlari</p>
            <div className="space-y-1.5">
              {envs.map((e, i) => (
                <div key={e} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/3">
                  <span className="text-[10px] text-white/30 font-mono w-4">{i + 1}</span>
                  <span className="text-[11px] text-white/65">{e}</span>
                </div>
              ))}
            </div>
          </Card>
        }
        right={
          <Card>
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Strategiyalar</p>
            <div className="space-y-1.5">
              {strategies.map(s => (
                <div key={s.s} className="flex items-center gap-2">
                  <span className={`${s.color} shrink-0`}>{s.icon}</span>
                  <span className="text-[11px] text-white/65">{s.s}</span>
                </div>
              ))}
            </div>
          </Card>
        }
      />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Rollback imkoniyatlari</p>
        <CapList items={rollback} icon={<RotateCcw size={10} />} />
      </Card>
    </div>
  );
};

// ─── Section 63: Enterprise Deployment ───────────────────────────────────────

const DeploySection: React.FC = () => {
  const environments = [
    { e: 'Single Server', icon: <Server size={12} />,   color: 'text-cyan-400'    },
    { e: 'Multi Server',  icon: <Layers size={12} />,   color: 'text-blue-400'    },
    { e: 'Cluster',       icon: <Network size={12} />,  color: 'text-purple-400'  },
    { e: 'Edge',          icon: <Cpu size={12} />,      color: 'text-yellow-400'  },
    { e: 'Cloud',         icon: <Cloud size={12} />,    color: 'text-emerald-400' },
    { e: 'Hybrid',        icon: <Globe size={12} />,    color: 'text-orange-400'  },
    { e: 'Air-Gapped',    icon: <Shield size={12} />,   color: 'text-red-400'     },
  ];
  const techs = [
    { t: 'Docker',          icon: <Boxes size={12} />,    color: 'text-blue-400'    },
    { t: 'Kubernetes',      icon: <Network size={12} />,  color: 'text-cyan-400'    },
    { t: 'NVIDIA GPU',      icon: <Cpu size={12} />,      color: 'text-green-400'   },
    { t: 'AMD GPU',         icon: <Cpu size={12} />,      color: 'text-red-400'     },
    { t: 'CPU Only',        icon: <Activity size={12} />, color: 'text-white/50'    },
    { t: 'Redis',           icon: <Database size={12} />, color: 'text-red-400'     },
    { t: 'PostgreSQL',      icon: <Database size={12} />, color: 'text-blue-400'    },
    { t: 'Vector Database', icon: <Layers size={12} />,   color: 'text-purple-400'  },
    { t: 'Message Broker',  icon: <Radio size={12} />,    color: 'text-yellow-400'  },
    { t: 'Object Storage',  icon: <Archive size={12} />,  color: 'text-emerald-400' },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Cloud size={15} />} title="Korporativ Deploy"
        subtitle="7 ta muhit va 10 ta texnologiyani qo\u2019llab-quvvatlaydi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Qo\u2019llab-quvvatlanadigan muhitlar</p>
        <div className="space-y-1.5">
          {environments.map(e => (
            <div key={e.e} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/3">
              <span className={`${e.color} shrink-0`}>{e.icon}</span>
              <span className="text-[12px] text-white/70 font-medium">{e.e}</span>
              <StatusBadge status="active" />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Qo\u2019llab-quvvatlanadigan texnologiyalar</p>
        <div className="grid grid-cols-2 gap-1.5">
          {techs.map(t => (
            <div key={t.t} className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white/3">
              <span className={`${t.color} shrink-0`}>{t.icon}</span>
              <span className="text-[11px] text-white/65">{t.t}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section 64: Master AI Directive ─────────────────────────────────────────

const DirectiveSection: React.FC = () => {
  const shallDo = [
    { a: 'Observe (Kuzatish)',             icon: <Eye size={12} />,          color: 'text-cyan-400'    },
    { a: 'Understand (Tushunish)',         icon: <Brain size={12} />,        color: 'text-blue-400'    },
    { a: 'Reason (Muhokama qilish)',       icon: <Cpu size={12} />,          color: 'text-purple-400'  },
    { a: 'Plan (Rejalashtirish)',          icon: <ClipboardList size={12} />, color: 'text-yellow-400' },
    { a: 'Recommend (Tavsiya berish)',     icon: <BookOpen size={12} />,     color: 'text-emerald-400' },
    { a: 'Execute only authorized actions',icon: <Shield size={12} />,       color: 'text-orange-400'  },
    { a: 'Explain every conclusion',      icon: <FileText size={12} />,     color: 'text-pink-400'    },
    { a: "Learn operational preferences", icon: <TrendingUp size={12} />,   color: 'text-cyan-400'    },
  ];
  const shallNever = [
    "Kuzatishlarni ixtiro qilish",
    "Dalillarni soxtalashtirish",
    "Identitetlarni taxmin qilish",
    "Noaniqlikni yashirish",
    "Ruxsatlarni chetlab o\u2019tish",
    "Ruxsatsiz himoyalangan konfiguratsiyani o\u2019zgartirish",
    "Talab qilingan tasdiqlashsiz qaytarib bo\u2019lmaydigan amallarni bajarish",
  ];
  const priorities = [
    { p: 'Xavfsizlik (Safety)',             color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
    { p: 'Aniqlik (Accuracy)',              color: 'text-cyan-400',    bg: 'bg-cyan-500/8 border-cyan-500/20'       },
    { p: 'Dalil (Evidence)',               color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/20'       },
    { p: 'Shaffoflik (Transparency)',       color: 'text-purple-400',  bg: 'bg-purple-500/8 border-purple-500/20'  },
    { p: 'Auditlanish (Auditability)',      color: 'text-yellow-400',  bg: 'bg-yellow-500/8 border-yellow-500/20'  },
    { p: 'Ishonchlilik (Reliability)',      color: 'text-orange-400',  bg: 'bg-orange-500/8 border-orange-500/20'  },
    { p: 'Operatsion qiymat',               color: 'text-pink-400',    bg: 'bg-pink-500/8 border-pink-500/20'      },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Brain size={15} />} title="Master AI Direktiv (Section 64)"
        subtitle="Enterprise AI Copilot operatorlarga aniq, tushuntirilgan va dalillarga asoslangan yordam beradi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Copilot bajarishi shart</p>
        <div className="space-y-1.5">
          {shallDo.map(a => (
            <div key={a.a} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/3">
              <span className={`${a.color} shrink-0`}>{a.icon}</span>
              <span className="text-[11px] text-white/65">{a.a}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="border-red-500/20 bg-red-500/5">
        <p className="text-[10px] text-red-400/70 uppercase tracking-wide font-semibold mb-2.5">Copilot hech qachon bajarmasligi shart</p>
        <CapList items={shallNever} icon={<AlertTriangle size={10} />} />
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Har bir javob ustuvorligiga ko\u2019ra</p>
        <div className="space-y-1.5">
          {priorities.map((p, i) => (
            <div key={p.p} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${p.bg}`}>
              <span className={`text-[10px] font-bold ${p.color} w-4`}>{i + 1}</span>
              <span className={`text-[11px] font-semibold ${p.color}`}>{p.p}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Nav & Root ───────────────────────────────────────────────────────────────

interface ArchNavItem {
  id: ArchSection;
  section: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  count: number;
}

const NAV_ITEMS: ArchNavItem[] = [
  { id: 'arch',       section: '§53', label: 'Arxitektura',  sub: "21 servis, 8 tamoyil",          icon: <Workflow size={14} />,      color: 'text-cyan-400',    count: 21 },
  { id: 'ha',         section: '§54', label: 'HA',           sub: "24/7, failover, zero-downtime", icon: <Activity size={14} />,      color: 'text-emerald-400', count:  6 },
  { id: 'perf',       section: '§55', label: 'Unumdorlik',   sub: "GPU, CPU, kesh, batch",         icon: <Zap size={14} />,           color: 'text-yellow-400',  count:  8 },
  { id: 'obs',        section: '§56', label: 'Kuzatuv',      sub: "11 metrika, 4 alert darajasi",  icon: <Eye size={14} />,           color: 'text-blue-400',    count: 11 },
  { id: 'sec',        section: '§57', label: 'Xavfsizlik',   sub: "Zero Trust, 11 xususiyat",      icon: <Shield size={14} />,        color: 'text-red-400',     count: 11 },
  { id: 'data',       section: '§58', label: "Ma\u2019lumot", sub: "Retention, Privacy, GDPR",     icon: <Database size={14} />,      color: 'text-purple-400',  count:  6 },
  { id: 'qa',         section: '§59', label: 'Test / QA',    sub: "10 test darajasi",              icon: <FlaskConical size={14} />,   color: 'text-orange-400',  count: 10 },
  { id: 'dr',         section: '§60', label: 'Tiklash',      sub: "6 zaxira, 5 tiklash rejimi",   icon: <RotateCcw size={14} />,     color: 'text-teal-400',    count:  6 },
  { id: 'compliance', section: '§61', label: 'Audit',        sub: "8 maydon, immutable loglar",    icon: <ClipboardList size={14} />, color: 'text-pink-400',    count:  8 },
  { id: 'release',    section: '§62', label: 'Nashr',        sub: "Blue-Green, Canary, Rollback",  icon: <Rocket size={14} />,        color: 'text-violet-400',  count:  5 },
  { id: 'deploy',     section: '§63', label: 'Deploy',       sub: "7 muhit, 10 texnologiya",       icon: <Cloud size={14} />,         color: 'text-sky-400',     count: 10 },
  { id: 'directive',  section: '§64', label: 'Direktiv',     sub: "8 qoida, 7 taqiq, ustuvorlik", icon: <Brain size={14} />,         color: 'text-amber-400',   count:  7 },
];

const SECTION_MAP: Record<ArchSection, React.ReactNode> = {
  arch:       <ArchSection />,
  ha:         <HASection />,
  perf:       <PerfSection />,
  obs:        <ObsSection />,
  sec:        <SecSection />,
  data:       <DataSection />,
  qa:         <QASection />,
  dr:         <DRSection />,
  compliance: <ComplianceSection />,
  release:    <ReleaseSection />,
  deploy:     <DeploySection />,
  directive:  <DirectiveSection />,
};

export const EnterpriseArchitecturePlatform: React.FC = () => {
  const [active, setActive] = useState<ArchSection>('arch');
  const activeItem = NAV_ITEMS.find(n => n.id === active)!;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Sidebar nav ─────────────────────────────────────────────────────── */}
      <nav className="w-[172px] shrink-0 border-r border-white/8 flex flex-col overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.018)' }}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-white/6 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Arxitektura · §53–64</p>
          <p className="text-[10px] text-white/45 mt-0.5">12 bo\u2019lim · 99 xususiyat</p>
        </div>
        {/* Items */}
        <div className="flex-1 overflow-y-auto py-1.5 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all relative group ${
                  isActive ? 'bg-cyan-500/12' : 'hover:bg-white/4'
                }`}>
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-cyan-400" />
                )}
                <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? `${item.color} bg-white/10 border border-white/12`
                    : 'text-white/30 bg-white/4 border border-white/6 group-hover:text-white/55'
                }`}>
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11.5px] font-semibold leading-tight truncate ${
                      isActive ? 'text-white/90' : 'text-white/45 group-hover:text-white/70'
                    }`}>{item.label}</span>
                    <span className={`shrink-0 text-[9px] font-mono px-1 py-0.5 rounded border ${
                      isActive ? 'text-cyan-400/70 bg-cyan-500/10 border-cyan-500/20' : 'text-white/20 bg-white/4 border-white/8'
                    }`}>{item.section}</span>
                  </div>
                  <p className={`text-[9.5px] leading-tight mt-0.5 truncate ${
                    isActive ? 'text-white/45' : 'text-white/22 group-hover:text-white/38'
                  }`}>{item.sub}</p>
                </div>
                <span className={`shrink-0 self-center text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/6 text-white/25'
                }`}>{item.count}</span>
              </button>
            );
          })}
        </div>
        {/* Footer */}
        <div className="px-3 py-2 border-t border-white/6 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] text-white/30 truncate">{activeItem.label} — {activeItem.sub}</span>
          </div>
        </div>
      </nav>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Breadcrumb bar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/6 bg-white/2">
          <span className={`${activeItem.color}`}>{activeItem.icon}</span>
          <span className="text-[11px] font-semibold text-white/70">{activeItem.label}</span>
          <ChevronRight size={11} className="text-white/20" />
          <span className="text-[10px] text-white/35">{activeItem.sub}</span>
          <span className="ml-auto text-[9px] font-mono text-white/25 bg-white/5 px-2 py-0.5 rounded border border-white/8">
            {activeItem.section}
          </span>
        </div>
        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
              {SECTION_MAP[active]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
