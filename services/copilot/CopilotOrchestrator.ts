/**
 * Enterprise AI Copilot — Orchestration Layer
 *
 * Implements the Observe → Understand → Reason → Plan → Verify → Execute → Explain cycle.
 * Each capability is a self-contained agent. The orchestrator routes intents,
 * gathers system context, and assembles structured responses.
 */

import { GoogleGenAI, Type } from "@google/genai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReasoningStep =
  | "Observe"
  | "Understand"
  | "Reason"
  | "Plan"
  | "Verify"
  | "Execute"
  | "Explain"
  | "Learn";

export interface ReasoningTrace {
  step: ReasoningStep;
  summary: string;
  sources?: string[];
  durationMs?: number;
}

export type ActionRisk = "none" | "low" | "medium" | "high" | "critical";

export interface ProposedAction {
  id: string;
  label: string;
  description: string;
  type: CopilotActionType;
  params: Record<string, unknown>;
  risk: ActionRisk;
  requiresConfirmation: boolean;
  permissionsRequired: string[];
}

export type CopilotActionType =
  | "ACKNOWLEDGE_ALARM"
  | "ESCALATE_ALARM"
  | "RESOLVE_ALARM"
  | "ASSIGN_ALARM"
  | "PTZ_MOVE"
  | "SNAPSHOT_CAMERA"
  | "START_RECORDING"
  | "STOP_RECORDING"
  | "LOCK_AREA"
  | "DISPATCH_RESOURCE"
  | "CREATE_INCIDENT"
  | "EXPORT_EVIDENCE"
  | "NAVIGATE_TO_VIEW"
  | "SEARCH_PERSONS"
  | "GENERATE_REPORT";

export interface CopilotContext {
  userRole: string;
  userName: string;
  currentView?: string;
  activeCameraId?: string;
  activeAlarmId?: string;
  timestamp: string;
}

export interface CopilotQueryRequest {
  query: string;
  context: CopilotContext;
  imageData?: string; // base64
  imageMimeType?: string;
  conversationHistory?: Array<{ role: "user" | "copilot"; text: string }>;
}

export interface CopilotQueryResponse {
  answer: string;
  reasoning: ReasoningTrace[];
  sourcesUsed: string[];
  proposedActions: ProposedAction[];
  confidence: number; // 0–1
  uncertainty?: string;
  agentsInvoked: string[];
  processingMs: number;
}

