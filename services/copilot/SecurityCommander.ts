/**
 * Enterprise AI Copilot — Autonomous Security Commander
 * Volume 4 · Section 40
 *
 * Coordinates complex security workflows:
 * Fire Alarm → verify evidence → open nearest cameras → track evacuation →
 * create incident → notify operators → generate timeline → collect evidence → recommend actions.
 *
 * Unauthorized Person → verify identity → track movement → collect evidence →
 * highlight Digital Twin → recommend response.
 *
 * RULE: Never initiate irreversible or safety-critical actions without explicit
 * authorization unless a pre-approved organizational policy explicitly permits
 * automated execution for that specific workflow.
 * Every decision must remain auditable.
 */

export type SecurityCommandType =
  | "FIRE_RESPONSE"
  | "INTRUSION_RESPONSE"
  | "UNAUTHORIZED_PERSON"
  | "MEDICAL_EMERGENCY"
  | "THEFT_RESPONSE"
  | "BOMB_THREAT"
  | "EVACUATION"
  | "LOCKDOWN";

export type AuthorizationLevel = "AUTO" | "OPERATOR_CONFIRM" | "SUPERVISOR_CONFIRM" | "ADMIN_CONFIRM";

export interface SecurityCommandStep {
  stepId: string;
  order: number;
  action: string;
  description: string;
  params: Record<string, unknown>;
  authRequired: AuthorizationLevel;
  reversible: boolean;
  timeout: number;         // ms
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED" | "WAITING_AUTH";
  result?: unknown;
  error?: string;
  executedAt?: string;
}

export interface SecurityCommand {
  commandId: string;
  type: SecurityCommandType;
  title: string;
  trigger: string;         // what event triggered this
  triggerEvidence: string[];
  steps: SecurityCommandStep[];
  authorizationLevel: AuthorizationLevel;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: "PENDING_AUTH" | "APPROVED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  auditTrail: Array<{ timestamp: string; action: string; actor: string }>;
  incidentId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

// Pre-approved AUTO workflows (low-risk, no irreversible actions)
const AUTO_APPROVED_WORKFLOWS: SecurityCommandType[] = [];

// Workflows that need operator confirmation
const OPERATOR_CONFIRM_WORKFLOWS: SecurityCommandType[] = [
  "FIRE_RESPONSE", "INTRUSION_RESPONSE", "UNAUTHORIZED_PERSON",
  "MEDICAL_EMERGENCY", "THEFT_RESPONSE",
];

// Always require supervisor
const SUPERVISOR_CONFIRM_WORKFLOWS: SecurityCommandType[] = [
  "BOMB_THREAT", "EVACUATION", "LOCKDOWN",
];

class SecurityCommanderEngine {
  private static instance: SecurityCommanderEngine;
  private commands = new Map<string, SecurityCommand>();
  private maxHistory = 100;

  static getInstance(): SecurityCommanderEngine {
    if (!SecurityCommanderEngine.instance)
      SecurityCommanderEngine.instance = new SecurityCommanderEngine();
    return SecurityCommanderEngine.instance;
  }

