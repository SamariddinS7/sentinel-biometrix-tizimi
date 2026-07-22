/**
 * Enterprise AI Copilot — Planning Engine
 * Volume 4 · Section 30
 *
 * Creates structured execution plans from complex operator requests.
 * Supports: Task Decomposition, Dependency Analysis, Parallel/Sequential Tasks,
 * Retry Planning, Rollback Planning, Recovery Planning, Priority Scheduling.
 */

export type PlanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "ROLLED_BACK";
export type PlanTaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED" | "RETRYING";
export type TaskExecutionMode = "SEQUENTIAL" | "PARALLEL" | "CONDITIONAL" | "LOOP" | "EVENT_DRIVEN";

export interface PlanTask {
  taskId: string;
  action: string;
  description: string;
  params: Record<string, unknown>;
  dependsOn: string[];           // taskIds that must complete first
  parallel: boolean;             // can run alongside other parallel tasks
  executionMode: TaskExecutionMode;
  priority: number;              // 1 (highest) to 10 (lowest)
  maxRetries: number;
  timeoutMs: number;
  rollbackAction?: string;
  rollbackParams?: Record<string, unknown>;
  status: PlanTaskStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  retryCount: number;
  estimatedDurationMs: number;
}

export interface ExecutionPlan {
  planId: string;
  title: string;
  objectives: string[];
  steps: PlanTask[];
  dependencies: Record<string, string[]>;
  estimatedDurationMs: number;
  executionStatus: PlanStatus;
  evidence: string[];
  confidence: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  operatorId: string;
  query: string;
  rollbackPlan: string[];
  recoveryPlan: string;
  result?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────

class PlanningEngine {
  private static instance: PlanningEngine;
  private plans = new Map<string, ExecutionPlan>();
  private maxHistory = 200;

  static getInstance(): PlanningEngine {
    if (!PlanningEngine.instance) PlanningEngine.instance = new PlanningEngine();
    return PlanningEngine.instance;
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private hoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 3_600_000).toISOString();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  createPlan(query: string, operatorId: string, intent: string): ExecutionPlan {
    const planId = this.makeId("PLAN");
    const steps = this.decompose(query, intent, planId);
    const deps: Record<string, string[]> = {};
    for (const s of steps) deps[s.taskId] = s.dependsOn;

    const plan: ExecutionPlan = {
      planId,
      title: this.inferTitle(intent),
      objectives: this.inferObjectives(intent),
      steps,
      dependencies: deps,
      estimatedDurationMs: steps.reduce((acc, s) => acc + s.estimatedDurationMs, 0),
      executionStatus: "PENDING",
      evidence: [],
      confidence: 0.87,
      createdAt: new Date().toISOString(),
      operatorId,
      query,
      rollbackPlan: steps.filter(s => s.rollbackAction).map(s => s.taskId),
      recoveryPlan:
        "Muvaffaqiyatsizlik bo'lsa: maxRetries martagacha qayta urinish, so'ng bajarilgan qadamlarni teskari tartibda rollback qilish.",
    };

    this.plans.set(planId, plan);
    if (this.plans.size > this.maxHistory) {
      const oldest = this.plans.keys().next().value;
      if (oldest) this.plans.delete(oldest);
    }
    return plan;
  }

  updateStatus(planId: string, status: PlanStatus, result?: unknown): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    plan.executionStatus = status;
    if (result !== undefined) plan.result = result;
    if (status === "RUNNING" && !plan.startedAt) plan.startedAt = new Date().toISOString();
    if (["COMPLETED", "FAILED", "CANCELLED", "ROLLED_BACK"].includes(status))
      plan.completedAt = new Date().toISOString();
  }

