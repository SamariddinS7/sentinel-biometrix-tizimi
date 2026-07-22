/**
 * Vision Intelligence Platform — API Router
 * Mount at: /api/vision (requires authentication)
 */

import { Router, Request, Response } from "express";
import {
  analyzeLiveFrame,
  runInvestigation,
  analyzePersonAttributes,
  analyzeVehicles,
  extractOCR,
  analyzeBehavior,
  reconstructTimeline,
  ingestObservation,
  registerEvidence,
  getEvidence,
  queryEvidence,
  exportEvidence,
  getEvidenceStats,
} from "../services/vision/VisionIntelligencePlatform.js";
import type { TimelineType } from "../services/vision/VisionIntelligencePlatform.js";

export const visionRouter = Router();

// ── Helper ────────────────────────────────────────────────────────────────────

function getUser(req: Request): { role: string; username: string } {
  const u = (req as any).user;
  return { role: u?.role ?? "OPERATOR", username: u?.username ?? u?.email ?? "Operator" };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/live-scene
// Analyze a single live/uploaded frame for full scene understanding.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/live-scene", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, cameraId = "uploaded", operatorQuery, frameId } = req.body as {
      imageData: string;
      mimeType?: string;
      cameraId?: string;
      operatorQuery?: string;
      frameId?: string;
    };

    if (!imageData) {
      res.status(400).json({ error: "imageData talab qilinadi." });
      return;
    }

    const result = await analyzeLiveFrame({ imageData, mimeType, cameraId, operatorQuery, frameId });

    // Register evidence and ingest into timeline store
    const evRecord = registerEvidence(result.observation, ["live_scene"], getUser(req).username);
    ingestObservation(result.observation);

    res.json({
      observation:     result.observation,
      activitySummary: result.activitySummary,
      unusualEvents:   result.unusualEvents,
      evidenceId:      evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] live-scene error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/investigate
// Run an investigation query against video/image evidence.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/investigate", async (req: Request, res: Response) => {
  try {
    const { query, cameraId = "uploaded", mediaData, mimeType, timeRange } = req.body as {
      query: string;
      cameraId?: string;
      mediaData?: string;
      mimeType?: string;
      timeRange?: { from: string; to: string };
    };

    if (!query) {
      res.status(400).json({ error: "query talab qilinadi." });
      return;
    }

    const result = await runInvestigation({ query, cameraId, mediaData, mimeType, timeRange });
    const evRecord = registerEvidence(result.observation, ["investigation"], getUser(req).username);
    ingestObservation(result.observation);

    res.json({
      observation:          result.observation,
      queryType:            result.queryType,
      investigationSummary: result.investigationSummary,
      findings:             result.findings,
      timelineEntries:      result.timelineEntries,
      evidenceId:           evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] investigate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/person-attributes
// Extract detailed person attributes from an image.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/person-attributes", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, cameraId = "uploaded", frameId } = req.body as {
      imageData: string;
      mimeType?: string;
      cameraId?: string;
      frameId?: string;
    };

    if (!imageData) {
      res.status(400).json({ error: "imageData talab qilinadi." });
      return;
    }

    const result = await analyzePersonAttributes({ imageData, mimeType, cameraId, frameId });
    const evRecord = registerEvidence(result.observation, ["person_attributes"], getUser(req).username);

    res.json({
      observation:           result.observation,
      persons:               result.persons,
      totalPersonsDetected:  result.totalPersonsDetected,
      evidenceId:            evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] person-attributes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/vehicle-intel
// Detect and classify all vehicles in an image.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/vehicle-intel", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, cameraId = "uploaded", frameId } = req.body as {
      imageData: string;
      mimeType?: string;
      cameraId?: string;
      frameId?: string;
    };

    if (!imageData) {
      res.status(400).json({ error: "imageData talab qilinadi." });
      return;
    }

    const result = await analyzeVehicles({ imageData, mimeType, cameraId, frameId });
    const evRecord = registerEvidence(result.observation, ["vehicle_intel"], getUser(req).username);

    res.json({
      observation:           result.observation,
      vehicles:              result.vehicles,
      totalVehiclesDetected: result.totalVehiclesDetected,
      evidenceId:            evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] vehicle-intel error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/ocr
// Extract all text from an image with optional search.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/ocr", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, cameraId = "uploaded", frameId, searchText, searchRegex } = req.body as {
      imageData: string;
      mimeType?: string;
      cameraId?: string;
      frameId?: string;
      searchText?: string;
      searchRegex?: string;
    };

    if (!imageData) {
      res.status(400).json({ error: "imageData talab qilinadi." });
      return;
    }

    const result = await extractOCR({ imageData, mimeType, cameraId, frameId, searchText, searchRegex });
    const evRecord = registerEvidence(result.observation, ["ocr"], getUser(req).username);

    res.json({
      observation:      result.observation,
      ocrResults:       result.ocrResults,
      totalTextRegions: result.totalTextRegions,
      dominantLanguage: result.dominantLanguage,
      searchResult:     result.searchResult,
      evidenceId:       evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] ocr error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/behavior
// Analyze scene and detect observable behaviors.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/behavior", async (req: Request, res: Response) => {
  try {
    const { imageData, mimeType, cameraId = "uploaded", frameId } = req.body as {
      imageData: string;
      mimeType?: string;
      cameraId?: string;
      frameId?: string;
    };

    if (!imageData) {
      res.status(400).json({ error: "imageData talab qilinadi." });
      return;
    }

    const result = await analyzeBehavior({ imageData, mimeType, cameraId, frameId });
    const evRecord = registerEvidence(result.observation, ["behavior"], getUser(req).username);
    ingestObservation(result.observation);

    res.json({
      observation:       result.observation,
      behaviors:         result.behaviors,
      sceneType:         result.sceneType,
      lightingConditions: result.lightingConditions,
      weatherConditions: result.weatherConditions,
      crowdDensity:      result.crowdDensity,
      occupancyCount:    result.occupancyCount,
      unusualEvents:     result.unusualEvents,
      evidenceId:        evRecord.id,
    });
  } catch (err: any) {
    console.error("[Vision] behavior error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/timeline/reconstruct
// Reconstruct a chronological/movement/cross-camera/evidence/incident timeline.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/timeline/reconstruct", async (req: Request, res: Response) => {
  try {
    const { type = "chronological", cameraIds = [], fromTime, toTime } = req.body as {
      type?: TimelineType;
      cameraIds?: string[];
      fromTime?: string;
      toTime?: string;
    };

    const timeline = reconstructTimeline({ type, cameraIds, fromTime, toTime });

    res.json({ timeline });
  } catch (err: any) {
    console.error("[Vision] timeline error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vision/evidence/:observationId
// Get evidence record for a specific observation.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.get("/evidence/:observationId", async (req: Request, res: Response) => {
  try {
    const rec = getEvidence(req.params.observationId);
    if (!rec) {
      res.status(404).json({ error: "Dalil topilmadi." });
      return;
    }
    res.json({ evidence: rec });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/evidence/query
// Query the evidence store.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/evidence/query", async (req: Request, res: Response) => {
  try {
    const results = queryEvidence(req.body ?? {});
    res.json({ evidence: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vision/evidence/stats
// Evidence store statistics.
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.get("/evidence/stats", async (_req: Request, res: Response) => {
  try {
    res.json(getEvidenceStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision/evidence/:observationId/export
// Export an evidence record (marks chain of custody).
// ─────────────────────────────────────────────────────────────────────────────

visionRouter.post("/evidence/:observationId/export", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const rec = exportEvidence(req.params.observationId, user.username);
    if (!rec) {
      res.status(404).json({ error: "Dalil topilmadi." });
      return;
    }
    res.json({ evidence: rec, exported: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
