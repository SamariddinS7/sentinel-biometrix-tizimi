/**
 * Enterprise AI Copilot — Investigation Agent
 * Volume 4 · Section 32
 *
 * Responsible for complete investigations:
 * Cross-Camera Search, Movement Reconstruction, Timeline Generation,
 * Evidence Collection, Identity/Vehicle/OCR/Incident Correlation.
 *
 * Output: Executive Summary, Timeline, Evidence, Camera References,
 * Confidence, Open Questions, Alternative Explanations, Recommendations.
 */

export type InvestigationStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED" | "SUSPENDED";

export interface TimelineEvent {
  eventId: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  eventType: string;
  description: string;
  confidence: number;
  evidenceId?: string;
  coordinates?: { x: number; y: number; floor?: number };
}

export interface InvestigationEvidence {
  evidenceId: string;
  type: "VIDEO" | "IMAGE" | "DETECTION" | "IDENTITY_MATCH" | "OCR" | "VEHICLE" | "INCIDENT_LINK";
  cameraId?: string;
  timestamp: string;
  description: string;
  confidence: number;
  locked: boolean;
  source: string;
}

export interface Investigation {
  invId: string;
  title: string;
  subject: string;           // person description, vehicle, event
  subjectType: "PERSON" | "VEHICLE" | "EVENT" | "UNKNOWN";
  status: InvestigationStatus;
  operatorId: string;
  timeline: TimelineEvent[];
  evidence: InvestigationEvidence[];
  camerasReferenced: string[];
  confidence: number;
  openQuestions: string[];
  alternativeExplanations: string[];
  recommendations: string[];
  executiveSummary: string;
  movementPath: Array<{ cameraId: string; timestamp: string; floor?: number }>;
  correlations: {
    identityMatches: Array<{ personId: string; confidence: number; source: string }>;
    vehicleMatches: Array<{ plate?: string; color?: string; confidence: number }>;
    ocrFindings: string[];
    linkedIncidents: string[];
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  durationLabel?: string; // "2 days", "1 hour"
}

// ─────────────────────────────────────────────────────────────────────────────

class InvestigationAgent {
  private static instance: InvestigationAgent;
  private investigations = new Map<string, Investigation>();
  private maxHistory = 100;

  static getInstance(): InvestigationAgent {
    if (!InvestigationAgent.instance)
      InvestigationAgent.instance = new InvestigationAgent();
    return InvestigationAgent.instance;
  }

