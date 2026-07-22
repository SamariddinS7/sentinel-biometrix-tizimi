/**
 * VisualEvidenceEngine
 *
 * Single responsibility: Maintain a queryable store of visual evidence.
 * Every conclusion produced by the Vision Platform is registered here.
 * No conclusion may be presented without an evidence reference.
 */

import { VisualObservation, EvidenceAttachment, createEvidenceAttachment } from "./VisionObservation.js";
import { randomUUID } from "crypto";

// ─── In-memory evidence store ─────────────────────────────────────────────────

interface EvidenceRecord {
  id: string;
  observationId: string;
  cameraId: string;
  timestamp: string;
  observation: VisualObservation;
  attachments: EvidenceAttachment[];
  tags: string[];
  chainOfCustody: CustodyEntry[];
}

interface CustodyEntry {
  timestamp: string;
  action: "created" | "accessed" | "exported" | "annotated" | "linked";
  actor: string;
  detail?: string;
}

const _evidence: Map<string, EvidenceRecord> = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/** Register a completed VisualObservation as evidence. */
export function registerEvidence(
  observation: VisualObservation,
  tags: string[] = [],
  actor = "system"
): EvidenceRecord {
  const existing = _evidence.get(observation.observationId);
  if (existing) return existing;

  const record: EvidenceRecord = {
    id: randomUUID(),
    observationId: observation.observationId,
    cameraId: observation.cameraId,
    timestamp: observation.timestamp,
    observation,
    attachments: [...observation.evidenceReference],
    tags,
    chainOfCustody: [{
      timestamp: new Date().toISOString(),
      action: "created",
      actor,
      detail: `${observation.sourceType} — ${observation.modelVersion}`,
    }],
  };

  _evidence.set(observation.observationId, record);
  return record;
}

/** Retrieve evidence by observation ID. */
export function getEvidence(observationId: string): EvidenceRecord | null {
  const rec = _evidence.get(observationId) ?? null;
  if (rec) {
    rec.chainOfCustody.push({
      timestamp: new Date().toISOString(),
      action: "accessed",
      actor: "operator",
    });
  }
  return rec;
}

/** Query evidence by camera, time range, tags, or object label. */
export interface EvidenceQuery {
  cameraId?: string;
  fromTime?: string;
  toTime?: string;
  tags?: string[];
  objectLabel?: string;
  sourceType?: VisualObservation["sourceType"];
  minConfidence?: number;
  limit?: number;
}

export function queryEvidence(q: EvidenceQuery): EvidenceRecord[] {
  let results = Array.from(_evidence.values());

  if (q.cameraId)     results = results.filter(r => r.cameraId === q.cameraId);
  if (q.fromTime)     results = results.filter(r => new Date(r.timestamp) >= new Date(q.fromTime!));
  if (q.toTime)       results = results.filter(r => new Date(r.timestamp) <= new Date(q.toTime!));
  if (q.sourceType)   results = results.filter(r => r.observation.sourceType === q.sourceType);
  if (q.minConfidence !== undefined)
    results = results.filter(r => r.observation.confidence >= q.minConfidence!);
  if (q.tags?.length)
    results = results.filter(r => q.tags!.some(t => r.tags.includes(t)));
  if (q.objectLabel)
    results = results.filter(r =>
      r.observation.objectList.some(o => o.label === q.objectLabel || o.subType === q.objectLabel)
    );

  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return results.slice(0, q.limit ?? 100);
}

/** Attach additional evidence to an existing observation. */
export function attachEvidence(
  observationId: string,
  type: EvidenceAttachment["type"],
  cameraId: string,
  metadata: Record<string, unknown>,
  actor = "operator"
): EvidenceAttachment | null {
  const rec = _evidence.get(observationId);
  if (!rec) return null;

  const att = createEvidenceAttachment(type, cameraId, metadata);
  rec.attachments.push(att);
  rec.chainOfCustody.push({
    timestamp: new Date().toISOString(),
    action: "annotated",
    actor,
    detail: `Attached ${type}`,
  });
  return att;
}

/** Export an evidence record (marks custody chain). */
export function exportEvidence(observationId: string, actor = "operator"): EvidenceRecord | null {
  const rec = _evidence.get(observationId);
  if (!rec) return null;
  rec.chainOfCustody.push({
    timestamp: new Date().toISOString(),
    action: "exported",
    actor,
  });
  return rec;
}

/** Summary stats for the evidence store. */
export function getEvidenceStats() {
  const all = Array.from(_evidence.values());
  const byCam = new Map<string, number>();
  for (const r of all) byCam.set(r.cameraId, (byCam.get(r.cameraId) ?? 0) + 1);
  return {
    total: all.length,
    byCameraId: Object.fromEntries(byCam),
    latestTimestamp: all.length > 0
      ? all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
      : null,
  };
}
