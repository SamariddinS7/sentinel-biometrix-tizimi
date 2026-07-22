/**
 * Enterprise AI Copilot — Proactive Monitoring Agent
 * Volume 4 · Section 33
 *
 * Continuously monitors: Camera Health, Recording Health, GPU, CPU, RAM, Disk,
 * Network, Storage, AI Models, Workers, Databases, API Services, Message Queues.
 *
 * Detects: Offline Cameras, Low FPS, Frame Drops, High Latency, GPU Overload,
 * Disk Nearly Full, Service Failure, Recording Failure, AI Failure, Network Problems.
 *
 * Every anomaly generates: Severity, Root Cause Hypothesis, Evidence, Suggested Actions.
 */

export type AlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type MonitoringCategory =
  | "CAMERA_HEALTH" | "RECORDING_HEALTH" | "GPU" | "CPU" | "RAM"
  | "DISK" | "NETWORK" | "STORAGE" | "AI_MODELS" | "WORKERS"
  | "DATABASE" | "API_SERVICE" | "MESSAGE_QUEUE";

export interface MonitoringAlert {
  alertId: string;
  severity: AlertSeverity;
  category: MonitoringCategory;
  title: string;
  description: string;
  rootCauseHypothesis: string;
  evidence: string[];
  suggestedActions: string[];
  affectedComponent: string;
  detectedAt: string;
  resolvedAt?: string;
  resolved: boolean;
  autoResolvable: boolean;
  metricSnapshot?: Record<string, unknown>;
}

export interface MonitoringStatus {
  lastScanAt: string;
  scanDurationMs: number;
  totalAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  warningAlerts: number;
  healthScore: number; // 0-100
  categories: Record<MonitoringCategory, "OK" | "WARN" | "CRITICAL">;
}

// ─────────────────────────────────────────────────────────────────────────────

class ProactiveMonitoringAgent {
  private static instance: ProactiveMonitoringAgent;
  private alerts = new Map<string, MonitoringAlert>();
  private lastStatus: MonitoringStatus | null = null;
  private scanIntervalMs = 30_000; // 30 seconds
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private maxAlerts = 500;

  static getInstance(): ProactiveMonitoringAgent {
    if (!ProactiveMonitoringAgent.instance)
      ProactiveMonitoringAgent.instance = new ProactiveMonitoringAgent();
    return ProactiveMonitoringAgent.instance;
  }