  private makeId(): string {
    return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  startInvestigation(
    subject: string,
    operatorId: string,
    subjectType: Investigation["subjectType"] = "UNKNOWN",
    initialEvidence?: InvestigationEvidence[]
  ): Investigation {
    const invId = this.makeId();
    const now = new Date().toISOString();

    const inv: Investigation = {
      invId,
      title: `Tergov: ${subject.slice(0, 80)}`,
      subject,
      subjectType,
      status: "ACTIVE",
      operatorId,
      timeline: [],
      evidence: initialEvidence ?? [],
      camerasReferenced: [],
      confidence: 0.0,
      openQuestions: this.generateOpenQuestions(subject, subjectType),
      alternativeExplanations: [],
      recommendations: [],
      executiveSummary: `"${subject}" bo'yicha tergov boshlandi. Dalillar yig'ilmoqda.`,
      movementPath: [],
      correlations: {
        identityMatches: [],
        vehicleMatches: [],
        ocrFindings: [],
        linkedIncidents: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    this.investigations.set(invId, inv);
    if (this.investigations.size > this.maxHistory) {
      const oldest = this.investigations.keys().next().value;
      if (oldest) this.investigations.delete(oldest);
    }
    return inv;
  }

  addTimelineEvent(invId: string, event: Omit<TimelineEvent, "eventId">): void {
    const inv = this.investigations.get(invId);
    if (!inv) return;
    const full: TimelineEvent = {
      ...event,
      eventId: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    inv.timeline.push(full);
    inv.timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (!inv.camerasReferenced.includes(event.cameraId))
      inv.camerasReferenced.push(event.cameraId);
    inv.updatedAt = new Date().toISOString();
    this.updateMovementPath(inv);
  }

  addEvidence(invId: string, evidence: Omit<InvestigationEvidence, "evidenceId">): string {
    const inv = this.investigations.get(invId);
    if (!inv) return "";
    const evidenceId = `EV-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    inv.evidence.push({ ...evidence, evidenceId });
    inv.updatedAt = new Date().toISOString();
    this.recalculateConfidence(inv);
    return evidenceId;
  }

  addCorrelation(
    invId: string,
    type: "identity" | "vehicle" | "ocr" | "incident",
    data: unknown
  ): void {
    const inv = this.investigations.get(invId);
    if (!inv) return;
    switch (type) {
      case "identity":
        inv.correlations.identityMatches.push(data as any);
        break;
      case "vehicle":
        inv.correlations.vehicleMatches.push(data as any);
        break;
      case "ocr":
        inv.correlations.ocrFindings.push(String(data));
        break;
      case "incident":
        inv.correlations.linkedIncidents.push(String(data));
        break;
    }
    inv.updatedAt = new Date().toISOString();
    this.recalculateConfidence(inv);
  }

  finalizeInvestigation(
    invId: string,
    summary?: string,
    recommendations?: string[],
    alternatives?: string[]
  ): Investigation | undefined {
    const inv = this.investigations.get(invId);
    if (!inv) return undefined;

    inv.status = "COMPLETED";
    inv.completedAt = new Date().toISOString();
    inv.updatedAt = inv.completedAt;

    const durationMs =
      new Date(inv.completedAt).getTime() - new Date(inv.createdAt).getTime();
    inv.durationLabel = this.formatDuration(durationMs);

    if (summary) inv.executiveSummary = summary;
    if (recommendations) inv.recommendations = recommendations;
    if (alternatives) inv.alternativeExplanations = alternatives;

    // Auto-generate summary if not provided
    if (!summary) inv.executiveSummary = this.generateSummary(inv);
    if (!recommendations?.length) inv.recommendations = this.generateRecommendations(inv);
    if (!alternatives?.length) inv.alternativeExplanations = this.generateAlternatives(inv);

    return inv;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  getInvestigation(invId: string): Investigation | undefined {
    return this.investigations.get(invId);
  }

  getAllInvestigations(operatorId?: string): Investigation[] {
    const all = Array.from(this.investigations.values()).reverse();
    return operatorId ? all.filter(i => i.operatorId === operatorId) : all;
  }

  getActiveInvestigations(): Investigation[] {
    return Array.from(this.investigations.values()).filter(i => i.status === "ACTIVE");
  }

  // ── Cross-camera movement reconstruction ────────────────────────────────────

  reconstructMovement(invId: string): Array<{
    step: number;
    cameraId: string;
    timestamp: string;
    action: string;
  }> {
    const inv = this.investigations.get(invId);
    if (!inv) return [];
    return inv.movementPath.map((p, i) => ({
      step: i + 1,
      cameraId: p.cameraId,
      timestamp: p.timestamp,
      action: i === 0 ? "Kirish" : i === inv.movementPath.length - 1 ? "So'nggi ko'rinish" : "O'tish",
    }));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private updateMovementPath(inv: Investigation): void {
    const pathMap = new Map<string, string>();
    for (const ev of inv.timeline) {
      pathMap.set(ev.cameraId, ev.timestamp);
    }
    inv.movementPath = Array.from(pathMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([cameraId, timestamp]) => ({ cameraId, timestamp }));
  }

  private recalculateConfidence(inv: Investigation): void {
    if (inv.evidence.length === 0) { inv.confidence = 0.1; return; }
    const avg = inv.evidence.reduce((s, e) => s + e.confidence, 0) / inv.evidence.length;
    const bonus = Math.min(0.2, inv.evidence.length * 0.03);
    const correlationBonus = Math.min(0.15,
      inv.correlations.identityMatches.length * 0.05 +
      inv.correlations.vehicleMatches.length * 0.04
    );
    inv.confidence = Math.min(0.99, avg + bonus + correlationBonus);
  }

  private generateOpenQuestions(subject: string, type: Investigation["subjectType"]): string[] {
    const base = [
      "Shaxs qaysi yo'l orqali kirdi?",
      "Qo'shimcha qo'lbola kameralar bormi?",
    ];
    if (type === "PERSON") return [...base,
      "Shaxs identifikatsiya qilinganmi?",
      "Boshqa hodisalar bilan bog'liqmi?",
    ];
    if (type === "VEHICLE") return [...base,
      "Davlat raqami aniqlanganmi?",
      "Transport vositasi qaerdan keldi?",
    ];
    return base;
  }

  private generateSummary(inv: Investigation): string {
    const camCount = inv.camerasReferenced.length;
    const evCount = inv.evidence.length;
    const conf = Math.round(inv.confidence * 100);
    return `"${inv.subject}" bo'yicha tergov yakunlandi. ${camCount} ta kamera, ${evCount} ta dalil to'plandi. Umumiy ishonch darajasi: ${conf}%. Harakat yo'li ${inv.movementPath.length} ta kamera orqali qayta qurildi.`;
  }

  private generateRecommendations(inv: Investigation): string[] {
    const recs: string[] = [];
    if (inv.correlations.identityMatches.length === 0)
      recs.push("Shaxsni aniq identifikatsiya qilish uchun qo'shimcha biometrik tekshiruv o'tkazing.");
    if (inv.camerasReferenced.length < 3)
      recs.push("Ko'r zonalarni qoplash uchun qo'shimcha kameralar o'rnating.");
    if (inv.correlations.linkedIncidents.length > 0)
      recs.push("Bog'liq hodisalarni birlashtirish uchun hodisa menejeriga o'ting.");
    recs.push("Barcha dalillarni muhrlang va yuridik himoyaga tayinlang.");
    return recs;
  }

  private generateAlternatives(inv: Investigation): string[] {
    return [
      "Soxta signal: Qurilma nosozligi yoki yoritish muammosi bo'lishi mumkin.",
      "Boshqa shaxs: Vizual o'xshashlik yanglishishga olib kelgan bo'lishi mumkin.",
    ];
  }

  private formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec} soniya`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} daqiqa`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} soat`;
    return `${Math.floor(hr / 24)} kun`;
  }
}

export const investigationAgent = InvestigationAgent.getInstance();
