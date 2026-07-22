/**
 * Enterprise AI Copilot — Recommendation Engine
 * Volume 4 · Section 34
 *
 * Recommends operational improvements.
 * Examples: Increase lighting, Move camera, Clean camera lens,
 * Increase recording bitrate, Add another camera, Enable PTZ preset,
 * Improve AI threshold, Reduce false positives, Archive old recordings, Increase storage.
 *
 * Every recommendation contains: Reason, Evidence, Expected Benefit, Estimated Risk, Priority.
 */

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecommendationCategory =
  | "CAMERA_PLACEMENT" | "LIGHTING" | "RECORDING_QUALITY" | "STORAGE_MANAGEMENT"
  | "AI_CALIBRATION" | "NETWORK_OPTIMIZATION" | "SECURITY_POLICY" | "MAINTENANCE"
  | "CAPACITY_PLANNING" | "WORKFLOW_IMPROVEMENT";

export interface Recommendation {
  recId: string;
  category: RecommendationCategory;
  title: string;
  reason: string;
  evidence: string[];
  expectedBenefit: string;
  estimatedRisk: string;
  priority: RecommendationPriority;
  actionLabel: string;
  actionType?: string;
  actionParams?: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
  accepted: boolean;
  rejected: boolean;
  acceptedAt?: string;
  rejectedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

class RecommendationEngine {
  private static instance: RecommendationEngine;
  private recommendations = new Map<string, Recommendation>();
  private maxRecs = 200;

