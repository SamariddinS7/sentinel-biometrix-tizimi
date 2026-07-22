/**
 * TimelineReconstructionService
 *
 * Single responsibility: Reconstruct chronological event timelines from
 * VisualObservations. Supports chronological, movement, cross-camera,
 * evidence, and incident timelines.
 */

import { VisualObservation, TimelineEntry } from "./VisionObservation.js";
import { randomUUID } from "crypto";

export type TimelineType =
  | "chronological"
  | "movement"
  | "cross_camera"
  | "evidence"
  | "incident";

export interface ReconstructedTimeline {
  id: string;
  type: TimelineType;
  title: string;
  cameraIds: string[];
  entries: TimelineEntry[];
  summary: string;
  generatedAt: string;
  observationIds: string[];
}

// ─── In-memory store (keyed by cameraId) ─────────────────────────────────────

const _store: Map<string, VisualObservation[]> = new Map();

export function ingestObservation(obs: VisualObservation): void {
  const key = obs.cameraId;
  if (!_store.has(key)) _store.set(key, []);
  const arr = _store.get(key)!;
  arr.push(obs);
  // Keep last 500 observations per camera
  if (arr.length > 500) arr.splice(0, arr.length - 500);
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildChronologicalTimeline(
  observations: VisualObservation[],
  cameraIds: string[]
): ReconstructedTimeline {
  const entries: TimelineEntry[] = observations
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .flatMap(obs =>
      obs.objectList.map(obj => ({
        id: randomUUID(),
        timestamp: obs.timestamp,
        cameraId: obs.cameraId,
        eventType: obj.label,
        description: `${obj.label}${obj.subType ? ` (${obj.subType})` : ""} aniqlandi`,
        objectIds: [obj.id],
        confidence: obj.confidence,
        evidenceRef: obs.evidenceReference[0]?.id ?? "",
      }))
    );

  return {
    id: randomUUID(),
    type: "chronological",
    title: "Xronologik Vaqt Chizig'i",
    cameraIds,
    entries,
    summary: `${entries.length} ta voqea ${cameraIds.length} ta kamerada qayd etildi.`,
    generatedAt: new Date().toISOString(),
    observationIds: observations.map(o => o.observationId),
  };
}

function buildMovementTimeline(
  observations: VisualObservation[],
  cameraIds: string[]
): ReconstructedTimeline {
  const personObs = observations.filter(o =>
    o.objectList.some(obj => obj.label === "person")
  );

  const entries: TimelineEntry[] = personObs
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(obs => {
      const persons = obs.objectList.filter(o => o.label === "person");
      return {
        id: randomUUID(),
        timestamp: obs.timestamp,
        cameraId: obs.cameraId,
        eventType: "person_movement",
        description: `${persons.length} ta shaxs harakati — ${obs.cameraId}`,
        objectIds: persons.map(p => p.id),
        confidence: persons.reduce((s, p) => s + p.confidence, 0) / Math.max(persons.length, 1),
        evidenceRef: obs.evidenceReference[0]?.id ?? "",
      };
    });

  return {
    id: randomUUID(),
    type: "movement",
    title: "Harakat Vaqt Chizig'i",
    cameraIds,
    entries,
    summary: `${entries.length} ta harakat hodisasi ${cameraIds.length} ta kamerada qayd etildi.`,
    generatedAt: new Date().toISOString(),
    observationIds: personObs.map(o => o.observationId),
  };
}

function buildCrossCameraTimeline(
  observations: VisualObservation[],
  cameraIds: string[]
): ReconstructedTimeline {
  // Group by camera and sort chronologically to reconstruct routes
  const byCam = new Map<string, VisualObservation[]>();
  for (const obs of observations) {
    if (!byCam.has(obs.cameraId)) byCam.set(obs.cameraId, []);
    byCam.get(obs.cameraId)!.push(obs);
  }

  const entries: TimelineEntry[] = [];
  for (const [camId, camObs] of byCam) {
    const sorted = camObs.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (sorted.length > 0) {
      entries.push({
        id: randomUUID(),
        timestamp: sorted[0].timestamp,
        cameraId: camId,
        eventType: "camera_entry",
        description: `Kamera ${camId} ga kirish — ${sorted[0].objectList.length} ob'ekt`,
        objectIds: sorted[0].objectList.map(o => o.id),
        confidence: 0.7,
        evidenceRef: sorted[0].evidenceReference[0]?.id ?? "",
      });
    }
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    id: randomUUID(),
    type: "cross_camera",
    title: "Ko'p Kamerali Vaqt Chizig'i",
    cameraIds,
    entries,
    summary: `${cameraIds.length} ta kamera bo'ylab ${entries.length} ta o'tish qayd etildi.`,
    generatedAt: new Date().toISOString(),
    observationIds: observations.map(o => o.observationId),
  };
}

function buildEvidenceTimeline(
  observations: VisualObservation[],
  cameraIds: string[]
): ReconstructedTimeline {
  const entries: TimelineEntry[] = observations
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .flatMap(obs =>
      obs.evidenceReference.map(evRef => ({
        id: randomUUID(),
        timestamp: evRef.timestamp,
        cameraId: obs.cameraId,
        eventType: `evidence_${evRef.type}`,
        description: `Dalil: ${evRef.type} — ${obs.cameraId}`,
        objectIds: [],
        confidence: obs.confidence,
        evidenceRef: evRef.id,
      }))
    );

  return {
    id: randomUUID(),
    type: "evidence",
    title: "Dalillar Vaqt Chizig'i",
    cameraIds,
    entries,
    summary: `${entries.length} ta dalil elementi qayd etildi.`,
    generatedAt: new Date().toISOString(),
    observationIds: observations.map(o => o.observationId),
  };
}

function buildIncidentTimeline(
  observations: VisualObservation[],
  cameraIds: string[]
): ReconstructedTimeline {
  const incidentObs = observations.filter(o =>
    (o.unusualEvents && o.unusualEvents.length > 0) ||
    (o.behaviorObservations && o.behaviorObservations.length > 0)
  );

  const entries: TimelineEntry[] = incidentObs
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .flatMap(obs => {
      const events: TimelineEntry[] = [];
      for (const evt of (obs.unusualEvents ?? [])) {
        events.push({
          id: randomUUID(),
          timestamp: obs.timestamp,
          cameraId: obs.cameraId,
          eventType: "unusual_event",
          description: evt,
          objectIds: [],
          confidence: obs.confidence,
          evidenceRef: obs.evidenceReference[0]?.id ?? "",
        });
      }
      for (const beh of (obs.behaviorObservations ?? [])) {
        events.push({
          id: randomUUID(),
          timestamp: beh.observationTime,
          cameraId: obs.cameraId,
          eventType: beh.type,
          description: beh.description,
          objectIds: beh.involvedObjectIds ?? [],
          confidence: beh.confidence,
          evidenceRef: beh.evidenceRef,
        });
      }
      return events;
    });

  return {
    id: randomUUID(),
    type: "incident",
    title: "Hodisa Vaqt Chizig'i",
    cameraIds,
    entries,
    summary: `${entries.length} ta hodisa belgisi qayd etildi.`,
    generatedAt: new Date().toISOString(),
    observationIds: incidentObs.map(o => o.observationId),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TimelineReconstructRequest {
  type: TimelineType;
  cameraIds: string[];
  fromTime?: string;   // ISO
  toTime?: string;     // ISO
  /** Optionally pass observations directly (e.g. from a just-completed analysis) */
  observations?: VisualObservation[];
}

export function reconstructTimeline(req: TimelineReconstructRequest): ReconstructedTimeline {
  let observations: VisualObservation[] = req.observations ?? [];

  if (observations.length === 0) {
    // Pull from in-memory store
    for (const camId of req.cameraIds) {
      const camObs = _store.get(camId) ?? [];
      observations.push(...camObs.filter(o => {
        if (req.fromTime && new Date(o.timestamp) < new Date(req.fromTime)) return false;
        if (req.toTime   && new Date(o.timestamp) > new Date(req.toTime))   return false;
        return true;
      }));
    }
  }

  switch (req.type) {
    case "chronological": return buildChronologicalTimeline(observations, req.cameraIds);
    case "movement":      return buildMovementTimeline(observations, req.cameraIds);
    case "cross_camera":  return buildCrossCameraTimeline(observations, req.cameraIds);
    case "evidence":      return buildEvidenceTimeline(observations, req.cameraIds);
    case "incident":      return buildIncidentTimeline(observations, req.cameraIds);
  }
}