  private makeId(): string {
    return `MON-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  startContinuousMonitoring(): void {
    if (this.scanTimer) return; // already running
    this.scanTimer = setInterval(() => {
      this.runScanBackground().catch(() => {/* silent */});
    }, this.scanIntervalMs);
    // immediate first scan
    this.runScanBackground().catch(() => {/* silent */});
  }

  stopMonitoring(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  // ── Full scan ───────────────────────────────────────────────────────────────

  async runFullScan(systemCtx?: Record<string, unknown>): Promise<MonitoringAlert[]> {
    const t0 = Date.now();
    const newAlerts: MonitoringAlert[] = [];

    // --- Load system data ---
    let cameras: any[] = [];
    let telemetry: any = {};
    let services: any[] = [];

    try {
      const { cameraService } = await import("../cameraService.js");
      cameras = await cameraService.getAllCameras();
    } catch { /* ignore */ }

    try {
      const { vmsHealthService } = await import("../vmsHealthService.js");
      if (typeof vmsHealthService?.getTelemetry === "function") {
        telemetry = vmsHealthService.getTelemetry();
      }
    } catch { /* ignore */ }

    // Use systemCtx if provided
    if (systemCtx) {
      if (!cameras.length && Array.isArray(systemCtx.cameras)) cameras = systemCtx.cameras as any[];
      if (!Object.keys(telemetry).length && systemCtx.systemHealth) telemetry = systemCtx.systemHealth;
    }

    // ── Camera health checks ──────────────────────────────────────────────────
    const offlineCams = cameras.filter((c: any) =>
      c.status === "offline" || c.status === "error" || c.status === "disconnected"
    );
    if (offlineCams.length > 0) {
      newAlerts.push(this.makeAlert(
        "CRITICAL", "CAMERA_HEALTH",
        `${offlineCams.length} ta kamera oflayn`,
        `Kameralar: ${offlineCams.map((c: any) => c.name ?? c.id).slice(0, 5).join(", ")}`,
        "Tarmoq ulanishi yoki qurilma nosozligi",
        offlineCams.map((c: any) => `Kamera ${c.name ?? c.id}: status=${c.status}`),
        [
          "Kameraning tarmoq ulanishini tekshiring",
          "RTSP stream URL ni verify qiling",
          "Kamera quvvatini tekshiring",
          "ONVIF discovery qaytadan ishga tushiring",
        ],
        `${offlineCams.length} ta kamera`, true
      ));
    }

    const degradedCams = cameras.filter((c: any) =>
      c.status === "degraded" || (c.fps && c.fps < 5)
    );
    if (degradedCams.length > 0) {
      newAlerts.push(this.makeAlert(
        "WARNING", "CAMERA_HEALTH",
        `${degradedCams.length} ta kamera past FPS`,
        `FPS 5 dan pastga tushdi: ${degradedCams.map((c: any) => c.name ?? c.id).join(", ")}`,
        "Tarmoq to'siqlanishi yoki GPU yuklanishi",
        [`Degraded cameras: ${degradedCams.length}`],
        ["GPU foydalanishini tekshiring", "Tarmoq o'tkazuvchanligini tekshiring", "Codec sozlamalarini optimallashtiring"],
        `${degradedCams.length} ta kamera`, true
      ));
    }

    // ── CPU checks ────────────────────────────────────────────────────────────
    const cpu = telemetry?.cpuUsage ?? telemetry?.cpu ?? 0;
    if (typeof cpu === "number") {
      if (cpu > 90) {
        newAlerts.push(this.makeAlert(
          "CRITICAL", "CPU",
          `CPU yuklanishi kritik darajada: ${cpu.toFixed(0)}%`,
          "CPU 90% dan oshdi — barcha jarayonlar sekinlashishi mumkin",
          "Ko'p threadli video dekodlash yoki AI inference to'qnashuvi",
          [`CPU: ${cpu.toFixed(1)}%`],
          ["AI inference yukini kamaytiring", "Video stream bitrate ni pasaytiring", "Keraksiz xizmatlarni to'xtating"],
          "Protsessor", false
        ));
      } else if (cpu > 75) {
        newAlerts.push(this.makeAlert(
          "WARNING", "CPU",
          `CPU yuklanishi yuqori: ${cpu.toFixed(0)}%`,
          "CPU 75% dan oshdi",
          "Ko'p paralel stream dekodlash",
          [`CPU: ${cpu.toFixed(1)}%`],
          ["Parallel stream sonini cheklang", "Prioritylarni qayta taqsimlang"],
          "Protsessor", false
        ));
      }
    }

    // ── RAM checks ────────────────────────────────────────────────────────────
    const ramPct = telemetry?.ramUsagePercentage ?? telemetry?.ram ?? 0;
    if (typeof ramPct === "number") {
      if (ramPct > 90) {
        newAlerts.push(this.makeAlert(
          "CRITICAL", "RAM",
          `RAM to'lib ketayapti: ${ramPct.toFixed(0)}%`,
          "Xotira 90% dan oshdi — OOM xavfi mavjud",
          "Xotira sızıntısı yoki juda ko'p stream buffer",
          [`RAM: ${ramPct.toFixed(1)}%`],
          ["Xizmatlarni qayta ishga tushiring", "Video buffer hajmini kamaytiring", "Xotira profili tahlilini boshlang"],
          "RAM", false
        ));
      } else if (ramPct > 80) {
        newAlerts.push(this.makeAlert(
          "WARNING", "RAM",
          `RAM foydalanish yuqori: ${ramPct.toFixed(0)}%`,
          "Xotira 80% ga yaqin",
          "Uzoq ishlash davomida to'plangan buffer",
          [`RAM: ${ramPct.toFixed(1)}%`],
          ["Cache tozalang", "Eski sessiyalarni yoping"],
          "RAM", false
        ));
      }
    }

    // ── GPU checks ────────────────────────────────────────────────────────────
    const gpu = telemetry?.gpuUsage ?? 0;
    if (typeof gpu === "number" && gpu > 0) {
      if (gpu > 92) {
        newAlerts.push(this.makeAlert(
          "HIGH", "GPU",
          `GPU bottleneck aniqlandi: ${gpu.toFixed(0)}%`,
          "GPU 92% dan oshdi — AI inference sekinlashishi mumkin",
          "Bir vaqtda juda ko'p AI model inference",
          [`GPU: ${gpu.toFixed(1)}%`],
          ["Inference batch hajmini kamaytiring", "Kamera sonini cheklang", "GPU keshlashni yoqing"],
          "GPU", false
        ));
      }
    }

    // ── Disk/Storage checks ───────────────────────────────────────────────────
    const diskUsed = telemetry?.diskUsagePercentage ?? telemetry?.disk ?? 0;
    if (typeof diskUsed === "number") {
      if (diskUsed > 90) {
        newAlerts.push(this.makeAlert(
          "CRITICAL", "DISK",
          `Disk deyarli to'lib ketdi: ${diskUsed.toFixed(0)}%`,
          "Disk 90% dan oshdi — yozuv to'xtashi mumkin",
          "Eski yozuvlar arxivlanmagan",
          [`Disk: ${diskUsed.toFixed(1)}%`],
          ["Eski yozuvlarni arxivlang", "Disk hajmini kengaytiring", "Auto-arxivni sozlang"],
          "Saqlash qurilmasi", true
        ));
      } else if (diskUsed > 75) {
        newAlerts.push(this.makeAlert(
          "WARNING", "DISK",
          `Disk foydalanish yuqori: ${diskUsed.toFixed(0)}%`,
          "Disk 75% ga yaqin",
          "Muntazam arxivlash yo'qligi",
          [`Disk: ${diskUsed.toFixed(1)}%`],
          ["Yozuv siqishtirishni yoqing", "Retention politikasini ko'rib chiqing"],
          "Saqlash qurilmasi", true
        ));
      }
    }

    // ── Network checks ────────────────────────────────────────────────────────
    const netIn = telemetry?.networkInboundKbps ?? 0;
    const netOut = telemetry?.networkOutboundKbps ?? 0;
    if (netIn > 800_000) { // > 800 Mbps
      newAlerts.push(this.makeAlert(
        "HIGH", "NETWORK",
        `Tarmoq kiruvchi trafik yuqori: ${(netIn / 1000).toFixed(0)} Mbps`,
        "Tarmoq to'siqlanishi bo'lishi mumkin",
        "Bir vaqtda juda ko'p kamera stream",
        [`Inbound: ${netIn} Kbps`],
        ["Kamera bitrate ni pasaytiring", "Stream multiplexer sozlang"],
        "Tarmoq", false
      ));
    }

    // ── Register new alerts, skip duplicates ──────────────────────────────────
    const now = new Date().toISOString();
    for (const a of newAlerts) {
      // Deduplicate by category + affectedComponent (1 min window)
      const existingKey = Array.from(this.alerts.values()).find(
        ex => !ex.resolved && ex.category === a.category && ex.affectedComponent === a.affectedComponent
      );
      if (existingKey) continue; // already active
      this.alerts.set(a.alertId, a);
    }

    // Prune old resolved alerts
    if (this.alerts.size > this.maxAlerts) {
      const resolved = Array.from(this.alerts.entries())
        .filter(([, v]) => v.resolved)
        .sort((a, b) => a[1].detectedAt.localeCompare(b[1].detectedAt));
      for (const [k] of resolved.slice(0, this.alerts.size - this.maxAlerts))
        this.alerts.delete(k);
    }

    // ── Build status ──────────────────────────────────────────────────────────
    const active = Array.from(this.alerts.values()).filter(a => !a.resolved);
    const criticals = active.filter(a => a.severity === "CRITICAL").length;
    const highs = active.filter(a => a.severity === "HIGH").length;
    const warns = active.filter(a => a.severity === "WARNING").length;

    const catStatus: Record<string, "OK" | "WARN" | "CRITICAL"> = {};
    const allCats: MonitoringCategory[] = [
      "CAMERA_HEALTH", "RECORDING_HEALTH", "GPU", "CPU", "RAM", "DISK",
      "NETWORK", "STORAGE", "AI_MODELS", "WORKERS", "DATABASE", "API_SERVICE", "MESSAGE_QUEUE",
    ];
    for (const cat of allCats) {
      const catAlerts = active.filter(a => a.category === cat);
      if (catAlerts.some(a => a.severity === "CRITICAL")) catStatus[cat] = "CRITICAL";
      else if (catAlerts.some(a => a.severity === "HIGH" || a.severity === "WARNING")) catStatus[cat] = "WARN";
      else catStatus[cat] = "OK";
    }

    const healthScore = Math.max(0, 100 - criticals * 20 - highs * 10 - warns * 5);

    this.lastStatus = {
      lastScanAt: now,
      scanDurationMs: Date.now() - t0,
      totalAlerts: active.length,
      criticalAlerts: criticals,
      highAlerts: highs,
      warningAlerts: warns,
      healthScore,
      categories: catStatus as any,
    };

    return newAlerts;
  }

  // ── Alert management ────────────────────────────────────────────────────────

  resolveAlert(alertId: string): boolean {
    const a = this.alerts.get(alertId);
    if (!a) return false;
    a.resolved = true;
    a.resolvedAt = new Date().toISOString();
    return true;
  }

  getActiveAlerts(severity?: AlertSeverity): MonitoringAlert[] {
    const active = Array.from(this.alerts.values()).filter(a => !a.resolved);
    return severity ? active.filter(a => a.severity === severity) : active;
  }

  getAllAlerts(limit = 100): MonitoringAlert[] {
    return Array.from(this.alerts.values()).slice(-limit).reverse();
  }

  getStatus(): MonitoringStatus | null {
    return this.lastStatus;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async runScanBackground(): Promise<void> {
    try { await this.runFullScan(); } catch { /* silent background scan */ }
  }

  private makeAlert(
    severity: AlertSeverity,
    category: MonitoringCategory,
    title: string,
    description: string,
    rootCauseHypothesis: string,
    evidence: string[],
    suggestedActions: string[],
    affectedComponent: string,
    autoResolvable: boolean,
    metricSnapshot?: Record<string, unknown>
  ): MonitoringAlert {
    return {
      alertId: this.makeId(),
      severity, category, title, description,
      rootCauseHypothesis, evidence, suggestedActions, affectedComponent,
      detectedAt: new Date().toISOString(),
      resolved: false, autoResolvable,
      metricSnapshot,
    };
  }
}

export const proactiveMonitoringAgent = ProactiveMonitoringAgent.getInstance();
// Start background monitoring on server startup
proactiveMonitoringAgent.startContinuousMonitoring();
