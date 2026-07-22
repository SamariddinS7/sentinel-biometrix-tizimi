/**
 * Enterprise AI Copilot — Unified AI Platform
 *
 * Three tabs:
 *   1. Copilot  — Operational intelligence: reasons across all subsystems,
 *                 proposes actions, explains decisions with a full reasoning chain.
 *   2. AI Chat  — Conversational Gemini chat with image/video attachment support
 *                 and deep-thinking mode.
 *   3. Asboblar — Multimodal tools: voice transcription, live map grounding,
 *                 CCTV image/video analysis.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BrainCircuit, Send, Image as ImageIcon, X, ChevronDown, ChevronRight,
  Loader2, Zap, Shield, Eye, FileText, Bell, Activity,
  CheckCircle2, AlertTriangle, Sparkles, Cpu, Radio,
  Camera, Database, Network, Lock, Play, RefreshCw, Copy, Check,
  AlertCircle, Terminal, TrendingUp, Users, Map,
  Bot, User, Trash2, MessageSquare, Sliders,
  Mic, MapPin, MapPinned, Globe, Square, Video, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  aiChatService, ChatMessage, transcribeAudio, getMapsGrounding,
  analyzeVideo, analyzeImage
} from '../services/geminiService';
import { useLanguage } from '../services/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab = 'copilot' | 'chat' | 'tools';
type ToolTab = 'audio' | 'maps' | 'media';

type ReasoningStep = 'Observe' | 'Understand' | 'Reason' | 'Plan' | 'Verify' | 'Execute' | 'Explain' | 'Learn';

interface ReasoningTrace {
  step: ReasoningStep;
  summary: string;
  sources?: string[];
}

type ActionRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

interface ProposedAction {
  id: string;
  label: string;
  description: string;
  type: string;
  params: Record<string, unknown>;
  risk: ActionRisk;
  requiresConfirmation: boolean;
  permissionsRequired: string[];
}

interface CopilotResponse {
  answer: string;
  reasoning: ReasoningTrace[];
  sourcesUsed: string[];
  proposedActions: ProposedAction[];
  confidence: number;
  uncertainty?: string;
  agentsInvoked: string[];
  processingMs: number;
}

interface ConversationTurn {
  id: string;
  role: 'user' | 'copilot';
  text: string;
  imagePreview?: string;
  response?: CopilotResponse;
  timestamp: Date;
}

interface CopilotMeta {
  aiEnabled: boolean;
  userRole: string;
  userName: string;
  agents: Array<{ name: string; status: 'active' | 'limited' | 'offline' }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = 'sentinel_ai_chat_history';
const CHAT_SETTINGS_KEY = 'sentinel_ai_chat_settings';

const QUICK_PROMPTS = [
  { label: "Tizim holati",      query: "Tizim holati qanday? Barcha komponentlar ishlayaptimi?",            icon: <Activity className="w-3.5 h-3.5" /> },
  { label: "Faol alarmlar",     query: "Hozir qanday faol alarmlar bor? Eng muhimini ko'rsat.",             icon: <Bell className="w-3.5 h-3.5" /> },
  { label: "Shubhali faoliyat", query: "Oxirgi soatda shubhali faoliyat aniqlangan kameral bormi?",         icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { label: "Xavfsizlik",        query: "Umumiy xavfsizlik holati haqida brifing ber.",                      icon: <Shield className="w-3.5 h-3.5" /> },
  { label: "Kamera tekshiruv",  query: "Qaysi kameralar oflayn yoki muammo bor?",                          icon: <Camera className="w-3.5 h-3.5" /> },
  { label: "Hisobot tayyorla",  query: "Bugungi xavfsizlik hisobotini tayyorla.",                           icon: <FileText className="w-3.5 h-3.5" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<ReasoningStep, React.ReactNode> = {
  Observe:    <Eye          className="w-3.5 h-3.5" />,
  Understand: <BrainCircuit className="w-3.5 h-3.5" />,
  Reason:     <Cpu          className="w-3.5 h-3.5" />,
  Plan:       <FileText     className="w-3.5 h-3.5" />,
  Verify:     <Shield       className="w-3.5 h-3.5" />,
  Execute:    <Zap          className="w-3.5 h-3.5" />,
  Explain:    <Terminal     className="w-3.5 h-3.5" />,
  Learn:      <TrendingUp   className="w-3.5 h-3.5" />,
};

const RISK_COLORS: Record<ActionRisk, string> = {
  none:     'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  low:      'text-blue-400 border-blue-500/30 bg-blue-500/10',
  medium:   'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  high:     'text-orange-400 border-orange-500/30 bg-orange-500/10',
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  cameras:        <Camera   className="w-3 h-3" />,
  alerts:         <Bell     className="w-3 h-3" />,
  alarms:         <Bell     className="w-3 h-3" />,
  system_health:  <Activity className="w-3 h-3" />,
  database:       <Database className="w-3 h-3" />,
  network:        <Network  className="w-3 h-3" />,
  operator_input: <Users    className="w-3 h-3" />,
  rule_engine:    <Shield   className="w-3 h-3" />,
  system_context: <Cpu      className="w-3 h-3" />,
  visual:         <Eye      className="w-3 h-3" />,
  map:            <Map      className="w-3 h-3" />,
};

// ─── Copilot sub-components ───────────────────────────────────────────────────

const ConfidenceMeter: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-white/40 tabular-nums">{pct}%</span>
    </div>
  );
};

const ReasoningChain: React.FC<{ traces: ReasoningTrace[] }> = ({ traces }) => {
  const [expanded, setExpanded] = useState(false);
  if (!traces.length) return null;
  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Muhokama zanjiri ({traces.length} qadam)
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-3 border-l border-white/10 space-y-2">
              {traces.map((trace, i) => (
                <div key={i} className="text-[11px]">
                  <div className="flex items-center gap-1.5 text-white/50 font-medium">
                    <span className="text-cyan-400/70">{STEP_ICONS[trace.step]}</span>
                    <span className="text-cyan-400/70 uppercase tracking-wide text-[10px]">{trace.step}</span>
                  </div>
                  <p className="text-white/60 mt-0.5 leading-relaxed">{trace.summary}</p>
                  {trace.sources && trace.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {trace.sources.map(src => (
                        <span key={src} className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/30">
                          {SOURCE_ICONS[src] ?? <Database className="w-3 h-3" />}
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ActionCard: React.FC<{
  action: ProposedAction;
  onExecute: (action: ProposedAction) => void;
  executing: boolean;
}> = ({ action, onExecute, executing }) => {
  const [confirming, setConfirming] = useState(false);
  const handleClick = () => {
    if (action.requiresConfirmation && !confirming) { setConfirming(true); return; }
    onExecute(action);
    setConfirming(false);
  };
  return (
    <div className={`border rounded-lg p-3 ${RISK_COLORS[action.risk]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold">{action.label}</span>
            {action.risk !== 'none' && (
              <span className="text-[9px] uppercase tracking-wide opacity-60 font-medium">{action.risk}</span>
            )}
          </div>
          <p className="text-[10px] opacity-60 mt-0.5 leading-relaxed">{action.description}</p>
        </div>
        <button
          onClick={handleClick}
          disabled={executing}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all
            ${confirming ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-current'} disabled:opacity-40`}
        >
          {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {confirming ? 'Tasdiqlash?' : 'Bajar'}
        </button>
      </div>
      {confirming && (
        <div className="mt-1.5 flex gap-2">
          <button onClick={() => { onExecute(action); setConfirming(false); }} className="text-[10px] text-orange-300 hover:text-orange-200">Ha, bajar</button>
          <button onClick={() => setConfirming(false)} className="text-[10px] text-white/30 hover:text-white/50">Bekor qilish</button>
        </div>
      )}
    </div>
  );
};

const CopilotMessage: React.FC<{
  turn: ConversationTurn;
  onAction: (action: ProposedAction) => Promise<void>;
  executingActionId: string | null;
}> = ({ turn, onAction, executingActionId }) => {
  const [copied, setCopied] = useState(false);
  const copyText = () => {
    navigator.clipboard.writeText(turn.response?.answer ?? turn.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[80%]">
          {turn.imagePreview && (
            <img src={turn.imagePreview} alt="upload" className="rounded-lg mb-1 max-h-32 object-cover" />
          )}
          <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-2xl rounded-tr-sm px-3 py-2">
            <p className="text-[13px] text-white/90 leading-relaxed">{turn.text}</p>
          </div>
          <p className="text-[10px] text-white/20 text-right mt-1">
            {turn.timestamp.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }
  const r = turn.response;
  return (
    <div className="flex gap-2">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mt-0.5">
        <BrainCircuit className="w-4 h-4 text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-cyan-400 font-medium">SENTINEL COPILOT</span>
          {r && (
            <>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/30">{r.processingMs}ms</span>
              {r.agentsInvoked.length > 0 && (
                <><span className="text-[10px] text-white/20">·</span>
                <span className="text-[10px] text-white/30">{r.agentsInvoked.length} agent</span></>
              )}
            </>
          )}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-3">
          <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{r?.answer ?? turn.text}</p>
          {r && (
            <>
              <div className="mt-3 pt-2.5 border-t border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30 uppercase tracking-wide">Ishonch darajasi</span>
                  <button onClick={copyText} className="text-white/20 hover:text-white/50 transition-colors">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <ConfidenceMeter value={r.confidence} />
              </div>
              {r.uncertainty && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-yellow-400/70">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{r.uncertainty}</span>
                </div>
              )}
              {r.sourcesUsed.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {r.sourcesUsed.map(src => (
                    <span key={src} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/30">
                      {SOURCE_ICONS[src] ?? <Database className="w-3 h-3" />}
                      {src}
                    </span>
                  ))}
                </div>
              )}
              {r.reasoning.length > 0 && <ReasoningChain traces={r.reasoning} />}
            </>
          )}
        </div>
        {r && r.proposedActions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wide px-0.5">Tavsiya qilingan amallar</p>
            {r.proposedActions.map(action => (
              <ActionCard key={action.id} action={action} onExecute={onAction} executing={executingActionId === action.id} />
            ))}
          </div>
        )}
        <p className="text-[10px] text-white/20 mt-1">
          {turn.timestamp.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

const AgentStatusBar: React.FC<{ meta: CopilotMeta | null }> = ({ meta }) => {
  if (!meta) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-white/2 overflow-x-auto scrollbar-hide">
      {meta.agents.map(agent => (
        <div key={agent.name} className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${
            agent.status === 'active' ? 'bg-emerald-400' :
            agent.status === 'limited' ? 'bg-yellow-400' : 'bg-red-400'
          }`} />
          <span className="text-[10px] text-white/30 whitespace-nowrap">{agent.name}</span>
        </div>
      ))}
      {!meta.aiEnabled && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 shrink-0">
          <AlertTriangle className="w-3 h-3 text-yellow-400" />
          <span className="text-[10px] text-yellow-400">GEMINI_API_KEY sozlanmagan</span>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface AICopilotProps {
  currentView?: string;
  activeCameraId?: string;
  activeAlarmId?: string;
  onNavigate?: (view: string) => void;
}

export const AICopilot: React.FC<AICopilotProps> = ({
  currentView, activeCameraId, activeAlarmId, onNavigate,
}) => {
  const { t, language } = useLanguage();

  // ── Main tab ────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('copilot');

  // ── COPILOT state ───────────────────────────────────────────────────────────
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [copilotInput, setCopilotInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<CopilotMeta | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const copilotBottomRef = useRef<HTMLDivElement>(null);
  const copilotFileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── CHAT state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved && saved !== 'undefined') return JSON.parse(saved);
    } catch { /* ignore */ }
    return [{ role: 'model', text: "Assalomu alaykum, Administrator. Men Sentinel AI – sizning xavfsizlik bo'yicha yordamchingizman. Bugun sizga qanday yordam bera olaman?" }];
  });
  const [thinkingMode, setThinkingMode] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_SETTINGS_KEY);
      if (saved && saved !== 'undefined') return JSON.parse(saved).thinkingMode ?? false;
    } catch { /* ignore */ }
    return false;
  });
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<{ type: 'image' | 'video'; data: string; mimeType: string }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  // ── TOOLS — audio ───────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<ToolTab>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [copiedTranscription, setCopiedTranscription] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── TOOLS — maps ────────────────────────────────────────────────────────────
  const [mapsQuery, setMapsQuery] = useState('');
  const [isMapsLoading, setIsMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<{ text: string; groundingChunks: any[] } | null>(null);

  // ── TOOLS — media ───────────────────────────────────────────────────────────
  const [mediaFile, setMediaFile] = useState<{ type: 'image' | 'video'; data: string; mimeType: string } | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState("Ushbu xavfsizlik kamerasidan olingan materialda biron bir qoidabuzarlik yoki shubhali faoliyat bormi?");
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaReport, setMediaReport] = useState<string | null>(null);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/copilot/context', {
      headers: { Authorization: `Bearer ${localStorage.getItem('sentinel_token') ?? ''}` },
    }).then(r => r.ok ? r.json() : null).then(d => { if (d) setMeta(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    const welcome: ConversationTurn = {
      id: 'welcome', role: 'copilot', text: '', timestamp: new Date(),
      response: {
        answer: `Assalomu alaykum. Men Sentinel Enterprise AI Copilot — operatsion razvedka platformasi.\n\nQuyidagi imkoniyatlardan foydalanishingiz mumkin:\n• Kamera va tasvir tahlili\n• Alarm boshqaruvi\n• Shaxs tekshiruvi va kuzatish\n• Tizim holati monitoringi\n• Hisobot yaratish\n\nBugun sizga qanday yordam bera olaman?`,
        reasoning: [], sourcesUsed: [], proposedActions: [], confidence: 1, agentsInvoked: [], processingMs: 0,
      },
    };
    setConversation([welcome]);
  }, []);

  useEffect(() => { copilotBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation, isProcessing]);
  useEffect(() => {
    if (mainTab === 'chat') chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, mainTab]);

  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify({ thinkingMode }));
  }, [thinkingMode]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingSeconds(p => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // ── COPILOT handlers ─────────────────────────────────────────────────────────
  const sendQuery = useCallback(async (queryText?: string) => {
    const text = (queryText ?? copilotInput).trim();
    if ((!text && !attachedImage) || isProcessing) return;

    const userTurn: ConversationTurn = {
      id: `user-${Date.now()}`, role: 'user', text: text || '(Tasvir yuklandi)',
      imagePreview: attachedImage?.preview, timestamp: new Date(),
    };
    setConversation(prev => [...prev, userTurn]);
    setCopilotInput('');
    const img = attachedImage;
    setAttachedImage(null);
    setIsProcessing(true);

    const history = conversation.filter(t => t.id !== 'welcome').slice(-6)
      .map(t => ({ role: t.role, text: t.response?.answer ?? t.text }));

    try {
      const token = localStorage.getItem('sentinel_token') ?? '';
      const res = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: text || 'Ushbu tasvirni tahlil qil.',
          imageData: img?.data, imageMimeType: img?.mimeType,
          conversationHistory: history, currentView, activeCameraId, activeAlarmId,
        }),
      });
      const data: CopilotResponse = await res.json();
      setConversation(prev => [...prev, { id: `copilot-${Date.now()}`, role: 'copilot', text: '', timestamp: new Date(), response: data }]);

      const navAction = data.proposedActions.find(a => a.type === 'NAVIGATE_TO_VIEW' && !a.requiresConfirmation);
      if (navAction && onNavigate) onNavigate(navAction.params.view as string);
    } catch {
      setConversation(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'copilot', text: '', timestamp: new Date(),
        response: { answer: "So'rovni qayta ishlashda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", reasoning: [], sourcesUsed: [], proposedActions: [], confidence: 0, agentsInvoked: [], processingMs: 0 },
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [copilotInput, attachedImage, isProcessing, conversation, currentView, activeCameraId, activeAlarmId, onNavigate]);

  const handleAction = async (action: ProposedAction) => {
    setExecutingActionId(action.id);
    setActionFeedback(null);
    try {
      const token = localStorage.getItem('sentinel_token') ?? '';
      const res = await fetch('/api/copilot/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actionType: action.type, params: action.params }),
      });
      const data = await res.json();
      setActionFeedback({ success: data.success, message: data.message });
      if (data.success && action.type === 'NAVIGATE_TO_VIEW' && data.data?.view && onNavigate) {
        onNavigate(data.data.view as string);
      }
    } catch {
      setActionFeedback({ success: false, message: 'Amal bajarishda tarmoq xatosi.' });
    } finally {
      setExecutingActionId(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  const handleCopilotKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  };

  const handleCopilotImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const dataUrl = evt.target?.result as string;
      setAttachedImage({ data: dataUrl, mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    if (copilotFileRef.current) copilotFileRef.current.value = '';
  };

  // ── CHAT handlers ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!chatInput.trim() && chatAttachments.length === 0) || isThinking) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput, attachments: [...chatAttachments] };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatAttachments([]);
    setIsThinking(true);
    try {
      const responseText = await aiChatService.sendMessage(
        userMsg.text,
        userMsg.attachments?.map(a => ({ data: a.data, mimeType: a.mimeType })),
        thinkingMode, language
      );
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'model', text: "So'rovingizni qayta ishlashda xatolik yuz berdi." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = evt => {
        const base64 = evt.target?.result as string;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setChatAttachments(prev => [...prev, { type, data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    }
    if (chatFileRef.current) chatFileRef.current.value = '';
  };

  const handleClearChat = () => {
    aiChatService.reset();
    setMessages([{ role: 'model', text: "Chat tarixi tozalandi. Yangi vazifalar uchun tayyorman." }]);
  };

  // ── AUDIO handlers ─────────────────────────────────────────────────────────
  const startAudioRecording = async () => {
    try {
      setTranscriptionText('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const fullBase64 = reader.result as string;
          const base64Clean = fullBase64.split(',')[1];
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(base64Clean, 'audio/wav');
            setTranscriptionText(text || "Audio bo'sh yoki hech qanday gap aniqlanmadi.");
          } catch {
            setTranscriptionText("Audio yozuvni transkripsiya qilish imkonsiz bo'ldi.");
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setTranscriptionText("Mikrofonni ishga tushirishda xatolik. Iltimos, brauzer ruxsatlarini tekshiring.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  const handleCopyTranscription = () => {
    if (!transcriptionText) return;
    navigator.clipboard.writeText(transcriptionText);
    setCopiedTranscription(true);
    setTimeout(() => setCopiedTranscription(false), 2000);
  };

  const sendTranscriptionToChat = () => {
    if (!transcriptionText) return;
    setChatInput(transcriptionText);
    setMainTab('chat');
  };

  // ── MAPS handlers ───────────────────────────────────────────────────────────
  const handleMapsSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim() || isMapsLoading) return;
    setIsMapsLoading(true);
    try {
      const result = await getMapsGrounding(mapsQuery);
      setMapsResult(result);
    } catch {
      setMapsResult({ text: "Joylashuv so'rovini amalga oshirishda xatolik yuz berdi.", groundingChunks: [] });
    } finally {
      setIsMapsLoading(false);
    }
  };

  // ── MEDIA handlers ──────────────────────────────────────────────────────────
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (files?.[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = evt => {
        setMediaFile({ type, data: evt.target?.result as string, mimeType: file.type });
        setMediaReport(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaAnalysis = async () => {
    if (!mediaFile || isMediaLoading) return;
    setIsMediaLoading(true);
    setMediaReport(null);
    const base64Data = mediaFile.data.split(',')[1];
    try {
      const result = mediaFile.type === 'image'
        ? await analyzeImage(base64Data, mediaFile.mimeType, mediaPrompt)
        : await analyzeVideo(base64Data, mediaFile.mimeType, mediaPrompt);
      setMediaReport(result);
    } catch {
      setMediaReport("Tahlil jarayonida xatolik yuz berdi. Fayl o'lchami yoki formatini tekshiring.");
    } finally {
      setIsMediaLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-white overflow-hidden">

      {/* ── Top tab bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1 px-3 pt-3 pb-0 border-b border-white/10">
        {([
          { id: 'copilot' as MainTab, label: 'Copilot', icon: <BrainCircuit className="w-3.5 h-3.5" /> },
          { id: 'chat'    as MainTab, label: 'AI Chat',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { id: 'tools'   as MainTab, label: 'Asboblar', icon: <Sliders className="w-3.5 h-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all -mb-px ${
              mainTab === tab.id
                ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                : 'text-white/35 border-transparent hover:text-white/60 hover:border-white/20'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1: COPILOT
      ════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'copilot' && (
        <>
          {/* Header row */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-app-panel/30">
            <div className="flex items-center gap-2">
              {meta?.aiEnabled ? (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                  <Radio className="w-3 h-3" /> Gemini AI faol
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full">
                  <Cpu className="w-3 h-3" /> Qoidalar rejimi
                </span>
              )}
            </div>
            <button
              onClick={() => setConversation(prev => [prev[0]])}
              className="text-white/20 hover:text-white/50 transition-colors p-1.5 rounded-lg hover:bg-white/5"
              title="Suhbatni tozalash"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <AgentStatusBar meta={meta} />

          <AnimatePresence>
            {actionFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className={`mx-4 mt-2 shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium
                  ${actionFeedback.success
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border border-red-500/30 text-red-300'}`}
              >
                {actionFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {actionFeedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          {conversation.length <= 1 && (
            <div className="shrink-0 px-4 pt-3 pb-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide mb-2">Tezkor so'rovlar</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp.label}
                    onClick={() => sendQuery(qp.query)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-left transition-all"
                  >
                    <span className="text-cyan-400/70 shrink-0">{qp.icon}</span>
                    <span className="text-[11px] text-white/60 leading-tight">{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
            {conversation.map(turn => (
              <CopilotMessage key={turn.id} turn={turn} onAction={handleAction} executingActionId={executingActionId} />
            ))}
            <AnimatePresence>
              {isProcessing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                  <div className="flex gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm">
                    <span className="text-[11px] text-white/40">Tahlil qilinmoqda</span>
                    <span className="flex gap-1 ml-2">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1 h-1 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={copilotBottomRef} />
          </div>

          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/10 bg-app-panel/30">
            {attachedImage && (
              <div className="mb-2 relative inline-block">
                <img src={attachedImage.preview} alt="attachment" className="h-16 rounded-lg object-cover border border-white/20" />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-cyan-500/40 transition-colors">
              <button onClick={() => copilotFileRef.current?.click()} className="shrink-0 text-white/25 hover:text-cyan-400 transition-colors mb-0.5" title="Tasvir yuklash">
                <ImageIcon className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={copilotInput}
                onChange={e => setCopilotInput(e.target.value)}
                onKeyDown={handleCopilotKeyDown}
                placeholder="Savol yoki buyruq kiriting… (Shift+Enter qatorni o'zgartiradi)"
                rows={1}
                style={{ resize: 'none', minHeight: '24px', maxHeight: '120px' }}
                className="flex-1 bg-transparent text-[13px] text-white/90 placeholder-white/20 outline-none leading-relaxed"
                onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }}
              />
              <button
                onClick={() => sendQuery()}
                disabled={(!copilotInput.trim() && !attachedImage) || isProcessing}
                className="shrink-0 w-7 h-7 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
            <input ref={copilotFileRef} type="file" accept="image/*" className="hidden" onChange={handleCopilotImageUpload} />
            <p className="text-[10px] text-white/15 mt-1.5 text-center">Hech qachon soxta kuzatuvlarni ixtiro qilmaydi · Har bir qaror asoslangan</p>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2: AI CHAT
      ════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'chat' && (
        <>
          {/* Chat header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-app-panel/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-primary/80 shadow">
                <Bot size={16} className="text-white animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-white/80 leading-none">Sentinel AI Chat</p>
                <p className="text-[10px] text-white/30 mt-0.5">Gemini Multi-Model Security Intelligence</p>
              </div>
            </div>
            <button onClick={handleClearChat} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors" title="Chatni tozalash">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 bg-brand-primary">
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div className="max-w-[82%] space-y-2">
                  <div className={`p-3.5 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/20 border border-cyan-500/30 text-white/90 rounded-tr-sm'
                      : 'bg-white/5 border border-white/10 text-white/80 rounded-tl-sm'
                  }`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="relative rounded overflow-hidden border border-white/20 w-24 h-24 shrink-0 bg-black">
                            {att.type === 'image'
                              ? <img src={att.data} alt="uploaded" className="w-full h-full object-cover" />
                              : <video src={att.data} className="w-full h-full object-cover" />}
                            <div className="absolute top-1 right-1 bg-black/50 rounded p-0.5">
                              {att.type === 'video' ? <Video size={10} className="text-white"/> : <ImageIcon size={10} className="text-white"/>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-1">
                    <User size={14} className="text-white/60" />
                  </div>
                )}
              </div>
            ))}
            {isThinking && (
              <div className="flex gap-3 justify-start animate-pulse">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-brand-primary">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  <span className="text-[12px] text-white/40 italic">Javob yozilmoqda...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/10 bg-app-panel/30">
            {chatAttachments.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {chatAttachments.map((att, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 group bg-black shrink-0">
                    {att.type === 'image'
                      ? <img src={att.data} alt="preview" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Video size={20} className="text-white/40" /></div>}
                    <button onClick={() => setChatAttachments(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-red-500 rounded-full p-0.5 text-white transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <input type="file" ref={chatFileRef} className="hidden" accept="image/*,video/*" multiple onChange={handleChatFileUpload} />
              <button type="button" onClick={() => chatFileRef.current?.click()}
                className="p-2.5 rounded-xl bg-white/5 text-white/30 hover:text-cyan-400 transition-colors border border-white/10 hover:border-white/20 shrink-0">
                <div className="relative"><ImageIcon size={18} /><Video size={12} className="absolute -bottom-1 -right-1.5 text-white/30" /></div>
              </button>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl focus-within:border-cyan-500/40 px-3 py-2.5 transition-colors">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Xavfsizlik jurnallari yoki videolari bo'yicha savol bering..."
                  className="w-full bg-transparent text-[13px] text-white/90 placeholder-white/20 outline-none"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
              </div>
              <button type="button"
                onClick={() => setThinkingMode(!thinkingMode)}
                className={`p-2.5 rounded-xl transition-all border shrink-0 ${thinkingMode ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'}`}
                title={thinkingMode ? "Chuqur Fikrlashni O'chirish" : "Chuqur Fikrlashni Yoqish"}>
                <BrainCircuit size={18} className={thinkingMode ? 'animate-pulse' : ''} />
              </button>
              <button type="submit" disabled={(!chatInput.trim() && chatAttachments.length === 0) || isThinking}
                className="p-2.5 rounded-xl text-white bg-cyan-500 hover:bg-cyan-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow shrink-0">
                {isThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3: ASBOBLAR (TOOLS)
      ════════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'tools' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Tool selector sidebar */}
          <div className="w-36 shrink-0 bg-white/3 border-r border-white/8 p-3 flex flex-col gap-1.5 overflow-y-auto">
            {([
              { id: 'audio' as ToolTab, label: 'Ovoz Yozish', icon: <Mic size={15} /> },
              { id: 'maps'  as ToolTab, label: 'Xarita Qidiruv', icon: <MapPinned size={15} /> },
              { id: 'media' as ToolTab, label: 'Media Tahlil', icon: <FileText size={15} /> },
            ] as const).map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                  activeTool === tool.id
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25 shadow'
                    : 'text-white/40 hover:text-white/70 border-transparent hover:bg-white/5'
                }`}
              >
                <span className="shrink-0">{tool.icon}</span>
                <span className="leading-tight">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Tool content */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">

            {/* ── 1. AUDIO TRANSCRIPTION ─────────────────────────────────── */}
            {activeTool === 'audio' && (
              <div className="space-y-4 max-w-sm mx-auto">
                <div>
                  <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                    <Mic className="text-cyan-400" size={16} /> Mikrofon orqali yozib olish
                  </h3>
                  <p className="text-[11px] text-white/30 mt-1">Nutqingizni yozib oling va Gemini yordamida matnga o'giring.</p>
                </div>

                <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/15 rounded-2xl bg-white/3 relative overflow-hidden">
                  {isRecording && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="w-40 h-40 rounded-full bg-cyan-500/10 animate-ping absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      <div className="w-24 h-24 rounded-full bg-cyan-500/15 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    {isRecording ? (
                      <button onClick={stopAudioRecording} className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center text-white shadow-md transition-all active:scale-95">
                        <Square size={22} fill="currentColor" />
                      </button>
                    ) : (
                      <button onClick={startAudioRecording} disabled={isTranscribing} className="w-14 h-14 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center text-white shadow-md transition-all active:scale-95 disabled:opacity-50">
                        <Mic size={22} />
                      </button>
                    )}
                    <span className="text-xs font-semibold text-white/50">
                      {isRecording ? `Yozilmoqda... ${recordingSeconds}s` : 'Boshlash uchun bosing'}
                    </span>
                  </div>
                </div>

                {isTranscribing && (
                  <div className="flex items-center justify-center gap-2 py-4 text-cyan-400 animate-pulse">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="text-xs">Gemini transkripsiya qilmoqda...</span>
                  </div>
                )}

                {transcriptionText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Matn natijasi:</span>
                      <div className="flex gap-1.5">
                        <button onClick={handleCopyTranscription} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-white/50 border border-white/10 transition-colors">
                          {copiedTranscription ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          {copiedTranscription ? "Nusxalandi" : "Nusxalash"}
                        </button>
                        <button onClick={sendTranscriptionToChat} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-[10px] font-semibold text-cyan-400 border border-cyan-500/30 transition-colors">
                          <MessageSquare size={12} /> Chatga
                        </button>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-white/60 text-xs leading-relaxed whitespace-pre-wrap">{transcriptionText}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── 2. MAPS GROUNDING ──────────────────────────────────────── */}
            {activeTool === 'maps' && (
              <div className="space-y-4 max-w-sm mx-auto">
                <div>
                  <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                    <MapPin className="text-cyan-400" size={16} /> Jonli Geo-Intellektual Qidiruv
                  </h3>
                  <p className="text-[11px] text-white/30 mt-1">Google Maps ma'lumotlari bilan bog'langan real vaqtda joylashuv tahlili.</p>
                </div>

                <form onSubmit={handleMapsSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={mapsQuery}
                    onChange={e => setMapsQuery(e.target.value)}
                    placeholder="Masalan: Toshkentdagi xavfsizlik zonalari..."
                    className="flex-1 bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-xl px-3 py-2.5 text-xs text-white/80 outline-none transition-all placeholder:text-white/20"
                  />
                  <button type="submit" disabled={isMapsLoading || !mapsQuery.trim()}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow">
                    {isMapsLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Qidirish
                  </button>
                </form>

                {isMapsLoading && (
                  <div className="flex flex-col items-center gap-2 py-8 text-cyan-400">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="text-xs font-semibold">Google Maps orqali tekshirilmoqda...</span>
                  </div>
                )}

                {mapsResult && (
                  <div className="space-y-3">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-white/60 text-xs leading-relaxed whitespace-pre-wrap">{mapsResult.text}</div>
                    {mapsResult.groundingChunks?.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1">
                          <Globe size={12} className="text-cyan-400" /> Manbalar:
                        </h4>
                        {mapsResult.groundingChunks.map((chunk: any, i: number) => {
                          const url = chunk.web?.uri || chunk.maps?.uri;
                          const title = chunk.web?.title || chunk.maps?.title || "Xarita nuqtasi";
                          return (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg border border-white/8 text-[11px]">
                              <span className="text-white/60 font-medium truncate">{title}</span>
                              {url && (
                                <a href={url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold shrink-0 ml-2">
                                  Ko'rish <MapPin size={10} />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── 3. MEDIA ANALYSIS ──────────────────────────────────────── */}
            {activeTool === 'media' && (
              <div className="space-y-4 max-w-sm mx-auto">
                <div>
                  <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
                    <ImageIcon className="text-cyan-400" size={16} /> CCTV Rasm va Video Tahlili
                  </h3>
                  <p className="text-[11px] text-white/30 mt-1">Kamera materiallarini anomaliyalar va xavfsizlik holatlarini aniqlash uchun tahlil qiling.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/15 hover:border-cyan-500/40 bg-white/3 hover:bg-white/5 rounded-xl cursor-pointer transition-all text-center">
                    <ImageIcon className="text-white/30 mb-1.5" size={20} />
                    <span className="text-[10px] text-white/40 font-semibold">Rasm yuklash</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleMediaUpload(e, 'image')} />
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/15 hover:border-cyan-500/40 bg-white/3 hover:bg-white/5 rounded-xl cursor-pointer transition-all text-center">
                    <Video className="text-white/30 mb-1.5" size={20} />
                    <span className="text-[10px] text-white/40 font-semibold">Video yuklash</span>
                    <input type="file" accept="video/mp4" className="hidden" onChange={e => handleMediaUpload(e, 'video')} />
                  </label>
                </div>

                {mediaFile && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/50 flex items-center gap-1">
                        {mediaFile.type === 'image' ? <ImageIcon size={12} className="text-cyan-400" /> : <Video size={12} className="text-cyan-400" />}
                        {mediaFile.type === 'image' ? 'Rasm' : 'Video'} yuklandi
                      </span>
                      <button onClick={() => { setMediaFile(null); setMediaReport(null); }} className="text-white/20 hover:text-white/50">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
                      {mediaFile.type === 'image'
                        ? <img src={mediaFile.data} alt="preview" className="w-full h-full object-contain" />
                        : <video src={mediaFile.data} controls className="w-full h-full object-contain" />}
                    </div>
                    <textarea
                      rows={2}
                      value={mediaPrompt}
                      onChange={e => setMediaPrompt(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/40 rounded-lg p-2.5 text-xs text-white/70 outline-none transition-all resize-none placeholder:text-white/20"
                    />
                    <button onClick={handleMediaAnalysis} disabled={isMediaLoading}
                      className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow">
                      {isMediaLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isMediaLoading ? 'Tahlil qilinmoqda...' : 'Intellektual tahlilni boshlash'}
                    </button>
                  </div>
                )}

                {mediaReport && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white/60 text-xs leading-relaxed whitespace-pre-wrap">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-2">
                      <FileText size={14} /> Xavfsizlik Tahlili Hisoboti:
                    </div>
                    {mediaReport}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
