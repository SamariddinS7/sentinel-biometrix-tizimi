/**
 * Enterprise AI Copilot — Learning & Adaptation Engine
 * Volume 4 · Section 37
 *
 * Learns operational preferences WITHOUT changing security policies.
 *
 * Tracks: Preferred Layouts, Frequently Used Cameras, Preferred Reports,
 * Saved Investigations, Common Search Patterns, Custom Workflows.
 *
 * NEVER modifies AI models, thresholds, or security config automatically.
 * Any optimization requiring configuration changes → Recommendation only.
 */

export interface CameraUsageRecord {
  cameraId: string;
  cameraName?: string;
  accessCount: number;
  lastAccessedAt: string;
  avgDailyAccess: number;
}

export interface SearchPattern {
  domain: string;
  query: string;
  count: number;
  lastUsedAt: string;
}

export interface CustomWorkflow {
  workflowId: string;
  name: string;
  steps: Array<{ action: string; params: Record<string, unknown> }>;
  createdAt: string;
  runCount: number;
  lastRunAt?: string;
}

export interface OperatorPreferences {
  operatorId: string;
  preferredLayouts: string[];            // e.g. "2x2", "3x3"
  preferredReports: string[];            // report types used most
  frequentCameras: CameraUsageRecord[];  // top cameras by access count
  savedInvestigationIds: string[];
  searchPatterns: SearchPattern[];
  customWorkflows: CustomWorkflow[];
  preferredView: string;                 // last viewed section
  lastActiveAt: string;
  totalInteractions: number;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────

class LearningEngine {
  private static instance: LearningEngine;
  private preferences = new Map<string, OperatorPreferences>();

  static getInstance(): LearningEngine {
    if (!LearningEngine.instance)
      LearningEngine.instance = new LearningEngine();
    return LearningEngine.instance;
  }

  // ── Interaction recording ───────────────────────────────────────────────────

  recordInteraction(
    operatorId: string,
    action: string,
    params: Record<string, unknown>
  ): void {
    const prefs = this.getOrCreate(operatorId);
    prefs.totalInteractions++;
    prefs.lastActiveAt = new Date().toISOString();

    // Camera access
    if (action === "OPEN_CAMERA" || action === "PIN_CAMERA" || action === "FOLLOW_CAMERA") {
      const cameraId = params.cameraId as string;
      if (cameraId) this.recordCameraAccess(prefs, cameraId, params.cameraName as string | undefined);
    }

    // Layout preference
    if (action === "SET_GRID_LAYOUT" && params.layout) {
      const layout = params.layout as string;
      if (!prefs.preferredLayouts.includes(layout)) {
        prefs.preferredLayouts.unshift(layout);
        prefs.preferredLayouts = prefs.preferredLayouts.slice(0, 5);
      } else {
        // Move to front
        prefs.preferredLayouts = [layout, ...prefs.preferredLayouts.filter(l => l !== layout)].slice(0, 5);
      }
    }

    // Report preference
    if (action.startsWith("GENERATE_") && action.endsWith("_REPORT")) {
      const reportType = action.replace("GENERATE_", "").replace("_REPORT", "");
      if (!prefs.preferredReports.includes(reportType)) {
        prefs.preferredReports.unshift(reportType);
      } else {
        prefs.preferredReports = [reportType, ...prefs.preferredReports.filter(r => r !== reportType)].slice(0, 10);
      }
    }

    // Search pattern
    if (action.startsWith("SEARCH_") && params.query) {
      this.recordSearchPattern(prefs, action.replace("SEARCH_", "").toLowerCase(), params.query as string);
    }

    // Navigation preference
    if (action === "NAVIGATE_TO_VIEW" && params.view) {
      prefs.preferredView = params.view as string;
    }

    this.preferences.set(operatorId, prefs);
  }

  saveInvestigation(operatorId: string, invId: string): void {
    const prefs = this.getOrCreate(operatorId);
    if (!prefs.savedInvestigationIds.includes(invId)) {
      prefs.savedInvestigationIds.unshift(invId);
      prefs.savedInvestigationIds = prefs.savedInvestigationIds.slice(0, 20);
    }
    this.preferences.set(operatorId, prefs);
  }

