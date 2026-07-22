/**
 * OCRIntelligenceService
 *
 * Single responsibility: Extract all readable text from images — signs,
 * badges, license plates, documents, screens, labels — with bounding boxes,
 * confidence, language detection, and evidence references.
 */

import { GoogleGenAI } from "@google/genai";
import {
  OCRResult, VisualObservation,
  createObservation, createEvidenceAttachment,
} from "./VisionObservation.js";

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

const PROMPT = `You are the OCR Intelligence Engine of an enterprise AI Video Management System.

Extract ALL readable text from this image, including:
- Signs and notices
- Safety signs
- Labels on boxes, packages, equipment
- Badges and ID cards
- License plates / vehicle plates
- Documents and screens
- Any other visible text

Return ONLY this JSON (no markdown):
{
  "ocrResults": [
    {
      "text": "string — exact text as shown",
      "confidence": 0.0,
      "language": "string (e.g. uz, en, ru) or null",
      "sourceType": "sign|label|badge|plate|document|screen|other",
      "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 }
    }
  ],
  "totalTextRegions": 0,
  "dominantLanguage": "string or null",
  "overallConfidence": 0.0,
  "sceneDescription": "string",
  "missingInformation": ["string"]
}`;

export interface OCRRequest {
  imageData: string;
  mimeType?: string;
  cameraId: string;
  frameId?: string;
  searchText?: string;      // Optional: search for specific text
  searchRegex?: string;     // Optional: regex pattern to match
}

export interface OCRSearchResult {
  matched: boolean;
  matchedTexts: string[];
}

export interface OCRResult2 {
  observation: VisualObservation;
  ocrResults: OCRResult[];
  totalTextRegions: number;
  dominantLanguage?: string;
  searchResult?: OCRSearchResult;
}

export async function extractOCR(req: OCRRequest): Promise<OCRResult2> {
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
      ocrResults: [],
      totalTextRegions: 0,
      dominantLanguage: null,
      overallConfidence: 0,
      sceneDescription: "",
      missingInformation: [genai ? "OCR amalga oshirilmadi." : "GEMINI_API_KEY sozlanmagan."],
    };
  }

  const evRef = createEvidenceAttachment("recognition_result", req.cameraId, { frameId: req.frameId });
  const now = new Date().toISOString();

  const ocrResults: OCRResult[] = (parsed.ocrResults ?? []).map((r: any): OCRResult => ({
    text: r.text ?? "",
    confidence: r.confidence ?? 0,
    language: r.language ?? undefined,
    boundingBox: r.boundingBox ?? undefined,
    sourceType: r.sourceType ?? "other",
    evidenceRef: evRef.id,
    timestamp: now,
  }));

  // Optional text search
  let searchResult: OCRSearchResult | undefined;
  if (req.searchText || req.searchRegex) {
    const pattern = req.searchRegex
      ? new RegExp(req.searchRegex, "i")
      : new RegExp(req.searchText!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matched = ocrResults.filter(r => pattern.test(r.text));
    searchResult = {
      matched: matched.length > 0,
      matchedTexts: matched.map(r => r.text),
    };
  }

  const observation = createObservation({
    cameraId: req.cameraId,
    frameId: req.frameId ?? `frame-${Date.now()}`,
    sourceType: "uploaded_image",
    objectList: ocrResults.map((r, i) => ({
      id: `text-${i}`,
      label: "text",
      subType: r.sourceType,
      confidence: r.confidence,
      boundingBox: r.boundingBox,
      attributes: { text: r.text, language: r.language ?? "" },
      evidenceRef: evRef.id,
    })),
    sceneDescription: parsed.sceneDescription || `${ocrResults.length} ta matn sohasi aniqlandi.`,
    confidence: parsed.overallConfidence ?? 0,
    evidenceReference: [evRef],
    modelVersion: "gemini-2.0-flash",
    ocrResults,
    missingInformation: parsed.missingInformation ?? [],
    processingMs: Date.now() - t0,
  });

  return {
    observation,
    ocrResults,
    totalTextRegions: parsed.totalTextRegions ?? ocrResults.length,
    dominantLanguage: parsed.dominantLanguage ?? undefined,
    searchResult,
  };
}
