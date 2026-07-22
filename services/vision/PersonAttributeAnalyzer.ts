/**
 * PersonAttributeAnalyzer
 *
 * Single responsibility: Extract detailed person attributes from images or
 * video frames. Reports only directly observable physical attributes —
 * never infers identity, intent, or sensitive characteristics.
 */

import { GoogleGenAI } from "@google/genai";
import {
  PersonAttributes, VisualObservation,
  createObservation, createEvidenceAttachment,
} from "./VisionObservation.js";

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

const PROMPT = `You are the Person Attribute Analyzer of an enterprise AI Video Management System.

Extract observable physical attributes of every person visible in this image.

STRICT RULES:
- Report ONLY directly observable attributes
- NEVER infer identity, ethnicity, religion, or emotional state
- If an attribute cannot be clearly determined, omit it or flag as uncertain
- Confidence reflects clarity of observation, not model certainty

Return ONLY this JSON (no markdown):
{
  "persons": [
    {
      "personIndex": 0,
      "upperClothingColor": "string or null",
      "lowerClothingColor": "string or null",
      "shoes": "string or null",
      "hasHelmet": false,
      "hasSafetyVest": false,
      "hasMask": false,
      "hasBackpack": false,
      "hasHandbag": false,
      "hasUmbrella": false,
      "hasReflectiveClothing": false,
      "estimatedHeightRange": "string or null",
      "bodyBuild": "slim|average|heavy|null",
      "movementDirection": "string or null",
      "movementType": "walking|running|standing|sitting|null",
      "carryingObject": "string or null",
      "hasBicycle": false,
      "hasWheelchair": false,
      "confidence": 0.0
    }
  ],
  "totalPersonsDetected": 0,
  "overallConfidence": 0.0,
  "missingInformation": ["string"]
}`;

export interface PersonAttributeRequest {
  imageData: string;
  mimeType?: string;
  cameraId: string;
  frameId?: string;
}

export interface PersonAttributeResult {
  observation: VisualObservation;
  persons: PersonAttributes[];
  totalPersonsDetected: number;
}

export async function analyzePersonAttributes(req: PersonAttributeRequest): Promise<PersonAttributeResult> {
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
      persons: [],
      totalPersonsDetected: 0,
      overallConfidence: 0,
      missingInformation: [genai ? "Tahlil amalga oshirilmadi." : "GEMINI_API_KEY sozlanmagan."],
    };
  }

  const evRef = createEvidenceAttachment("snapshot", req.cameraId, { frameId: req.frameId });

  const now = new Date().toISOString();
  const persons: PersonAttributes[] = (parsed.persons ?? []).map((p: any): PersonAttributes => ({
    upperClothingColor: p.upperClothingColor ?? undefined,
    lowerClothingColor: p.lowerClothingColor ?? undefined,
    shoes: p.shoes ?? undefined,
    hasHelmet: p.hasHelmet ?? false,
    hasSafetyVest: p.hasSafetyVest ?? false,
    hasMask: p.hasMask ?? false,
    hasBackpack: p.hasBackpack ?? false,
    hasHandbag: p.hasHandbag ?? false,
    hasUmbrella: p.hasUmbrella ?? false,
    hasReflectiveClothing: p.hasReflectiveClothing ?? false,
    estimatedHeightRange: p.estimatedHeightRange ?? undefined,
    bodyBuild: p.bodyBuild !== "null" ? p.bodyBuild : undefined,
    movementDirection: p.movementDirection ?? undefined,
    movementType: p.movementType !== "null" ? p.movementType : undefined,
    carryingObject: p.carryingObject ?? undefined,
    hasBicycle: p.hasBicycle ?? false,
    hasWheelchair: p.hasWheelchair ?? false,
    confidence: p.confidence ?? 0,
    observationTime: now,
    camera: req.cameraId,
    evidenceRef: evRef.id,
  }));

  const observation = createObservation({
    cameraId: req.cameraId,
    frameId: req.frameId ?? `frame-${Date.now()}`,
    sourceType: "uploaded_image",
    objectList: persons.map((_, i) => ({
      id: `person-${i}`,
      label: "person",
      confidence: persons[i].confidence,
      attributes: {},
      evidenceRef: evRef.id,
    })),
    sceneDescription: `${parsed.totalPersonsDetected ?? persons.length} ta shaxs aniqlandi.`,
    confidence: parsed.overallConfidence ?? 0,
    evidenceReference: [evRef],
    modelVersion: "gemini-2.0-flash",
    personAttributes: persons,
    missingInformation: parsed.missingInformation ?? [],
    processingMs: Date.now() - t0,
  });

  return { observation, persons, totalPersonsDetected: parsed.totalPersonsDetected ?? persons.length };
}
