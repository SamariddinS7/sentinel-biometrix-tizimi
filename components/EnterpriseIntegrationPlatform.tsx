/**
 * Enterprise Integration Platform — Sections 42–52
 */
import React, { useState } from 'react';
import {
  Globe, Camera, Mail, Puzzle, Brain, Building2, Shield,
  Network, Cpu, Radio, Server, Lock, CheckCircle2,
  AlertCircle, Clock, Monitor, Wifi, Database,
  Zap, Package, Eye, Users, Layers, Terminal, Settings,
  Activity, FileText, MessageSquare, Bell, Bot,
  Mic, MapPin, Video, Image as ImageIcon, BarChart3,
  RefreshCw, GitBranch, Gauge, AlertTriangle, Play,
  ChevronRight, Boxes, Flame, Car, Key, Satellite,
  HardDrive, Printer, PhoneCall, Hash, Workflow
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PlatformSection =
  | 'overview' | 'agents' | 'cameras' | 'comms' | 'docs'
  | 'gateway'  | 'plugins' | 'models'  | 'ecosystem'
  | 'voice'    | 'policy';

type ItemStatus = 'active' | 'standby' | 'offline' | 'pending';

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

// ─── Section: Overview ────────────────────────────────────────────────────────
const OverviewSection: React.FC = () => {
  const integrationOrder = [
    { label: 'Rasmiy API',               icon: <Globe size={13} />,    desc: 'Birinchi ustuvorlik' },
    { label: 'Rasmiy SDK',               icon: <Package size={13} />,  desc: 'Ikkinchi ustuvorlik' },
    { label: 'Protocol qollash',          icon: <Network size={13} />,  desc: 'Uchinchi' },
    { label: 'Buyruqlar qatori (CLI)',    icon: <Terminal size={13} />, desc: "To\u2019rtinchi" },
    { label: 'Brauzer avtomatizatsiya',   icon: <Monitor size={13} />,  desc: "So\u2019nggi chora" },
    { label: 'Ish stoli avtomatizatsiya', icon: <Monitor size={13} />,  desc: "So\u2019nggi chora" },
  ];
  const protocols = [
    'REST API', 'GraphQL', 'gRPC', 'WebSocket', 'MQTT', 'AMQP',
    'Kafka', 'OPC-UA', 'ONVIF', 'RTSP', 'HTTP/HTTPS', 'SSH',
    'SFTP', 'SNMP', 'LDAP', 'Active Directory', 'SAML', 'OAuth2', 'OpenID Connect',
  ];
  const principles = [
    "Autentifikatsiyani hech qachon chetlab o\u2019tmang",
    "Avtorizatsiyani hech qachon chetlab o\u2019tmang",
    "Qo\u2019llab-quvvatlanmaydigan API-lardan foydalanmang",
    "Ruxsatsiz tashqi tizimlarni o\u2019zgartirmang",
    "Har bir integratsiya auditlana olishi kerak",
    "Har bir integratsiya almashtirilishi mumkin bo\u2019lishi kerak",
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Workflow size={15} />} title="Korporativ Integratsiya Platformasi"
        subtitle="Tashqi tizimlar bilan xavfsiz integratsiya. Ustuvorlik tartibiga rioya qilinadi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-3">Integratsiya ustuvorlik tartibi</p>
        <div className="space-y-1.5">
          {integrationOrder.map((item, i) => (
            <div key={item.label} className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] shrink-0">{i + 1}</span>
              <span className="text-cyan-400/70 shrink-0">{item.icon}</span>
              <span className="text-[12px] text-white/75 font-medium flex-1">{item.label}</span>
              <span className={`text-[10px] ${i < 3 ? 'text-emerald-400/70' : 'text-orange-400/60'}`}>{item.desc}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Integratsiya tamoyillari</p>
        <CapList items={principles} icon={<Shield size={10} />} />
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Qo\u2019llab-quvvatlanadigan protokollar ({protocols.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {protocols.map(p => <Tag key={p} label={p} color="text-cyan-300/70 bg-cyan-500/8 border-cyan-500/15" />)}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Agents ──────────────────────────────────────────────────────────
const AgentsSection: React.FC = () => {
  const [agentTab, setAgentTab] = useState<'computer' | 'browser'>('computer');
  const computerCaps = [
    'Ilovalarni ochish', 'Oynalarni boshqarish', "Formalarni to\u2019ldirish",
    "Ekran mazmunini o\u2019qish", 'Skrinshot olish', 'UI elementlarini topish',
    "Tasdiqlangan ish oqimlarini bajarish",
  ];
  const computerEnvs = ['Windows', 'Linux', 'Electron ilovalar', 'Veb-brauzerlar', 'Native desktop ilovalar'];
  const safetySteps = [
    { step: 'Ruxsat tekshiruvi',        icon: <Lock size={12} /> },
    { step: 'Maqsad tasdiqlash',        icon: <Eye size={12} /> },
    { step: 'Amal validatsiyasi',       icon: <Shield size={12} /> },
    { step: 'Bajarish',                 icon: <Play size={12} /> },
    { step: 'Tekshiruv (Verify)',       icon: <CheckCircle2 size={12} /> },
    { step: 'Audit yozuv',              icon: <FileText size={12} /> },
  ];
  const browserTasks = ['Login / Kirish', 'Navigatsiya', 'Konfiguratsiya', 'Qidiruv', 'Eksport',
    'Hisobot yuklash', 'Konfiguratsiya validatsiyasi'];
  const browserBrowsers = ['Chrome', 'Edge', 'Firefox'];
  const browserTargets = ['Kamera Web UI', 'NVR Web UI', 'VMS Portal', 'Cloud Dashboard', 'Enterprise ilovalar'];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Bot size={15} />} title="Agent Platformasi"
        subtitle="Kompyuter foydalanuvchi agenti va brauzer avtomatizatsiya mexanizmi." />
      <div className="flex gap-1 p-1 bg-white/4 rounded-xl border border-white/8">
        {([
          { id: 'computer' as const, label: 'Kompyuter agenti', icon: <Monitor size={12} /> },
          { id: 'browser'  as const, label: 'Brauzer',          icon: <Globe size={12} /> },
        ]).map(t => (
          <button key={t.id} onClick={() => setAgentTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              agentTab === t.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/25' : 'text-white/35 hover:text-white/60'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {agentTab === 'computer' && (
        <>
          <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Imkoniyatlar</p><CapList items={computerCaps} /></Card>
          <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Muhitlar</p><div className="flex flex-wrap gap-1.5">{computerEnvs.map(e => <Tag key={e} label={e} />)}</div></Card>
          <Card>
            <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-3">Xavfsiz bajarish zanjiri</p>
            <div className="flex flex-col gap-1.5">
              {safetySteps.map((s, i) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-white/6 border border-white/10 flex items-center justify-center text-cyan-400/70 shrink-0">{s.icon}</div>
                  <span className="text-[11px] text-white/65">{s.step}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-orange-400/60 border-t border-white/5 pt-2.5">Agent hech qachon aniq tasdiqlashsiz destruktiv amallarni bajarmaydi.</p>
          </Card>
        </>
      )}
      {agentTab === 'browser' && (
        <>
          <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Vazifalar</p><CapList items={browserTasks} /></Card>
          <div className="grid grid-cols-2 gap-3">
            <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Brauzerlar</p><CapList items={browserBrowsers} /></Card>
            <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Maqsadlar</p><CapList items={browserTargets} /></Card>
          </div>
          <Card><p className="text-[10px] text-orange-400/60 italic">Iloji bo\u2019lsa, brauzer avtomatizatsiyasi o\u2019rnida hujjatlashtirilgan veb-API-lar ishlatiladi.</p></Card>
        </>
      )}
    </div>
  );
};

// ─── Section: Camera Configuration ───────────────────────────────────────────
const CamerasSection: React.FC = () => {
  const vendors: Array<{ name: string; status: ItemStatus; proto: string }> = [
    { name: 'Hikvision',          status: 'active',  proto: 'ONVIF + SDK'   },
    { name: 'Dahua',              status: 'active',  proto: 'ONVIF + SDK'   },
    { name: 'Axis',               status: 'standby', proto: 'VAPIX + ONVIF' },
    { name: 'Bosch',              status: 'standby', proto: 'ONVIF'         },
    { name: 'Hanwha Vision',      status: 'offline', proto: 'ONVIF'         },
    { name: 'Uniview',            status: 'standby', proto: 'ONVIF'         },
    { name: 'Tiandy',             status: 'offline', proto: 'ONVIF'         },
    { name: 'VIVOTEK',            status: 'offline', proto: 'ONVIF'         },
    { name: 'Reolink',            status: 'active',  proto: 'RTSP'          },
    { name: 'TP-Link VIGI',       status: 'standby', proto: 'ONVIF'         },
    { name: 'ONVIF mos qurilma',  status: 'active',  proto: 'ONVIF'         },
  ];
  const operations = [
    { op: "Qurilmalarni aniqlash",      icon: <Wifi size={12} />      },
    { op: 'Holat tekshiruvi',           icon: <Activity size={12} />  },
    { op: 'Tarmoq konfiguratsiyasi',    icon: <Network size={12} />   },
    { op: 'Video konfiguratsiyasi',     icon: <Video size={12} />     },
    { op: 'Kodlash konfiguratsiyasi',   icon: <Settings size={12} />  },
    { op: 'Yozib olish konfiguratsiya', icon: <HardDrive size={12} /> },
    { op: 'PTZ konfiguratsiyasi',       icon: <MapPin size={12} />    },
    { op: 'Analitik konfiguratsiya',    icon: <BarChart3 size={12} /> },
    { op: "Firmware ma\u2019lumoti",    icon: <Cpu size={12} />       },
  ];
  const configPolicy = [
    { step: "Konfiguratsiyani o\u2019qish", icon: <Eye size={11} />          },
    { step: 'Validatsiya',                  icon: <CheckCircle2 size={11} /> },
    { step: "Ko\u2019rinish (Preview)",     icon: <ImageIcon size={11} />    },
    { step: 'Tasdiqlash talab etish',       icon: <AlertTriangle size={11} />},
    { step: "O\u2019zgarishlarni qo\u2019llash", icon: <Play size={11} />   },
    { step: 'Muvaffaqiyatni tekshirish',    icon: <CheckCircle2 size={11} /> },
    { step: 'Audit yaratish',               icon: <FileText size={11} />     },
    { step: "Kerak bo\u2019lsa rollback",   icon: <RefreshCw size={11} />    },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Camera size={15} />} title="Kamera Konfiguratsiya Platformasi"
        subtitle="Qollab-quvvatlanadigan ishlab chiqaruvchilarni boshqarish va konfiguratsiya qilish." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Ishlab chiqaruvchilar ({vendors.length})</p>
        <div className="space-y-1.5">
          {vendors.map(v => (
            <div key={v.name} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/3 border border-transparent">
              <Camera size={12} className="text-white/30 shrink-0" />
              <span className="text-[12px] text-white/75 flex-1 font-medium">{v.name}</span>
              <span className="text-[10px] text-white/25 mr-2">{v.proto}</span>
              <StatusBadge status={v.status} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Amallar</p>
        <div className="grid grid-cols-2 gap-1.5">
          {operations.map(o => (
            <div key={o.op} className="flex items-center gap-2 text-[11px] text-white/55">
              <span className="text-cyan-400/50 shrink-0">{o.icon}</span>{o.op}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-3">Konfiguratsiya siyosati</p>
        <div className="space-y-1.5">
          {configPolicy.map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-white/5 flex items-center justify-center text-cyan-400/60 shrink-0">{s.icon}</span>
              <span className="text-[11px] text-white/60">{i + 1}. {s.step}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Communication Hub ───────────────────────────────────────────────
const CommsSection: React.FC = () => {
  const channels: Array<{ name: string; icon: React.ReactNode; status: ItemStatus; color: string }> = [
    { name: 'Email',              icon: <Mail size={14} />,      status: 'standby', color: 'text-blue-400'   },
    { name: 'Telegram',           icon: <Bot size={14} />,       status: 'active',  color: 'text-cyan-400'   },
    { name: 'Microsoft Teams',    icon: <Users size={14} />,     status: 'standby', color: 'text-purple-400' },
    { name: 'Slack',              icon: <Hash size={14} />,      status: 'offline', color: 'text-yellow-400' },
    { name: 'SMS Gateway',        icon: <PhoneCall size={14} />, status: 'standby', color: 'text-emerald-400'},
    { name: 'Push Notifications', icon: <Bell size={14} />,      status: 'active',  color: 'text-orange-400' },
    { name: 'Webhook',            icon: <Network size={14} />,   status: 'active',  color: 'text-pink-400'   },
  ];
  const capabilities = [
    'Hodisa bildirishnomasi', 'Alarm bildirishnomasi', 'Kunlik hisobotlar',
    'Haftalik hisobotlar', 'Texnik xizmat ogohlantirishlari',
    'Rahbariyat xulosalari', 'Dalil almashish',
  ];
  const msgFields = [
    { f: 'Qabul qiluvchi',  icon: <Users size={10} />    },
    { f: 'Sabab',           icon: <FileText size={10} />  },
    { f: 'Manba',           icon: <Server size={10} />    },
    { f: 'Vaqt belgisi',    icon: <Clock size={10} />     },
    { f: "Bog\u2019liq hodisa", icon: <Activity size={10} /> },
    { f: 'Audit havolasi',  icon: <Shield size={10} />    },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<MessageSquare size={15} />} title="Korporativ Aloqa Markazi"
        subtitle="AI Copilot tasdiqlangan kanallar orqali tashqi foydalanuvchilar bilan muloqot qiladi." />
      <div className="space-y-2">
        {channels.map(ch => (
          <Card key={ch.name} className="flex items-center gap-3">
            <span className={`${ch.color} shrink-0`}>{ch.icon}</span>
            <span className="text-[12px] text-white/75 font-medium flex-1">{ch.name}</span>
            <StatusBadge status={ch.status} />
          </Card>
        ))}
      </div>
      <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Imkoniyatlar</p><CapList items={capabilities} icon={<Bell size={10} />} /></Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Har bir chiquvchi xabar</p>
        <div className="space-y-1.5">
          {msgFields.map(f => (
            <div key={f.f} className="flex items-center gap-2 text-[11px] text-white/55">
              <span className="text-cyan-400/50 shrink-0">{f.icon}</span>{f.f}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Document Platform ───────────────────────────────────────────────
const DocsSection: React.FC = () => {
  const docTypes = ['PDF', 'Word', 'Excel', 'CSV', 'PowerPoint', 'Markdown', 'JSON', 'XML'];
  const caps = [
    "O\u2019qish", 'Xulosa chiqarish', 'Jadvallarni ajratish', 'Qidiruv',
    'Hisobotlar yaratish', 'Versiyalarni taqqoslash', 'Rahbariyat xulosalari',
  ];
  const sources = [
    'Siyosatlar', "Qo\u2019llanmalar", 'SOPlar',
    'Hodisa protseduralari', 'Kamera hujjatlari', 'Tizim hujjatlari',
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<FileText size={15} />} title="Hujjat va Bilim Platformasi"
        subtitle="Korporativ hujjatlarni o\u2019qish, tahlil qilish va bilim bazasini boshqarish." />
      <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Hujjat turlari</p><div className="flex flex-wrap gap-1.5">{docTypes.map(d => <Tag key={d} label={d} color="text-cyan-300/70 bg-cyan-500/8 border-cyan-500/15" />)}</div></Card>
      <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Imkoniyatlar</p><CapList items={caps} /></Card>
      <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Bilim manbalari</p><CapList items={sources} icon={<Database size={10} />} /></Card>
    </div>
  );
};

// ─── Section: API Gateway ─────────────────────────────────────────────────────
const GatewaySection: React.FC = () => {
  const responsibilities: Array<{ r: string; icon: React.ReactNode; status: ItemStatus }> = [
    { r: 'Autentifikatsiya',             icon: <Lock size={12} />,      status: 'active' },
    { r: 'Avtorizatsiya',                icon: <Shield size={12} />,    status: 'active' },
    { r: "So\u2019rovlar cheklash",      icon: <Gauge size={12} />,     status: 'active' },
    { r: 'Kesh (Caching)',               icon: <Database size={12} />,  status: 'active' },
    { r: 'Loglash',                      icon: <FileText size={12} />,  status: 'active' },
    { r: 'Versiyalash',                  icon: <GitBranch size={12} />, status: 'active' },
    { r: 'Monitoring',                   icon: <Activity size={12} />,  status: 'active' },
  ];
  const apiStyles = ['REST', 'GraphQL', 'gRPC', 'WebSocket'];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Server size={15} />} title="Korporativ API Gateway"
        subtitle="Barcha tashqi xizmatlar Enterprise API Gateway orqali muloqot qiladi." />
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Masuliyatlar</p>
        <div className="space-y-2">
          {responsibilities.map(r => (
            <div key={r.r} className="flex items-center gap-2.5">
              <span className="text-cyan-400/60 shrink-0">{r.icon}</span>
              <span className="text-[12px] text-white/70 flex-1">{r.r}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">API uslublari</p>
        <div className="flex gap-2 flex-wrap">
          {apiStyles.map(s => (
            <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Network size={11} className="text-cyan-400" />
              <span className="text-[11px] text-cyan-300 font-semibold">{s}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card><p className="text-[10px] text-orange-400/60 italic">Copilot ishlab chiqarish xizmatlari bilan gateway tashqarisida muloqot qilmaydi.</p></Card>
    </div>
  );
};

// ─── Section: Plugin SDK ──────────────────────────────────────────────────────
const PluginsSection: React.FC = () => {
  const pluginTypes: Array<{ type: string; icon: React.ReactNode; color: string; status: ItemStatus }> = [
    { type: 'Camera Plugin',       icon: <Camera size={13} />,    color: 'text-cyan-400',    status: 'active'  },
    { type: 'Analytics Plugin',    icon: <BarChart3 size={13} />, color: 'text-blue-400',    status: 'active'  },
    { type: 'Storage Plugin',      icon: <HardDrive size={13} />, color: 'text-purple-400',  status: 'active'  },
    { type: 'Notification Plugin', icon: <Bell size={13} />,      color: 'text-yellow-400',  status: 'active'  },
    { type: 'Identity Plugin',     icon: <Key size={13} />,       color: 'text-emerald-400', status: 'active'  },
    { type: 'AI Model Plugin',     icon: <Brain size={13} />,     color: 'text-pink-400',    status: 'active'  },
    { type: 'Language Plugin',     icon: <Globe size={13} />,     color: 'text-orange-400',  status: 'standby' },
    { type: 'Search Plugin',       icon: <Eye size={13} />,       color: 'text-rose-400',    status: 'standby' },
  ];
  const exposes = ['Metadata', 'Imkoniyatlar', 'Versiya', "Bog\u2019liqliklar", 'Holat', 'Ruxsatlar', 'Konfiguratsiya'];
  const reqs = ['Hot Reloadable', 'Versiyalangan', 'Sandboxed', 'Auditlana olishi mumkin'];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Puzzle size={15} />} title="Plagin SDK"
        subtitle="Har bir kengaytma plagin sifatida amalga oshiriladi. Hot-reload va audit qollab-quvvatlanadi." />
      <div className="space-y-1.5">
        {pluginTypes.map(p => (
          <Card key={p.type} className="flex items-center gap-2.5 py-2.5">
            <span className={`${p.color} shrink-0`}>{p.icon}</span>
            <span className="text-[12px] text-white/75 flex-1 font-medium">{p.type}</span>
            <StatusBadge status={p.status} />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Har plagin</p><CapList items={exposes} icon={<ChevronRight size={9} />} /></Card>
        <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Talablar</p><CapList items={reqs} icon={<CheckCircle2 size={9} />} /></Card>
      </div>
    </div>
  );
};

// ─── Section: AI Model Platform ───────────────────────────────────────────────
const ModelsSection: React.FC = () => {
  const sources: Array<{ src: string; icon: React.ReactNode; color: string; status: ItemStatus }> = [
    { src: 'Mahalliy modellar',  icon: <HardDrive size={13} />, color: 'text-emerald-400', status: 'active' },
    { src: 'Bulut modellari',    icon: <Globe size={13} />,     color: 'text-blue-400',    status: 'active' },
    { src: 'Vision modellari',   icon: <Eye size={13} />,       color: 'text-cyan-400',    status: 'active' },
    { src: 'Nutq modellari',     icon: <Mic size={13} />,       color: 'text-purple-400',  status: 'active' },
    { src: 'Embedding modellari',icon: <Layers size={13} />,    color: 'text-yellow-400',  status: 'active' },
    { src: 'OCR modellari',      icon: <Printer size={13} />,   color: 'text-orange-400',  status: 'active' },
    { src: 'Reasoning modellari',icon: <Brain size={13} />,     color: 'text-pink-400',    status: 'active' },
  ];
  const mgmt = [
    "Ro\u2019yxatdan o\u2019tish", 'Yoqish', "O\u2019chirish", 'Versiyalash',
    'Benchmark', 'Holat tekshiruvi', 'Rollback', 'A/B Testlash',
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Brain size={15} />} title="Tashqi AI Model Platformasi"
        subtitle="Copilot bir nechta AI provayderlarni qollab-quvvatlaydi. Model almashtirish biznes mantiqni ozgartirmaydi." />
      <div className="space-y-1.5">
        {sources.map(s => (
          <Card key={s.src} className="flex items-center gap-2.5 py-2.5">
            <span className={`${s.color} shrink-0`}>{s.icon}</span>
            <span className="text-[12px] text-white/75 flex-1 font-medium">{s.src}</span>
            <StatusBadge status={s.status} />
          </Card>
        ))}
      </div>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2.5">Model boshqaruvi</p>
        <div className="grid grid-cols-2 gap-1.5">
          {mgmt.map(m => (
            <div key={m} className="flex items-center gap-1.5 text-[11px] text-white/55">
              <Settings size={10} className="text-cyan-400/50 shrink-0" />{m}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Enterprise Ecosystem ───────────────────────────────────────────
const EcosystemSection: React.FC = () => {
  const integrations: Array<{ name: string; icon: React.ReactNode; color: string; status: ItemStatus }> = [
    { name: 'ERP',                    icon: <Building2 size={13} />,  color: 'text-blue-400',    status: 'standby' },
    { name: 'HR tizimi',              icon: <Users size={13} />,      color: 'text-purple-400',  status: 'standby' },
    { name: 'Kirish nazorati',        icon: <Lock size={13} />,       color: 'text-emerald-400', status: 'active'  },
    { name: 'Mehmon boshqaruvi',      icon: <Key size={13} />,        color: 'text-cyan-400',    status: 'standby' },
    { name: 'Bino boshqaruvi',        icon: <Building2 size={13} />,  color: 'text-yellow-400',  status: 'standby' },
    { name: 'IoT',                    icon: <Wifi size={13} />,       color: 'text-orange-400',  status: 'active'  },
    { name: 'SCADA',                  icon: <Activity size={13} />,   color: 'text-red-400',     status: 'standby' },
    { name: "Yong\u2019in signali",   icon: <Flame size={13} />,      color: 'text-red-400',     status: 'standby' },
    { name: 'Parkovka tizimlari',     icon: <Car size={13} />,        color: 'text-white/50',    status: 'offline' },
    { name: 'GPS',                    icon: <Satellite size={13} />,  color: 'text-emerald-400', status: 'standby' },
    { name: 'GIS',                    icon: <MapPin size={13} />,     color: 'text-blue-400',    status: 'standby' },
    { name: 'Aktivlar boshqaruvi',    icon: <Boxes size={13} />,      color: 'text-purple-400',  status: 'offline' },
    { name: 'Help Desk',              icon: <Terminal size={13} />,   color: 'text-yellow-400',  status: 'offline' },
    { name: 'Identity Provider',      icon: <Shield size={13} />,     color: 'text-cyan-400',    status: 'active'  },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Building2 size={15} />} title="Korporativ Ekosistema"
        subtitle="Copilot konfiguratsiyalangan ruxsatlar va ma\u2019lumot boshqaruv siyosatlariga rioya qiladi." />
      <div className="space-y-1.5">
        {integrations.map(item => (
          <Card key={item.name} className="flex items-center gap-2.5 py-2.5">
            <span className={`${item.color} shrink-0`}>{item.icon}</span>
            <span className="text-[12px] text-white/75 flex-1 font-medium">{item.name}</span>
            <StatusBadge status={item.status} />
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Section: Voice & Multimodal ─────────────────────────────────────────────
const VoiceSection: React.FC = () => {
  const inputs  = ['Klaviatura', 'Ovoz', 'Rasm', 'Video', 'Hujjat', 'Aralash kirish'];
  const outputs = ['Matn', 'Ovoz', 'Grafiklar', 'Jadvallar', 'Dalil kartalari', 'Xaritalar', 'Vaqt chizig\u2019i', 'Video kliplar'];
  const voiceFlow = [
    { step: 'Nutq tanish',          icon: <Mic size={11} />          },
    { step: 'Niyat aniqlash',       icon: <Brain size={11} />        },
    { step: 'Rejalashtirish',       icon: <GitBranch size={11} />    },
    { step: "Dalil to\u2019plash",  icon: <Database size={11} />     },
    { step: 'Hisobot yaratish',     icon: <FileText size={11} />     },
    { step: 'Tasdiqlash',           icon: <CheckCircle2 size={11} /> },
    { step: 'Yetkazish',            icon: <Bell size={11} />         },
  ];
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Mic size={15} />} title="Ovoz va Multimodal Muloqot"
        subtitle="Operator ko\u2019p xil kirish usullaridan foydalanib, turli xil chiqish formatlarini olishi mumkin." />
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Kirish</p><CapList items={inputs} icon={<ChevronRight size={9} />} /></Card>
        <Card><p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-2">Chiqish</p><CapList items={outputs} icon={<ChevronRight size={9} />} /></Card>
      </div>
      <Card>
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-semibold mb-3">Ovozli ish oqimi</p>
        <p className="text-[10px] text-cyan-300/70 italic mb-3 px-2 py-1.5 bg-cyan-500/8 rounded-lg border border-cyan-500/15">
          "Kecha soat 18:00 dan keyin A Omboriga kirgan barchani ko\u2019rsating va hisobot eksport qiling."
        </p>
        <div className="space-y-1.5">
          {voiceFlow.map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-white/5 flex items-center justify-center text-cyan-400/60 shrink-0">{s.icon}</span>
              <span className="text-[11px] text-white/60">{i + 1}. {s.step}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Section: Action Policy ───────────────────────────────────────────────────
const PolicySection: React.FC = () => {
  const riskLevels = [
    {
      level: 'Past Xavf (Low)', color: 'text-emerald-400',
      bg: 'bg-emerald-500/8 border-emerald-500/20',
      badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
      rule: "Avtorizatsiyalangan bo\u2019lsa avtomatik bajarilishi mumkin.",
      actions: ["Ma\u2019lumot olish", 'Navigatsiya', 'Qidiruv', 'Vizualizatsiya'],
    },
    {
      level: "O\u2019rta Xavf (Medium)", color: 'text-yellow-400',
      bg: 'bg-yellow-500/8 border-yellow-500/20',
      badge: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400',
      rule: "Tashkilot siyosatiga qarab tasdiqlash talab qilinishi mumkin.",
      actions: ["Konfiguratsiya ko\u2019rinishi", 'Hisobot yaratish', 'Bildirishnoma', 'Eksport'],
    },
    {
      level: 'Yuqori Xavf (High)', color: 'text-orange-400',
      bg: 'bg-orange-500/8 border-orange-500/20',
      badge: 'bg-orange-500/15 border-orange-500/25 text-orange-400',
      rule: "Aniq tasdiqlash va audit talab etadi.",
      actions: ["O\u2019chirish (Delete)", "O\u2019chirish (Disable)", 'Qayta ishga tushirish', 'Firmware yangilash', 'Ommaviy konfiguratsiya'],
    },
    {
      level: 'Kritik Xavf (Critical)', color: 'text-red-400',
      bg: 'bg-red-500/8 border-red-500/20',
      badge: 'bg-red-500/15 border-red-500/25 text-red-400',
      rule: "Ko\u2019p tomonli avtorizatsiya va to\u2019liq audit izi talab etadi.",
      actions: ["Xavfsizlik siyosati o\u2019zgarishlari", "Identity Provider o\u2019zgarishlari", "Ma\u2019lumotlar bazasi migratsiyasi", 'Falokat tiklash'],
    },
  ];
  const [expanded, setExpanded] = useState<string | null>('Past Xavf (Low)');
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Shield size={15} />} title="Korporativ Amal Siyosati"
        subtitle="Copilot amallarni xavf darajasiga ko\u2019ra tasniflaydi. Har bir daraja aniq bajarish qoidalariga ega." />
      <div className="space-y-2">
        {riskLevels.map(r => (
          <div key={r.level} className={`border rounded-xl overflow-hidden ${r.bg}`}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              onClick={() => setExpanded(e => e === r.level ? null : r.level)}>
              <span className={`text-[11px] font-bold ${r.color} flex-1`}>{r.level}</span>
              <ChevronRight size={13} className={`${r.color} opacity-60 transition-transform ${expanded === r.level ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {expanded === r.level && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <div className="px-3 pb-3 space-y-2.5 border-t border-white/8 pt-2.5">
                    <p className="text-[11px] text-white/60 italic">{r.rule}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.actions.map(a => (
                        <span key={a} className={`text-[10px] px-2 py-0.5 rounded border font-medium ${r.badge}`}>{a}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Nav & Root ───────────────────────────────────────────────────────────────

interface NavItem {
  id: PlatformSection;
  section: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  count: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',  section: '§42', label: 'Platforma',    sub: "Protokollar, tamoyillar",      icon: <Workflow size={14} />,      color: 'text-cyan-400',    count: 19 },
  { id: 'agents',    section: '§43', label: 'Agentlar',     sub: "Kompyuter + Brauzer agent",    icon: <Bot size={14} />,           color: 'text-blue-400',    count: 12 },
  { id: 'cameras',   section: '§44', label: 'Kameralar',    sub: "11 ishlab chiqaruvchi",        icon: <Camera size={14} />,        color: 'text-purple-400',  count: 11 },
  { id: 'comms',     section: '§45', label: 'Aloqa',        sub: "7 kanal, bildirishnoma",       icon: <MessageSquare size={14} />, color: 'text-yellow-400',  count:  7 },
  { id: 'docs',      section: '§46', label: 'Hujjatlar',    sub: "8 format, bilim bazasi",       icon: <FileText size={14} />,      color: 'text-emerald-400', count:  8 },
  { id: 'gateway',   section: '§47', label: 'API Gateway',  sub: "7 mas\u2019uliyat, 4 uslub",  icon: <Server size={14} />,        color: 'text-orange-400',  count:  7 },
  { id: 'plugins',   section: '§48', label: 'Plaginlar',    sub: "8 plagin turi, hot-reload",    icon: <Puzzle size={14} />,        color: 'text-pink-400',    count:  8 },
  { id: 'models',    section: '§49', label: 'AI Modellari', sub: "7 manba, model boshqaruvi",   icon: <Brain size={14} />,         color: 'text-violet-400',  count:  7 },
  { id: 'ecosystem', section: '§50', label: 'Ekosistema',   sub: "14 korporativ integratsiya",  icon: <Building2 size={14} />,     color: 'text-rose-400',    count: 14 },
  { id: 'voice',     section: '§51', label: 'Ovoz',         sub: "6 kirish, 8 chiqish turi",    icon: <Mic size={14} />,           color: 'text-teal-400',    count:  6 },
  { id: 'policy',    section: '§52', label: 'Siyosat',      sub: "4 xavf darajasi, audit",      icon: <Shield size={14} />,        color: 'text-amber-400',   count:  4 },
];

const SECTION_MAP: Record<PlatformSection, React.ReactNode> = {
  overview:  <OverviewSection />,
  agents:    <AgentsSection />,
  cameras:   <CamerasSection />,
  comms:     <CommsSection />,
  docs:      <DocsSection />,
  gateway:   <GatewaySection />,
  plugins:   <PluginsSection />,
  models:    <ModelsSection />,
  ecosystem: <EcosystemSection />,
  voice:     <VoiceSection />,
  policy:    <PolicySection />,
};

export const EnterpriseIntegrationPlatform: React.FC = () => {
  const [active, setActive] = useState<PlatformSection>('overview');
  const activeItem = NAV_ITEMS.find(n => n.id === active)!;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Sidebar nav ─────────────────────────────────────────────────────── */}
      <nav className="w-[172px] shrink-0 border-r border-white/8 flex flex-col overflow-hidden"
           style={{ background: 'rgba(255,255,255,0.018)' }}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-white/6 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Integratsiya · §42–52</p>
          <p className="text-[10px] text-white/45 mt-0.5">11 bo\u2019lim · 103 xususiyat</p>
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
                {/* Active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-cyan-400" />
                )}
                {/* Icon box */}
                <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? `${item.color} bg-white/10 border border-white/12`
                    : 'text-white/30 bg-white/4 border border-white/6 group-hover:text-white/55'
                }`}>
                  {item.icon}
                </span>
                {/* Text */}
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
                {/* Count */}
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
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400`} />
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