  private makeId(): string {
    return `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  // ── Command creation ─────────────────────────────────────────────────────────

  createCommand(
    type: SecurityCommandType,
    trigger: string,
    triggerEvidence: string[],
    params: Record<string, unknown> = {}
  ): SecurityCommand {
    const commandId = this.makeId();
    const steps = this.buildSteps(type, commandId, params);
    const authLevel = this.determineAuth(type);

    const cmd: SecurityCommand = {
      commandId,
      type,
      title: this.commandTitle(type),
      trigger,
      triggerEvidence,
      steps,
      authorizationLevel: authLevel,
      isApproved: AUTO_APPROVED_WORKFLOWS.includes(type),
      createdAt: new Date().toISOString(),
      status: AUTO_APPROVED_WORKFLOWS.includes(type) ? "APPROVED" : "PENDING_AUTH",
      auditTrail: [{
        timestamp: new Date().toISOString(),
        action: `Xavfsizlik buyrug'i yaratildi: ${type}`,
        actor: "SecurityCommander",
      }],
    };

    this.commands.set(commandId, cmd);
    if (this.commands.size > this.maxHistory) {
      const oldest = this.commands.keys().next().value;
      if (oldest) this.commands.delete(oldest);
    }
    return cmd;
  }

  // ── Authorization ────────────────────────────────────────────────────────────

  authorize(commandId: string, approverName: string, approverRole: string): boolean {
    const cmd = this.commands.get(commandId);
    if (!cmd) return false;

    // Check approver has sufficient role
    const roleLevel: Record<string, number> = { VIEWER: 0, OPERATOR: 1, SUPERVISOR: 2, ADMIN: 3 };
    const requiredLevel: Record<AuthorizationLevel, number> = {
      AUTO: 0, OPERATOR_CONFIRM: 1, SUPERVISOR_CONFIRM: 2, ADMIN_CONFIRM: 3,
    };
    if ((roleLevel[approverRole] ?? 0) < (requiredLevel[cmd.authorizationLevel] ?? 1)) {
      return false;
    }

    cmd.isApproved = true;
    cmd.approvedBy = approverName;
    cmd.approvedAt = new Date().toISOString();
    cmd.status = "APPROVED";
    cmd.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: `Buyruq tasdiqlandi`,
      actor: approverName,
    });
    return true;
  }

  cancel(commandId: string, actor: string): boolean {
    const cmd = this.commands.get(commandId);
    if (!cmd || cmd.status === "COMPLETED") return false;
    cmd.status = "CANCELLED";
    cmd.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: "Buyruq bekor qilindi",
      actor,
    });
    return true;
  }

  // ── Execution ────────────────────────────────────────────────────────────────

  async execute(
    commandId: string,
    executor: (action: string, params: Record<string, unknown>) => Promise<unknown>
  ): Promise<SecurityCommand> {
    const cmd = this.commands.get(commandId);
    if (!cmd) throw new Error("Command not found");
    if (!cmd.isApproved) throw new Error("Command not authorized");

    cmd.status = "RUNNING";
    cmd.startedAt = new Date().toISOString();
    cmd.auditTrail.push({
      timestamp: cmd.startedAt,
      action: "Buyruq ijrosi boshlandi",
      actor: "SecurityCommander",
    });

    for (const step of cmd.steps.sort((a, b) => a.order - b.order)) {
      step.status = "RUNNING";
      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`Timeout ${step.timeout}ms`)), step.timeout)
        );
        const result = await Promise.race([executor(step.action, step.params), timeout]);
        step.result = result;
        step.status = "DONE";
        step.executedAt = new Date().toISOString();
        cmd.auditTrail.push({
          timestamp: step.executedAt,
          action: `Qadam bajarildi: ${step.description}`,
          actor: "SecurityCommander",
        });
      } catch (err: any) {
        step.status = "FAILED";
        step.error = err.message;
        cmd.auditTrail.push({
          timestamp: new Date().toISOString(),
          action: `Qadam bajarilmadi: ${step.description} — ${err.message}`,
          actor: "SecurityCommander",
        });
        // Non-critical steps can be skipped; critical steps fail the whole command
        if (step.order <= 2) {
          cmd.status = "FAILED";
          cmd.completedAt = new Date().toISOString();
          return cmd;
        }
      }
    }

    cmd.status = "COMPLETED";
    cmd.completedAt = new Date().toISOString();
    cmd.auditTrail.push({
      timestamp: cmd.completedAt,
      action: "Buyruq muvaffaqiyatli yakunlandi",
      actor: "SecurityCommander",
    });
    return cmd;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  getCommand(commandId: string): SecurityCommand | undefined {
    return this.commands.get(commandId);
  }

  getAllCommands(): SecurityCommand[] {
    return Array.from(this.commands.values()).reverse();
  }

  getPendingAuthorization(): SecurityCommand[] {
    return Array.from(this.commands.values()).filter(c => c.status === "PENDING_AUTH");
  }

  // ── Step builders ────────────────────────────────────────────────────────────

  private buildSteps(type: SecurityCommandType, cmdId: string, params: Record<string, unknown>): SecurityCommandStep[] {
    const s = (order: number, action: string, desc: string, extraParams: Record<string, unknown> = {},
               auth: AuthorizationLevel = "AUTO", reversible = true, timeout = 10_000): SecurityCommandStep => ({
      stepId: `${cmdId}-S${order}`,
      order, action, description: desc,
      params: { ...params, ...extraParams },
      authRequired: auth, reversible, timeout,
      status: "PENDING",
    });

    switch (type) {
      case "FIRE_RESPONSE":
        return [
          s(1,  "SEARCH_ALARMS",             "Olov alarmlarini tasdiqlash",              { severity: "critical" }),
          s(2,  "OPEN_CAMERA",               "Eng yaqin kamerani ochish",                {}, "AUTO", true, 5000),
          s(3,  "CREATE_INCIDENT",           "Olov hodisasini yaratish",                 { title: "Olov xavfi aniqlandi", category: "FIRE", priority: "CRITICAL" }, "OPERATOR_CONFIRM", false),
          s(4,  "SEND_NOTIFICATION",         "Operatorlarga xabar yuborish",             { title: "OLOV XAVFI", message: "Darhol evakuatsiya boshlang!", priority: "critical" }),
          s(5,  "SEARCH_TIMELINE",           "Voqealar vaqt jadvalini yaratish",         { since: new Date(Date.now() - 600_000).toISOString(), until: new Date().toISOString() }),
          s(6,  "CREATE_EVIDENCE",           "Dalillarni yig'ish",                       {}, "AUTO", true),
          s(7,  "GENERATE_FIRE_REPORT",      "Olov hisobotini tayyorlash",               {}),
          s(8,  "SEND_ALARM_NOTIFICATION",   "Xavfsizlik xizmatiga xabar",              { message: "Olov xavfi — darhol javob talab qilinadi" }),
        ];

      case "INTRUSION_RESPONSE":
        return [
          s(1,  "SEARCH_ALARMS",             "Kirib kelish alarmini tasdiqlash",         {}),
          s(2,  "SEARCH_CAMERAS",            "Hudud kameralarini aniqlash",              {}),
          s(3,  "CREATE_INCIDENT",           "Kirib kelish hodisasini yaratish",         { title: "Ruxsatsiz kirish", category: "INTRUSION", priority: "HIGH" }, "OPERATOR_CONFIRM", false),
          s(4,  "TWIN_HIGHLIGHT_CAMERA",     "Digital Twin da kamerani belgilash",       {}),
          s(5,  "SEARCH_PERSONS",            "Shaxsni qidirish",                         {}),
          s(6,  "CREATE_EVIDENCE",           "Dalillarni muhrlash",                      {}, "AUTO", true),
          s(7,  "SEND_NOTIFICATION",         "Navbatchi xodimga xabar",                  { title: "KIRIB KELISH", message: "Ruxsatsiz shaxs aniqlandi", priority: "high" }),
          s(8,  "GENERATE_REPORT",           "Hodisa hisobotini tayyorlash",             { reportType: "intrusion" }),
        ];

      case "UNAUTHORIZED_PERSON":
        return [
          s(1,  "SEARCH_FACE",               "Yuz identifikatsiyasini tekshirish",       {}),
          s(2,  "SEARCH_APPEARANCE",         "Ko'rinish bo'yicha ReID qidirish",         {}),
          s(3,  "SEARCH_TIMELINE",           "Harakat yo'lini kuzatish",                 { since: new Date(Date.now() - 1_800_000).toISOString(), until: new Date().toISOString() }),
          s(4,  "CREATE_EVIDENCE",           "Dalillarni yig'ish",                       {}),
          s(5,  "TWIN_HIGHLIGHT_PERSON",     "Digital Twin da shaxsni belgilash",        {}),
          s(6,  "CREATE_INCIDENT",           "Hodisani ro'yxatdan o'tkazish",            { title: "Noma'lum shaxs", category: "INTRUSION", priority: "MEDIUM" }, "OPERATOR_CONFIRM", false),
          s(7,  "SEND_NOTIFICATION",         "Xavfsizlik guruhiga xabar",                { title: "NOMA'LUM SHAXS", message: "Identifikatsiya talab qilinadi", priority: "high" }),
        ];

      case "MEDICAL_EMERGENCY":
        return [
          s(1,  "SEARCH_CAMERAS",            "Hodisa joyidagi kamerani aniqlash",        {}),
          s(2,  "OPEN_CAMERA",               "Kamerani ochish",                          {}),
          s(3,  "CREATE_INCIDENT",           "Tibbiy yordam hodisasini yaratish",        { title: "Tibbiy favqulodda holat", category: "MEDICAL", priority: "CRITICAL" }, "OPERATOR_CONFIRM", false),
          s(4,  "SEND_NOTIFICATION",         "Tibbiy xizmatlarga xabar",                 { title: "TIBBIY YORDAM", message: "Darhol tibbiy yordam kerak!", priority: "critical" }),
          s(5,  "CREATE_EVIDENCE",           "Video dalillarni saqlash",                 {}),
        ];

      case "THEFT_RESPONSE":
        return [
          s(1,  "SEARCH_CAMERAS",            "Hodisa joyi kameralarini aniqlash",        {}),
          s(2,  "SEARCH_APPEARANCE",         "Shaxs ko'rinishini qidirish",              {}),
          s(3,  "SEARCH_VEHICLES",           "Transport vositasini qidirish",            {}),
          s(4,  "CREATE_INCIDENT",           "O'g'irlik hodisasini yaratish",            { title: "O'g'irlik", category: "THEFT", priority: "HIGH" }, "OPERATOR_CONFIRM", false),
          s(5,  "CREATE_EVIDENCE",           "Dalillarni muhrlash",                      {}),
          s(6,  "SEND_NOTIFICATION",         "Qo'riqlash xizmatiga xabar",               { title: "O'G'IRLIK", message: "Shaxs aniqlandi — quvib yetishga harakat qiling", priority: "high" }),
          s(7,  "GENERATE_REPORT",           "O'g'irlik hisobotini tayyorlash",          { reportType: "theft" }),
        ];

      default:
        return [
          s(1, "SEND_NOTIFICATION", "Umumiy xavfsizlik xabari", { title: type, message: "Xavfsizlik hodisasi aniqlandi", priority: "high" }),
        ];
    }
  }

  private determineAuth(type: SecurityCommandType): AuthorizationLevel {
    if (AUTO_APPROVED_WORKFLOWS.includes(type)) return "AUTO";
    if (OPERATOR_CONFIRM_WORKFLOWS.includes(type)) return "OPERATOR_CONFIRM";
    if (SUPERVISOR_CONFIRM_WORKFLOWS.includes(type)) return "SUPERVISOR_CONFIRM";
    return "SUPERVISOR_CONFIRM";
  }

  private commandTitle(type: SecurityCommandType): string {
    const titles: Record<SecurityCommandType, string> = {
      FIRE_RESPONSE:         "Olov xavfi javob rejasi",
      INTRUSION_RESPONSE:    "Kirib kelish javob rejasi",
      UNAUTHORIZED_PERSON:   "Noma'lum shaxs javob rejasi",
      MEDICAL_EMERGENCY:     "Tibbiy favqulodda holat rejasi",
      THEFT_RESPONSE:        "O'g'irlik javob rejasi",
      BOMB_THREAT:           "Bomba tahdidi javob rejasi",
      EVACUATION:            "Evakuatsiya rejasi",
      LOCKDOWN:              "Qulflash rejasi",
    };
    return titles[type] ?? `Xavfsizlik buyrug'i: ${type}`;
  }
}

export const securityCommander = SecurityCommanderEngine.getInstance();