export interface ActionExecutionRequest {
  actionType: CopilotActionType;
  params: Record<string, unknown>;
  context: CopilotContext;
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ─── System Context Collector ─────────────────────────────────────────────────

async function collectSystemContext(): Promise<Record<string, unknown>> {
  const ctx: Record<string, unknown> = {};

  // Try to gather live system data from available services
  try {
    // Import lazily to avoid circular deps
    const { getSecurityAlerts } = await import("../securityService.js");
    const alerts = await getSecurityAlerts();
    ctx.activeAlarms = Array.isArray(alerts)
      ? alerts.filter((a: any) => a.status === "active" || a.status === "ACTIVE").slice(0, 10)
      : [];
    ctx.alarmCount = Array.isArray(alerts) ? alerts.length : 0;
  } catch {
    ctx.activeAlarms = [];
    ctx.alarmCount = 0;
  }

  try {
    const { vmsHealthService } = await import("../vmsHealthService.js");
    if (typeof vmsHealthService?.getTelemetry === "function") {
      ctx.systemHealth = vmsHealthService.getTelemetry();
    }
  } catch {
    ctx.systemHealth = { status: "unknown" };
  }

  ctx.timestamp = new Date().toISOString();
  ctx.nodeEnv = process.env.NODE_ENV ?? "development";

  return ctx;
}

// ─── Intent Classifier ────────────────────────────────────────────────────────

type CopilotIntent =
  | "VISUAL_ANALYSIS"
  | "ALARM_MANAGEMENT"
  | "INVESTIGATION"
  | "SYSTEM_HEALTH"
  | "PERSON_SEARCH"
  | "REPORT_GENERATION"
  | "NAVIGATION"
  | "GENERAL_INTELLIGENCE"
  | "ACTION_REQUEST";

function classifyIntent(query: string): CopilotIntent {
  const q = query.toLowerCase();

  if (/kamera|camera|ko'r|analiz|snap|rasm|tasvir|image|video|visual|look at/i.test(q))
    return "VISUAL_ANALYSIS";
  if (/alarm|ogohlantirish|signal|xavf|tahdid|incident|tasdiql|resolve|escalat/i.test(q))
    return "ALARM_MANAGEMENT";
  if (/tekshir|investigat|search|qidir|shaxs|person|kim|who|kuzat|track/i.test(q))
    return "INVESTIGATION";
  if (/tizim|system|health|sog'liq|cpu|ram|disk|server|metric|status/i.test(q))
    return "SYSTEM_HEALTH";
  if (/hisobot|report|export|summary|statistik|analytics/i.test(q))
    return "REPORT_GENERATION";
  if (/o'tish|navigate|ko'rsat|show|open|ochish|dashboard/i.test(q))
    return "NAVIGATION";
  if (/bajar|execute|yoq|lock|dispatch|record|yuborish|send/i.test(q))
    return "ACTION_REQUEST";

  return "GENERAL_INTELLIGENCE";
}

// ─── Agent: Perception ────────────────────────────────────────────────────────

async function perceptionAgent(
  genai: GoogleGenAI | null,
  query: string,
  imageData?: string,
  imageMimeType?: string
): Promise<{ observation: string; detections: string[] }> {
  if (!imageData || !genai) {
    return {
      observation: imageData
        ? "Visual input received but AI model unavailable."
        : "No visual input provided.",
      detections: [],
    };
  }

  try {
    const model = genai.models;
    const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;

    const res = await model.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: { mimeType: (imageMimeType ?? "image/jpeg") as any, data: base64 },
            },
            {
              text: `You are a surveillance AI perception agent. Analyze this security camera image and report:
1. All detected persons (count, location, activity, clothing)
2. All detected vehicles (type, color, location)
3. Anomalies or suspicious activity
4. Environmental conditions
5. Any text visible (signs, plates)

Be precise and factual. Never fabricate details. If uncertain, say so.

User query context: ${query}

Respond in JSON: { "observation": "...", "detections": ["...", "..."] }`,
            },
          ],
        },
      ],
    });

    const text = res.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { observation: text, detections: [] };
  } catch (e: any) {
    return { observation: `Perception error: ${e.message}`, detections: [] };
  }
}

// ─── Agent: Reasoning ─────────────────────────────────────────────────────────

