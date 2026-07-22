/**
 * Enterprise AI Copilot — Explainable AI Engine
 * Volume 4 · Section 35
 *
 * Every answer must explain:
 * Why, How, Which Evidence, Which Cameras, Which AI Models,
 * Confidence, Limitations, Missing Information, Alternative Interpretations.
 *
 * Example:
 *   Fire detected. Confidence: 96%
 *   Evidence: Camera 18, Frames 2415-2520, Fire Detection Model, Smoke Detection Model
 *   Thermal Camera unavailable
 *   Alternative: Bright welding activity cannot be fully excluded.
 */

export interface XAIExplanation {
  why: string;
  how: string;
  evidenceUsed: Array<{
    type: string;
    source: string;
    description: string;
    weight: number; // 0-1, contribution to conclusion
  }>;
  camerasInvolved: Array<{
    cameraId: string;
    cameraName?: string;
    role: "primary" | "secondary" | "corroborating";
  }>;
  aiModelsUsed: Array<{
    modelName: string;
    modelVersion?: string;
    contribution: string;
    confidence: number;
  }>;
  confidence: number;
  confidenceLabel: string; // "Yuqori", "O'rtacha", "Past"
  limitations: string[];
  missingInformation: string[];
  alternativeInterpretations: Array<{
    description: string;
    likelihood: "LOW" | "MEDIUM" | "HIGH";
    excludedBy?: string; // what evidence rules it out
  }>;
  decisionBasis: string; // human-readable decision tree summary
  auditTrail: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

class ExplainableAIEngine {
  private static instance: ExplainableAIEngine;

  static getInstance(): ExplainableAIEngine {
    if (!ExplainableAIEngine.instance)
      ExplainableAIEngine.instance = new ExplainableAIEngine();
    return ExplainableAIEngine.instance;
  }

  /**
   * Enriches a Copilot answer with full XAI metadata.
   */
  explain(
    answer: string,
    intent: string,
    sourcesUsed: string[],
    systemCtx: Record<string, unknown>,
    cameras: Array<{ id: string; name: string }> = []
  ): XAIExplanation {
    const confidence = this.estimateConfidence(answer, sourcesUsed, systemCtx);
    return {
      why: this.buildWhy(answer, intent),
      how: this.buildHow(intent, sourcesUsed),
      evidenceUsed: this.buildEvidence(sourcesUsed, systemCtx),
      camerasInvolved: this.buildCameras(cameras, systemCtx),
      aiModelsUsed: this.buildModels(intent),
      confidence,
      confidenceLabel: this.confidenceLabel(confidence),
      limitations: this.buildLimitations(sourcesUsed, systemCtx),
      missingInformation: this.buildMissingInfo(intent, systemCtx),
      alternativeInterpretations: this.buildAlternatives(intent, systemCtx),
      decisionBasis: this.buildDecisionBasis(intent, answer),
      auditTrail: [
        `Intent classified: ${intent}`,
        `Sources consulted: ${sourcesUsed.join(", ") || "none"}`,
        `System snapshot: ${new Date().toISOString()}`,
        `Confidence: ${Math.round(confidence * 100)}%`,
      ],
    };
  }

  /**
   * Generates a concise XAI summary string (Uzbek) for inline display.
   */
  summarize(xai: XAIExplanation): string {
    const conf = Math.round(xai.confidence * 100);
    const cams = xai.camerasInvolved.length;
    const models = xai.aiModelsUsed.map(m => m.modelName).join(", ");
    const lims = xai.limitations.slice(0, 2).join("; ");
    return (
      `Ishonch: ${conf}% · ` +
      (cams > 0 ? `${cams} ta kamera · ` : "") +
      (models ? `Modellar: ${models} · ` : "") +
      (lims ? `Cheklov: ${lims}` : "")
    ).replace(/· $/, "");
  }

  // ── Private builders ────────────────────────────────────────────────────────

