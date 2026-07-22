/**
 * LiveVideoUnderstandingService
 *
 * Single responsibility: Continuously understand live video frames and
 * produce structured VisualObservations with scene descriptions, activity
 * summaries, unusual event detection, crowd density, and occupancy estimates.
 */

import { GoogleGenAI } from "@google/genai";
import {
  VisualObservation, createObservation, createEvidenceAttachment,
  DetectedObject, BehaviorObservation,
} from "./VisionObservation.js";

// ─── Gemini client ─────────────────────────────────────────────────────────────

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildLiveScenePrompt(cameraId: string, operatorQuery?: string): string {
  return `You are the Vision Intelligence Platform of an enterprise AI Video Management System.

Analyze this security camera frame from camera "${cameraId}".

${operatorQuery ? `Operator query: "${operatorQuery}"` : ""}

ABSOLUTE RULES:
- Describe ONLY what is directly observable in the image
- Never infer emotions, intentions, or criminality
- Never fabricate detections
- If multiple explanations exist, list them as possibilities
- If image quality limits analysis, state what is missing

Respond ONLY with this JSON (no markdown fences):
{
  "sceneDescription": "string — clear, factual description of the current scene",
  "activitySummary": "string — what is happening right now",
  "unusualEvents": ["string"],
  "crowdDensity": 0.0,
  "occupancyCount": 0,
  "objectList": [
    {
      "label": "string (person|vehicle|fire|smoke|object)",
      "subType": "string or null",
      "confidence": 0.0,
      "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
      "attributes": {}
    }
  ],
  "behaviorObservations": [
    {
      "type": "running|loitering|queue_formation|object_left_behind|object_removed|restricted_area_entry|wrong_direction|unsafe_movement|crowd_formation|unknown",
      "description": "string",
      "confidence": 0.0,
      "alternativeInterpretations": ["string"]
    }
  ],
  "missingInformation": ["string"],
  "alternativeInterpretations": ["string"],
  "confidence": 0.0
}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface LiveAnalysisRequest {
  cameraId: string;
  imageData: string;       // base64 (with or without data URL prefix)
  mimeType?: string;
  operatorQuery?: string;
  frameId?: string;
}

export interface LiveAnalysisResult {
  observation: VisualObservation;
  activitySummary: string;
  unusualEvents: string[];
}

export async function analyzeLiveFrame(req: LiveAnalysisRequest): Promise<LiveAnalysisResult> {
  const t0 = Date.now();
  const genai = getGenAI();

  const base64 = req.imageData.includes(",") ? req.imageData.split(",")[1] : req.imageData;
  const mimeType = (req.mimeType ?? "image/jpeg") as any;

  let parsed: any = null;

  if (genai && base64) {
    try {
      const res = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: buildLiveScenePrompt(req.cameraId, req.operatorQuery) },
          ],
        }],
      });
      const raw = (res.text ?? "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback below */ }
  }

  if (!parsed) {
    parsed = {
      sceneDescription: genai ? "Tasvir tahlili yakunlanmadi." : "AI modeli mavjud emas. GEMINI_API_KEY sozlang.",
      activitySummary: "Tahlil amalga oshirilmadi.",
      unusualEvents: [],
      crowdDensity: 0,
      occupancyCount: 0,
      objectList: [],
      behaviorObservations: [],
      missingInformation: ["GEMINI_API_KEY sozlanmagan yoki tasvir o'qib bo'lmadi."],
      alternativeInterpretations: [],
      confidence: 0,
    };
  }

  const evidenceAttachment = createEvidenceAttachment("snapshot", req.cameraId, {
    frameId: req.frameId ?? `frame-${Date.now()}`,
    query: req.operatorQuery,
    hasImage: true,
  });

  const objectList: DetectedObject[] = (parsed.objectList ?? []).map((o: any, i: number) => ({
    id: `obj-${i}-${Date.now()}`,
    label: o.label ?? "unknown",
    subType: o.subType ?? undefined,
    confidence: o.confidence ?? 0,
    boundingBox: o.boundingBox ?? undefined,
    attributes: o.attributes ?? {},
  }));

  const behaviorObservations: BehaviorObservation[] = (parsed.behaviorObservations ?? []).map((b: any) => ({
    type: b.type ?? "unknown",
    description: b.description ?? "",
    confidence: b.confidence ?? 0,
    alternativeInterpretations: b.alternativeInterpretations ?? [],
    evidenceRef: evidenceAttachment.id,
    observationTime: new Date().toISOString(),
  }));

  const observation = createObservation({
    cameraId: req.cameraId,
    frameId: req.frameId ?? `frame-${Date.now()}`,
    sourceType: "live_stream",
    objectList,
    sceneDescription: parsed.sceneDescription ?? "",
    confidence: parsed.confidence ?? 0,
    evidenceReference: [evidenceAttachment],
    modelVersion: "gemini-2.0-flash",
    crowdDensity: parsed.crowdDensity ?? 0,
    occupancyCount: parsed.occupancyCount ?? 0,
    unusualEvents: parsed.unusualEvents ?? [],
    behaviorObservations,
    missingInformation: parsed.missingInformation ?? [],
    alternativeInterpretations: parsed.alternativeInterpretations ?? [],
    processingMs: Date.now() - t0,
  });

  return {
    observation,
    activitySummary: parsed.activitySummary ?? "",
    unusualEvents: parsed.unusualEvents ?? [],
  };
}
