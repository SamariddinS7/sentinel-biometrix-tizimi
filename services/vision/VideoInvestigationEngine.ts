/**
 * VideoInvestigationEngine
 *
 * Single responsibility: Answer investigation queries against recorded video
 * or uploaded footage. Supports natural-language forensic questions and
 * produces structured VisualObservations with timeline entries.
 */

import { GoogleGenAI } from "@google/genai";
import {
  VisualObservation, createObservation, createEvidenceAttachment,
  DetectedObject, TimelineEntry,
} from "./VisionObservation.js";
import { randomUUID } from "crypto";

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  return key?.startsWith("AIzaSy") ? new GoogleGenAI({ apiKey: key }) : null;
}

// ─── Investigation query types ─────────────────────────────────────────────────

export type InvestigationQueryType =
  | "who_entered"
  | "who_exited"
  | "how_many_people"
  | "who_stayed_longest"
  | "who_entered_together"
  | "who_returned"
  | "find_person_by_attribute"
  | "find_object"
  | "find_event"
  | "general_investigation";

const QUERY_TYPE_PATTERNS: Array<{ type: InvestigationQueryType; patterns: RegExp[] }> = [
  { type: "who_entered",           patterns: [/kim kirdi|who entered|kirish/i] },
  { type: "who_exited",            patterns: [/kim chiqdi|who exited|chiqish/i] },
  { type: "how_many_people",       patterns: [/nechta|how many|son|count/i] },
  { type: "who_stayed_longest",    patterns: [/eng uzoq|longest|stayed/i] },
  { type: "who_entered_together",  patterns: [/birgalikda|together|with/i] },
  { type: "who_returned",          patterns: [/qaytib keldi|returned|came back/i] },
  { type: "find_person_by_attribute", patterns: [/ryukzak|backpack|sariq|yellow|helmet|dubulg'a|kiyim|wearing|ves|vest/i] },
  { type: "find_object",           patterns: [/top|forklift|truck|yuk|smoke|tutun|fire|olov|abandon|tashlab/i] },
  { type: "find_event",            patterns: [/nima bo'ldi|what happened|voqea|event|incident/i] },
];

function classifyQuery(query: string): InvestigationQueryType {
  for (const { type, patterns } of QUERY_TYPE_PATTERNS) {
    if (patterns.some(p => p.test(query))) return type;
  }
  return "general_investigation";
}

function buildInvestigationPrompt(query: string, cameraId: string, queryType: InvestigationQueryType): string {
  return `You are the Video Investigation Engine of an enterprise AI Video Management System.

You are analyzing footage from camera "${cameraId}".
Investigation query: "${query}"
Query type: ${queryType}

RULES:
- Describe ONLY what is directly observable
- Never infer emotions, intent, or criminality
- If uncertain, state the uncertainty explicitly
- Present multiple possible interpretations when applicable
- Every finding must reference what was observed

Return ONLY this JSON (no markdown):
{
  "investigationSummary": "string — direct answer to the investigation query",
  "findings": [
    {
      "finding": "string — specific observable finding",
      "confidence": 0.0,
      "timestamp": "string — estimated time or null",
      "alternatives": ["string"]
    }
  ],
  "objectList": [
    {
      "label": "string",
      "subType": "string or null",
      "confidence": 0.0,
      "boundingBox": { "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0 },
      "attributes": {}
    }
  ],
  "timelineEntries": [
    {
      "timestamp": "string",
      "eventType": "string",
      "description": "string",
      "objectIds": ["string"],
      "confidence": 0.0
    }
  ],
  "relevantCameras": ["string"],
  "missingInformation": ["string"],
  "overallConfidence": 0.0,
  "sceneDescription": "string"
}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InvestigationRequest {
  query: string;
  cameraId: string;
  mediaData?: string;     // base64 image or video
  mimeType?: string;
  timeRange?: { from: string; to: string };
}

export interface InvestigationFinding {
  finding: string;
  confidence: number;
  timestamp?: string;
  alternatives?: string[];
}

export interface InvestigationResult {
  observation: VisualObservation;
  queryType: InvestigationQueryType;
  investigationSummary: string;
  findings: InvestigationFinding[];
  timelineEntries: TimelineEntry[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function runInvestigation(req: InvestigationRequest): Promise<InvestigationResult> {
  const t0 = Date.now();
  const genai = getGenAI();
  const queryType = classifyQuery(req.query);

  const parts: any[] = [];
  if (req.mediaData) {
    const base64 = req.mediaData.includes(",") ? req.mediaData.split(",")[1] : req.mediaData;
    const isVideo = req.mimeType?.startsWith("video") ?? false;
    parts.push({ inlineData: { mimeType: (req.mimeType ?? "image/jpeg") as any, data: base64 } });
  }
  parts.push({ text: buildInvestigationPrompt(req.query, req.cameraId, queryType) });

  let parsed: any = null;
  if (genai && parts.length > 0) {
    try {
      const res = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts }],
      });
      const raw = (res.text ?? "").replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* fallback */ }
  }

  if (!parsed) {
    parsed = {
      investigationSummary: genai
        ? "Media ma'lumotlari tahlil qilinmadi."
        : "AI modeli mavjud emas. GEMINI_API_KEY sozlang.",
      findings: [],
      objectList: [],
      timelineEntries: [],
      relevantCameras: [req.cameraId],
      missingInformation: ["Media yuklanmadi yoki AI modeli mavjud emas."],
      overallConfidence: 0,
      sceneDescription: "",
    };
  }

  const evRef = createEvidenceAttachment(req.mediaData ? "snapshot" : "timeline_entry", req.cameraId, {
    query: req.query,
    queryType,
    timeRange: req.timeRange,
  });

  const objectList: DetectedObject[] = (parsed.objectList ?? []).map((o: any, i: number) => ({
    id: `inv-obj-${i}-${Date.now()}`,
    label: o.label ?? "unknown",
    subType: o.subType ?? undefined,
    confidence: o.confidence ?? 0,
    boundingBox: o.boundingBox ?? undefined,
    attributes: o.attributes ?? {},
    evidenceRef: evRef.id,
  }));

  const timelineEntries: TimelineEntry[] = (parsed.timelineEntries ?? []).map((te: any) => ({
    id: randomUUID(),
    timestamp: te.timestamp ?? new Date().toISOString(),
    cameraId: req.cameraId,
    eventType: te.eventType ?? "event",
    description: te.description ?? "",
    objectIds: te.objectIds ?? [],
    confidence: te.confidence ?? 0,
    evidenceRef: evRef.id,
  }));

  const observation = createObservation({
    cameraId: req.cameraId,
    sourceType: req.mimeType?.startsWith("video") ? "recorded_video" : req.mediaData ? "evidence_image" : "recorded_video",
    objectList,
    sceneDescription: parsed.sceneDescription ?? parsed.investigationSummary ?? "",
    confidence: parsed.overallConfidence ?? 0,
    evidenceReference: [evRef],
    modelVersion: "gemini-2.0-flash",
    timelineEntries,
    relevantCameras: parsed.relevantCameras ?? [req.cameraId],
    missingInformation: parsed.missingInformation ?? [],
    processingMs: Date.now() - t0,
  });

  return {
    observation,
    queryType,
    investigationSummary: parsed.investigationSummary ?? "",
    findings: (parsed.findings ?? []) as InvestigationFinding[],
    timelineEntries,
  };
}
