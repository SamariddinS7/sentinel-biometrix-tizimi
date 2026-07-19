/**
 * Enterprise Person Intelligence & Investigation Platform — Core Types
 *
 * Every field in every type must be populated from real AI observations.
 * No fake profiles. No mock histories. No placeholder data.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

export type PersonStatus = 'KNOWN' | 'ANONYMOUS' | 'WATCHLIST' | 'BLOCKED' | 'ARCHIVED';

export type TimelineEntryType =
  | 'DETECTION'
  | 'RECOGNITION'
  | 'MOVEMENT'
  | 'APPEARANCE_UPDATE'
  | 'ANALYTICS_EVENT'
  | 'ALARM'
  | 'EVIDENCE'
  | 'OPERATOR_ACTION'
  | 'PROFILE_CREATED'
  | 'PROFILE_UPDATED'
  | 'PROFILE_MERGED'
  | 'WATCHLIST_ADDED'
  | 'WATCHLIST_REMOVED';

export type RelationshipObservationType =
  | 'CO_OCCURRENCE'
  | 'GROUP_ENTRY'
  | 'GROUP_EXIT'
  | 'ROUTE_SIMILARITY'
  | 'ZONE_CORRELATION'
  | 'TIME_CORRELATION'
  | 'CAMERA_CORRELATION';

export type ReportType =
  | 'MOVEMENT'
  | 'ATTENDANCE'
  | 'VISIT'
  | 'INCIDENT'
  | 'INVESTIGATION'
  | 'EVIDENCE'
  | 'RECOGNITION'
  | 'BEHAVIOR_SUMMARY';

export type ReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type SearchMode =
  | 'FACE_SEARCH'
  | 'APPEARANCE_SEARCH'
  | 'PERSON_SEARCH'
  | 'TIMELINE_SEARCH'
  | 'EVIDENCE_SEARCH'
  | 'MOVEMENT_SEARCH'
  | 'SIMILARITY_SEARCH'
  | 'HYBRID_SEARCH'
  | 'NATURAL_LANGUAGE';

// ─────────────────────────────────────────────────────────────────────────────
// Face Management
// ─────────────────────────────────────────────────────────────────────────────

export interface FaceEntry {
  faceId:         string;           // FE-XXXXX
  descriptorVersion: number;        // Increments on re-enrollment
  qualityScore:   number;           // 0–1 (ArcFace quality gate)
  descriptor:     number[];         // 128 or 512-dim embedding
  capturedAt:     string;           // ISO timestamp
  cameraId:       string;
  snapshotRef?:   string;           // Storage path
  isPrimary:      boolean;
  isArchived:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appearance History
// ─────────────────────────────────────────────────────────────────────────────

export interface AppearanceSnapshot {
  snapshotId:          string;
  capturedAt:          string;
  cameraId:            string;
  upperClothingColor:  string;
  upperClothingType:   string;
  upperClothingPattern: string;
  lowerClothingColor:  string;
  lowerClothingType:   string;
  shoes:               string;
  helmet:              boolean;
  vest:                boolean;
  backpack:            boolean;
  bag:                 boolean;
  glasses:             boolean;
  mask:                boolean;
  umbrella?:           boolean;      // Soyabon
  hairColor:           string;
  hairStyle?:          string;       // Soch uslubi (e.g. short, long, curly, bun)
  beard?:              boolean;      // Soqol mavjudligi
  beardStyle?:         string;       // Soqol uslubi (e.g. stubble, full, goatee)
  bodyShape:           string;
  estimatedBodySize?:  string;       // XS / S / M / L / XL / XXL
  estimatedHeightCm:   number;
  carriedObjects:      string[];
  appearanceEmbedding?: number[];   // For similarity search
  confidence:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Movement History
// ─────────────────────────────────────────────────────────────────────────────

export interface MovementRecord {
  recordId:    string;
  cameraId:    string;
  cameraName:  string;
  location:    string;           // Zone / room / building
  enteredAt:   string;
  exitedAt?:   string;
  durationMs?: number;
  floor?:      string;
  building?:   string;
  zoneId?:     string;
  trackId:     string;
}

export interface CameraVisit {
  cameraId:        string;
  cameraName:      string;
  location:        string;
  firstSeenAt:     string;
  lastSeenAt:      string;
  visitCount:      number;
  totalDurationMs: number;
  recognitionCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration & Versioning
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistrationEvent {
  eventId:     string;
  timestamp:   string;
  operator?:   string;           // null if auto-created by AI
  action:      'AUTO_CREATED' | 'MANUALLY_ENROLLED' | 'MERGED' | 'SPLIT' | 'LINKED_TO_USER' | 'ARCHIVED' | 'WATCHLISTED';
  details:     string;
  previousVersion?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Person Profile
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonProfile {
  // ── Identity
  personId:        string;          // Uses F-XXXXX from IdentityFusionEngine
  fusionId?:       string;          // F-XXXXX link (same as personId when auto-created)
  multiModalId?:   string;          // MM-XXXXX link
  userId?:         string;          // Known employee link (User.id)

  // ── Demographics
  fullName:        string;          // Employee name or 'Anonymous-XXXXX'
  employeeId?:     string;
  department?:     string;
  organization?:   string;
  position?:       string;
  status:          PersonStatus;
  role:            string;

  // ── Biometrics
  faceGallery:     FaceEntry[];
  appearanceGallery: AppearanceSnapshot[];
  currentAppearance?: AppearanceSnapshot;  // Most recent snapshot
  primaryEmbedding?: number[];             // ReID embedding (latest)

  // ── Camera Presence
  firstSeen:       string;
  lastSeen:        string;
  lastCameraId:    string;
  currentCameraId?: string;
  previousCameraId?: string;
  currentlyPresent: boolean;
  totalDetections:  number;
  totalRecognitions: number;

  // ── Camera History (aggregated)
  cameraHistory:   CameraVisit[];

  // ── Movement Summary
  visitedZones:    string[];
  visitedBuildings: string[];
  totalMovementRecords: number;

  // ── Profile Meta
  notes:            string;
  customAttributes: Record<string, string>;
  registrationHistory: RegistrationEvent[];
  profileVersion:   number;
  createdAt:        string;
  updatedAt:        string;
  mergedInto?:      string;       // If this profile was merged
  mergedFrom?:      string[];     // Profiles merged into this one
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  entryId:      string;
  personId:     string;
  type:         TimelineEntryType;
  timestamp:    string;           // ISO
  cameraId?:    string;
  cameraName?:  string;
  location?:    string;
  trackId?:     string;
  confidence?:  number;
  severity?:    'CRITICAL' | 'WARNING' | 'INFO';
  title:        string;           // Human-readable one-liner
  description:  string;
  evidenceIds:  string[];         // Links to EvidenceRecord.id
  alarmId?:     string;
  analyticsEventId?: string;
  operator?:    string;           // For OPERATOR_ACTION entries
  metadata:     Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationship Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface RelationshipObservation {
  observationId:    string;
  personAId:        string;
  personBId:        string;
  type:             RelationshipObservationType;
  confidence:       number;       // 0–1 based on observation count
  observationCount: number;
  firstObservedAt:  string;
  lastObservedAt:   string;
  supportingEvidenceIds: string[];
  cameraIds:        string[];     // Cameras where observed
  description:      string;       // e.g. "Observed in same zone 5 times"
  label:            'OBSERVED_CORRELATION';  // Always this — never "confirmed relationship"
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonStatistics {
  personId:           string;
  computedAt:         string;
  periodDays:         number;
  visitFrequencyPerDay: number;
  averageStayMs:      number;
  totalPresenceMs:    number;
  movementDistanceNorm: number;   // Normalized 0–1 (relative to camera graph size)
  mostVisitedCameraIds: Array<{ cameraId: string; visitCount: number }>;
  mostVisitedZones:   Array<{ zoneId: string; visitCount: number }>;
  mostActiveHours:    number[];   // 0–23 sorted by activity
  recognitionAccuracy: number;    // Avg confidence of recognition events
  incidentCount:      number;
  incidentsByType:    Record<string, number>;
  cameraUsageCount:   number;
  firstSeenAt:        string;
  lastSeenAt:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Investigation
// ─────────────────────────────────────────────────────────────────────────────

export interface MovementReplayStep {
  stepIndex:    number;
  cameraId:     string;
  cameraName:   string;
  location:     string;
  enteredAt:    string;
  exitedAt?:    string;
  durationMs?:  number;
  trackId:      string;
  evidenceId?:  string;
}

export interface InvestigationResult {
  personId:     string;
  queryType:    SearchMode;
  query:        Record<string, unknown>;
  executedAt:   string;
  results:      PersonProfile[];
  totalCount:   number;
  confidence:   number;
  evidenceIds:  string[];
  note:         string;           // e.g. "Results based on observed evidence only"
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonReport {
  reportId:     string;
  personId:     string;
  personName:   string;
  type:         ReportType;
  period:       ReportPeriod;
  startTime:    string;
  endTime:      string;
  generatedAt:  string;
  generatedBy:  string;           // operator userId or 'system'
  summary:      string;
  sections:     Array<{
    title:      string;
    data:       unknown;
    evidenceIds: string[];
  }>;
  exportHistory: Array<{ exportedAt: string; operator: string; format: 'JSON' | 'PDF' }>;
  chainOfCustody: Array<{ timestamp: string; operator: string; action: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonSearchQuery {
  mode:           SearchMode;
  text?:          string;
  cameraId?:      string;
  zoneId?:        string;
  since?:         string;
  until?:         string;
  appearanceAttrs?: Partial<AppearanceSnapshot>;
  faceDescriptor?: number[];
  similarToPersonId?: string;
  similarityThreshold?: number;
  status?:        PersonStatus;
  limit?:         number;
  offset?:        number;
}

export interface PersonSearchResult {
  profile:      PersonProfile;
  score:        number;           // Relevance score 0–1
  matchReason:  string;
  evidenceIds:  string[];
}