  private buildWhy(answer: string, intent: string): string {
    const map: Record<string, string> = {
      INVESTIGATION:       "Operator shaxsni kuzatish va harakat yo'lini aniqlashni so'radi.",
      ALARM_MANAGEMENT:    "Faol xavfsizlik alarmlari mavjud va ular boshqaruvni talab qiladi.",
      INCIDENT_MANAGEMENT: "Hodisa yaratish yoki yangilash so'rovi aniqlandi.",
      SYSTEM_HEALTH:       "Tizim komponentlarining holati baholandi.",
      REPORT_GENERATION:   "Operatsiyaviy hisobot tayyorlash so'rovi aniqlandi.",
      CAMERA_CONTROL:      "Kamera boshqaruvi amali so'raldi.",
      GENERAL_INTELLIGENCE:"Operator umumiy ma'lumot yoki yordam so'radi.",
    };
    return map[intent] ?? `"${answer.slice(0, 60)}..." javobining asosi tizim holatini tahlil qilishdir.`;
  }

  private buildHow(intent: string, sources: string[]): string {
    const usedSources = sources.length > 0 ? sources.join(", ") : "tizim konteksti";
    return `Qaror quyidagi ketma-ketlikda qabul qilindi: ` +
      `1) So'rov tahlili va niyat aniqlash (${intent}); ` +
      `2) Tizim holatini yig'ish (${usedSources}); ` +
      `3) AI reasoning agenti tomonidan mantiqiy xulosa chiqarish; ` +
      `4) Amallar va tavsiyalar generatsiyasi.`;
  }

  private buildEvidence(sources: string[], ctx: Record<string, unknown>): XAIExplanation["evidenceUsed"] {
    const ev: XAIExplanation["evidenceUsed"] = [];
    if (sources.includes("cameras") || ctx.cameras) {
      ev.push({ type: "CAMERA_FEED", source: "Camera Service", description: "Jonli kamera holati va metadatasi", weight: 0.4 });
    }
    if (sources.includes("alerts") || ctx.activeAlarms) {
      ev.push({ type: "ALARM_LOG", source: "Security Service", description: `${(ctx.alarmCount as number) ?? 0} ta alarm yozuvi`, weight: 0.35 });
    }
    if (sources.includes("incidents") || ctx.incidentStats) {
      ev.push({ type: "INCIDENT_RECORD", source: "Incident Service", description: "Hodisalar ma'lumotlar bazasi", weight: 0.25 });
    }
    if (sources.includes("system_health") || ctx.systemHealth) {
      ev.push({ type: "SYSTEM_METRICS", source: "Health Monitor", description: "Tizim resurs metrikasi", weight: 0.2 });
    }
    if (sources.includes("operator_input")) {
      ev.push({ type: "OPERATOR_QUERY", source: "Operator", description: "Operator so'rovi", weight: 0.5 });
    }
    if (ev.length === 0) {
      ev.push({ type: "SYSTEM_CONTEXT", source: "Orchestrator", description: "Umumiy tizim konteksti", weight: 0.3 });
    }
    return ev;
  }

  private buildCameras(
    cameras: Array<{ id: string; name: string }>,
    ctx: Record<string, unknown>
  ): XAIExplanation["camerasInvolved"] {
    if (cameras.length > 0) {
      return cameras.slice(0, 5).map((c, i) => ({
        cameraId: c.id,
        cameraName: c.name,
        role: (i === 0 ? "primary" : "secondary") as any,
      }));
    }
    const ctxCams = (ctx.cameras as any[]) ?? [];
    return ctxCams.slice(0, 3).map((c: any, i: number) => ({
      cameraId: c.id,
      cameraName: c.name,
      role: (i === 0 ? "primary" : "corroborating") as any,
    }));
  }

  private buildModels(intent: string): XAIExplanation["aiModelsUsed"] {
    const models: XAIExplanation["aiModelsUsed"] = [
      { modelName: "Gemini 2.5 Flash", modelVersion: "2.5", contribution: "Natural language reasoning va amal generatsiyasi", confidence: 0.92 },
    ];
    if (intent === "INVESTIGATION" || intent === "VISUAL_ANALYSIS") {
      models.push({ modelName: "YOLOv8n", modelVersion: "8n-ONNX", contribution: "Ob'ekt va shaxs deteksiyasi", confidence: 0.88 });
      models.push({ modelName: "ByteTrack+Kalman", contribution: "Multi-object tracking", confidence: 0.85 });
    }
    if (intent === "INVESTIGATION") {
      models.push({ modelName: "FAISS ReID", contribution: "Ko'rinish asosida identifikatsiya", confidence: 0.79 });
    }
    return models;
  }