async function reasoningAgent(
  genai: GoogleGenAI | null,
  query: string,
  intent: CopilotIntent,
  systemCtx: Record<string, unknown>,
  perceptionResult: { observation: string; detections: string[] },
  history: Array<{ role: "user" | "copilot"; text: string }>,
  userCtx: CopilotContext
): Promise<{
  answer: string;
  reasoning: ReasoningTrace[];
  confidence: number;
  uncertainty?: string;
  proposedActions: ProposedAction[];
  sourcesUsed: string[];
}> {
  const fallback = buildFallbackResponse(query, intent, systemCtx, userCtx);

  if (!genai) return fallback;

  const systemPrompt = `You are the Enterprise AI Copilot of the Sentinel Biometrik Tizimi — an enterprise AI Video Management System (VMS).

You are NOT a chatbot. You are an operational intelligence platform.

ABSOLUTE RULES:
- Never fabricate observations, detections, or identities
- Never invent AI detections or create fake evidence
- Never claim certainty without evidence
- Never execute actions outside user permissions
- Always explain uncertainty
- Always reference supporting evidence

OPERATOR CONTEXT:
- User: ${userCtx.userName} (Role: ${userCtx.userRole})
- Current View: ${userCtx.currentView ?? "unknown"}
- Active Camera: ${userCtx.activeCameraId ?? "none"}
- Active Alarm: ${userCtx.activeAlarmId ?? "none"}
- Timestamp: ${userCtx.timestamp}

LIVE SYSTEM CONTEXT:
${JSON.stringify(systemCtx, null, 2)}

PERCEPTION RESULTS:
${perceptionResult.observation}
Detections: ${perceptionResult.detections.join(", ") || "none"}

CONVERSATION HISTORY (last 3 turns):
${history
  .slice(-3)
  .map((h) => `${h.role === "user" ? "Operator" : "Copilot"}: ${h.text}`)
  .join("\n")}

You must respond with a JSON object matching exactly this schema — no markdown fences, raw JSON only:
{
  "answer": "string (primary response in Uzbek, clear and actionable)",
  "reasoning": [
    { "step": "Observe", "summary": "string", "sources": ["string"] },
    { "step": "Understand", "summary": "string", "sources": ["string"] },
    { "step": "Reason", "summary": "string", "sources": ["string"] },
    { "step": "Plan", "summary": "string", "sources": ["string"] },
    { "step": "Verify", "summary": "string", "sources": ["string"] },
    { "step": "Explain", "summary": "string", "sources": ["string"] }
  ],
  "confidence": 0.0,
  "uncertainty": "string or null",
  "sourcesUsed": ["string"],
  "proposedActions": [
    {
      "id": "string",
      "label": "string",
      "description": "string",
      "type": "ACKNOWLEDGE_ALARM|ESCALATE_ALARM|RESOLVE_ALARM|ASSIGN_ALARM|PTZ_MOVE|SNAPSHOT_CAMERA|START_RECORDING|STOP_RECORDING|CREATE_INCIDENT|EXPORT_EVIDENCE|NAVIGATE_TO_VIEW|SEARCH_PERSONS|GENERATE_REPORT",
      "params": {},
      "risk": "none|low|medium|high|critical",
      "requiresConfirmation": true,
      "permissionsRequired": ["string"]
    }
  ]
}`;

  try {
    const res = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nOperator Query: ${query}` }],
        },
      ],
    });

    const raw = res.text ?? "";
    // Strip markdown code fences if present
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(clean);

    return {
      answer: parsed.answer ?? "Javob topilmadi.",
      reasoning: (parsed.reasoning ?? []) as ReasoningTrace[],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      uncertainty: parsed.uncertainty ?? undefined,
      proposedActions: (parsed.proposedActions ?? []) as ProposedAction[],
      sourcesUsed: (parsed.sourcesUsed ?? []) as string[],
    };
  } catch (e: any) {
    return { ...fallback, uncertainty: `Reasoning engine error: ${e.message}` };
  }
}

// ─── Fallback Response ────────────────────────────────────────────────────────

function buildFallbackResponse(
  query: string,
  intent: CopilotIntent,
  systemCtx: Record<string, unknown>,
  userCtx: CopilotContext
): {
  answer: string;
  reasoning: ReasoningTrace[];
  confidence: number;
  uncertainty?: string;
  proposedActions: ProposedAction[];
  sourcesUsed: string[];
} {
  const alarmCount = (systemCtx.alarmCount as number) ?? 0;

  const intentAnswers: Record<CopilotIntent, string> = {
    VISUAL_ANALYSIS:
      "Vizual tahlil uchun AI modeli mavjud emas. GEMINI_API_KEY ni sozlang.",
    ALARM_MANAGEMENT: `Tizimda ${alarmCount} ta faol alarm mavjud. Alarmlarni boshqarish uchun SOC paneliga o'ting.`,
    INVESTIGATION:
      "Tekshiruv markazi: SOC Investigation Center moduliga o'ting.",
    SYSTEM_HEALTH: `Tizim holati: ${JSON.stringify(systemCtx.systemHealth ?? {})}`,
    PERSON_SEARCH:
      "Shaxs qidiruvi: Identity Intelligence moduliga o'ting.",
    REPORT_GENERATION:
      "Hisobot yaratish: SOC Reports moduliga o'ting.",
    NAVIGATION: "Ko'rsatilgan bo'limga o'tish uchun yon panelni foydalaning.",
    GENERAL_INTELLIGENCE: `Sentinel AI Copilot faol. Tizimda ${alarmCount} ta alarm. Qo'shimcha savollar uchun GEMINI_API_KEY ni sozlang.`,
    ACTION_REQUEST:
      "Amal bajarish uchun AI modeli kerak. GEMINI_API_KEY ni sozlang.",
  };

  return {
    answer: intentAnswers[intent],
    reasoning: [
      {
        step: "Observe",
        summary: `Operatordan so'rov qabul qilindi: "${query.slice(0, 80)}..."`,
        sources: ["operator_input"],
      },
      {
        step: "Understand",
        summary: `Maqsad aniqlandi: ${intent}`,
        sources: ["intent_classifier"],
      },
      {
        step: "Reason",
        summary: "AI modeli mavjud emas — qoida asosida javob tayyorlandi.",
        sources: ["rule_engine"],
      },
      {
        step: "Explain",
        summary: "To'liq AI tahlili uchun GEMINI_API_KEY kerak.",
        sources: [],
      },
    ],
    confidence: 0.4,
    uncertainty: "GEMINI_API_KEY sozlanmagan. Qoida asosida javob.",
    proposedActions: buildDefaultActions(intent, systemCtx, userCtx),
    sourcesUsed: ["system_context", "rule_engine"],
  };
}