  updateTaskStatus(
    planId: string, taskId: string, status: PlanTaskStatus,
    result?: unknown, error?: string
  ): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    const task = plan.steps.find(s => s.taskId === taskId);
    if (!task) return;
    task.status = status;
    if (result !== undefined) task.result = result;
    if (error) task.error = error;
    if (status === "RUNNING" && !task.startedAt) task.startedAt = new Date().toISOString();
    if (["COMPLETED", "FAILED", "SKIPPED"].includes(status) && !task.finishedAt)
      task.finishedAt = new Date().toISOString();
  }

  addEvidence(planId: string, item: string): void {
    this.plans.get(planId)?.evidence.push(item);
  }

  getPlan(planId: string): ExecutionPlan | undefined {
    return this.plans.get(planId);
  }

  getAllPlans(operatorId?: string): ExecutionPlan[] {
    const all = Array.from(this.plans.values()).reverse();
    return operatorId ? all.filter(p => p.operatorId === operatorId) : all;
  }

  getActivePlans(): ExecutionPlan[] {
    return Array.from(this.plans.values()).filter(p =>
      p.executionStatus === "PENDING" || p.executionStatus === "RUNNING"
    );
  }

  // ── Decomposition ───────────────────────────────────────────────────────────

  private decompose(query: string, intent: string, planId: string): PlanTask[] {
    switch (intent) {
      case "INVESTIGATION":
        return [
          this.t(planId, "T1", "SEARCH_CAMERAS",    "Barcha kameralarni skanerlash",             {},                                                         [],               false, 2, 5000,  8000),
          this.t(planId, "T2", "SEARCH_PERSONS",    "Shaxsni deteksiyalangan ro'yxatdan qidirish", { query },                                                ["T1"],           false, 2, 8000,  15000),
          this.t(planId, "T3", "SEARCH_APPEARANCE", "Ko'rinish bo'yicha ReID qidirish",           { query },                                                 ["T1"],           true,  2, 8000,  20000),
          this.t(planId, "T4", "SEARCH_FACE",       "Yuz tasviri bo'yicha taqqoslash",             { query },                                                 ["T1"],           true,  1, 10000, 25000),
          this.t(planId, "T5", "SEARCH_TIMELINE",   "Harakat vaqt jadvalini qayta qurish",         { since: this.hoursAgo(24), until: new Date().toISOString() }, ["T2", "T3", "T4"], false, 1, 8000,  15000),
          this.t(planId, "T6", "CREATE_EVIDENCE",   "Dalillarni yig'ish va muhrlash",              {},                                                         ["T5"],           false, 1, 5000,  10000, "LOCK_EVIDENCE"),
          this.t(planId, "T7", "GENERATE_REPORT",   "Tergov hisobotini tayyorlash",                { reportType: "investigation" },                            ["T6"],           false, 0, 15000, 30000),
        ];

      case "ALARM_MANAGEMENT":
        return [
          this.t(planId, "T1", "SEARCH_ALARMS",           "Faol alarmlarni yuklash",                {},                              [],        false, 2, 3000,  5000),
          this.t(planId, "T2", "ACKNOWLEDGE_ALARM",        "Kritik alarmlarni tasdiqlash",            {},                              ["T1"],    false, 1, 3000,  8000, "ESCALATE_ALARM"),
          this.t(planId, "T3", "ASSIGN_ALARM",             "Alarmlarni navbatchi operatorga tayinlash", { assignee: "duty_operator" }, ["T2"],    false, 1, 3000,  8000),
          this.t(planId, "T4", "SEND_ALARM_NOTIFICATION",  "Bildirishnoma yuborish",                   {},                              ["T2"],    true,  1, 3000,  5000),
        ];

      case "INCIDENT_MANAGEMENT":
        return [
          this.t(planId, "T1", "CREATE_INCIDENT",          "Hodisani ro'yxatdan o'tkazish",     { title: query.slice(0, 80), category: "OTHER", priority: "HIGH" }, [],           false, 0, 5000,  10000),
          this.t(planId, "T2", "SEARCH_EVIDENCE_DB",       "Tegishli dalillarni qidirish",       {},                                                                ["T1"],       true,  2, 5000,  12000),
          this.t(planId, "T3", "SEARCH_TIMELINE",          "Voqealar vaqt jadvalini yaratish",  { since: this.hoursAgo(4), until: new Date().toISOString() },      ["T1"],       true,  2, 5000,  12000),
          this.t(planId, "T4", "ATTACH_INCIDENT_EVIDENCE", "Dalillarni hodisaga biriktirish",    {},                                                                ["T2", "T3"], false, 1, 3000,  8000),
          this.t(planId, "T5", "GENERATE_INCIDENT_REPORT", "Hodisa hisobotini yaratish",          {},                                                                ["T4"],       false, 0, 12000, 25000),
        ];

      case "REPORT_GENERATION":
        return [
          this.t(planId, "T1", "SEARCH_INCIDENTS",     "Hodisalar ma'lumotlarini yig'ish",  {},                    [],           true,  1, 4000,  8000),
          this.t(planId, "T2", "SEARCH_ALARMS",        "Alarmlar statistikasini yig'ish",    {},                    [],           true,  1, 4000,  8000),
          this.t(planId, "T3", "SEARCH_EVIDENCE_DB",   "Dalillar ro'yxatini olish",           {},                    [],           true,  1, 4000,  8000),
          this.t(planId, "T4", "GENERATE_EXECUTIVE_REPORT", "Ijroiya hisobotini yaratish", { period: "daily" }, ["T1","T2","T3"], false, 1, 15000, 30000),
        ];

      case "WORKFLOW_AUTOMATION":
        return [
          this.t(planId, "T1", "SEARCH_CAMERAS",     "Kamera holatini tekshirish",            {},  [],     false, 1, 3000,  6000),
          this.t(planId, "T2", "EXECUTE_WORKFLOW",   "Avtomatik ish jarayonini ishga tushirish", {}, ["T1"], false, 0, 30000, 20000),
          this.t(planId, "T3", "CREATE_EVIDENCE",    "Jarayon dalillarini saqlash",            {},  ["T2"], false, 1, 3000,  8000),
        ];

      case "SYSTEM_HEALTH":
        return [
          this.t(planId, "T1", "SEARCH_CAMERAS",    "Kamera sog'lig'ini tekshirish",   {},  [],     true,  1, 3000,  8000),
          this.t(planId, "T2", "SEARCH_INCIDENTS",  "Ochiq hodisalarni ko'rish",        {},  [],     true,  1, 3000,  8000),
          this.t(planId, "T3", "NAVIGATE_TO_VIEW",  "Tizim monitoringini ochish",       { view: "analytics" }, ["T1","T2"], false, 0, 1000, 2000),
        ];

      default:
        return [
          this.t(planId, "T1", "NAVIGATE_TO_VIEW", "So'rovga mos ko'rinishni ochish", { view: "cameras" }, [], false, 0, 1000, 3000),
        ];
    }
  }

  private t(
    planId: string, shortId: string, action: string, description: string,
    params: Record<string, unknown>, depShortIds: string[],
    parallel: boolean, maxRetries: number, timeoutMs: number, estimatedMs: number,
    rollbackAction?: string
  ): PlanTask {
    const taskId = `${planId}-${shortId}`;
    return {
      taskId,
      action,
      description,
      params,
      dependsOn: depShortIds.map(d => `${planId}-${d}`),
      parallel,
      executionMode: parallel ? "PARALLEL" : "SEQUENTIAL",
      priority: 5,
      maxRetries,
      timeoutMs,
      rollbackAction,
      status: "PENDING",
      retryCount: 0,
      estimatedDurationMs: estimatedMs,
    };
  }

  private inferTitle(intent: string): string {
    const map: Record<string, string> = {
      INVESTIGATION:       "Avtomatlashtirilgan tergov rejasi",
      ALARM_MANAGEMENT:    "Alarm boshqaruv rejasi",
      INCIDENT_MANAGEMENT: "Hodisa boshqaruv rejasi",
      REPORT_GENERATION:   "Hisobot yaratish rejasi",
      WORKFLOW_AUTOMATION: "Ish jarayoni avtomatlashtirish rejasi",
      GLOBAL_SEARCH:       "Global qidiruv rejasi",
      SYSTEM_HEALTH:       "Tizim diagnostika rejasi",
    };
    return map[intent] ?? "Umumiy amal rejasi";
  }

  private inferObjectives(intent: string): string[] {
    const map: Record<string, string[]> = {
      INVESTIGATION: [
        "Shaxsni barcha kameralarda kuzatish",
        "Harakat yo'lini qayta qurish",
        "Dalillarni yig'ish va muhrlash",
        "Hisobot va tavsiyalar tayyorlash",
      ],
      ALARM_MANAGEMENT: [
        "Faol alarmlarni baholash",
        "Muhim alarmlarni tasdiqlash va eskalatsiya qilish",
        "Tegishli operatorlarga tayinlash",
        "Hal qilish va arxivlash",
      ],
      INCIDENT_MANAGEMENT: [
        "Hodisani ro'yxatdan o'tkazish",
        "Dalillarni biriktirish",
        "Tergov boshlash",
        "Hisobot tayyorlash",
      ],
      REPORT_GENERATION: [
        "Ma'lumotlarni barcha manbalardan yig'ish",
        "Tahlil qilish va qiyoslash",
        "Hisobot formatlash",
        "Eksport va yuborish",
      ],
      SYSTEM_HEALTH: [
        "Kamera sog'lig'ini tekshirish",
        "Tizim resurslarini baholash",
        "Muammolarni aniqlash",
        "Tavsiyalar berish",
      ],
    };
    return map[intent] ?? ["So'rovni to'liq bajarish"];
  }
}

export const planningEngine = PlanningEngine.getInstance();
