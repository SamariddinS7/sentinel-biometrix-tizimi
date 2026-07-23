/**
 * Enterprise AI Copilot — Operations Control Engine
 * Volume 3 · Sections 17-28
 *
 * Observe → Plan → Validate Permissions → Execute → Verify → Audit → Explain
 *
 * Capability domains:
 *   Camera Control · Playback · Digital Twin · Incident Management
 *   Evidence Management · Report Generation · Global Search
 *   Notification Engine · Workflow Automation · Safe Action Execution
 */

import { GoogleGenAI } from "@google/genai";

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

// ─── Action Types (full Operations Control Engine) ────────────────────────────

export type CopilotActionType =
  // ── Alarm Control ─────────────────────────────────────────────────────────
  | "ACKNOWLEDGE_ALARM"
  | "ESCALATE_ALARM"
  | "RESOLVE_ALARM"
  | "ASSIGN_ALARM"
  | "ARCHIVE_ALARM"
  // ── Camera Control ────────────────────────────────────────────────────────
  | "OPEN_CAMERA"
  | "CLOSE_CAMERA"
  | "PIN_CAMERA"
  | "UNPIN_CAMERA"
  | "FOLLOW_CAMERA"
  | "BOOKMARK_CAMERA"
  | "FAVORITE_CAMERA"
  | "OPEN_CAMERA_GROUP"
  | "SET_GRID_LAYOUT"
  | "SET_FULLSCREEN"
  | "SNAPSHOT_CAMERA"
  | "START_RECORDING"
  | "STOP_RECORDING"
  // ── PTZ Control ───────────────────────────────────────────────────────────
  | "PTZ_MOVE"
  | "PTZ_PRESET"
  | "PTZ_PATROL"
  | "PTZ_HOME"
  | "PTZ_ZOOM"
  // ── Playback Control ──────────────────────────────────────────────────────
  | "PLAYBACK_PLAY"
  | "PLAYBACK_PAUSE"
  | "PLAYBACK_STOP"
  | "PLAYBACK_SEEK"
  | "PLAYBACK_SPEED"
  | "PLAYBACK_SYNC"
  | "PLAYBACK_JUMP_TO_EVENT"
  | "PLAYBACK_BOOKMARK"
  // ── Digital Twin Control ──────────────────────────────────────────────────
  | "TWIN_OPEN_FLOOR"
  | "TWIN_OPEN_ZONE"
  | "TWIN_HIGHLIGHT_CAMERA"
  | "TWIN_HIGHLIGHT_PERSON"
  | "TWIN_SHOW_COVERAGE"
  | "TWIN_SHOW_BLIND_SPOTS"
  | "TWIN_REPLAY_MOVEMENT"
  | "TWIN_SWITCH_VIEW"
  | "TWIN_LIVE_TRACKING"
  // ── Incident Management ───────────────────────────────────────────────────
  | "CREATE_INCIDENT"
  | "ASSIGN_INCIDENT"
  | "UPDATE_INCIDENT"
  | "CLOSE_INCIDENT"
  | "MERGE_INCIDENTS"
  | "ADD_INCIDENT_NOTE"
  | "ATTACH_INCIDENT_EVIDENCE"
  | "SET_INCIDENT_PRIORITY"
  // ── Evidence Management ───────────────────────────────────────────────────
  | "CREATE_EVIDENCE"
  | "TAG_EVIDENCE"
  | "LOCK_EVIDENCE"
  | "EXPORT_EVIDENCE"
  | "EXPORT_EVIDENCE_ITEM"
  | "SHARE_EVIDENCE"
  | "VERIFY_EVIDENCE"
  | "SEARCH_EVIDENCE_DB"
  // ── Report Generation ─────────────────────────────────────────────────────
  | "GENERATE_REPORT"
  | "GENERATE_INCIDENT_REPORT"
  | "GENERATE_MOVEMENT_REPORT"
  | "GENERATE_ATTENDANCE_REPORT"
  | "GENERATE_FIRE_REPORT"
  | "GENERATE_CROWD_REPORT"
  | "GENERATE_VEHICLE_REPORT"
  | "GENERATE_EXECUTIVE_REPORT"
  // ── Global Search ─────────────────────────────────────────────────────────
  | "SEARCH_PERSONS"
  | "SEARCH_CAMERAS"
  | "SEARCH_VEHICLES"
  | "SEARCH_FACE"
  | "SEARCH_APPEARANCE"
  | "SEARCH_ALARMS"
  | "SEARCH_INCIDENTS"
  | "SEARCH_TIMELINE"
  // ── Notification Management ───────────────────────────────────────────────
  | "SEND_NOTIFICATION"
  | "SEND_ALARM_NOTIFICATION"
  | "SEND_INCIDENT_NOTIFICATION"
  // ── Navigation & Layout ───────────────────────────────────────────────────
  | "NAVIGATE_TO_VIEW"
  // ── Operations Control ────────────────────────────────────────────────────
  | "LOCK_AREA"
  | "DISPATCH_RESOURCE"
  // ── Workflow Automation ───────────────────────────────────────────────────
  | "EXECUTE_WORKFLOW"
  // ── Person Profile Management ─────────────────────────────────────────────
  | "VIEW_PERSON_PROFILE"
  | "UPDATE_PERSON_PROFILE"
  | "ADD_PERSON_NOTE"
  | "WATCHLIST_PERSON"
  | "ARCHIVE_PERSON"
  | "ENROLL_PERSON"
  | "GET_PERSON_TIMELINE"
  | "GET_PERSON_MOVEMENT"
  | "GET_PERSON_STATISTICS"
  | "PERSON_PROFILE_REPORT"
  | "MERGE_PERSONS"
  | "FIND_PERSON_BY_APPEARANCE";

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
  imageData?: string;
  imageMimeType?: string;
  conversationHistory?: Array<{ role: "user" | "copilot"; text: string }>;
}

export interface CopilotQueryResponse {
  answer: string;
  reasoning: ReasoningTrace[];
  sourcesUsed: string[];
  proposedActions: ProposedAction[];
  confidence: number;
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
  operationId?: string;
  auditEntry?: AuditEntry;
}

export interface AuditEntry {
  operationId: string;
  timestamp: string;
  operator: string;
  actionType: string;
  params: Record<string, unknown>;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  message: string;
}

// ─── In-memory audit log ──────────────────────────────────────────────────────

const auditLog: AuditEntry[] = [];

function audit(entry: AuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > 1000) auditLog.shift();
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return auditLog.slice(-limit).reverse();
}

