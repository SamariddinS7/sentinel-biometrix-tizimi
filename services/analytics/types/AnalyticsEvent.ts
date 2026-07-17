/**
 * Enterprise Analytics & Safety Intelligence Platform
 * Typed event definitions — every analytics result that originates from real AI inference.
 *
 * RULE: No mock data. No placeholder confidence. No fake detections.
 * Every AnalyticsEvent must be produced by a real IAnalyticsPlugin.processFrame() call.
 */

import type { BoundingBox } from '../../ai/interfaces';

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Registry
// ─────────────────────────────────────────────────────────────────────────────

export enum AnalyticsEventType {
  // Vehicle & Traffic
  VEHICLE_DETECTED          = 'VEHICLE_DETECTED',
  VEHICLE_ENTERED           = 'VEHICLE_ENTERED',
  VEHICLE_EXITED            = 'VEHICLE_EXITED',
  PLATE_RECOGNIZED          = 'PLATE_RECOGNIZED',
  OCR_COMPLETED             = 'OCR_COMPLETED',

  // Fire & Safety (camera-capable)
  FIRE_DETECTED             = 'FIRE_DETECTED',
  SMOKE_DETECTED            = 'SMOKE_DETECTED',
  EXPLOSION_DETECTED        = 'EXPLOSION_DETECTED',
  SPARK_DETECTED            = 'SPARK_DETECTED',
  FLOOD_DETECTED            = 'FLOOD_DETECTED',
  WATER_LEAK_DETECTED       = 'WATER_LEAK_DETECTED',

  // PPE Compliance
  PPE_VIOLATION             = 'PPE_VIOLATION',
  HELMET_MISSING            = 'HELMET_MISSING',
  VEST_MISSING              = 'VEST_MISSING',
  MASK_MISSING              = 'MASK_MISSING',
  GLOVES_MISSING            = 'GLOVES_MISSING',
  GLASSES_MISSING           = 'GLASSES_MISSING',
  SHOES_MISSING             = 'SHOES_MISSING',
  PPE_COMPLIANT             = 'PPE_COMPLIANT',

  // Crowd & Occupancy
  CROWD_DETECTED            = 'CROWD_DETECTED',
  OCCUPANCY_UPDATED         = 'OCCUPANCY_UPDATED',
  QUEUE_DETECTED            = 'QUEUE_DETECTED',
  PEOPLE_COUNT_UPDATED      = 'PEOPLE_COUNT_UPDATED',

  // Behavior & Spatial
  LOITERING_DETECTED        = 'LOITERING_DETECTED',
  INTRUSION_DETECTED        = 'INTRUSION_DETECTED',
  LINE_CROSSED              = 'LINE_CROSSED',
  ZONE_VIOLATION            = 'ZONE_VIOLATION',
  WRONG_DIRECTION_DETECTED  = 'WRONG_DIRECTION_DETECTED',
  HAZARD_ZONE_VIOLATION     = 'HAZARD_ZONE_VIOLATION',

  // Object State
  ABANDONED_OBJECT_DETECTED = 'ABANDONED_OBJECT_DETECTED',
  REMOVED_OBJECT_DETECTED   = 'REMOVED_OBJECT_DETECTED',

  // Heatmap
  HEATMAP_UPDATED           = 'HEATMAP_UPDATED',

  // Sensor-only (not RGB camera inference)
  GAS_LEAK_SENSOR_ALERT     = 'GAS_LEAK_SENSOR_ALERT',
  CHEMICAL_SPILL_SENSOR_ALERT = 'CHEMICAL_SPILL_SENSOR_ALERT',