function buildDefaultActions(
  intent: CopilotIntent,
  systemCtx: Record<string, unknown>,
  userCtx: CopilotContext
): ProposedAction[] {
  const actions: ProposedAction[] = [];

  if (intent === "ALARM_MANAGEMENT" && (systemCtx.alarmCount as number) > 0) {
    actions.push({
      id: "nav_alarms",
      label: "Alarmlar bo'limiga o'tish",
      description: "Faol alarmlarni ko'rish va boshqarish",
      type: "NAVIGATE_TO_VIEW",
      params: { view: "event_timeline" },
      risk: "none",
      requiresConfirmation: false,
      permissionsRequired: ["OPERATOR"],
    });
  }

  if (intent === "INVESTIGATION") {
    actions.push({
      id: "nav_investigation",
      label: "Tekshiruv markazini ochish",
      description: "SOC tekshiruv moduliga o'tish",
      type: "NAVIGATE_TO_VIEW",
      params: { view: "investigation" },
      risk: "none",
      requiresConfirmation: false,
      permissionsRequired: ["OPERATOR"],
    });
  }

  if (intent === "REPORT_GENERATION") {
    actions.push({
      id: "nav_reports",
      label: "Hisobotlar bo'limiga o'tish",
      description: "Hisobotlarni ko'rish va eksport qilish",
      type: "NAVIGATE_TO_VIEW",
      params: { view: "reports" },
      risk: "none",
      requiresConfirmation: false,
      permissionsRequired: ["OPERATOR"],
    });
  }

  return actions;
}

// ─── Action Executor ──────────────────────────────────────────────────────────

