/**
 * IAnalyticsPlugin — the single contract every analytics plugin must implement.
 *
 * The AnalyticsPlatform core engine never depends on a concrete plugin class;
 * it only knows this interface. Plugins can be installed, removed, and upgraded
 * at runtime without touching the engine.
 */

import type { VideoFrame, BoundingBox } from '../../ai/interfaces';
import type { TrackedObject } from '../../ai/DetectionTrackingEngine';
import type { AnalyticsEvent } from './AnalyticsEvent';

// ─────────────────────────────────────────────────────────────────────────────
// Runtime context passed to every plugin on each frame
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsContext {
  /** Confirmed person tracks from ByteTrack (upstream pipeline output) */
  personTracks: TrackedObject[];
  /** All object detections (including vehicles) from YOLOv8n */
  allDetections: Array<{
    classLabel: string;
    classIndex: number;
    confidence: number;
    box: BoundingBox;
    trackId?: string;
  }>;
  /** Camera metadata */
  camera: {
    id: string;
    name: string;
    location: string;
  };
  /** Active zone map from area_map (polygon definitions) */
  zones: Array<{
    id: string;
    name: string;
    type: string;
    points: Array<{ x: number; y: number }>;
  }>;
  /** Configured virtual lines for line-crossing detection */
  lines: Array<{
    id: string;
    name: string;
    x1: number; y1: number;
    x2: number; y2: number;
    allowedDirection?: 'LEFT' | 'RIGHT' | 'BOTH';
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsPluginMetadata {
  id: string;         // e.g. 'analytics.vehicle'
  name: string;
  version: string;
  description: string;
  /** Categories of events this plugin can emit */
  eventTypes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin health
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsPluginHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  latencyMs: number;
  lastError?: string;
  frameCount: number;
  eventCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsPluginConfig {
  enabled: boolean;
  /** Minimum confidence threshold for emitting events [0–1] */
  confidenceThreshold: number;
  /** Extra plugin-specific parameters */
  params?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata;

  /** Called once after registration. May load models or initialise state. */
  initialize(config: AnalyticsPluginConfig): Promise<void>;

  /**
   * Process a single decoded video frame.
   * Returns zero or more typed analytics events.
   * Must NEVER generate fake events or random confidence values.
   */
  processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]>;

  /**
   * Called when a tracking update arrives (state changes, new track, lost track).
   * Behavior-only plugins primarily use this path.
   */
  onTrackUpdate?(track: TrackedObject, context: AnalyticsContext): Promise<AnalyticsEvent[]>;

  /** Liveness / diagnostic check. */
  healthCheck(): Promise<AnalyticsPluginHealth>;

  /** Called before the plugin is removed from the registry. */
  dispose(): Promise<void>;
}