  // Meta
  ANALYTICS_COMPLETED       = 'ANALYTICS_COMPLETED',
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Event Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsEvent<TData = unknown> {
  /** UUID — unique per detection instance */
  id: string;
  type: AnalyticsEventType;
  timestamp: string;           // ISO-8601
  cameraId: string;
  cameraName: string;
  location: string;            // zone label / floor label
  /** Real inference probability [0.0, 1.0] — never random */
  confidence: number;
  /** plugin.id@plugin.version */
  modelVersion: string;
  evidenceRef?: string;
  boundingBoxes: BoundingBox[];
  trackId?: string;
  /** Plugin-specific payload */
  data: TData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin-specific payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface VehicleDetectedData {
  vehicleType: 'CAR' | 'TRUCK' | 'BUS' | 'MOTORCYCLE' | 'BICYCLE' | 'UNKNOWN';
  color?: string;
  direction?: 'ENTERING' | 'EXITING' | 'PASSING';
  plateText?: string;
  plateConfidence?: number;
}

export interface OcrCompletedData {
  text: string;
  language?: string;
  regionId?: string;
}

export interface PlateRecognizedData {
  plateText: string;
  countryProfile: string;
  vehicleTrackId?: string;
}

export interface FireSafetyData {
  hazardType: 'FIRE' | 'SMOKE' | 'EXPLOSION' | 'SPARK' | 'FLOOD' | 'WATER_LEAK';
  volumetricAreaRatio?: number;  // fraction of frame affected
  intensityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PpeViolationData {
  subjectTrackId: string;
  missingItems: string[];
  presentItems: string[];
  complianceScore: number; // 0–1
}

export interface CrowdData {
  headCount: number;
  densityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  zoneId?: string;
  isQueue?: boolean;
  estimatedWaitSeconds?: number;
}

export interface OccupancyData {
  count: number;
  capacity?: number;
  utilizationPct?: number;
  zoneId?: string;
}

export interface BehaviorData {
  behaviorType: 'LOITERING' | 'INTRUSION' | 'LINE_CROSSING' | 'ZONE_VIOLATION' | 'WRONG_DIRECTION';
  dwellSeconds?: number;
  lineId?: string;
  zoneId?: string;
  zoneName?: string;
  directionVector?: { dx: number; dy: number };
}

export interface ObjectStateData {
  objectClass: string;
  stationarySeconds?: number;
  lastKnownBox?: BoundingBox;
}

export interface HeatmapData {
  cameraId: string;
  /** Serialised 50×50 grid values (column-major, JSON array) */
  gridSnapshot: number[];
  gridWidth: number;
  gridHeight: number;
  capturedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alarm severity mapping (used by AnalyticsAlarmBroker)
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_ALARM_SEVERITY: Record<AnalyticsEventType, 'CRITICAL' | 'WARNING' | 'INFO' | null> = {
  [AnalyticsEventType.FIRE_DETECTED]:             'CRITICAL',
  [AnalyticsEventType.EXPLOSION_DETECTED]:        'CRITICAL',
  [AnalyticsEventType.GAS_LEAK_SENSOR_ALERT]:     'CRITICAL',
  [AnalyticsEventType.CHEMICAL_SPILL_SENSOR_ALERT]: 'CRITICAL',
  [AnalyticsEventType.SMOKE_DETECTED]:            'CRITICAL',
  [AnalyticsEventType.INTRUSION_DETECTED]:        'CRITICAL',
  [AnalyticsEventType.HAZARD_ZONE_VIOLATION]:     'WARNING',
  [AnalyticsEventType.PPE_VIOLATION]:             'WARNING',
  [AnalyticsEventType.HELMET_MISSING]:            'WARNING',
  [AnalyticsEventType.VEST_MISSING]:              'WARNING',
  [AnalyticsEventType.MASK_MISSING]:              'WARNING',
  [AnalyticsEventType.GLOVES_MISSING]:            'WARNING',
  [AnalyticsEventType.GLASSES_MISSING]:           'WARNING',
  [AnalyticsEventType.SHOES_MISSING]:             'WARNING',
  [AnalyticsEventType.ABANDONED_OBJECT_DETECTED]: 'WARNING',
  [AnalyticsEventType.LOITERING_DETECTED]:        'WARNING',
  [AnalyticsEventType.ZONE_VIOLATION]:            'WARNING',
  [AnalyticsEventType.SPARK_DETECTED]:            'WARNING',
  [AnalyticsEventType.FLOOD_DETECTED]:            'WARNING',
  [AnalyticsEventType.WATER_LEAK_DETECTED]:       'INFO',
  [AnalyticsEventType.CROWD_DETECTED]:            'INFO',
  [AnalyticsEventType.QUEUE_DETECTED]:            'INFO',
  [AnalyticsEventType.WRONG_DIRECTION_DETECTED]:  'INFO',
  [AnalyticsEventType.REMOVED_OBJECT_DETECTED]:   'INFO',
  [AnalyticsEventType.LINE_CROSSED]:              null,
  [AnalyticsEventType.VEHICLE_DETECTED]:          null,
  [AnalyticsEventType.VEHICLE_ENTERED]:           null,
  [AnalyticsEventType.VEHICLE_EXITED]:            null,
  [AnalyticsEventType.PLATE_RECOGNIZED]:          null,
  [AnalyticsEventType.OCR_COMPLETED]:             null,
  [AnalyticsEventType.PPE_COMPLIANT]:             null,
  [AnalyticsEventType.OCCUPANCY_UPDATED]:         null,
  [AnalyticsEventType.PEOPLE_COUNT_UPDATED]:      null,
  [AnalyticsEventType.HEATMAP_UPDATED]:           null,
  [AnalyticsEventType.ANALYTICS_COMPLETED]:       null,
};