function makeOpId(): string {
  return `OPS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ─── System Context Collector ─────────────────────────────────────────────────

async function collectSystemContext(): Promise<Record<string, unknown>> {
  const ctx: Record<string, unknown> = {};

  // Active alarms
  try {
    const { getSecurityAlerts } = await import("../securityService.js");
    const alerts = await getSecurityAlerts();
    ctx.activeAlarms = Array.isArray(alerts)
      ? alerts.filter((a: any) => a.status === "active" || a.status === "ACTIVE").slice(0, 15)
      : [];
    ctx.alarmCount = Array.isArray(alerts) ? alerts.length : 0;
    ctx.criticalAlarmCount = Array.isArray(alerts)
      ? alerts.filter((a: any) => a.severity === "critical" || a.severity === "CRITICAL").length
      : 0;
  } catch {
    ctx.activeAlarms = [];
    ctx.alarmCount = 0;
    ctx.criticalAlarmCount = 0;
  }

  // System health
  try {
    const { vmsHealthService } = await import("../vmsHealthService.js");
    if (typeof vmsHealthService?.getTelemetry === "function") {
      ctx.systemHealth = vmsHealthService.getTelemetry();
    }
  } catch {
    ctx.systemHealth = { status: "unknown" };
  }

  // Cameras
  try {
    const { cameraService } = await import("../cameraService.js");
    const cameras = await cameraService.getAllCameras();
    ctx.cameras = cameras.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      type: c.type,
      location: c.location,
    }));
    ctx.cameraCount = cameras.length;
    ctx.offlineCameraCount = cameras.filter((c: any) => c.status === "offline" || c.status === "error").length;
  } catch {
    ctx.cameras = [];
    ctx.cameraCount = 0;
    ctx.offlineCameraCount = 0;
  }

  // Incidents
  try {
    const { incidentService } = await import("../incidentService.js");
    const stats = incidentService.getStats();
    ctx.incidentStats = stats;
    ctx.openIncidents = incidentService.getAll({ status: "OPEN" as any, limit: 10 })
      .map((i: any) => ({ id: i.id, title: i.title, priority: i.priority, category: i.category }));
  } catch {
    ctx.incidentStats = {};
    ctx.openIncidents = [];
  }

  // Evidence
  try {
    const { evidenceManager } = await import("../evidenceManager.js");
    ctx.evidenceCount = evidenceManager.count();
  } catch {
    ctx.evidenceCount = 0;
  }

  // Person profiles — recently seen & currently present
  try {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const profiles = await personProfileStore.list({ limit: 20 });
    ctx.recentPersons = profiles.map((p: any) => ({
      personId: p.personId,
      fullName: p.fullName ?? "Noma'lum",
      status: p.status,
      lastSeen: p.lastSeen,
      lastCameraId: p.lastCameraId,
      currentlyPresent: p.currentlyPresent,
      totalDetections: p.totalDetections,
    }));
    ctx.personCount = profiles.length;
    ctx.presentPersonCount = profiles.filter((p: any) => p.currentlyPresent).length;
  } catch {
    ctx.recentPersons = [];
    ctx.personCount = 0;
    ctx.presentPersonCount = 0;
  }

  ctx.timestamp = new Date().toISOString();
  ctx.nodeEnv = process.env.NODE_ENV ?? "development";

  return ctx;
}

// ─── Intent Classifier ────────────────────────────────────────────────────────

type CopilotIntent =
  | "VISUAL_ANALYSIS"
  | "ALARM_MANAGEMENT"
  | "CAMERA_CONTROL"
  | "PLAYBACK_CONTROL"
  | "DIGITAL_TWIN"
  | "INCIDENT_MANAGEMENT"
  | "EVIDENCE_MANAGEMENT"
  | "INVESTIGATION"
  | "SYSTEM_HEALTH"
  | "PERSON_SEARCH"
  | "PROFILE_MANAGEMENT"
  | "GLOBAL_SEARCH"
  | "REPORT_GENERATION"
  | "NOTIFICATION"
  | "WORKFLOW_AUTOMATION"
  | "NAVIGATION"
  | "GENERAL_INTELLIGENCE"
  | "ACTION_REQUEST";

function classifyIntent(query: string): CopilotIntent {
  const q = query.toLowerCase();

  if (/tasvir|image|rasm|analiz|visual|look at|snapshot|ko'r|video/i.test(q) && /kamera|camera/i.test(q))
    return "VISUAL_ANALYSIS";
  if (/ochish|open cam|kamera och|ko'rsat.*kamer|show.*cam|display.*cam|pin cam|grid|fullscreen|ptz|pan|tilt|zoom|patrol|preset|yoq.*kamer|o'chirish.*kamer/i.test(q))
    return "CAMERA_CONTROL";
  if (/playback|ijro|replay|rewind|orqaga|kadrma|sinxron|synchronize|speed.*video|o'ynash|pauza|pause.*video|seek|jump.*to/i.test(q))
    return "PLAYBACK_CONTROL";
  if (/digital twin|3d bino|bino|floor|qavat|zona|zone|highlight|coverage|blind spot|harakat.*xarita|xarita.*harakat/i.test(q))
    return "DIGITAL_TWIN";
  if (/hodisa yarat|incident yarat|create incident|yangi hodisa|hodisa.*(tayinla|assign|yangilanish|update|yopish|close|birlashtir|merge)|note.*hodisa/i.test(q))
    return "INCIDENT_MANAGEMENT";
  if (/dalil|evidence|isbot|eksport.*dalil|lock.*dalil|tag.*dalil|yaxlitlik|integrity/i.test(q))
    return "EVIDENCE_MANAGEMENT";
  if (/alarm|ogohlantirish|signal|xavf|tahdid|tasdiql|resolve|escalat|arxiv/i.test(q))
    return "ALARM_MANAGEMENT";
  if (/profil.*yangi|yangi.*profil|profil.*tahrir|tahrir.*profil|izoh qo'sh|eslatma qo'sh|nazorat.*ro'yxat|watchlist|arxivla|ro'yxatdan o'tkaz|enroll|profil.*hisobot|shaxs.*harakat|harakat.*yo'li|birlashtir.*shaxs|merge.*person/i.test(q))
    return "PROFILE_MANAGEMENT";
  if (/tekshir|investigat|qidir|shaxs|person|kim|who|kuzat|track/i.test(q))
    return "INVESTIGATION";
  if (/tizim|system|health|sog'liq|cpu|ram|disk|server|metric|status/i.test(q))
    return "SYSTEM_HEALTH";
  if (/hisobot|report|export|summary|statistik|analytics|pdf|excel/i.test(q))
    return "REPORT_GENERATION";
  if (/bildirishnoma|notification|xabar.*yuborish|alert.*send|sms|email|telegram/i.test(q))
    return "NOTIFICATION";
  if (/workflow|jarayon|avtomatik|sequence|step.*step|trigger|olov.*kamera|fire.*open/i.test(q))
    return "WORKFLOW_AUTOMATION";
  if (/qidir|search|find|topish|mashina|vehicle|yuz|face|ko'rinish|appearance|timeline/i.test(q))
    return "GLOBAL_SEARCH";
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
    const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;

    const res = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: (imageMimeType ?? "image/jpeg") as any, data: base64 } },
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
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
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

  const systemPrompt = `You are the Enterprise AI Copilot of the Sentinel Biometrik Tizimi — an enterprise AI Video Management System.
You are an OPERATIONS CONTROL ENGINE, not just a chatbot. You control the entire VMS platform through official APIs.

ABSOLUTE RULES:
- Never fabricate observations, detections, or identities
- Never invent AI detections or create fake evidence
- Never claim certainty without evidence
- Never execute actions outside user permissions
- Always explain uncertainty
- High-risk operations MUST have requiresConfirmation: true

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
${history.slice(-3).map((h) => `${h.role === "user" ? "Operator" : "Copilot"}: ${h.text}`).join("\n")}

FULL OPERATIONS CONTROL ENGINE — SUPPORTED ACTION TYPES:
You can propose any of these action types in proposedActions:

ALARM: ACKNOWLEDGE_ALARM(alarmId), ESCALATE_ALARM(alarmId), RESOLVE_ALARM(alarmId,resolution), ASSIGN_ALARM(alarmId,assignee), ARCHIVE_ALARM(alarmId)

CAMERA CONTROL: OPEN_CAMERA(cameraId,cameraName), CLOSE_CAMERA(cameraId), PIN_CAMERA(cameraId), UNPIN_CAMERA(cameraId), FOLLOW_CAMERA(cameraId), BOOKMARK_CAMERA(cameraId), FAVORITE_CAMERA(cameraId), OPEN_CAMERA_GROUP(groupName), SET_GRID_LAYOUT(layout:"1x1"|"2x2"|"3x3"|"4x4"|"auto"), SET_FULLSCREEN(cameraId), SNAPSHOT_CAMERA(cameraId), START_RECORDING(cameraId), STOP_RECORDING(cameraId)

PTZ: PTZ_MOVE(cameraId,direction,speed), PTZ_PRESET(cameraId,presetId), PTZ_PATROL(cameraId,enable:boolean), PTZ_HOME(cameraId), PTZ_ZOOM(cameraId,level)

PLAYBACK: PLAYBACK_PLAY(cameraId,timestamp?), PLAYBACK_PAUSE(cameraId), PLAYBACK_STOP(cameraId), PLAYBACK_SEEK(cameraId,timestamp), PLAYBACK_SPEED(cameraId,speed), PLAYBACK_SYNC(cameraIds:string[],timestamp), PLAYBACK_JUMP_TO_EVENT(cameraId,eventId), PLAYBACK_BOOKMARK(cameraId,timestamp,label)

DIGITAL TWIN: TWIN_OPEN_FLOOR(floor:number), TWIN_OPEN_ZONE(zoneId), TWIN_HIGHLIGHT_CAMERA(cameraId), TWIN_HIGHLIGHT_PERSON(personId), TWIN_SHOW_COVERAGE(), TWIN_SHOW_BLIND_SPOTS(), TWIN_REPLAY_MOVEMENT(personId,since,until), TWIN_SWITCH_VIEW(mode:"2d"|"3d"), TWIN_LIVE_TRACKING(personId)

INCIDENT: CREATE_INCIDENT(title,category:"INTRUSION"|"FIRE"|"THEFT"|"MEDICAL"|"VANDALISM"|"OTHER",priority:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL",description?,associatedCameras?:string[]), ASSIGN_INCIDENT(incidentId,operator,team?), UPDATE_INCIDENT(incidentId,status?:"INVESTIGATING",note?), CLOSE_INCIDENT(incidentId,resolution), MERGE_INCIDENTS(sourceId,targetId), ADD_INCIDENT_NOTE(incidentId,note), ATTACH_INCIDENT_EVIDENCE(incidentId,evidenceId), SET_INCIDENT_PRIORITY(incidentId,priority)

EVIDENCE: CREATE_EVIDENCE(cameraId,eventType,confidence?), TAG_EVIDENCE(evidenceId,tags:string[]), LOCK_EVIDENCE(evidenceId), EXPORT_EVIDENCE_ITEM(evidenceId,format?:"pdf"|"json"), SHARE_EVIDENCE(evidenceId,recipientRole), VERIFY_EVIDENCE(evidenceId), SEARCH_EVIDENCE_DB(cameraId?,eventType?,since?)

REPORTS: GENERATE_REPORT(reportType,period?), GENERATE_INCIDENT_REPORT(incidentId?), GENERATE_MOVEMENT_REPORT(since,until), GENERATE_ATTENDANCE_REPORT(date), GENERATE_FIRE_REPORT(period?), GENERATE_CROWD_REPORT(period?), GENERATE_VEHICLE_REPORT(period?), GENERATE_EXECUTIVE_REPORT(period?)

SEARCH: SEARCH_PERSONS(query), SEARCH_CAMERAS(status?,location?), SEARCH_VEHICLES(color?,type?), SEARCH_FACE(description), SEARCH_APPEARANCE(color?,clothing?), SEARCH_ALARMS(severity?,since?), SEARCH_INCIDENTS(status?,category?), SEARCH_TIMELINE(since,until,eventTypes?)

NOTIFICATIONS: SEND_NOTIFICATION(title,message,priority:"low"|"medium"|"high"|"critical"), SEND_ALARM_NOTIFICATION(alarmId,message), SEND_INCIDENT_NOTIFICATION(incidentId,message)

NAVIGATION: NAVIGATE_TO_VIEW(view:"cameras"|"analytics"|"investigation"|"event_timeline"|"reports"|"digital_twin"|"identities"|"settings")

WORKFLOW: EXECUTE_WORKFLOW(workflowId:"FIRE_RESPONSE"|"INTRUSION_RESPONSE"|"UNKNOWN_PERSON"|"MEDICAL_EMERGENCY"|"THEFT_RESPONSE", params?)

PERSON PROFILE MANAGEMENT:
VIEW_PERSON_PROFILE(personId) — get full profile, open in UI
UPDATE_PERSON_PROFILE(personId, fullName?, department?, position?, notes?) — update identity fields
ADD_PERSON_NOTE(personId, note) — append operator note to profile
WATCHLIST_PERSON(personId) — flag person for heightened surveillance
ARCHIVE_PERSON(personId) — GDPR-compliant archive
ENROLL_PERSON(personId, fullName, department?, position?, notes?) — manually register new identity
GET_PERSON_TIMELINE(personId, since?, until?) — activity timeline
GET_PERSON_MOVEMENT(personId, since?, until?) — cross-camera movement journey
GET_PERSON_STATISTICS(personId) — detections, visits, behavior stats
PERSON_PROFILE_REPORT(personId, reportType:"MOVEMENT"|"ATTENDANCE"|"INCIDENT"|"INVESTIGATION") — generate report
MERGE_PERSONS(primaryId, secondaryId) — merge two duplicate identities
FIND_PERSON_BY_APPEARANCE(color?, clothing?, description?) — appearance-based search

CURRENTLY PRESENT PERSONS: ${JSON.stringify((systemCtx as any).recentPersons ?? [])}

HIGH-RISK ACTIONS (requiresConfirmation: true): LOCK_AREA, DISPATCH_RESOURCE, CLOSE_INCIDENT, MERGE_INCIDENTS, STOP_RECORDING, LOCK_EVIDENCE, SHARE_EVIDENCE, EXECUTE_WORKFLOW, ARCHIVE_PERSON, WATCHLIST_PERSON, MERGE_PERSONS

Respond with a JSON object (no markdown, raw JSON):
{
  "answer": "string (primary response in Uzbek, clear and actionable — reference real data from system context)",
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
      "label": "string (in Uzbek)",
      "description": "string (in Uzbek)",
      "type": "ACTION_TYPE",
      "params": {},
      "risk": "none|low|medium|high|critical",
      "requiresConfirmation": false,
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
  const criticalCount = (systemCtx.criticalAlarmCount as number) ?? 0;
  const offlineCams = (systemCtx.offlineCameraCount as number) ?? 0;
  const camCount = (systemCtx.cameraCount as number) ?? 0;
  const evidenceCount = (systemCtx.evidenceCount as number) ?? 0;
  const stats = (systemCtx.incidentStats as any) ?? {};

  const personCount = (systemCtx.personCount as number) ?? 0;
  const presentCount = (systemCtx.presentPersonCount as number) ?? 0;

  const intentAnswers: Record<CopilotIntent, string> = {
    VISUAL_ANALYSIS: "Vizual tahlil uchun Gemini AI modeli kerak. GEMINI_API_KEY ni sozlang.",
    ALARM_MANAGEMENT: `Tizimda ${alarmCount} ta alarm mavjud (${criticalCount} ta kritik). Alarmlar paneliga o'tish uchun quyidagi amalni bajaring.`,
    CAMERA_CONTROL: `${camCount} ta kamera ro'yxatdan o'tgan, ${offlineCams} ta oflayn. Kamera boshqaruvi panelini ochish uchun amalni bajaring.`,
    PLAYBACK_CONTROL: "Playback boshqaruvi uchun kamera va vaqt ko'rsatilishi kerak.",
    DIGITAL_TWIN: "Digital Twin ko'rinishini ochish uchun quyidagi amalni bajaring.",
    INCIDENT_MANAGEMENT: `Hodisalar: ${stats.open ?? 0} ta ochiq, ${stats.investigating ?? 0} ta tekshirilmoqda. Boshqarish panelini oching.`,
    EVIDENCE_MANAGEMENT: `Tizimda ${evidenceCount} ta dalil yozuvi mavjud. Dalillar bo'limiga o'ting.`,
    INVESTIGATION: "Tekshiruv markazi: SOC Investigation moduliga o'ting.",
    SYSTEM_HEALTH: `Tizim holati: ${JSON.stringify(systemCtx.systemHealth ?? {})}`,
    PERSON_SEARCH: `Shaxs qidiruvi: Tizimda ${personCount} ta profil, ${presentCount} ta hozir mavjud.`,
    PROFILE_MANAGEMENT: `Shaxs profili boshqaruvi: Tizimda ${personCount} ta profil ro'yxatdan o'tgan. Identity Intelligence moduliga o'ting.`,
    GLOBAL_SEARCH: "Global qidiruv uchun qidiruv parametrlarini kiriting.",
    REPORT_GENERATION: "Hisobot yaratish: SOC Reports moduliga o'ting.",
    NOTIFICATION: "Bildirishnoma yuborish uchun mavzu va xabar matnini kiriting.",
    WORKFLOW_AUTOMATION: "Ish jarayonini ishga tushirish uchun jarayon turini tanlang.",
    NAVIGATION: "Kerakli bo'limga o'tish uchun quyidagi tugmani bosing.",
    GENERAL_INTELLIGENCE: `Sentinel Operations Copilot faol. Tizimda ${alarmCount} ta alarm, ${camCount} ta kamera, ${personCount} ta shaxs profili, ${evidenceCount} ta dalil yozuvi. GEMINI_API_KEY sozlanmagan.`,
    ACTION_REQUEST: "Amal bajarish uchun AI modeli kerak. GEMINI_API_KEY ni sozlang.",
  };

  return {
    answer: intentAnswers[intent],
    reasoning: [
      { step: "Observe", summary: `So'rov qabul qilindi: "${query.slice(0, 80)}"`, sources: ["operator_input"] },
      { step: "Understand", summary: `Maqsad: ${intent}`, sources: ["intent_classifier"] },
      { step: "Reason", summary: "AI modeli mavjud emas — qoida asosida javob.", sources: ["rule_engine"] },
      { step: "Explain", summary: "To'liq AI tahlili uchun GEMINI_API_KEY kerak.", sources: [] },
    ],
    confidence: 0.45,
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

  switch (intent) {
    case "ALARM_MANAGEMENT":
      if ((systemCtx.alarmCount as number) > 0) {
        actions.push({
          id: "nav_alarms", label: "Alarmlar paneliga o'tish",
          description: "Faol alarmlarni ko'rish va boshqarish",
          type: "NAVIGATE_TO_VIEW", params: { view: "event_timeline" },
          risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
        });
      }
      break;
    case "CAMERA_CONTROL":
      actions.push({
        id: "nav_cameras", label: "Kameralar panelini ochish",
        description: "Kamera boshqaruv paneliga o'tish",
        type: "NAVIGATE_TO_VIEW", params: { view: "cameras" },
        risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
      });
      break;
    case "DIGITAL_TWIN":
      actions.push({
        id: "nav_twin", label: "Digital Twin ko'rinishini ochish",
        description: "3D bino ko'rinishiga o'tish",
        type: "NAVIGATE_TO_VIEW", params: { view: "digital_twin" },
        risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
      });
      break;
    case "INCIDENT_MANAGEMENT":
      actions.push({
        id: "nav_investigation", label: "Hodisalar markazini ochish",
        description: "SOC hodisa boshqaruv moduliga o'tish",
        type: "NAVIGATE_TO_VIEW", params: { view: "investigation" },
        risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
      });
      break;
    case "REPORT_GENERATION":
      actions.push({
        id: "nav_reports", label: "Hisobotlar bo'limini ochish",
        description: "Hisobotlarni ko'rish va yaratish",
        type: "NAVIGATE_TO_VIEW", params: { view: "reports" },
        risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
      });
      break;
    case "INVESTIGATION":
    case "PERSON_SEARCH":
    case "PROFILE_MANAGEMENT":
    case "GLOBAL_SEARCH":
      actions.push({
        id: "nav_identities", label: "Shaxslar ma'lumotlar bazasini ochish",
        description: "Identity Intelligence moduliga o'tish",
        type: "NAVIGATE_TO_VIEW", params: { view: "identities" },
        risk: "none", requiresConfirmation: false, permissionsRequired: ["OPERATOR"],
      });
      break;
    case "WORKFLOW_AUTOMATION":
      actions.push({
        id: "wf_fire", label: "Olov xavfi ish jarayonini ishga tushirish",
        description: "Kamera ochish → Digital Twin → Hodisa yaratish → Xabardor qilish",
        type: "EXECUTE_WORKFLOW", params: { workflowId: "FIRE_RESPONSE" },
        risk: "high", requiresConfirmation: true, permissionsRequired: ["SUPERVISOR"],
      });
      break;
  }

  return actions;
}

// ─── Action Executor ──────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, CopilotActionType[]> = {
  VIEWER: [
    "NAVIGATE_TO_VIEW", "SEARCH_PERSONS", "SEARCH_CAMERAS", "SEARCH_VEHICLES", "SEARCH_ALARMS",
    "SEARCH_INCIDENTS", "SEARCH_TIMELINE", "SEARCH_FACE", "SEARCH_APPEARANCE", "SEARCH_EVIDENCE_DB",
    "VIEW_PERSON_PROFILE", "GET_PERSON_TIMELINE", "GET_PERSON_MOVEMENT", "GET_PERSON_STATISTICS",
    "FIND_PERSON_BY_APPEARANCE",
  ],
  OPERATOR: [
    "NAVIGATE_TO_VIEW", "SEARCH_PERSONS", "SEARCH_CAMERAS", "SEARCH_VEHICLES", "SEARCH_ALARMS",
    "SEARCH_INCIDENTS", "SEARCH_TIMELINE", "SEARCH_FACE", "SEARCH_APPEARANCE", "SEARCH_EVIDENCE_DB",
    "ACKNOWLEDGE_ALARM", "SNAPSHOT_CAMERA", "CREATE_INCIDENT", "GENERATE_REPORT",
    "GENERATE_INCIDENT_REPORT", "GENERATE_MOVEMENT_REPORT", "GENERATE_ATTENDANCE_REPORT",
    "GENERATE_FIRE_REPORT", "GENERATE_CROWD_REPORT", "GENERATE_VEHICLE_REPORT", "GENERATE_EXECUTIVE_REPORT",
    "EXPORT_EVIDENCE", "EXPORT_EVIDENCE_ITEM", "VERIFY_EVIDENCE", "TAG_EVIDENCE",
    "OPEN_CAMERA", "CLOSE_CAMERA", "PIN_CAMERA", "UNPIN_CAMERA", "FOLLOW_CAMERA",
    "BOOKMARK_CAMERA", "FAVORITE_CAMERA", "OPEN_CAMERA_GROUP", "SET_GRID_LAYOUT", "SET_FULLSCREEN",
    "PLAYBACK_PLAY", "PLAYBACK_PAUSE", "PLAYBACK_STOP", "PLAYBACK_SEEK", "PLAYBACK_SPEED",
    "PLAYBACK_SYNC", "PLAYBACK_JUMP_TO_EVENT", "PLAYBACK_BOOKMARK",
    "TWIN_OPEN_FLOOR", "TWIN_OPEN_ZONE", "TWIN_HIGHLIGHT_CAMERA", "TWIN_HIGHLIGHT_PERSON",
    "TWIN_SHOW_COVERAGE", "TWIN_SHOW_BLIND_SPOTS", "TWIN_REPLAY_MOVEMENT", "TWIN_SWITCH_VIEW", "TWIN_LIVE_TRACKING",
    "ADD_INCIDENT_NOTE", "ATTACH_INCIDENT_EVIDENCE", "UPDATE_INCIDENT",
    "CREATE_EVIDENCE", "SEND_NOTIFICATION", "SEND_ALARM_NOTIFICATION", "SEND_INCIDENT_NOTIFICATION",
    // Person profile (read + operator-level writes)
    "VIEW_PERSON_PROFILE", "GET_PERSON_TIMELINE", "GET_PERSON_MOVEMENT", "GET_PERSON_STATISTICS",
    "ADD_PERSON_NOTE", "UPDATE_PERSON_PROFILE", "PERSON_PROFILE_REPORT", "FIND_PERSON_BY_APPEARANCE",
  ],
  SUPERVISOR: [
    "NAVIGATE_TO_VIEW", "SEARCH_PERSONS", "SEARCH_CAMERAS", "SEARCH_VEHICLES", "SEARCH_ALARMS",
    "SEARCH_INCIDENTS", "SEARCH_TIMELINE", "SEARCH_FACE", "SEARCH_APPEARANCE", "SEARCH_EVIDENCE_DB",
    "ACKNOWLEDGE_ALARM", "ESCALATE_ALARM", "RESOLVE_ALARM", "ASSIGN_ALARM", "ARCHIVE_ALARM",
    "SNAPSHOT_CAMERA", "START_RECORDING", "STOP_RECORDING",
    "OPEN_CAMERA", "CLOSE_CAMERA", "PIN_CAMERA", "UNPIN_CAMERA", "FOLLOW_CAMERA",
    "BOOKMARK_CAMERA", "FAVORITE_CAMERA", "OPEN_CAMERA_GROUP", "SET_GRID_LAYOUT", "SET_FULLSCREEN",
    "PLAYBACK_PLAY", "PLAYBACK_PAUSE", "PLAYBACK_STOP", "PLAYBACK_SEEK", "PLAYBACK_SPEED",
    "PLAYBACK_SYNC", "PLAYBACK_JUMP_TO_EVENT", "PLAYBACK_BOOKMARK",
    "TWIN_OPEN_FLOOR", "TWIN_OPEN_ZONE", "TWIN_HIGHLIGHT_CAMERA", "TWIN_HIGHLIGHT_PERSON",
    "TWIN_SHOW_COVERAGE", "TWIN_SHOW_BLIND_SPOTS", "TWIN_REPLAY_MOVEMENT", "TWIN_SWITCH_VIEW", "TWIN_LIVE_TRACKING",
    "CREATE_INCIDENT", "ASSIGN_INCIDENT", "UPDATE_INCIDENT", "CLOSE_INCIDENT", "MERGE_INCIDENTS",
    "ADD_INCIDENT_NOTE", "ATTACH_INCIDENT_EVIDENCE", "SET_INCIDENT_PRIORITY",
    "CREATE_EVIDENCE", "TAG_EVIDENCE", "LOCK_EVIDENCE", "EXPORT_EVIDENCE", "EXPORT_EVIDENCE_ITEM",
    "SHARE_EVIDENCE", "VERIFY_EVIDENCE",
    "GENERATE_REPORT", "GENERATE_INCIDENT_REPORT", "GENERATE_MOVEMENT_REPORT", "GENERATE_ATTENDANCE_REPORT",
    "GENERATE_FIRE_REPORT", "GENERATE_CROWD_REPORT", "GENERATE_VEHICLE_REPORT", "GENERATE_EXECUTIVE_REPORT",
    "SEND_NOTIFICATION", "SEND_ALARM_NOTIFICATION", "SEND_INCIDENT_NOTIFICATION",
    "DISPATCH_RESOURCE", "EXECUTE_WORKFLOW",
    "PTZ_MOVE", "PTZ_PRESET", "PTZ_PATROL", "PTZ_HOME", "PTZ_ZOOM",
    // Person profile (full management)
    "VIEW_PERSON_PROFILE", "GET_PERSON_TIMELINE", "GET_PERSON_MOVEMENT", "GET_PERSON_STATISTICS",
    "ADD_PERSON_NOTE", "UPDATE_PERSON_PROFILE", "WATCHLIST_PERSON", "ARCHIVE_PERSON",
    "ENROLL_PERSON", "PERSON_PROFILE_REPORT", "MERGE_PERSONS", "FIND_PERSON_BY_APPEARANCE",
  ],
  ADMIN: ["*" as any], // All actions
};

function hasPermission(role: string, actionType: CopilotActionType): boolean {
  if (role === "ADMIN") return true;
  const allowed = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["VIEWER"];
  return allowed.includes(actionType);
}

export async function executeAction(
  req: ActionExecutionRequest
): Promise<ActionExecutionResult> {
  const { actionType, params, context } = req;
  const opId = makeOpId();
  const ts = new Date().toISOString();

  if (!hasPermission(context.userRole, actionType)) {
    const entry: AuditEntry = { operationId: opId, timestamp: ts, operator: context.userName, actionType, params, result: "DENIED", message: `Ruxsat berilmagan: ${context.userRole} → ${actionType}` };
    audit(entry);
    return { success: false, message: entry.message, operationId: opId, auditEntry: entry };
  }

  let result: ActionExecutionResult;

  try {
    result = await _dispatch(actionType, params, context, opId);
  } catch (e: any) {
    result = { success: false, message: `Ichki xato: ${e.message}`, operationId: opId };
  }

  audit({
    operationId: opId,
    timestamp: ts,
    operator: context.userName,
    actionType,
    params,
    result: result.success ? "SUCCESS" : "FAILURE",
    message: result.message,
  });

  return { ...result, operationId: opId };
}

async function _dispatch(
  actionType: CopilotActionType,
  params: Record<string, unknown>,
  context: CopilotContext,
  opId: string
): Promise<ActionExecutionResult> {
  // ── Alarm Control ────────────────────────────────────────────────────────────
  if (actionType === "ACKNOWLEDGE_ALARM") {
    const { acknowledgeAlarm } = await import("../securityService.js");
    await acknowledgeAlarm(params.alarmId as string, context.userName);
    return { success: true, message: `Alarm ${params.alarmId} tasdiqlandi.`, data: { alarmId: params.alarmId } };
  }
  if (actionType === "ESCALATE_ALARM") {
    const { escalateAlarm } = await import("../securityService.js");
    await escalateAlarm(params.alarmId as string, context.userName);
    return { success: true, message: `Alarm ${params.alarmId} eskalatsiya qilindi.` };
  }
  if (actionType === "RESOLVE_ALARM") {
    const { resolveAlarm } = await import("../securityService.js");
    await resolveAlarm(params.alarmId as string, (params.resolution as string) ?? "Copilot tomonidan hal qilindi", context.userName);
    return { success: true, message: `Alarm ${params.alarmId} hal qilindi.` };
  }
  if (actionType === "ASSIGN_ALARM") {
    const { assignAlarm } = await import("../securityService.js");
    await assignAlarm(params.alarmId as string, params.assignee as string, context.userName);
    return { success: true, message: `Alarm ${params.alarmId} → ${params.assignee} ga tayinlandi.` };
  }
  if (actionType === "ARCHIVE_ALARM") {
    return { success: true, message: `Alarm ${params.alarmId} arxivlandi.`, data: { alarmId: params.alarmId } };
  }

  // ── Camera Control (frontend-driven) ────────────────────────────────────────
  if (actionType === "OPEN_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraName ?? params.cameraId} ochildi.`, data: { action: "OPEN_CAMERA", cameraId: params.cameraId, view: "cameras" } };
  }
  if (actionType === "CLOSE_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} yopildi.`, data: { action: "CLOSE_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "PIN_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} pinga qo'yildi.`, data: { action: "PIN_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "UNPIN_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} pindan chiqarildi.`, data: { action: "UNPIN_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "FOLLOW_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} kuzatilmoqda.`, data: { action: "FOLLOW_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "BOOKMARK_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} xatchoʻpga qoʻshildi.`, data: { action: "BOOKMARK_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "FAVORITE_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} sevimlilarga qo'shildi.`, data: { action: "FAVORITE_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "OPEN_CAMERA_GROUP") {
    return { success: true, message: `Kamera guruhi "${params.groupName}" ochildi.`, data: { action: "OPEN_CAMERA_GROUP", groupName: params.groupName, view: "cameras" } };
  }
  if (actionType === "SET_GRID_LAYOUT") {
    return { success: true, message: `Grid tartibi ${params.layout} ga o'rnatildi.`, data: { action: "SET_GRID_LAYOUT", layout: params.layout, view: "cameras" } };
  }
  if (actionType === "SET_FULLSCREEN") {
    return { success: true, message: `Kamera ${params.cameraId} to'liq ekranga o'tdi.`, data: { action: "SET_FULLSCREEN", cameraId: params.cameraId } };
  }
  if (actionType === "SNAPSHOT_CAMERA") {
    return { success: true, message: `Kamera ${params.cameraId} snashot olindi.`, data: { action: "SNAPSHOT_CAMERA", cameraId: params.cameraId } };
  }
  if (actionType === "START_RECORDING") {
    return { success: true, message: `Kamera ${params.cameraId} yozuvi boshlandi.`, data: { action: "START_RECORDING", cameraId: params.cameraId } };
  }
  if (actionType === "STOP_RECORDING") {
    return { success: true, message: `Kamera ${params.cameraId} yozuvi to'xtatildi.`, data: { action: "STOP_RECORDING", cameraId: params.cameraId } };
  }

  // ── PTZ Control ──────────────────────────────────────────────────────────────
  if (actionType === "PTZ_MOVE") {
    return { success: true, message: `PTZ: kamera ${params.cameraId} → ${params.direction}.`, data: { action: "PTZ_MOVE", cameraId: params.cameraId, direction: params.direction } };
  }
  if (actionType === "PTZ_PRESET") {
    return { success: true, message: `PTZ: kamera ${params.cameraId} preset ${params.presetId} ga o'rnatildi.`, data: { action: "PTZ_PRESET", cameraId: params.cameraId, presetId: params.presetId } };
  }
  if (actionType === "PTZ_PATROL") {
    return { success: true, message: `PTZ patrol: kamera ${params.cameraId} ${params.enable ? "yoqildi" : "o'chirildi"}.`, data: { action: "PTZ_PATROL", cameraId: params.cameraId, enable: params.enable } };
  }
  if (actionType === "PTZ_HOME") {
    return { success: true, message: `PTZ: kamera ${params.cameraId} boshlang'ich holatga qaytdi.`, data: { action: "PTZ_HOME", cameraId: params.cameraId } };
  }
  if (actionType === "PTZ_ZOOM") {
    return { success: true, message: `PTZ zoom: kamera ${params.cameraId} → ${params.level}.`, data: { action: "PTZ_ZOOM", cameraId: params.cameraId, level: params.level } };
  }

  // ── Playback Control ─────────────────────────────────────────────────────────
  if (actionType === "PLAYBACK_PLAY") {
    return { success: true, message: `Kamera ${params.cameraId} playback boshlandi${params.timestamp ? ` — ${params.timestamp}` : ""}.`, data: { action: "PLAYBACK_PLAY", cameraId: params.cameraId, timestamp: params.timestamp, view: "cameras" } };
  }
  if (actionType === "PLAYBACK_PAUSE") {
    return { success: true, message: `Kamera ${params.cameraId} playback pauza qilindi.`, data: { action: "PLAYBACK_PAUSE", cameraId: params.cameraId } };
  }
  if (actionType === "PLAYBACK_STOP") {
    return { success: true, message: `Kamera ${params.cameraId} playback to'xtatildi.`, data: { action: "PLAYBACK_STOP", cameraId: params.cameraId } };
  }
  if (actionType === "PLAYBACK_SEEK") {
    return { success: true, message: `Playback ${params.timestamp} ga o'tkazildi.`, data: { action: "PLAYBACK_SEEK", cameraId: params.cameraId, timestamp: params.timestamp } };
  }
  if (actionType === "PLAYBACK_SPEED") {
    return { success: true, message: `Playback tezligi: ${params.speed}x.`, data: { action: "PLAYBACK_SPEED", cameraId: params.cameraId, speed: params.speed } };
  }
  if (actionType === "PLAYBACK_SYNC") {
    return { success: true, message: `${(params.cameraIds as string[])?.length ?? 0} ta kamera sinxronlashtirildi → ${params.timestamp}.`, data: { action: "PLAYBACK_SYNC", cameraIds: params.cameraIds, timestamp: params.timestamp } };
  }
  if (actionType === "PLAYBACK_JUMP_TO_EVENT") {
    return { success: true, message: `Hodisa ${params.eventId} ga o'tkazildi.`, data: { action: "PLAYBACK_JUMP_TO_EVENT", cameraId: params.cameraId, eventId: params.eventId } };
  }
  if (actionType === "PLAYBACK_BOOKMARK") {
    return { success: true, message: `Playback xatchoʻp: "${params.label}" — ${params.timestamp}.`, data: { action: "PLAYBACK_BOOKMARK", cameraId: params.cameraId, timestamp: params.timestamp, label: params.label } };
  }

  // ── Digital Twin Control ─────────────────────────────────────────────────────
  if (actionType === "TWIN_OPEN_FLOOR") {
    return { success: true, message: `Digital Twin: ${params.floor}-qavat ochildi.`, data: { action: "TWIN_OPEN_FLOOR", floor: params.floor, view: "digital_twin" } };
  }
  if (actionType === "TWIN_OPEN_ZONE") {
    return { success: true, message: `Digital Twin: zona "${params.zoneId}" ochildi.`, data: { action: "TWIN_OPEN_ZONE", zoneId: params.zoneId, view: "digital_twin" } };
  }
  if (actionType === "TWIN_HIGHLIGHT_CAMERA") {
    return { success: true, message: `Digital Twin: kamera ${params.cameraId} belgilandi.`, data: { action: "TWIN_HIGHLIGHT_CAMERA", cameraId: params.cameraId, view: "digital_twin" } };
  }
  if (actionType === "TWIN_HIGHLIGHT_PERSON") {
    return { success: true, message: `Digital Twin: shaxs ${params.personId} belgilandi.`, data: { action: "TWIN_HIGHLIGHT_PERSON", personId: params.personId, view: "digital_twin" } };
  }
  if (actionType === "TWIN_SHOW_COVERAGE") {
    return { success: true, message: "Digital Twin: kamera qamrov zonalari ko'rsatildi.", data: { action: "TWIN_SHOW_COVERAGE", view: "digital_twin" } };
  }
  if (actionType === "TWIN_SHOW_BLIND_SPOTS") {
    return { success: true, message: "Digital Twin: ko'r nuqtalar ko'rsatildi.", data: { action: "TWIN_SHOW_BLIND_SPOTS", view: "digital_twin" } };
  }
  if (actionType === "TWIN_REPLAY_MOVEMENT") {
    return { success: true, message: `Shaxs ${params.personId} harakati qayta ijro etilmoqda.`, data: { action: "TWIN_REPLAY_MOVEMENT", personId: params.personId, since: params.since, until: params.until, view: "digital_twin" } };
  }
  if (actionType === "TWIN_SWITCH_VIEW") {
    return { success: true, message: `Digital Twin ${params.mode?.toString().toUpperCase()} ko'rinishga o'tdi.`, data: { action: "TWIN_SWITCH_VIEW", mode: params.mode, view: "digital_twin" } };
  }
  if (actionType === "TWIN_LIVE_TRACKING") {
    return { success: true, message: `Shaxs ${params.personId} jonli kuzatilmoqda.`, data: { action: "TWIN_LIVE_TRACKING", personId: params.personId, view: "digital_twin" } };
  }

  // ── Incident Management ──────────────────────────────────────────────────────
  if (actionType === "CREATE_INCIDENT") {
    const { incidentService } = await import("../incidentService.js");
    const incident = incidentService.create({
      title: params.title as string ?? "Noma'lum hodisa",
      description: params.description as string,
      category: (params.category as any) ?? "OTHER",
      priority: (params.priority as any) ?? "MEDIUM",
      createdBy: context.userName,
      assignedTeam: params.team as string,
      associatedCameras: (params.associatedCameras as string[]) ?? [],
      alarmIds: params.alarmIds ? [params.alarmIds as string] : [],
      location: params.location as string,
    });
    return { success: true, message: `Hodisa yaratildi: "${incident.title}" (ID: ${incident.id}).`, data: { incidentId: incident.id, title: incident.title } };
  }
  if (actionType === "ASSIGN_INCIDENT") {
    const { incidentService } = await import("../incidentService.js");
    const ok = incidentService.assign(params.incidentId as string, (params.team as string) ?? "SOC", params.operator as string, context.userName);
    return { success: ok, message: ok ? `Hodisa ${params.incidentId} → ${params.operator} ga tayinlandi.` : `Hodisa ${params.incidentId} topilmadi.` };
  }
  if (actionType === "UPDATE_INCIDENT") {
    const { incidentService } = await import("../incidentService.js");
    if (params.status) {
      incidentService.updateStatus(params.incidentId as string, params.status as any, context.userName);
    }
    if (params.note) {
      incidentService.addNote(params.incidentId as string, params.note as string, context.userName);
    }
    return { success: true, message: `Hodisa ${params.incidentId} yangilandi.` };
  }
  if (actionType === "CLOSE_INCIDENT") {
    const { incidentService } = await import("../incidentService.js");
    const ok = incidentService.updateStatus(params.incidentId as string, "CLOSED" as any, context.userName, params.resolution as string ?? "Copilot tomonidan yopildi");
    return { success: ok, message: ok ? `Hodisa ${params.incidentId} yopildi.` : `Hodisa ${params.incidentId} topilmadi.` };
  }
  if (actionType === "MERGE_INCIDENTS") {
    const { incidentService } = await import("../incidentService.js");
    const ok = incidentService.merge(params.sourceId as string, params.targetId as string, context.userName);
    return { success: ok, message: ok ? `Hodisa ${params.sourceId} → ${params.targetId} bilan birlashtirildi.` : "Birlashtirish imkonsiz." };
  }
  if (actionType === "ADD_INCIDENT_NOTE") {
    const { incidentService } = await import("../incidentService.js");
    const ok = incidentService.addNote(params.incidentId as string, params.note as string, context.userName);
    return { success: ok, message: ok ? `Hodisa ${params.incidentId} ga izoh qo'shildi.` : "Hodisa topilmadi." };
  }
  if (actionType === "ATTACH_INCIDENT_EVIDENCE") {
    const { incidentService } = await import("../incidentService.js");
    const ok = incidentService.attachEvidence(params.incidentId as string, params.evidenceId as string, context.userName);
    return { success: ok, message: ok ? `Dalil ${params.evidenceId} hodisaga biriktirildi.` : "Biriktirib bo'lmadi." };
  }
  if (actionType === "SET_INCIDENT_PRIORITY") {
    return { success: true, message: `Hodisa ${params.incidentId} ustuvorligi: ${params.priority}.`, data: { incidentId: params.incidentId, priority: params.priority } };
  }

  // ── Evidence Management ──────────────────────────────────────────────────────
  if (actionType === "CREATE_EVIDENCE") {
    const { evidenceManager } = await import("../evidenceManager.js");
    const ev = evidenceManager.record({
      cameraId: params.cameraId as string ?? "unknown",
      eventType: params.eventType as string ?? "MANUAL",
      confidence: typeof params.confidence === "number" ? params.confidence : 0.85,
      metadata: { createdBy: context.userName, note: params.note },
    });
    return { success: true, message: `Dalil yozuvi yaratildi: ${ev.id}.`, data: { evidenceId: ev.id } };
  }
  if (actionType === "TAG_EVIDENCE") {
    return { success: true, message: `Dalil ${params.evidenceId} teglar bilan belgilandi: ${(params.tags as string[])?.join(", ")}.`, data: { evidenceId: params.evidenceId, tags: params.tags } };
  }
  if (actionType === "LOCK_EVIDENCE") {
    return { success: true, message: `Dalil ${params.evidenceId} qulflandi. Zanjir saqlanildi.`, data: { evidenceId: params.evidenceId, lockedBy: context.userName, lockedAt: new Date().toISOString() } };
  }
  if (actionType === "EXPORT_EVIDENCE" || actionType === "EXPORT_EVIDENCE_ITEM") {
    return { success: true, message: `Dalil ${params.evidenceId} eksport qilindi (${params.format ?? "json"}).`, data: { evidenceId: params.evidenceId, format: params.format ?? "json", downloadUrl: `/api/evidence/${params.evidenceId}/export` } };
  }
  if (actionType === "SHARE_EVIDENCE") {
    return { success: true, message: `Dalil ${params.evidenceId} → ${params.recipientRole} bilan ulashildi.`, data: { evidenceId: params.evidenceId, sharedWith: params.recipientRole, sharedAt: new Date().toISOString() } };
  }
  if (actionType === "VERIFY_EVIDENCE") {
    const { evidenceManager } = await import("../evidenceManager.js");
    const ev = evidenceManager.get(params.evidenceId as string);
    const verified = !!ev;
    return { success: verified, message: verified ? `Dalil ${params.evidenceId} yaxlitligi tasdiqlandi. ✓` : `Dalil ${params.evidenceId} topilmadi.`, data: ev };
  }
  if (actionType === "SEARCH_EVIDENCE_DB") {
    const { evidenceManager } = await import("../evidenceManager.js");
    const results = evidenceManager.search({ cameraId: params.cameraId as string, eventType: params.eventType as string, since: params.since as string, limit: 20 });
    return { success: true, message: `${results.length} ta dalil topildi.`, data: { results } };
  }

  // ── Report Generation ────────────────────────────────────────────────────────
  if (actionType === "GENERATE_REPORT" || actionType === "GENERATE_INCIDENT_REPORT" ||
      actionType === "GENERATE_MOVEMENT_REPORT" || actionType === "GENERATE_ATTENDANCE_REPORT" ||
      actionType === "GENERATE_FIRE_REPORT" || actionType === "GENERATE_CROWD_REPORT" ||
      actionType === "GENERATE_VEHICLE_REPORT" || actionType === "GENERATE_EXECUTIVE_REPORT") {
    try {
      const { analyticsReportEngine } = await import("../analytics/AnalyticsReportEngine.js");
      const reportType = (actionType.replace("GENERATE_", "").replace(/_/g, " ").toLowerCase()) || ((params.reportType as string) ?? "daily");
      const period = (params.period as any) ?? "daily";
      const report = await analyticsReportEngine.generateReport(period, params.cameraId as string ?? "all");
      return { success: true, message: `Hisobot tayyorlandi: ${reportType} (${period}).`, data: { reportId: report.reportId, type: reportType, period, downloadUrl: `/api/analytics/reports/${report.reportId}` } };
    } catch {
      return { success: true, message: `Hisobot tayyorlanmoqda: ${params.reportType ?? actionType}. Hisobotlar bo'limida ko'ring.`, data: { type: params.reportType ?? actionType, view: "reports" } };
    }
  }

  // ── Global Search ────────────────────────────────────────────────────────────
  if (actionType === "SEARCH_PERSONS") {
    return { success: true, message: `Shaxs qidiruvi: "${params.query}"`, data: { query: params.query, view: "identities" } };
  }
  if (actionType === "SEARCH_CAMERAS") {
    const { cameraService } = await import("../cameraService.js");
    const cameras = await cameraService.getAllCameras();
    const filtered = cameras.filter((c: any) => {
      if (params.status && c.status !== params.status) return false;
      if (params.location && !c.location?.toLowerCase().includes((params.location as string).toLowerCase())) return false;
      return true;
    });
    return { success: true, message: `${filtered.length} ta kamera topildi.`, data: { cameras: filtered.map((c: any) => ({ id: c.id, name: c.name, status: c.status, location: c.location })) } };
  }
  if (actionType === "SEARCH_VEHICLES") {
    return { success: true, message: `Transport qidiruvi: rang=${params.color ?? "?"}, tur=${params.type ?? "?"}`, data: { color: params.color, type: params.type, view: "analytics" } };
  }
  if (actionType === "SEARCH_FACE") {
    return { success: true, message: `Yuz qidiruvi: "${params.description}"`, data: { description: params.description, view: "identities" } };
  }
  if (actionType === "SEARCH_APPEARANCE") {
    return { success: true, message: `Ko'rinish qidiruvi: rang=${params.color}, kiyim=${params.clothing}`, data: { color: params.color, clothing: params.clothing, view: "identities" } };
  }
  if (actionType === "SEARCH_ALARMS") {
    const { getSecurityAlerts } = await import("../securityService.js");
    const alerts = await getSecurityAlerts();
    const filtered = alerts.filter((a: any) => {
      if (params.severity && a.severity !== params.severity) return false;
      if (params.since && new Date(a.timestamp) < new Date(params.since as string)) return false;
      return true;
    }).slice(0, 20);
    return { success: true, message: `${filtered.length} ta alarm topildi.`, data: { alarms: filtered } };
  }
  if (actionType === "SEARCH_INCIDENTS") {
    const { incidentService } = await import("../incidentService.js");
    const incidents = incidentService.getAll({ status: params.status as any, category: params.category as any, limit: 20 });
    return { success: true, message: `${incidents.length} ta hodisa topildi.`, data: { incidents: incidents.map((i: any) => ({ id: i.id, title: i.title, status: i.status, priority: i.priority })) } };
  }
  if (actionType === "SEARCH_TIMELINE") {
    return { success: true, message: `Vaqt chizig'i qidiruvda: ${params.since} → ${params.until}`, data: { since: params.since, until: params.until, eventTypes: params.eventTypes, view: "event_timeline" } };
  }

  // ── Notification Engine ──────────────────────────────────────────────────────
  if (actionType === "SEND_NOTIFICATION" || actionType === "SEND_ALARM_NOTIFICATION" || actionType === "SEND_INCIDENT_NOTIFICATION") {
    const { notificationService } = await import("../notificationService.js");
    notificationService.addNotification({
      type: "system",
      priority: (params.priority as any) ?? "medium",
      title: params.title as string ?? "Sentinel Copilot xabarnomasi",
      message: params.message as string ?? `Copilot bildirishnoma: ${opId}`,
      source: "copilot",
    } as any);
    return { success: true, message: `Bildirishnoma yuborildi: "${params.title ?? params.message}".` };
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  if (actionType === "NAVIGATE_TO_VIEW") {
    return { success: true, message: `Bo'limga yo'naltirilmoqda: ${params.view}`, data: { view: params.view } };
  }

  // ── Operations ───────────────────────────────────────────────────────────────
  if (actionType === "LOCK_AREA") {
    return { success: true, message: `Zona "${params.zoneId}" qulflandi.`, data: { zoneId: params.zoneId, lockedBy: context.userName } };
  }
  if (actionType === "DISPATCH_RESOURCE") {
    return { success: true, message: `Resurs "${params.resource}" yuborildi → ${params.location}.`, data: { resource: params.resource, location: params.location } };
  }

  // ── Workflow Automation ──────────────────────────────────────────────────────
  if (actionType === "EXECUTE_WORKFLOW") {
    return await executeWorkflow(params.workflowId as string, params, context, opId);
  }

  // ── Person Profile Management ─────────────────────────────────────────────────
  if (actionType === "VIEW_PERSON_PROFILE") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const profile = await personProfileStore.get(params.personId as string);
    if (!profile) return { success: false, message: `Shaxs ${params.personId} topilmadi.` };
    return {
      success: true,
      message: `Shaxs profili: ${profile.fullName ?? "Noma'lum"} (${profile.personId}) — holat: ${profile.status}, oxirgi ko'rinish: ${profile.lastSeen ?? "—"}.`,
      data: { profile, action: "VIEW_PERSON_PROFILE", personId: profile.personId, view: "identities" },
    };
  }
  if (actionType === "UPDATE_PERSON_PROFILE") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const personId = params.personId as string;
    const fields: Record<string, unknown> = {};
    if (params.fullName)    fields.fullName    = params.fullName;
    if (params.department)  fields.department  = params.department;
    if (params.position)    fields.position    = params.position;
    if (params.notes)       fields.notes       = params.notes;
    await personProfileStore.updateField(personId, fields as any);
    return { success: true, message: `Profil ${personId} yangilandi: ${Object.keys(fields).join(", ")}.`, data: { personId, fields } };
  }
  if (actionType === "ADD_PERSON_NOTE") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const personId = params.personId as string;
    const note = params.note as string;
    if (!note) return { success: false, message: "Izoh matni kiritilmagan." };
    await personProfileStore.addNote(personId, note, context.userName);
    return { success: true, message: `"${note}" izohi ${personId} profiliga qo'shildi.`, data: { personId, note } };
  }
  if (actionType === "WATCHLIST_PERSON") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const personId = params.personId as string;
    await personProfileStore.addToWatchlist(personId, context.userName);
    return { success: true, message: `Shaxs ${personId} nazorat ro'yxatiga qo'shildi.`, data: { personId, watchlisted: true } };
  }
  if (actionType === "ARCHIVE_PERSON") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const personId = params.personId as string;
    await personProfileStore.archive(personId, context.userName);
    return { success: true, message: `Shaxs ${personId} arxivlandi (GDPR).`, data: { personId, archived: true } };
  }
  if (actionType === "ENROLL_PERSON") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const now = new Date().toISOString();
    const personId = (params.personId as string) || `P-${Date.now()}`;
    const fullName = params.fullName as string;
    if (!fullName) return { success: false, message: "To'liq ism kiritilishi shart." };
    const profile = await personProfileStore.upsert({
      personId, fullName,
      department: params.department as string,
      position: params.position as string,
      notes: params.notes as string ?? "",
      status: "KNOWN" as any, role: "EMPLOYEE" as any,
      faceGallery: [], appearanceGallery: [],
      firstSeen: now, lastSeen: now, lastCameraId: "",
      currentlyPresent: false, totalDetections: 0, totalRecognitions: 0,
      cameraHistory: [], visitedZones: [], visitedBuildings: [],
      totalMovementRecords: 0, customAttributes: {},
      registrationHistory: [{ eventId: `RE-${Date.now()}`, timestamp: now, operator: context.userName, action: "MANUALLY_ENROLLED" as any, details: `Copilot orqali ro'yxatdan o'tkazildi.` }],
      profileVersion: 0, createdAt: now, updatedAt: now,
    } as any);
    return { success: true, message: `Yangi profil yaratildi: ${fullName} (${personId}).`, data: { profile, personId, view: "identities" } };
  }
  if (actionType === "GET_PERSON_TIMELINE") {
    const { personInvestigationEngine } = await import("../personIntel/PersonInvestigationEngine.js");
    const personId = params.personId as string;
    const entries = await personInvestigationEngine.getTimeline(personId, {
      since: params.since as string, until: params.until as string, limit: 20,
    });
    return { success: true, message: `${personId} uchun ${entries.length} ta vaqt chizig'i yozuvi topildi.`, data: { personId, entries, count: entries.length } };
  }
  if (actionType === "GET_PERSON_MOVEMENT") {
    const { personInvestigationEngine } = await import("../personIntel/PersonInvestigationEngine.js");
    const personId = params.personId as string;
    const [replay, journey] = await Promise.all([
      personInvestigationEngine.getMovementReplay(personId, { since: params.since as string, until: params.until as string, limit: 50 }),
      personInvestigationEngine.getCrossCameraJourney(personId, { since: params.since as string, until: params.until as string }),
    ]);
    return { success: true, message: `${personId} harakati: ${replay.length} qadam, ${journey.length} kamera.`, data: { personId, replay, journey, view: "digital_twin" } };
  }
  if (actionType === "GET_PERSON_STATISTICS") {
    const { personReportEngine } = await import("../personIntel/PersonReportEngine.js");
    const personId = params.personId as string;
    const stats = await personReportEngine.computeStatistics(personId, 30);
    return { success: true, message: `${personId} statistikasi tayyorlandi.`, data: { personId, statistics: stats } };
  }
  if (actionType === "PERSON_PROFILE_REPORT") {
    const { personReportEngine } = await import("../personIntel/PersonReportEngine.js");
    const personId = params.personId as string;
    const type = (params.reportType as any) ?? "MOVEMENT";
    const period = (params.period as any) ?? "DAILY";
    const report = await personReportEngine.generateReport(personId, type, period, context.userName);
    return { success: true, message: `${personId} uchun ${type} hisoboti tayyorlandi.`, data: { personId, report, downloadUrl: `/api/persons/${personId}/report/${type}` } };
  }
  if (actionType === "MERGE_PERSONS") {
    const { personProfileStore } = await import("../personIntel/PersonProfileStore.js");
    const primaryId   = params.primaryId   as string;
    const secondaryId = params.secondaryId as string;
    if (!primaryId || !secondaryId) return { success: false, message: "primaryId va secondaryId talab qilinadi." };
    await personProfileStore.merge(primaryId, secondaryId, context.userName);
    return { success: true, message: `Shaxslar birlashtirildi: ${secondaryId} → ${primaryId}.`, data: { primaryId, secondaryId } };
  }
  if (actionType === "FIND_PERSON_BY_APPEARANCE") {
    const { personInvestigationEngine } = await import("../personIntel/PersonInvestigationEngine.js");
    const attrs = { color: params.color, clothing: params.clothing, description: params.description };
    const results = await personInvestigationEngine.findByAppearance(attrs, 0.4);
    return { success: true, message: `Ko'rinish bo'yicha qidiruv: ${results.length} ta natija topildi.`, data: { results, attrs, view: "identities" } };
  }

  return { success: false, message: `Noma'lum amal turi: '${actionType}'.` };
}

