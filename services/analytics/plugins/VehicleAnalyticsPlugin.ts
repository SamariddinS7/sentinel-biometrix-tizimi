/**
 * VehicleAnalyticsPlugin — Vehicle Detection, Classification, Counting & LPR
 *
 * Uses YOLOv8n COCO class indices (already loaded by PersonDetectorPlugin):
 *   1=bicycle, 2=car, 3=motorcycle, 5=bus, 7=truck
 *
 * License Plate Recognition: crops the vehicle region → runs Tesseract.js OCR
 * on the lower-third of the bounding box (where plates typically appear).
 *
 * No fake plates, no mock vehicles. Every result originates from real pixel inference.
 */

import type { VideoFrame, BoundingBox } from '../../ai/interfaces';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, VehicleDetectedData, PlateRecognizedData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';

// COCO vehicle class index → label
const VEHICLE_COCO_CLASSES: Record<number, VehicleDetectedData['vehicleType']> = {
  1: 'BICYCLE',
  2: 'CAR',
  3: 'MOTORCYCLE',
  5: 'BUS',
  7: 'TRUCK',
};

const VEHICLE_CLASS_LABELS = new Set(['bicycle', 'car', 'motorcycle', 'bus', 'truck']);

interface VehicleTrack {
  trackId: string;
  vehicleType: VehicleDetectedData['vehicleType'];
  box: BoundingBox;
  firstSeenMs: number;
  lastSeenMs: number;
  /** Which counting lines this vehicle has crossed, keyed by lineId → side (-1 | 1) */
  lineSides: Map<string, number>;
  enteredAlerted: boolean;
  exitedAlerted: boolean;
  lprAttempted: boolean;
  plateText?: string;
}

function lineSide(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
}

