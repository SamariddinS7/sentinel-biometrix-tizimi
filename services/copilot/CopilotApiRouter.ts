/**
 * Enterprise AI Copilot — API Router
 * Mount at: /api/copilot (requires authentication)
 */

import { Router, Request, Response } from "express";
import { processCopilotQuery, executeAction } from "./CopilotOrchestrator.js";
import type { CopilotContext, CopilotQueryRequest, ActionExecutionRequest } from "./CopilotOrchestrator.js";

export const copilotApiRouter = Router();

// ─── Query endpoint ───────────────────────────────────────────────────────────

copilotApiRouter.post("/query", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Autentifikatsiya talab qilinadi." });
      return;
    }

    const {
      query,
      imageData,
      imageMimeType,
      conversationHistory,
      currentView,
      activeCameraId,
      activeAlarmId,
    } = req.body as {
      query: string;
      imageData?: string;
      imageMimeType?: string;
      conversationHistory?: Array<{ role: "user" | "copilot"; text: string }>;
      currentView?: string;
      activeCameraId?: string;
      activeAlarmId?: string;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "So'rov matni talab qilinadi." });
      return;
    }

    const context: CopilotContext = {
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      currentView,
      activeCameraId,
      activeAlarmId,
      timestamp: new Date().toISOString(),
    };

    const request: CopilotQueryRequest = {
      query: query.trim(),
      context,
      imageData,
      imageMimeType,
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
    if (!user) {
      res.status(401).json({ error: "Autentifikatsiya talab qilinadi." });
      return;
    }

    const { actionType, params } = req.body as ActionExecutionRequest;

    if (!actionType) {
      res.status(400).json({ error: "actionType talab qilinadi." });
      return;
    }

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

// ─── System context snapshot ──────────────────────────────────────────────────

copilotApiRouter.get("/context", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Autentifikatsiya talab qilinadi." });
      return;
    }

    // Return quick system snapshot for the UI to display
    res.json({
      aiEnabled: !!(process.env.GEMINI_API_KEY?.startsWith("AIzaSy")),
      userRole: user.role ?? "OPERATOR",
      userName: user.username ?? user.email ?? "Operator",
      timestamp: new Date().toISOString(),
      capabilities: [
        "natural_language",
        "visual_analysis",
        "alarm_management",
        "investigation_support",
        "system_health",
        "report_generation",
        "action_execution",
      ],
      agents: [
        { name: "IntentClassifier", status: "active" },
        { name: "SystemContextCollector", status: "active" },
        { name: "PerceptionAgent", status: process.env.GEMINI_API_KEY?.startsWith("AIzaSy") ? "active" : "limited" },
        { name: "ReasoningAgent", status: process.env.GEMINI_API_KEY?.startsWith("AIzaSy") ? "active" : "limited" },
        { name: "ActionAgent", status: "active" },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
