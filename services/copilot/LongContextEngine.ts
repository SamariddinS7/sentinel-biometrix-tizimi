/**
 * Enterprise AI Copilot — Long Context Engine
 * Volume 4 · Section 36
 *
 * Supports investigations lasting Minutes, Hours, Days, Weeks.
 *
 * Remembers per-operator session:
 * Current Investigation, Operator Intent, Evidence, Timeline,
 * Search Results, Agent Outputs, Open Questions, Pending Tasks.
 *
 * Maintains investigation continuity across multiple operator messages.
 */

export interface SearchResult {
  domain: string;
  query: string;
  results: unknown[];
  timestamp: string;
}

export interface AgentOutput {
  agentName: string;
  output: unknown;
  timestamp: string;
}

export interface InvestigationSession {
  sessionId: string;
  operatorId: string;
  currentInvestigationId?: string;  // links to InvestigationAgent
  currentPlanId?: string;           // links to PlanningEngine
  operatorIntent: string;
  evidence: Array<{
    evidenceId: string;
    description: string;
    source: string;
    addedAt: string;
  }>;
  timeline: Array<{
    eventId: string;
    timestamp: string;
    description: string;
    source: string;
  }>;
  searchResults: SearchResult[];
  agentOutputs: AgentOutput[];
  openQuestions: string[];
  pendingTasks: Array<{
    taskId: string;
    description: string;
    status: "PENDING" | "DONE" | "CANCELLED";
    createdAt: string;
  }>;
  conversationSummary: string;   // rolling summary of last N turns
  contextKeywords: string[];     // for fast relevance matching
  totalTurns: number;
  createdAt: string;
  lastUpdatedAt: string;
  expiresAt: string;             // long-context: configurable TTL
}

// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TTL_HOURS = 7 * 24; // 1 week

class LongContextEngine {
  private static instance: LongContextEngine;
  private sessions = new Map<string, InvestigationSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  static getInstance(): LongContextEngine {
    if (!LongContextEngine.instance)
      LongContextEngine.instance = new LongContextEngine();
    return LongContextEngine.instance;
  }