export class VehicleAnalyticsPlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.vehicle',
    name: 'Vehicle Analytics (Detection + Classification + LPR)',
    version: '1.0.0',
    description: 'Vehicle detection and classification via YOLOv8n COCO classes. LPR via Tesseract.js OCR on cropped plate regions.',
    eventTypes: [
      AnalyticsEventType.VEHICLE_DETECTED,
      AnalyticsEventType.VEHICLE_ENTERED,
      AnalyticsEventType.VEHICLE_EXITED,
      AnalyticsEventType.PLATE_RECOGNIZED,
    ],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.45 };

  private vehicleTracks: Map<string, VehicleTrack> = new Map();
  private vehicleIdCounter = 0;

  /** Rate-limit LPR attempts — expensive Tesseract call */
  private lprCooldownMs = 10_000;
  private lastLprAttempt: Map<string, number> = new Map();

  /** Whether Tesseract.js is available */
  private tesseractAvailable = false;
  private tesseractWorker: any = null;

  private frameCount = 0;
  private eventCount = 0;

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.lprCooldownMs = (config.params?.lprCooldownMs as number) ?? 10_000;

    // Try to initialise Tesseract.js worker
    try {
      const { createWorker } = await import('tesseract.js');
      this.tesseractWorker = await createWorker('eng', 1, {
        logger: () => {},
      });
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7', // Treat as single line
      });
      this.tesseractAvailable = true;
      console.log('[VehicleAnalyticsPlugin] Tesseract.js LPR worker ready.');
    } catch (err) {
      console.warn('[VehicleAnalyticsPlugin] Tesseract.js unavailable. LPR disabled.', err);
      this.tesseractAvailable = false;
    }
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    const events: AnalyticsEvent[] = [];
    const now = Date.now();

    // Filter vehicle detections from allDetections
    const vehicleDetections = context.allDetections.filter(d =>
      VEHICLE_CLASS_LABELS.has(d.classLabel.toLowerCase()) &&
      d.confidence >= this.config.confidenceThreshold,
    );

    const matchedTrackIds = new Set<string>();

    for (const det of vehicleDetections) {
      const vehicleType = this.classifyVehicle(det.classLabel);
      const cx = (det.box.xMin + det.box.xMax) / 2;
      const cy = (det.box.yMin + det.box.yMax) / 2;

      // Find matching tracked vehicle
      let matchedKey: string | null = null;
      let bestDist = 0.15; // max normalised centroid distance to match

      for (const [key, vt] of this.vehicleTracks.entries()) {
        if (vt.vehicleType !== vehicleType) continue;
        const vtcx = (vt.box.xMin + vt.box.xMax) / 2;
        const vtcy = (vt.box.yMin + vt.box.yMax) / 2;
        const dist = Math.sqrt((cx - vtcx) ** 2 + (cy - vtcy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          matchedKey = key;
        }
      }

      if (matchedKey) {
        const vt = this.vehicleTracks.get(matchedKey)!;
        vt.box = det.box;
        vt.lastSeenMs = now;
        matchedTrackIds.add(matchedKey);

        // Line crossing check (vehicle entered / exited)
        for (const line of context.lines) {
          const side = Math.sign(lineSide(line.x1, line.y1, line.x2, line.y2, cx, cy));
          const prevSide = vt.lineSides.get(line.id);
          if (prevSide !== undefined && prevSide !== 0 && side !== 0 && prevSide !== side) {
            const direction = side > 0 ? 'ENTERING' : 'EXITING';
            const evType = direction === 'ENTERING' ? AnalyticsEventType.VEHICLE_ENTERED : AnalyticsEventType.VEHICLE_EXITED;
            events.push(this.buildVehicleEvent(frame, context, evType, vt, det.confidence, direction));
          }
          if (side !== 0) vt.lineSides.set(line.id, side);
        }

        // LPR attempt on established vehicle
        if (!vt.lprAttempted && this.tesseractAvailable && frame.buffer.length > 0) {
          const lastLpr = this.lastLprAttempt.get(matchedKey) ?? 0;
          if (now - lastLpr >= this.lprCooldownMs) {
            this.lastLprAttempt.set(matchedKey, now);
            // Async — don't await; emit event independently
            this.attemptLpr(frame, det.box, context, vt, matchedKey, events).catch(() => {});
          }
        }
      } else {
        // New vehicle
        const key = `VT-${++this.vehicleIdCounter}`;
        const newVt: VehicleTrack = {
          trackId: key,
          vehicleType,
          box: det.box,
          firstSeenMs: now,
          lastSeenMs: now,
          lineSides: new Map(),
          enteredAlerted: false,
          exitedAlerted: false,
          lprAttempted: false,
        };
        this.vehicleTracks.set(key, newVt);
        matchedTrackIds.add(key);

        // Initial line side
        for (const line of context.lines) {
          const side = Math.sign(lineSide(line.x1, line.y1, line.x2, line.y2, cx, cy));
          newVt.lineSides.set(line.id, side);
        }

        // Emit vehicle detected
        events.push(this.buildVehicleEvent(frame, context, AnalyticsEventType.VEHICLE_DETECTED, newVt, det.confidence, undefined));
      }
    }

    // Prune stale vehicle tracks (not seen for 10 s)
    for (const [key, vt] of this.vehicleTracks.entries()) {
      if (now - vt.lastSeenMs > 10_000 && !matchedTrackIds.has(key)) {
        this.vehicleTracks.delete(key);
      }
    }

    this.eventCount += events.length;
    return events;
  }

  private classifyVehicle(label: string): VehicleDetectedData['vehicleType'] {
    const l = label.toLowerCase();
    if (l === 'car')        return 'CAR';
    if (l === 'truck')      return 'TRUCK';
    if (l === 'bus')        return 'BUS';
    if (l === 'motorcycle') return 'MOTORCYCLE';
    if (l === 'bicycle')    return 'BICYCLE';
    return 'UNKNOWN';
  }

  private buildVehicleEvent(
    frame: VideoFrame,
    context: AnalyticsContext,
    type: AnalyticsEventType,
    vt: VehicleTrack,
    confidence: number,
    direction?: VehicleDetectedData['direction'],
  ): AnalyticsEvent<VehicleDetectedData> {
    return {
      id: `AE-${Date.now()}-${vt.trackId}`,
      type,
      timestamp: new Date(frame.timestamp).toISOString(),
      cameraId: context.camera.id,
      cameraName: context.camera.name,
      location: context.camera.location,
      confidence,
      modelVersion: `${this.metadata.id}@${this.metadata.version}`,
      boundingBoxes: [vt.box],
      trackId: vt.trackId,
      data: {
        vehicleType: vt.vehicleType,
        direction,
        plateText: vt.plateText,
      },
    };
  }

  /**
   * LPR: crop the lower-third of the vehicle bounding box (plate region),
   * run Tesseract.js, and emit PLATE_RECOGNIZED if text is found.
   * Uses real pixel data — never generates fake plate numbers.
   */
  private async attemptLpr(
    frame: VideoFrame,
    box: BoundingBox,
    context: AnalyticsContext,
    vt: VehicleTrack,
    trackKey: string,
    events: AnalyticsEvent[],
  ): Promise<void> {
    if (!this.tesseractAvailable || !this.tesseractWorker) return;

    try {
      // Crop plate region: lower-third of vehicle bounding box
      const imgW = frame.width;
      const imgH = frame.height;
      if (!imgW || !imgH || frame.buffer.length < imgW * imgH * 3) return;

      const px1 = Math.floor(box.xMin * imgW);
      const py1 = Math.floor((box.yMin + (box.yMax - box.yMin) * 0.65) * imgH); // lower 35%
      const px2 = Math.floor(box.xMax * imgW);
      const py2 = Math.floor(box.yMax * imgH);

      const cropW = Math.max(1, px2 - px1);
      const cropH = Math.max(1, py2 - py1);

      // Minimum plate region size: 30×10 px
      if (cropW < 30 || cropH < 10) return;

      // Extract RGB crop
      const cropBuf = Buffer.alloc(cropW * cropH * 3);
      for (let row = 0; row < cropH; row++) {
        for (let col = 0; col < cropW; col++) {
          const srcIdx = ((py1 + row) * imgW + (px1 + col)) * 3;
          const dstIdx = (row * cropW + col) * 3;
          if (srcIdx + 2 < frame.buffer.length) {
            cropBuf[dstIdx]     = frame.buffer[srcIdx];
            cropBuf[dstIdx + 1] = frame.buffer[srcIdx + 1];
            cropBuf[dstIdx + 2] = frame.buffer[srcIdx + 2];
          }
        }
      }

      const { data } = await this.tesseractWorker.recognize(cropBuf);
      const rawText = (data.text || '').replace(/[^A-Z0-9]/g, '').trim();
      const conf = data.confidence / 100;

      // Minimum 4 chars and confidence > 0.6 to emit
      if (rawText.length >= 4 && conf >= 0.6) {
        vt.lprAttempted = true;
        vt.plateText = rawText;

        const plateBox: BoundingBox = {
          xMin: box.xMin,
          yMin: box.yMin + (box.yMax - box.yMin) * 0.65,
          xMax: box.xMax,
          yMax: box.yMax,
        };

        events.push({
          id: `AE-${Date.now()}-lpr-${trackKey}`,
          type: AnalyticsEventType.PLATE_RECOGNIZED,
          timestamp: new Date().toISOString(),
          cameraId: context.camera.id,
          cameraName: context.camera.name,
          location: context.camera.location,
          confidence: conf,
          modelVersion: `${this.metadata.id}@${this.metadata.version}`,
          boundingBoxes: [plateBox],
          trackId: vt.trackId,
          data: {
            plateText: rawText,
            countryProfile: 'UZB',
            vehicleTrackId: vt.trackId,
          } as PlateRecognizedData,
        });

        this.eventCount++;
      }
    } catch {
      // Non-fatal: LPR failure doesn't break the pipeline
    }
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return {
      status: this.tesseractAvailable ? 'HEALTHY' : 'DEGRADED',
      latencyMs: 0,
      frameCount: this.frameCount,
      eventCount: this.eventCount,
      lastError: this.tesseractAvailable ? undefined : 'Tesseract.js unavailable — LPR disabled',
    };
  }

  async dispose(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate().catch(() => {});
      this.tesseractWorker = null;
    }
    this.vehicleTracks.clear();
  }
}