  saveCustomWorkflow(operatorId: string, name: string, steps: CustomWorkflow["steps"]): CustomWorkflow {
    const prefs = this.getOrCreate(operatorId);
    const wf: CustomWorkflow = {
      workflowId: `WF-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      steps,
      createdAt: new Date().toISOString(),
      runCount: 0,
    };
    prefs.customWorkflows.unshift(wf);
    prefs.customWorkflows = prefs.customWorkflows.slice(0, 20);
    this.preferences.set(operatorId, prefs);
    return wf;
  }

  recordWorkflowRun(operatorId: string, workflowId: string): void {
    const prefs = this.preferences.get(operatorId);
    if (!prefs) return;
    const wf = prefs.customWorkflows.find(w => w.workflowId === workflowId);
    if (wf) {
      wf.runCount++;
      wf.lastRunAt = new Date().toISOString();
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  getPreferences(operatorId: string): OperatorPreferences {
    return this.getOrCreate(operatorId);
  }

  getTopCameras(operatorId: string, limit = 5): CameraUsageRecord[] {
    const prefs = this.preferences.get(operatorId);
    if (!prefs) return [];
    return [...prefs.frequentCameras]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  getTopSearchPatterns(operatorId: string, limit = 5): SearchPattern[] {
    const prefs = this.preferences.get(operatorId);
    if (!prefs) return [];
    return [...prefs.searchPatterns]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSuggestedActions(operatorId: string): Array<{ label: string; action: string; params: Record<string, unknown> }> {
    const prefs = this.preferences.get(operatorId);
    if (!prefs) return [];
    const suggestions: Array<{ label: string; action: string; params: Record<string, unknown> }> = [];

    // Suggest top cameras
    const topCams = this.getTopCameras(operatorId, 2);
    for (const cam of topCams) {
      suggestions.push({
        label: `${cam.cameraName ?? cam.cameraId} ochish`,
        action: "OPEN_CAMERA",
        params: { cameraId: cam.cameraId },
      });
    }

    // Suggest preferred report
    if (prefs.preferredReports[0]) {
      suggestions.push({
        label: `${prefs.preferredReports[0]} hisoboti`,
        action: `GENERATE_${prefs.preferredReports[0]}_REPORT`,
        params: {},
      });
    }

    // Suggest preferred view
    if (prefs.preferredView) {
      suggestions.push({
        label: `${prefs.preferredView} ko'rinishiga o'tish`,
        action: "NAVIGATE_TO_VIEW",
        params: { view: prefs.preferredView },
      });
    }

    return suggestions.slice(0, 5);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private getOrCreate(operatorId: string): OperatorPreferences {
    let prefs = this.preferences.get(operatorId);
    if (!prefs) {
      prefs = {
        operatorId,
        preferredLayouts: ["2x2"],
        preferredReports: [],
        frequentCameras: [],
        savedInvestigationIds: [],
        searchPatterns: [],
        customWorkflows: [],
        preferredView: "cameras",
        lastActiveAt: new Date().toISOString(),
        totalInteractions: 0,
        createdAt: new Date().toISOString(),
      };
      this.preferences.set(operatorId, prefs);
    }
    return prefs;
  }

  private recordCameraAccess(prefs: OperatorPreferences, cameraId: string, cameraName?: string): void {
    const existing = prefs.frequentCameras.find(c => c.cameraId === cameraId);
    if (existing) {
      existing.accessCount++;
      existing.lastAccessedAt = new Date().toISOString();
    } else {
      prefs.frequentCameras.push({
        cameraId,
        cameraName,
        accessCount: 1,
        lastAccessedAt: new Date().toISOString(),
        avgDailyAccess: 1,
      });
      if (prefs.frequentCameras.length > 50) {
        prefs.frequentCameras.sort((a, b) => b.accessCount - a.accessCount);
        prefs.frequentCameras = prefs.frequentCameras.slice(0, 50);
      }
    }
  }

  private recordSearchPattern(prefs: OperatorPreferences, domain: string, query: string): void {
    const existing = prefs.searchPatterns.find(s => s.domain === domain && s.query === query);
    if (existing) {
      existing.count++;
      existing.lastUsedAt = new Date().toISOString();
    } else {
      prefs.searchPatterns.push({ domain, query, count: 1, lastUsedAt: new Date().toISOString() });
      if (prefs.searchPatterns.length > 100) {
        prefs.searchPatterns.sort((a, b) => b.count - a.count);
        prefs.searchPatterns = prefs.searchPatterns.slice(0, 100);
      }
    }
  }
}

export const learningEngine = LearningEngine.getInstance();
