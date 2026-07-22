/**
 * Enterprise AI Copilot — API Router
 * Volume 3 · Operations Control Engine
 * Mount at: /api/copilot
 */

import { Router, Request, Response } from "express";
import {
  processCopilotQuery,
  executeAction,
  getAuditLog,
} from "./CopilotOrchestrator.js";
import type {
  CopilotContext,
  CopilotQueryRequest,
  ActionExecutionRequest,
} from "./CopilotOrchestrator.js";

export const copilotApiRouter = Router();

// ─── Query endpoint ───────────────────────────────────────────────────────────

copilotApiRouter.post("/query", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { query, imageData, imageMimeType, conversationHistory, currentView, activeCameraId, activeAlarmId } = req.body as {
      query: string;
      imageData?: string;
      imageMimeType?: string;
      conversationHistory?: Array<{ role: "user" | "copilot"; text: string }>;
      currentView?: string;
      activeCameraId?: string;
      activeAlarmId?: string;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "So'rov matni talab qilinadi." }); return;
    }

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      currentView, activeCameraId, activeAlarmId,
      timestamp: new Date().toISOString(),
    };

    const request: CopilotQueryRequest = {
      query: query.trim(), context, imageData, imageMimeType,
      conversationHistory: conversationHistory ?? [],
    };

    const result = await processCopilotQuery(request);
    res.json(result);
  } catch (err: any) {
    console.error("[Copilot] Query error:", err);
    res.status(500).json({ error: "Copilot xatoligi.", details: err.message });
  }
});

// ─── Action execution endpoint ────────────────────────────────────────────────

copilotApiRouter.post("/execute-action", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { actionType, params } = req.body as ActionExecutionRequest;
    if (!actionType) { res.status(400).json({ error: "actionType talab qilinadi." }); return; }

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
    };

    const result = await executeAction({ actionType, params: params ?? {}, context });
    res.json(result);
  } catch (err: any) {
    console.error("[Copilot] Action error:", err);
    res.status(500).json({ error: "Amal bajarishda xatolik.", details: err.message });
  }
});

// ─── Context snapshot ─────────────────────────────────────────────────────────

copilotApiRouter.get("/context", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    res.json({
      aiEnabled: !!(process.env.GEMINI_API_KEY?.startsWith("AIzaSy")),
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
      capabilities: [
        "camera_control", "ptz_control", "playback_control", "digital_twin",
        "incident_management", "evidence_management", "report_generation",
        "global_search", "notification_engine", "workflow_automation",
        "safe_action_execution", "audit_trail",
      ],
      agents: [
        { name: "IntentClassifier",        status: "active" },
        { name: "SystemContextCollector",  status: "active" },
        { name: "PerceptionAgent",         status: process.env.GEMINI_API_KEY?.startsWith("AIzaSy") ? "active" : "limited" },
        { name: "ReasoningAgent",          status: process.env.GEMINI_API_KEY?.startsWith("AIzaSy") ? "active" : "limited" },
        { name: "ActionAgent",             status: "active" },
        { name: "WorkflowAutomationEngine",status: "active" },
        { name: "AuditLogger",             status: "active" },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Audit log endpoint ───────────────────────────────────────────────────────

copilotApiRouter.get("/audit", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }
    if (!["ADMIN", "SUPERVISOR"].includes(user.role ?? "")) {
      res.status(403).json({ error: "Faqat ADMIN va SUPERVISOR ko'ra oladi." }); return;
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json({ entries: getAuditLog(limit), total: getAuditLog(1000).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Search endpoint ──────────────────────────────────────────────────────────

copilotApiRouter.post("/search", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { domain, query, filters } = req.body as {
      domain: "cameras" | "persons" | "vehicles" | "alarms" | "incidents" | "evidence" | "face" | "appearance" | "timeline";
      query?: string;
      filters?: Record<string, unknown>;
    };

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
    };

    const actionTypeMap: Record<string, any> = {
      cameras:    "SEARCH_CAMERAS",
      persons:    "SEARCH_PERSONS",
      vehicles:   "SEARCH_VEHICLES",
      alarms:     "SEARCH_ALARMS",
      incidents:  "SEARCH_INCIDENTS",
      evidence:   "SEARCH_EVIDENCE_DB",
      face:       "SEARCH_FACE",
      appearance: "SEARCH_APPEARANCE",
      timeline:   "SEARCH_TIMELINE",
    };

    const actionType = actionTypeMap[domain];
    if (!actionType) { res.status(400).json({ error: `Noma'lum qidiruv domeni: ${domain}` }); return; }

    const result = await executeAction({ actionType, params: { query, ...filters }, context });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workflow execution endpoint ──────────────────────────────────────────────

copilotApiRouter.post("/workflow", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { workflowId, params } = req.body as { workflowId: string; params?: Record<string, unknown> };
    if (!workflowId) { res.status(400).json({ error: "workflowId talab qilinadi." }); return; }

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
    };

    const result = await executeAction({
      actionType: "EXECUTE_WORKFLOW",
      params: { workflowId, ...(params ?? {}) },
      context,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Incidents endpoint ───────────────────────────────────────────────────────

copilotApiRouter.get("/incidents", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { incidentService } = await import("../incidentService.js");
    const incidents = incidentService.getAll({ limit: 50 });
    const stats = incidentService.getStats();
    res.json({ incidents, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

copilotApiRouter.post("/incidents", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
    };

    const result = await executeAction({ actionType: "CREATE_INCIDENT", params: req.body, context });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cameras endpoint ─────────────────────────────────────────────────────────

copilotApiRouter.get("/cameras", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ error: "Autentifikatsiya talab qilinadi." }); return; }

    const { cameraService } = await import("../cameraService.js");
    const cameras = await cameraService.getAllCameras();
    res.json({ cameras: cameras.map((c: any) => ({ id: c.id, name: c.name, status: c.status, type: c.type, location: c.location })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