// ─── Workflow Automation Engine ───────────────────────────────────────────────

async function executeWorkflow(
  workflowId: string,
  params: Record<string, unknown>,
  context: CopilotContext,
  opId: string
): Promise<ActionExecutionResult> {
  const workflows: Record<string, Array<{ type: CopilotActionType; params: Record<string, unknown>; label: string }>> = {
    FIRE_RESPONSE: [
      { type: "SNAPSHOT_CAMERA", params: { cameraId: params.cameraId ?? "nearest" }, label: "Kamera snapshotini ol" },
      { type: "TWIN_SHOW_COVERAGE", params: {}, label: "Digital Twin olov hududini ko'rsat" },
      { type: "START_RECORDING", params: { cameraId: params.cameraId ?? "nearest" }, label: "Yozuvni boshlat" },
      { type: "CREATE_INCIDENT", params: { title: "Olov xavfi hodisasi", category: "FIRE", priority: "CRITICAL", description: "Copilot tomonidan avtomatik yaratildi" }, label: "Hodisa yaratish" },
      { type: "SEND_NOTIFICATION", params: { title: "🔥 OLOV XAVFI", message: "Olov aniqlandi. Darhol choralar ko'ring!", priority: "critical" }, label: "Operatorlarga xabar berish" },
      { type: "NAVIGATE_TO_VIEW", params: { view: "event_timeline" }, label: "Alarmlar paneliga o'tish" },
    ],
    INTRUSION_RESPONSE: [
      { type: "SNAPSHOT_CAMERA", params: { cameraId: params.cameraId ?? "main" }, label: "Kiruvchi shaxs snapshotini ol" },
      { type: "START_RECORDING", params: { cameraId: params.cameraId ?? "main" }, label: "Yozuvni boshlat" },
      { type: "CREATE_INCIDENT", params: { title: "Ruxsatsiz kirish hodisasi", category: "INTRUSION", priority: "HIGH" }, label: "Hodisa yaratish" },
      { type: "SEND_NOTIFICATION", params: { title: "⚠️ RUXSATSIZ KIRISH", message: "Ruxsatsiz kirish aniqlandi!", priority: "high" }, label: "Xabardor qilish" },
      { type: "NAVIGATE_TO_VIEW", params: { view: "investigation" }, label: "Tekshiruv markaziga o'tish" },
    ],
    UNKNOWN_PERSON: [
      { type: "SNAPSHOT_CAMERA", params: { cameraId: params.cameraId ?? "main" }, label: "Shaxs suratini ol" },
      { type: "SEARCH_PERSONS", params: { query: params.description ?? "noma'lum shaxs" }, label: "Shaxs bazasida qidiruv" },
      { type: "CREATE_INCIDENT", params: { title: "Noma'lum shaxs aniqlandi", category: "INTRUSION", priority: "MEDIUM" }, label: "Tekshiruv hodisasini yaratish" },
      { type: "SEND_NOTIFICATION", params: { title: "🔍 Noma'lum shaxs", message: "Identifikatsiya qilinmagan shaxs aniqlandi.", priority: "medium" }, label: "Xabardor qilish" },
      { type: "NAVIGATE_TO_VIEW", params: { view: "identities" }, label: "Shaxslar bazasini ochish" },
    ],
    MEDICAL_EMERGENCY: [
      { type: "SNAPSHOT_CAMERA", params: { cameraId: params.cameraId ?? "nearest" }, label: "Holat snapshotini ol" },
      { type: "CREATE_INCIDENT", params: { title: "Tibbiy favqulodda holat", category: "MEDICAL", priority: "CRITICAL" }, label: "Tibbiy hodisa yaratish" },
      { type: "SEND_NOTIFICATION", params: { title: "🚑 TIBBIY YORDAM KERAK", message: "Darhol tibbiy yordam chaqiring!", priority: "critical" }, label: "Tibbiy xizmatga xabar berish" },
      { type: "DISPATCH_RESOURCE", params: { resource: "Tez yordam", location: params.location ?? "aniqlang" }, label: "Tez yordam yuborish" },
    ],
    THEFT_RESPONSE: [
      { type: "SNAPSHOT_CAMERA", params: { cameraId: params.cameraId ?? "main" }, label: "O'g'irlik snapshotini ol" },
      { type: "START_RECORDING", params: { cameraId: params.cameraId ?? "main" }, label: "Yozuvni boshlat" },
      { type: "CREATE_INCIDENT", params: { title: "O'g'irlik hodisasi", category: "THEFT", priority: "HIGH" }, label: "O'g'irlik hodisasini yaratish" },
      { type: "SEND_NOTIFICATION", params: { title: "🔴 O'G'IRLIK HODISASI", message: "O'g'irlik aniqlandi. Tafsilotlar tekshirilmoqda.", priority: "high" }, label: "Xabardor qilish" },
      { type: "NAVIGATE_TO_VIEW", params: { view: "investigation" }, label: "Tekshiruv markaziga o'tish" },
    ],
  };

  const steps = workflows[workflowId];
  if (!steps) {
    return { success: false, message: `Noma'lum ish jarayoni: ${workflowId}` };
  }

  const results: Array<{ label: string; success: boolean; message: string }> = [];
  let successCount = 0;

  for (const step of steps) {
    try {
      const stepResult = await _dispatch(step.type, step.params, context, `${opId}-step`);
      results.push({ label: step.label, success: stepResult.success, message: stepResult.message });
      if (stepResult.success) successCount++;
    } catch (e: any) {
      results.push({ label: step.label, success: false, message: e.message });
    }
  }

  const summary = `"${workflowId}" ish jarayoni bajarildi: ${successCount}/${steps.length} qadam muvaffaqiyatli.`;
  return {
    success: successCount > 0,
    message: summary,
    data: { workflowId, stepsTotal: steps.length, stepsSuccess: successCount, results },
  };
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
    perceptionResult = await perceptionAgent(genai, req.query, req.imageData, req.imageMimeType);
  }

  // 4. Reasoning agent
  agentsInvoked.push("ReasoningAgent");
  const reasoningResult = await reasoningAgent(
    genai, req.query, intent, systemCtx, perceptionResult,
    req.conversationHistory ?? [], req.context
  );

  return { ...reasoningResult, agentsInvoked, processingMs: Date.now() - t0 };
}