  constructor() {
    // Run cleanup every 6 hours
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.cleanup(), 6 * 3_600_000);
    }
  }

  private makeId(): string {
    return `SES-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  getOrCreate(operatorId: string): InvestigationSession {
    let session = this.sessions.get(operatorId);
    if (!session || this.isExpired(session)) {
      session = this.create(operatorId);
    }
    return session;
  }

  getSession(operatorId: string): InvestigationSession | undefined {
    const s = this.sessions.get(operatorId);
    return s && !this.isExpired(s) ? s : undefined;
  }

  clearSession(operatorId: string): void {
    this.sessions.delete(operatorId);
  }

  // ── Session updates ─────────────────────────────────────────────────────────

  setInvestigation(operatorId: string, invId: string): void {
    const s = this.getOrCreate(operatorId);
    s.currentInvestigationId = invId;
    this.touch(s);
  }

  setPlan(operatorId: string, planId: string): void {
    const s = this.getOrCreate(operatorId);
    s.currentPlanId = planId;
    this.touch(s);
  }

  setIntent(operatorId: string, intent: string): void {
    const s = this.getOrCreate(operatorId);
    s.operatorIntent = intent;
    this.touch(s);
  }

  addEvidence(operatorId: string, evidenceId: string, description: string, source: string): void {
    const s = this.getOrCreate(operatorId);
    s.evidence.push({ evidenceId, description, source, addedAt: new Date().toISOString() });
    if (s.evidence.length > 100) s.evidence.shift();
    this.touch(s);
  }

  addTimelineEvent(operatorId: string, eventId: string, description: string, source: string, timestamp?: string): void {
    const s = this.getOrCreate(operatorId);
    s.timeline.push({
      eventId,
      timestamp: timestamp ?? new Date().toISOString(),
      description,
      source,
    });
    s.timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (s.timeline.length > 200) s.timeline.shift();
    this.touch(s);
  }

  addSearchResult(operatorId: string, domain: string, query: string, results: unknown[]): void {
    const s = this.getOrCreate(operatorId);
    s.searchResults.push({ domain, query, results, timestamp: new Date().toISOString() });
    if (s.searchResults.length > 50) s.searchResults.shift();
    this.touch(s);
  }

  addAgentOutput(operatorId: string, agentName: string, output: unknown): void {
    const s = this.getOrCreate(operatorId);
    s.agentOutputs.push({ agentName, output, timestamp: new Date().toISOString() });
    if (s.agentOutputs.length > 50) s.agentOutputs.shift();
    this.touch(s);
  }

  addOpenQuestion(operatorId: string, question: string): void {
    const s = this.getOrCreate(operatorId);
    if (!s.openQuestions.includes(question)) s.openQuestions.push(question);
    this.touch(s);
  }

  resolveQuestion(operatorId: string, question: string): void {
    const s = this.sessions.get(operatorId);
    if (!s) return;
    s.openQuestions = s.openQuestions.filter(q => q !== question);
    this.touch(s);
  }

  addPendingTask(operatorId: string, taskId: string, description: string): void {
    const s = this.getOrCreate(operatorId);
    s.pendingTasks.push({ taskId, description, status: "PENDING", createdAt: new Date().toISOString() });
    this.touch(s);
  }

  completeTask(operatorId: string, taskId: string): void {
    const s = this.sessions.get(operatorId);
    if (!s) return;
    const t = s.pendingTasks.find(t => t.taskId === taskId);
    if (t) t.status = "DONE";
    this.touch(s);
  }

  recordTurn(operatorId: string, userText: string, copilotSummary: string): void {
    const s = this.getOrCreate(operatorId);
    s.totalTurns++;

    // Extract keywords
    const words = userText.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    for (const w of words) {
      if (!s.contextKeywords.includes(w)) s.contextKeywords.push(w);
    }
    if (s.contextKeywords.length > 100) s.contextKeywords.splice(0, 20);

    // Rolling summary (keep last 3 summaries + new)
    const existing = s.conversationSummary ? [s.conversationSummary] : [];
    const newSummary = `Turn ${s.totalTurns}: ${copilotSummary.slice(0, 120)}`;
    const allSummaries = [...existing.slice(-2), newSummary];
    s.conversationSummary = allSummaries.join(" | ");
    this.touch(s);
  }

  /**
   * Returns a compact context string for inclusion in AI prompts.
   */
  getContextSummary(operatorId: string): string {
    const s = this.getSession(operatorId);
    if (!s) return "";
    const parts: string[] = [];
    if (s.operatorIntent) parts.push(`Joriy maqsad: ${s.operatorIntent}`);
    if (s.currentInvestigationId) parts.push(`Faol tergov: ${s.currentInvestigationId}`);
    if (s.openQuestions.length) parts.push(`Ochiq savollar: ${s.openQuestions.slice(0, 3).join("; ")}`);
    if (s.evidence.length) parts.push(`Yig'ilgan dalillar: ${s.evidence.length} ta`);
    if (s.pendingTasks.filter(t => t.status === "PENDING").length) {
      parts.push(`Kutayotgan vazifalar: ${s.pendingTasks.filter(t => t.status === "PENDING").length} ta`);
    }
    if (s.conversationSummary) parts.push(`Suhbat qisqachasi: ${s.conversationSummary.slice(0, 200)}`);
    return parts.join("\n");
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private create(operatorId: string): InvestigationSession {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000).toISOString();
    const session: InvestigationSession = {
      sessionId: this.makeId(),
      operatorId,
      operatorIntent: "",
      evidence: [],
      timeline: [],
      searchResults: [],
      agentOutputs: [],
      openQuestions: [],
      pendingTasks: [],
      conversationSummary: "",
      contextKeywords: [],
      totalTurns: 0,
      createdAt: now,
      lastUpdatedAt: now,
      expiresAt: expires,
    };
    this.sessions.set(operatorId, session);
    return session;
  }

  private touch(s: InvestigationSession): void {
    s.lastUpdatedAt = new Date().toISOString();
    // Extend TTL on activity
    s.expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000).toISOString();
  }

  private isExpired(s: InvestigationSession): boolean {
    return new Date(s.expiresAt) < new Date();
  }

  private cleanup(): void {
    for (const [key, s] of this.sessions.entries()) {
      if (this.isExpired(s)) this.sessions.delete(key);
    }
  }

  getAllSessions(): InvestigationSession[] {
    return Array.from(this.sessions.values()).filter(s => !this.isExpired(s));
  }
}

export const longContextEngine = LongContextEngine.getInstance();
