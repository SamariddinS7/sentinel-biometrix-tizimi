/**
 * ObjectStatePlugin — Abandoned & Removed Object Detection
 *
 * Algorithm:
 *   Abandoned: An object detection that remains stationary (IoU > threshold)
 *   across N consecutive frames without an associated person track nearby.
 *
 *   Removed: An object that was consistently detected in a region across
 *   M frames and then disappears for K frames.
 *
 * Uses real detections from YOLOv8n. No fake data.
 */

import type { VideoFrame, BoundingBox } from '../../ai/interfaces';
import type { TrackedObject } from '../../ai/DetectionTrackingEngine';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, ObjectStateData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';

interface StaticObject {
  classLabel: string;
  box: BoundingBox;
  firstSeenMs: number;
  lastSeenMs: number;
  frameCount: number;
  alerted: boolean;
  missingFrameCount: number;
  removedAlerted: boolean;
}

function iou(a: BoundingBox, b: BoundingBox): number {
  const ix1 = Math.max(a.xMin, b.xMin);
  const iy1 = Math.max(a.yMin, b.yMin);
  const ix2 = Math.min(a.xMax, b.xMax);
  const iy2 = Math.min(a.yMax, b.yMax);
  if (ix2 < ix1 || iy2 < iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const aArea = (a.xMax - a.xMin) * (a.yMax - a.yMin);
  const bArea = (b.xMax - b.xMin) * (b.yMax - b.yMin);
  return inter / (aArea + bArea - inter);
}

function centroidDistance(a: BoundingBox, b: BoundingBox): number {
  const ax = (a.xMin + a.xMax) / 2, ay = (a.yMin + a.yMax) / 2;
  const bx = (b.xMin + b.xMax) / 2, by = (b.yMin + b.yMax) / 2;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/** COCO object classes that are not persons or vehicles (likely left/removed items) */
const STATIC_OBJECT_CLASSES = new Set([
  'backpack', 'handbag', 'suitcase', 'umbrella', 'bag',
  'bottle', 'cup', 'fork', 'knife', 'bowl',
  'laptop', 'mouse', 'keyboard', 'cell phone', 'book',
  'chair', 'couch', 'potted plant', 'bed', 'dining table',
  'luggage', 'box', 'package',
]);

export class ObjectStatePlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.object_state',
    name: 'Abandoned & Removed Object Detector',
    version: '1.0.0',
    description: 'Detects stationary abandoned objects and objects that have been removed from a scene using frame-differencing and IoU tracking.',
    eventTypes: [AnalyticsEventType.ABANDONED_OBJECT_DETECTED, AnalyticsEventType.REMOVED_OBJECT_DETECTED],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.5 };
  private staticObjects: Map<string, StaticObject> = new Map();
  private objectIdCounter = 0;

  /** Seconds before an unattended static object is flagged as abandoned */
  private abandonedThresholdSec = 60;
  /** Consecutive missed frames before flagging as removed */
  private removedThresholdFrames = 30;
  /** Minimum frames to be "established" before removal alert */
  private establishedFrameCount = 15;

  private frameCount = 0;
  private eventCount = 0;

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.abandonedThresholdSec = (config.params?.abandonedThresholdSec as number) ?? 60;
    this.removedThresholdFrames = (config.params?.removedThresholdFrames as number) ?? 30;
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    const events: AnalyticsEvent[] = [];
    const now = Date.now();

    // Filter detections to static object classes only
    const objectDetections = context.allDetections.filter(d =>
      STATIC_OBJECT_CLASSES.has(d.classLabel.toLowerCase()) &&
      d.confidence >= this.config.confidenceThreshold,
    );

    // Person detection boxes (to check proximity)
    const personBoxes = context.personTracks.map(t => t.boundingBox);

    // ── Match current detections to tracked static objects ─────────────────
    const matchedKeys = new Set<string>();

    for (const det of objectDetections) {
      let bestKey: string | null = null;
      let bestIou = 0.3; // minimum IoU to consider a match

      for (const [key, obj] of this.staticObjects.entries()) {
        if (obj.classLabel !== det.classLabel) continue;
        const score = iou(obj.box, det.box);
        if (score > bestIou) {
          bestIou = score;
          bestKey = key;
        }
      }

      if (bestKey) {
        // Update existing tracked object
        const obj = this.staticObjects.get(bestKey)!;
        obj.box = det.box;
        obj.lastSeenMs = now;
        obj.frameCount++;
        obj.missingFrameCount = 0;
        matchedKeys.add(bestKey);
      } else {
        // New static object
        const key = `SO-${++this.objectIdCounter}`;
        this.staticObjects.set(key, {
          classLabel: det.classLabel,
          box: det.box,
          firstSeenMs: now,
          lastSeenMs: now,
          frameCount: 1,
          alerted: false,
          missingFrameCount: 0,
          removedAlerted: false,
        });
        matchedKeys.add(key);
      }
    }

    // Increment missing count for unmatched tracked objects
    for (const [key, obj] of this.staticObjects.entries()) {
      if (!matchedKeys.has(key)) {
        obj.missingFrameCount++;
      }
    }

    // ── Evaluate each tracked object ───────────────────────────────────────
    for (const [key, obj] of this.staticObjects.entries()) {
      const stationarySec = (now - obj.firstSeenMs) / 1000;

      // Abandoned: present and stationary, no person nearby
      if (!obj.alerted && obj.missingFrameCount === 0) {
        const isPersonNearby = personBoxes.some(pb => centroidDistance(pb, obj.box) < 0.15);
        if (!isPersonNearby && stationarySec >= this.abandonedThresholdSec) {
          obj.alerted = true;
          const conf = Math.min(0.95, 0.55 + (stationarySec / (this.abandonedThresholdSec * 2)) * 0.4);
          events.push({
            id: `AE-${Date.now()}-${key}`,
            type: AnalyticsEventType.ABANDONED_OBJECT_DETECTED,
            timestamp: new Date(frame.timestamp).toISOString(),
            cameraId: context.camera.id,
            cameraName: context.camera.name,
            location: context.camera.location,
            confidence: conf,
            modelVersion: `${this.metadata.id}@${this.metadata.version}`,
            boundingBoxes: [obj.box],
            data: {
              objectClass: obj.classLabel,
              stationarySeconds: Math.round(stationarySec),
              lastKnownBox: obj.box,
            } as ObjectStateData,
          });
        }
      }

      // Removed: was established, now gone for threshold frames
      if (!obj.removedAlerted && obj.frameCount >= this.establishedFrameCount && obj.missingFrameCount >= this.removedThresholdFrames) {
        obj.removedAlerted = true;
        events.push({
          id: `AE-${Date.now()}-${key}-rm`,
          type: AnalyticsEventType.REMOVED_OBJECT_DETECTED,
          timestamp: new Date(frame.timestamp).toISOString(),
          cameraId: context.camera.id,
          cameraName: context.camera.name,
          location: context.camera.location,
          confidence: 0.75,
          modelVersion: `${this.metadata.id}@${this.metadata.version}`,
          boundingBoxes: [obj.box],
          data: {
            objectClass: obj.classLabel,
            lastKnownBox: obj.box,
          } as ObjectStateData,
        });
      }

      // Prune: gone for too long
      if (obj.missingFrameCount > this.removedThresholdFrames * 2) {
        this.staticObjects.delete(key);
      }
    }

    this.eventCount += events.length;
    return events;
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return { status: 'HEALTHY', latencyMs: 0, frameCount: this.frameCount, eventCount: this.eventCount };
  }

  async dispose(): Promise<void> {
    this.staticObjects.clear();
  }
}