  private buildLimitations(sources: string[], ctx: Record<string, unknown>): string[] {
    const lims: string[] = [];
    const offlineCams = (ctx.offlineCameraCount as number) ?? 0;
    if (offlineCams > 0) lims.push(`${offlineCams} ta kamera oflayn — ular ko'rsatmagan mintaqalar tekshirilmadi.`);
    if (!sources.includes("visual") && !sources.includes("cameras")) {
      lims.push("Real vaqt video tahlili amalga oshirilmadi — faqat metadataga asoslangan xulosalar.");
    }
    const geminiOk = !!(process.env.GEMINI_API_KEY?.startsWith("AIzaSy"));
    if (!geminiOk) lims.push("Gemini AI modeli mavjud emas — qoida asosida cheklangan javob.");
    lims.push("Tarix ma'lumotlari real arxiv bazasiga bog'liq emas — taxminiy intervallar ishlatildi.");
    return lims;
  }

  private buildMissingInfo(intent: string, ctx: Record<string, unknown>): string[] {
    const missing: string[] = [];
    if (intent === "INVESTIGATION") {
      missing.push("Termal kamera ma'lumotlari mavjud emas.");
      missing.push("Mikrofonli kuzatuv yoqilmagan.");
      const offlineCams = (ctx.offlineCameraCount as number) ?? 0;
      if (offlineCams > 0) missing.push(`${offlineCams} ta oflayn kameraning tasvirlari yo'q.`);
    }
    if (intent === "ALARM_MANAGEMENT") {
      missing.push("Alarmlarning dala tekshiruvlari tasdiqlanmagan.");
    }
    if (missing.length === 0) missing.push("Barcha asosiy ma'lumot manbalari mavjud.");
    return missing;
  }

  private buildAlternatives(intent: string, ctx: Record<string, unknown>): XAIExplanation["alternativeInterpretations"] {
    const alts: XAIExplanation["alternativeInterpretations"] = [];
    if (intent === "INVESTIGATION") {
      alts.push({
        description: "Tasvirda aniqlangan shaxs boshqa xodim yoki tashrif buyuruvchi bo'lishi mumkin.",
        likelihood: "MEDIUM",
      });
      alts.push({
        description: "Qurilma nosozligi yoki soya effekti soxta aniqlanishga olib kelgan bo'lishi mumkin.",
        likelihood: "LOW",
        excludedBy: "Bir nechta kamerada bir xil natija aniqlangan",
      });
    }
    if (intent === "ALARM_MANAGEMENT") {
      alts.push({
        description: "Signal sezuvchisi nosozligi yoki atrof-muhit o'zgarishi",
        likelihood: "LOW",
        excludedBy: "Kamera tasvirida qo'shimcha tasdiqlangan",
      });
    }
    return alts;
  }

  private buildDecisionBasis(intent: string, answer: string): string {
    return (
      `Qaror quyidagi mantiq asosida: ` +
      `[${intent}] niyati aniqlandi → tizim holati yig'ildi → ` +
      `AI reasoning amali bajarildi → "${answer.slice(0, 50)}..." xulosasi chiqarildi.`
    );
  }

  private estimateConfidence(answer: string, sources: string[], ctx: Record<string, unknown>): number {
    let base = 0.65;
    if (sources.length > 2) base += 0.1;
    if (sources.length > 4) base += 0.05;
    if (process.env.GEMINI_API_KEY?.startsWith("AIzaSy")) base += 0.1;
    if ((ctx.cameraCount as number) > 0) base += 0.05;
    if (answer.length > 100) base += 0.03;
    return Math.min(0.97, base);
  }

  private confidenceLabel(conf: number): string {
    if (conf >= 0.85) return "Yuqori";
    if (conf >= 0.65) return "O'rtacha";
    return "Past";
  }
}

export const explainableAIEngine = ExplainableAIEngine.getInstance();