  static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance)
      RecommendationEngine.instance = new RecommendationEngine();
    return RecommendationEngine.instance;
  }

  private makeId(): string {
    return `REC-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }

  // ── Generation ──────────────────────────────────────────────────────────────

  generateRecommendations(
    systemCtx: Record<string, unknown>,
    monitoringAlerts: Array<{ severity: string; category: string; description: string; evidence: string[] }>,
    cameras: Array<{ id: string; name: string; status: string; type?: string; location?: string }>
  ): Recommendation[] {
    const created: Recommendation[] = [];

    // Based on monitoring alerts
    for (const alert of monitoringAlerts) {
      const rec = this.alertToRecommendation(alert);
      if (rec) created.push(rec);
    }

    // Based on camera analysis
    const offlineCams = cameras.filter(c => c.status === "offline" || c.status === "error");
    if (offlineCams.length > 0) {
      created.push(this.makeRec(
        "MAINTENANCE",
        `${offlineCams.length} ta kamerani ta'mirlash`,
        `${offlineCams.length} ta kamera oflayn: ${offlineCams.map(c => c.name).slice(0, 3).join(", ")}`,
        offlineCams.map(c => `${c.name}: ${c.status}`),
        "Ko'r zonalar kamayadi, xavfsizlik qamrovi yaxshilanadi",
        "Texnik xodim kerak bo'ladi",
        "HIGH",
        "Kameralarni tekshirish",
        "NAVIGATE_TO_VIEW", { view: "cameras" }
      ));
    }

    const camCount = (systemCtx.cameraCount as number) ?? cameras.length;
    if (camCount === 0) {
      created.push(this.makeRec(
        "CAMERA_PLACEMENT",
        "Kamera qo'shish",
        "Tizimda kameralar ro'yxatdan o'tmagan",
        ["cameraCount=0"],
        "Hududni qamrab olish boshlansa, xavfsizlik ta'minlanadi",
        "Past — faqat kamera o'rnatish va ulanishni talab qiladi",
        "CRITICAL",
        "Kamera qo'shish",
        "NAVIGATE_TO_VIEW", { view: "cameras" }
      ));
    }

    // Storage recommendation
    const disk = (systemCtx as any)?.systemHealth?.diskUsagePercentage ?? 0;
    if (disk > 70) {
      created.push(this.makeRec(
        "STORAGE_MANAGEMENT",
        "Eski yozuvlarni arxivlash",
        `Disk ${disk}% ga to'ldi — arxivlash tavsiya etiladi`,
        [`diskUsage=${disk}%`],
        "Yozuv to'xtab qolishining oldini oladi, saqlash hajmini bo'shatadi",
        "Past — faqat arxivlash jarayonini ishga tushirish",
        disk > 85 ? "CRITICAL" : "HIGH",
        "Arxivlashni boshlash",
        "NAVIGATE_TO_VIEW", { view: "settings" }
      ));
    }

    // Evidence recommendations
    const evidenceCount = (systemCtx.evidenceCount as number) ?? 0;
    if (evidenceCount > 500) {
      created.push(this.makeRec(
        "STORAGE_MANAGEMENT",
        "Dalillar bazasini optimallashtirish",
        `${evidenceCount} ta dalil yig'ilgan — tozalash tavsiya etiladi`,
        [`evidenceCount=${evidenceCount}`],
        "Qidiruv tezligi oshadi, xotira bo'shatiladi",
        "O'rtacha — muhim dalillarni yo'qotib qo'yish xavfi bor",
        "MEDIUM",
        "Dalillarni boshqarish",
        "NAVIGATE_TO_VIEW", { view: "investigation" }
      ));
    }

    // Open incidents
    const openInc = (systemCtx as any)?.incidentStats?.open ?? 0;
    if (openInc > 10) {
      created.push(this.makeRec(
        "WORKFLOW_IMPROVEMENT",
        "Ko'p ochiq hodisalarni hal qilish",
        `${openInc} ta hodisa hal qilinmagan — jamoaviy ko'rib chiqish tavsiya etiladi`,
        [`openIncidents=${openInc}`],
        "Operatorlar yukini kamaytiradi, SLA muvofiqligini ta'minlaydi",
        "Past — faqat qayta ko'rib chiqish vaqti kerak",
        openInc > 20 ? "HIGH" : "MEDIUM",
        "Hodisalarni ko'rish",
        "NAVIGATE_TO_VIEW", { view: "event_timeline" }
      ));
    }

    // AI calibration
    created.push(this.makeRec(
      "AI_CALIBRATION",
      "AI modellarini kalibrovka qilish",
      "Muntazam kalibrovka AI aniqligi va soxta signallar sonini optimallashtiradi",
      ["scheduled_recommendation"],
      "Soxta alarmlar kamayadi, real tahdidlar aniqroq aniqlanadi",
      "O'rtacha — kalibrovka paytida vaqtincha xatoliklar ko'payishi mumkin",
      "LOW",
      "AI sozlamalarini ko'rish",
      "NAVIGATE_TO_VIEW", { view: "settings" }
    ));

    // Store and return
    for (const rec of created) {
      this.recommendations.set(rec.recId, rec);
    }
    if (this.recommendations.size > this.maxRecs) {
      const old = Array.from(this.recommendations.keys()).slice(0, this.recommendations.size - this.maxRecs);
      for (const k of old) this.recommendations.delete(k);
    }

    return created;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  acceptRecommendation(recId: string): boolean {
    const r = this.recommendations.get(recId);
    if (!r) return false;
    r.accepted = true;
    r.acceptedAt = new Date().toISOString();
    return true;
  }

  rejectRecommendation(recId: string): boolean {
    const r = this.recommendations.get(recId);
    if (!r) return false;
    r.rejected = true;
    r.rejectedAt = new Date().toISOString();
    return true;
  }

  getRecommendations(filter?: { priority?: RecommendationPriority; category?: RecommendationCategory; pending?: boolean }): Recommendation[] {
    let recs = Array.from(this.recommendations.values()).reverse();
    if (filter?.priority) recs = recs.filter(r => r.priority === filter.priority);
    if (filter?.category) recs = recs.filter(r => r.category === filter.category);
    if (filter?.pending) recs = recs.filter(r => !r.accepted && !r.rejected);
    return recs;
  }

  getRecommendation(recId: string): Recommendation | undefined {
    return this.recommendations.get(recId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private alertToRecommendation(alert: {
    severity: string; category: string; description: string; evidence: string[];
  }): Recommendation | null {
    const catMap: Record<string, RecommendationCategory> = {
      CAMERA_HEALTH:    "MAINTENANCE",
      RECORDING_HEALTH: "RECORDING_QUALITY",
      GPU:              "CAPACITY_PLANNING",
      CPU:              "CAPACITY_PLANNING",
      RAM:              "CAPACITY_PLANNING",
      DISK:             "STORAGE_MANAGEMENT",
      NETWORK:          "NETWORK_OPTIMIZATION",
      AI_MODELS:        "AI_CALIBRATION",
    };
    const cat = catMap[alert.category] ?? "MAINTENANCE";
    const priority: RecommendationPriority =
      alert.severity === "CRITICAL" ? "CRITICAL" :
      alert.severity === "HIGH" ? "HIGH" :
      alert.severity === "WARNING" ? "MEDIUM" : "LOW";

    return this.makeRec(
      cat,
      `${alert.category} muammosini hal qilish`,
      alert.description,
      alert.evidence,
      "Tizim barqarorligi va ishlash samaradorligi yaxshilanadi",
      "Texnik ko'nikmalar talab qilinadi",
      priority,
      "Muammoni ko'rish"
    );
  }

  private makeRec(
    category: RecommendationCategory,
    title: string,
    reason: string,
    evidence: string[],
    expectedBenefit: string,
    estimatedRisk: string,
    priority: RecommendationPriority,
    actionLabel: string,
    actionType?: string,
    actionParams?: Record<string, unknown>
  ): Recommendation {
    return {
      recId: this.makeId(),
      category, title, reason, evidence, expectedBenefit, estimatedRisk,
      priority, actionLabel, actionType, actionParams,
      createdAt: new Date().toISOString(),
      accepted: false, rejected: false,
    };
  }
}

export const recommendationEngine = RecommendationEngine.getInstance();