export async function executeAction(
  req: ActionExecutionRequest
): Promise<ActionExecutionResult> {
  const { actionType, params, context } = req;

  // Permission check
  const rolePermissions: Record<string, CopilotActionType[]> = {
    VIEWER: ["NAVIGATE_TO_VIEW", "SEARCH_PERSONS"],
    OPERATOR: [
      "NAVIGATE_TO_VIEW",
      "SEARCH_PERSONS",
      "ACKNOWLEDGE_ALARM",
      "SNAPSHOT_CAMERA",
      "CREATE_INCIDENT",
      "GENERATE_REPORT",
      "EXPORT_EVIDENCE",
    ],
    SUPERVISOR: [
      "NAVIGATE_TO_VIEW",
      "SEARCH_PERSONS",
      "ACKNOWLEDGE_ALARM",
      "ESCALATE_ALARM",
      "RESOLVE_ALARM",
      "ASSIGN_ALARM",
      "SNAPSHOT_CAMERA",
      "START_RECORDING",
      "STOP_RECORDING",
      "CREATE_INCIDENT",
      "GENERATE_REPORT",
      "EXPORT_EVIDENCE",
      "DISPATCH_RESOURCE",
    ],
    ADMIN: [
      "NAVIGATE_TO_VIEW",
      "SEARCH_PERSONS",
      "ACKNOWLEDGE_ALARM",
      "ESCALATE_ALARM",
      "RESOLVE_ALARM",
      "ASSIGN_ALARM",
      "SNAPSHOT_CAMERA",
      "START_RECORDING",
      "STOP_RECORDING",
      "CREATE_INCIDENT",
      "GENERATE_REPORT",
      "EXPORT_EVIDENCE",
      "DISPATCH_RESOURCE",
      "LOCK_AREA",
      "PTZ_MOVE",
    ],
  };

  const allowed = rolePermissions[context.userRole] ?? rolePermissions["VIEWER"];
  if (!allowed.includes(actionType)) {
    return {
      success: false,
      message: `Ruxsat berilmagan: ${context.userRole} roli '${actionType}' amalni bajara olmaydi.`,
    };
  }

  switch (actionType) {
    case "ACKNOWLEDGE_ALARM": {
      try {
        const { acknowledgeAlarm } = await import("../securityService.js");
        await acknowledgeAlarm(params.alarmId as string, context.userName);
        return { success: true, message: `Alarm ${params.alarmId} tasdiqlandi.` };
      } catch (e: any) {
        return { success: false, message: `Alarm tasdiqlashda xato: ${e.message}` };
      }
    }

    case "ESCALATE_ALARM": {
      try {
        const { escalateAlarm } = await import("../securityService.js");
        await escalateAlarm(params.alarmId as string, context.userName);
        return { success: true, message: `Alarm ${params.alarmId} eskalatsiya qilindi.` };
      } catch (e: any) {
        return { success: false, message: `Eskalatsiyada xato: ${e.message}` };
      }
    }

    case "RESOLVE_ALARM": {
      try {
        const { resolveAlarm } = await import("../securityService.js");
        await resolveAlarm(params.alarmId as string, context.userName, params.resolution as string ?? "Copilot tomonidan hal qilindi");
        return { success: true, message: `Alarm ${params.alarmId} hal qilindi.` };
      } catch (e: any) {
        return { success: false, message: `Hal qilishda xato: ${e.message}` };
      }
    }

    case "NAVIGATE_TO_VIEW":
      // Frontend-only — return target view for client to handle
      return { success: true, message: `Navigation: ${params.view}`, data: { view: params.view } };

    case "SEARCH_PERSONS":
      return { success: true, message: "Shaxs qidiruvi boshlandi.", data: { query: params.query } };

    case "GENERATE_REPORT":
      return { success: true, message: "Hisobot tayyorlanmoqda.", data: { type: params.reportType } };

    case "SNAPSHOT_CAMERA":
      return { success: true, message: `Kamera ${params.cameraId} snashot olindi.`, data: {} };

    case "CREATE_INCIDENT":
      return { success: true, message: "Hodisa yaratildi.", data: { title: params.title } };

    default:
      return {
        success: false,
        message: `Amal turi '${actionType}' hali amalga oshirilmagan.`,
      };
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

let _genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (_genai) return _genai;
  const key = process.env.GEMINI_API_KEY;
  if (key && key.startsWith("AIzaSy")) {
    _genai = new GoogleGenAI({ apiKey: key });
  }
  return _genai;
}

export async function processCopilotQuery(
  req: CopilotQueryRequest
): Promise<CopilotQueryResponse> {
  const t0 = Date.now();
  const genai = getGenAI();
  const agentsInvoked: string[] = [];

  // 1. Classify intent
  const intent = classifyIntent(req.query);
  agentsInvoked.push("IntentClassifier");

  // 2. Collect system context
  const systemCtx = await collectSystemContext();
  agentsInvoked.push("SystemContextCollector");

  // 3. Perception agent (visual)
  let perceptionResult = { observation: "No visual input.", detections: [] as string[] };
  if (req.imageData || intent === "VISUAL_ANALYSIS") {
    agentsInvoked.push("PerceptionAgent");
    perceptionResult = await perceptionAgent(
      genai,
      req.query,
      req.imageData,
      req.imageMimeType
    );
  }

  // 4. Reasoning agent
  agentsInvoked.push("ReasoningAgent");
  const reasoningResult = await reasoningAgent(
    genai,
    req.query,
    intent,
    systemCtx,
    perceptionResult,
    req.conversationHistory ?? [],
    req.context
  );

  return {
    ...reasoningResult,
    agentsInvoked,
    processingMs: Date.now() - t0,
  };
}
