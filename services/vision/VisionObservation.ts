/**
 * Vision Intelligence Platform — Canonical Types
 *
 * Every output produced by the Vision Platform must conform to VisualObservation.
 * No conclusion may be returned without a populated evidenceReference.
 */

import { randomUUID } from "crypto";

// ─── Core Observation ──────────────────────────────────────────────────────────

export interface BoundingBox {
  x: number; y: number; width: number; height: number; /** 0–1 normalised */
}

export interface DetectedObject {
  id: string;
  label: string;             // e.g. "person", "vehicle", "fire"
  subType?: string;          // e.g. "forklift", "sedan"
  confidence: number;        // 0–1
  boundingBox?: BoundingBox;
  attributes: Record<string, string | number | boolean>;
  trackId?: string;
  evidenceRef?: string;
}

export interface PersonAttributes {
  upperClothingColor?: string;
  lowerClothingColor?: string;
  shoes?: string;
  hasHelmet: boolean;
  hasSafetyVest: boolean;
  hasMask: boolean;
  hasBackpack: boolean;
  hasHandbag: boolean;
  hasUmbrella: boolean;
  hasReflectiveClothing: boolean;
  estimatedHeightRange?: string;
  bodyBuild?: "slim" | "average" | "heavy";
  movementDirection?: string;
  movementType?: "walking" | "running" | "standing" | "sitting";
  carryingObject?: string;
  hasBicycle: boolean;
  hasWheelchair: boolean;
  confidence: number;
  observationTime: string;
  camera: string;
  evidenceRef: string;
}

export interface VehicleAttributes {
  type: "car" | "suv" | "pickup" | "truck" | "bus" | "motorcycle" | "bicycle" | "forklift" | "emergency" | "construction" | "unknown";
  color?: string;
  approximateSize?: "small" | "medium" | "large";
  licensePlate?: string;
  licensePlateConfidence?: number;
  movementDirection?: string;
  entryTime?: string;
  exitTime?: string;
  parkingDuration?: number;     // minutes
  route?: string[];             // camera IDs traversed
  confidence: number;
  evidenceRef: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  boundingBox?: BoundingBox;
  sourceType: "sign" | "label" | "badge" | "plate" | "document" | "screen" | "other";
  evidenceRef: string;
  timestamp: string;
}

export interface BehaviorObservation {
  type:
    | "running"
    | "loitering"
    | "queue_formation"
    | "object_left_behind"
    | "object_removed"
    | "restricted_area_entry"
    | "wrong_direction"
    | "unsafe_movement"
    | "crowd_formation"
    | "unknown";
  description: string;          // Observable description only — no inferred intent
  confidence: number;
  alternativeInterpretations?: string[];
  involvedObjectIds?: string[];
  evidenceRef: string;
  observationTime: string;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  cameraId: string;
  eventType: string;
  description: string;
  objectIds: string[];
  confidence: number;
  evidenceRef: string;
}

export interface EvidenceAttachment {
  id: string;
  type: "snapshot" | "video_clip" | "bounding_box" | "track_id" | "recognition_result" | "timeline_entry";
  cameraId: string;
  timestamp: string;
  trackId?: string;
  modelVersion: string;
  url?: string;                 // in-memory blob or storage URL
  metadata: Record<string, unknown>;
}

export interface VisualObservation {
  /** Unique identifier for this observation */
  observationId: string;
  /** ISO 8601 timestamp of analysis */
  timestamp: string;
  /** Source camera identifier */
  cameraId: string;
  /** Frame or clip reference */
  frameId: string;
  /** Source type */
  sourceType: "live_stream" | "recorded_video" | "snapshot" | "uploaded_image" | "evidence_image" | "evidence_video" | "video_wall" | "screen_capture";
  /** All detected objects in this frame */
  objectList: DetectedObject[];
  /** Human-readable scene description */
  sceneDescription: string;
  /** Overall confidence in observations [0–1] */
  confidence: number;
  /** Evidence attachments */
  evidenceReference: EvidenceAttachment[];
  /** AI model that produced this observation */
  modelVersion: string;
  /** Person attributes if persons detected */
  personAttributes?: PersonAttributes[];
  /** Vehicle attributes if vehicles detected */
  vehicleAttributes?: VehicleAttributes[];
  /** OCR results */
  ocrResults?: OCRResult[];
  /** Behavior observations */
  behaviorObservations?: BehaviorObservation[];
  /** Cross-camera timeline entries */
  timelineEntries?: TimelineEntry[];
  /** Crowd density estimate 0–1 */
  crowdDensity?: number;
  /** Occupancy count */
  occupancyCount?: number;
  /** Unusual events detected */
  unusualEvents?: string[];
  /** Missing information that limits conclusions */
  missingInformation?: string[];
  /** Alternative interpretations when applicable */
  alternativeInterpretations?: string[];
  /** Relevant camera IDs for cross-camera context */
  relevantCameras?: string[];
  /** Related event IDs */
  relatedEvents?: string[];
  /** Processing time in ms */
  processingMs: number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createObservation(
  partial: Partial<VisualObservation> & { cameraId: string; sourceType: VisualObservation["sourceType"] }
): VisualObservation {
  return {
    observationId:  partial.observationId  ?? randomUUID(),
    timestamp:      partial.timestamp      ?? new Date().toISOString(),
    cameraId:       partial.cameraId,
    frameId:        partial.frameId        ?? `frame-${Date.now()}`,
    sourceType:     partial.sourceType,
    objectList:     partial.objectList     ?? [],
    sceneDescription: partial.sceneDescription ?? "",
    confidence:     partial.confidence     ?? 0,
    evidenceReference: partial.evidenceReference ?? [],
    modelVersion:   partial.modelVersion   ?? "gemini-2.0-flash",
    processingMs:   partial.processingMs   ?? 0,
    ...partial,
  };
}

export function createEvidenceAttachment(
  type: EvidenceAttachment["type"],
  cameraId: string,
  metadata: Record<string, unknown> = {}
): EvidenceAttachment {
  return {
    id:           randomUUID(),
    type,
    cameraId,
    timestamp:    new Date().toISOString(),
    modelVersion: "gemini-2.0-flash",
    metadata,
  };
}
