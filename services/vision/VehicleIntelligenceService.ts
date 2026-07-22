/**
 * VehicleIntelligenceService
 *
 * Single responsibility: Detect, classify, and extract attributes for all
 * vehicles visible in an image or video frame.
 */

import { GoogleGenAI } from "@google/genai";
import {
  VehicleAttributes, VisualObservation,
  createObservation, createEvidenceAttachment,
} from "./VisionObservation.js";

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

const PROMPT = `You are the Vehicle Intelligence Engine of an enterprise AI Video Management System.

Analyze this image/frame and detect all vehicles.

Return ONLY this JSON (no markdown):
{
  "vehicles": [
    {
      "vehicleIndex": 0,
      "type": "car|suv|pickup|truck|bus|motorcycle|bicycle|forklift|emergency|construction|unknown",
      "color": "string or null",
      "approximateSize": "small|medium|large|null",
      "licensePlate": "string or null",
      "licensePlateConfidence": 0.0,
      "movementDirection": "string or null",
      "parkingDuration": null,
      "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
      "confidence": 0.0
    }
  ],
  "totalVehiclesDetected": 0,
  "overallConfidence": 0.0,
  "sceneDescription": "string",
  "missingInformation": ["string"]
}`;

export interface VehicleIntelRequest {
  imageData: string;
  mimeType?: string;
  cameraId: string;
  frameId?: string;
}

export interface VehicleIntelResult {
  observation: VisualObservation;
  vehicles: VehicleAttributes[];
  totalVehiclesDetected: number;
}

export async function analyzeVehicles(req: VehicleIntelRequest): Promise<VehicleIntelResult> {
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
      vehicles: [],
      totalVehiclesDetected: 0,
      overallConfidence: 0,
      sceneDescription: "",
      missingInformation: [genai ? "Tahlil amalga oshirilmadi." : "GEMINI_API_KEY sozlanmagan."],
    };
  }

  const evRef = createEvidenceAttachment("snapshot", req.cameraId, { frameId: req.frameId });

  const vehicles: VehicleAttributes[] = (parsed.vehicles ?? []).map((v: any): VehicleAttributes => ({
    type: v.type ?? "unknown",
    color: v.color ?? undefined,
    approximateSize: v.approximateSize !== "null" ? v.approximateSize : undefined,
    licensePlate: v.licensePlate ?? undefined,
    licensePlateConfidence: v.licensePlateConfidence ?? undefined,
    movementDirection: v.movementDirection ?? undefined,
    parkingDuration: v.parkingDuration ?? undefined,
    confidence: v.confidence ?? 0,
    evidenceRef: evRef.id,
  }));

  const observation = createObservation({
    cameraId: req.cameraId,
    frameId: req.frameId ?? `frame-${Date.now()}`,
    sourceType: "uploaded_image",
    objectList: (parsed.vehicles ?? []).map((v: any, i: number) => ({
      id: `vehicle-${i}`,
      label: "vehicle",
      subType: v.type,
      confidence: v.confidence ?? 0,
      boundingBox: v.boundingBox ?? undefined,
      attributes: { color: v.color, plate: v.licensePlate },
      evidenceRef: evRef.id,
    })),
    sceneDescription: parsed.sceneDescription ?? `${vehicles.length} ta transport vositasi aniqlandi.`,
    confidence: parsed.overallConfidence ?? 0,
    evidenceReference: [evRef],
    modelVersion: "gemini-2.0-flash",
    vehicleAttributes: vehicles,
    missingInformation: parsed.missingInformation ?? [],
    processingMs: Date.now() - t0,
  });

  return { observation, vehicles, totalVehiclesDetected: parsed.totalVehiclesDetected ?? vehicles.length };
}
