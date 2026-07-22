/**
 * SceneBehaviorAnalyzer
 *
 * Single responsibility: Recognize observable behaviors and describe the
 * environment. Never infers emotions, intentions, or criminality.
 * If multiple explanations are possible, lists them as possibilities.
 */

import { GoogleGenAI } from "@google/genai";
import {
  BehaviorObservation, VisualObservation,
  createObservation, createEvidenceAttachment,
} from "./VisionObservation.js";

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

const PROMPT = `You are the Scene and Behavior Analyzer of an enterprise AI Video Management System.

Analyze this image/frame and:
1. Describe the environment (scene type, layout, conditions)
2. Identify all observable behaviors — describe ONLY what is visible, never infer intent or emotion
3. Flag any unusual or potentially safety-relevant behaviors

CRITICAL RULES:
- NEVER infer emotions, intentions, or criminality
- Describe behaviors factually: "person moving quickly" not "person fleeing"
- If multiple explanations exist, list ALL of them under alternativeInterpretations
- Only flag behaviors directly observable in the image

Behavior types to check:
- running, loitering, queue_formation, object_left_behind, object_removed
- restricted_area_entry, wrong_direction, unsafe_movement, crowd_formation

Return ONLY this JSON (no markdown):
{
  "sceneType": "string (e.g. loading dock, office corridor, parking lot)",
  "sceneDescription": "string — factual environment description",
  "lightingConditions": "string",
  "weatherConditions": "string or null (outdoor only)",
  "crowdDensity": 0.0,
  "occupancyCount": 0,
  "behaviorObservations": [
    {
      "type": "running|loitering|queue_formation|object_left_behind|object_removed|restricted_area_entry|wrong_direction|unsafe_movement|crowd_formation|unknown",
      "description": "string — factual, observable description",
      "confidence": 0.0,
      "alternativeInterpretations": ["string"],
      "severity": "low|medium|high"
    }
  ],
  "unusualEvents": ["string"],
  "missingInformation": ["string"],
  "overallConfidence": 0.0
}`;

export interface BehaviorAnalysisRequest {
  imageData: string;
  mimeType?: string;
  cameraId: string;
  frameId?: string;
}

export interface BehaviorAnalysisResult {
  observation: VisualObservation;
  behaviors: BehaviorObservation[];
  sceneType: string;
  lightingConditions: string;
  weatherConditions?: string;
  crowdDensity: number;
  occupancyCount: number;
  unusualEvents: string[];
}

export async function analyzeBehavior(req: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResult> {
  const t0 = Date.now();
  const genai = getGenAI();
  const base64 = req.imageData.includes(",") ? req.imageData.split(",")[1] : req.imageData;

  let parsed: any = null;
  if (genai && base64) {
    try {
      const res = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: (req.mimeType ?? "image/jpeg") as any, data: base64 } },
            { text: PROMPT },
          ],
        }],
      });
      const raw = (res.text ?? "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* fallback */ }
  }

  if (!parsed) {
    parsed = {
      sceneType: "Noma'lum",
      sceneDescription: genai ? "Tahlil amalga oshirilmadi." : "GEMINI_API_KEY sozlanmagan.",
      lightingConditions: "Noma'lum",
      weatherConditions: null,
      crowdDensity: 0,
      occupancyCount: 0,
      behaviorObservations: [],
      unusualEvents: [],
      missingInformation: ["Media yuklanmadi yoki AI modeli mavjud emas."],
      overallConfidence: 0,
    };
  }

  const evRef = createEvidenceAttachment("snapshot", req.cameraId, { frameId: req.frameId });
  const now = new Date().toISOString();

  const behaviors: BehaviorObservation[] = (parsed.behaviorObservations ?? []).map((b: any): BehaviorObservation => ({
    type: b.type ?? "unknown",
    description: b.description ?? "",
    confidence: b.confidence ?? 0,
    alternativeInterpretations: b.alternativeInterpretations ?? [],
    evidenceRef: evRef.id,
    observationTime: now,
  }));

  const observation = createObservation({
    cameraId: req.cameraId,
    frameId: req.frameId ?? `frame-${Date.now()}`,
    sourceType: "uploaded_image",
    objectList: [],
    sceneDescription: parsed.sceneDescription ?? "",
    confidence: parsed.overallConfidence ?? 0,
    evidenceReference: [evRef],
    modelVersion: "gemini-2.0-flash",
    behaviorObservations: behaviors,
    crowdDensity: parsed.crowdDensity ?? 0,
    occupancyCount: parsed.occupancyCount ?? 0,
    unusualEvents: parsed.unusualEvents ?? [],
    missingInformation: parsed.missingInformation ?? [],
    processingMs: Date.now() - t0,
  });

  return {
    observation,
    behaviors,
    sceneType: parsed.sceneType ?? "Noma'lum",
    lightingConditions: parsed.lightingConditions ?? "Noma'lum",
    weatherConditions: parsed.weatherConditions ?? undefined,
    crowdDensity: parsed.crowdDensity ?? 0,
    occupancyCount: parsed.occupancyCount ?? 0,
    unusualEvents: parsed.unusualEvents ?? [],
  };
}
