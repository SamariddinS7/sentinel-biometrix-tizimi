/**
 * BehaviorPlugin — Spatial Behavior Analytics
 *
 * Detects: Loitering, Intrusion, Line Crossing, Zone Violation, Wrong Direction
 *
 * All detections are derived from real ByteTrack trajectory data.
 * No mock detections. No simulated events.
 */

import type { VideoFrame, BoundingBox } from '../../ai/interfaces';
import type { TrackedObject } from '../../ai/DetectionTrackingEngine';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, BehaviorData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';
import { analyticsPlatform } from '../AnalyticsPlatform';

interface TrackState {
  firstSeenMs: number;
  lastSeenMs: number;
  zoneEntry: Map<string, number>;       // zoneId → entry timestamp
  crossedLines: Set<string>;            // lineId
  velocityHistory: Array<{ dx: number; dy: number }>;
  lastPosition: { cx: number; cy: number };
  loiteringAlerted: boolean;
  intrusionAlerted: Set<string>;        // zoneIds already alerted
  wrongDirAlerted: boolean;
}

// Point-in-polygon (ray casting) — normalized coordinates
function pointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Signed area / cross product to determine which side of a line a point is on
function lineSide(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
}

// Dot product of two 2D vectors
function dotProduct(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

export class BehaviorPlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.behavior',
    name: 'Spatial Behavior Analytics Engine',
    version: '1.0.0',
    description: 'Loitering, intrusion, line crossing, zone violation, wrong direction — all derived from real ByteTrack trajectory data.',
    eventTypes: [
      AnalyticsEventType.LOITERING_DETECTED,
      AnalyticsEventType.INTRUSION_DETECTED,
      AnalyticsEventType.LINE_CROSSED,
      AnalyticsEventType.ZONE_VIOLATION,
      AnalyticsEventType.WRONG_DIRECTION_DETECTED,
      AnalyticsEventType.HAZARD_ZONE_VIOLATION,
    ],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.5 };

  /** Per-track behavioral state */
  private trackStates: Map<string, TrackState> = new Map();

  /** Loitering dwell threshold in seconds */
  private loiteringThresholdSec = 30;
  /** Minimum velocity magnitude to NOT be considered loitering */
  private loiteringMinVelocity = 0.004;

  private frameCount = 0;
  private eventCount = 0;

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.loiteringThresholdSec = (config.params?.loiteringThresholdSec as number) ?? 30;
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    const events: AnalyticsEvent[] = [];
    const now = Date.now();

    for (const track of context.personTracks) {
      const cx = (track.boundingBox.xMin + track.boundingBox.xMax) / 2;
      const cy = (track.boundingBox.yMin + track.boundingBox.yMax) / 2;

      let state = this.trackStates.get(track.trackId);
      if (!state) {
        state = {
          firstSeenMs: now,
          lastSeenMs: now,
          zoneEntry: new Map(),
          crossedLines: new Set(),
          velocityHistory: [],
          lastPosition: { cx, cy },
          loiteringAlerted: false,
          intrusionAlerted: new Set(),
          wrongDirAlerted: false,
        };
        this.trackStates.set(track.trackId, state);
      }

      state.lastSeenMs = now;
      state.velocityHistory.push({ dx: track.motionVector.dx, dy: track.motionVector.dy });
      if (state.velocityHistory.length > 30) state.velocityHistory.shift();

      const dwellSec = (now - state.firstSeenMs) / 1000;
      const avgVel = this.averageVelocity(state.velocityHistory);
      const isSlowMoving = Math.sqrt(avgVel.dx ** 2 + avgVel.dy ** 2) < this.loiteringMinVelocity;

      // ── Loitering ──────────────────────────────────────────────────────────
      if (!state.loiteringAlerted && dwellSec >= this.loiteringThresholdSec && isSlowMoving) {
        state.loiteringAlerted = true;
        const conf = Math.min(0.99, 0.6 + (dwellSec / (this.loiteringThresholdSec * 3)) * 0.39);
        events.push(this.buildEvent(frame, context, AnalyticsEventType.LOITERING_DETECTED, track.trackId, conf, [track.boundingBox], {
          behaviorType: 'LOITERING',
          dwellSeconds: Math.round(dwellSec),
        }));
      }

      // ── Zone Violation & Intrusion ────────────────────────────────────────
      for (const zone of context.zones) {
        const inZone = pointInPolygon(cx, cy, zone.points);

        if (inZone) {
          if (!state.zoneEntry.has(zone.id)) {
            state.zoneEntry.set(zone.id, now);
          }

          if (zone.type === 'restricted' && !state.intrusionAlerted.has(zone.id)) {
            state.intrusionAlerted.add(zone.id);
            const eventType = zone.name?.toLowerCase().includes('hazard')
              ? AnalyticsEventType.HAZARD_ZONE_VIOLATION
              : AnalyticsEventType.INTRUSION_DETECTED;
            events.push(this.buildEvent(frame, context, eventType, track.trackId, track.confidence, [track.boundingBox], {
              behaviorType: eventType === AnalyticsEventType.INTRUSION_DETECTED ? 'INTRUSION' : 'ZONE_VIOLATION',
              zoneId: zone.id,
              zoneName: zone.name,
            }));
          } else if (zone.type !== 'restricted') {
            const zoneDwellSec = (now - (state.zoneEntry.get(zone.id) ?? now)) / 1000;
            if (zoneDwellSec >= this.loiteringThresholdSec && isSlowMoving && !state.intrusionAlerted.has(zone.id)) {
              state.intrusionAlerted.add(zone.id);
              events.push(this.buildEvent(frame, context, AnalyticsEventType.ZONE_VIOLATION, track.trackId, track.confidence, [track.boundingBox], {
                behaviorType: 'ZONE_VIOLATION',
                zoneId: zone.id,
                zoneName: zone.name,
                dwellSeconds: Math.round(zoneDwellSec),
              }));
            }
          }
        } else {
          state.zoneEntry.delete(zone.id);
        }
      }

      // ── Line Crossing ──────────────────────────────────────────────────────
      for (const line of context.lines) {
        if (state.crossedLines.has(line.id)) continue;

        const prevCx = state.lastPosition.cx;
        const prevCy = state.lastPosition.cy;

        const sidePrev = lineSide(line.x1, line.y1, line.x2, line.y2, prevCx, prevCy);
        const sideCurr = lineSide(line.x1, line.y1, line.x2, line.y2, cx, cy);

        // Sign change → crossing occurred
        if (sidePrev !== 0 && sideCurr !== 0 && Math.sign(sidePrev) !== Math.sign(sideCurr)) {
          // Direction check
          const moveDx = cx - prevCx;
          const moveDy = cy - prevCy;
          const lineDx = line.x2 - line.x1;
          const lineDy = line.y2 - line.y1;
          const perpDx = -lineDy;
          const perpDy = lineDx;
          const dot = dotProduct(moveDx, moveDy, perpDx, perpDy);
          const crossDir = dot >= 0 ? 'RIGHT' : 'LEFT';

          if (!line.allowedDirection || line.allowedDirection === 'BOTH' || crossDir !== line.allowedDirection) {
            state.crossedLines.add(line.id);
            setTimeout(() => state!.crossedLines.delete(line.id), 5000); // allow re-crossing after 5s
            events.push(this.buildEvent(frame, context, AnalyticsEventType.LINE_CROSSED, track.trackId, track.confidence, [track.boundingBox], {
              behaviorType: 'LINE_CROSSING',
              lineId: line.id,
              directionVector: { dx: moveDx, dy: moveDy },
            }));
          }
        }
      }

      // ── Wrong Direction ────────────────────────────────────────────────────
      // If all configured lines have an allowedDirection and the track consistently
      // moves opposite to that direction, flag it.
      if (!state.wrongDirAlerted && state.velocityHistory.length >= 10) {
        for (const line of context.lines) {
          if (!line.allowedDirection || line.allowedDirection === 'BOTH') continue;

          const lineDx = line.x2 - line.x1;
          const lineDy = line.y2 - line.y1;
          const perpDx = -lineDy;
          const perpDy = lineDx;
          const avgDot = state.velocityHistory.reduce((sum, v) => sum + dotProduct(v.dx, v.dy, perpDx, perpDy), 0) / state.velocityHistory.length;

          const movingWrong = (line.allowedDirection === 'RIGHT' && avgDot < -0.01) ||
                              (line.allowedDirection === 'LEFT'  && avgDot >  0.01);

          if (movingWrong) {
            state.wrongDirAlerted = true;
            setTimeout(() => { if (state) state.wrongDirAlerted = false; }, 10000);
            events.push(this.buildEvent(frame, context, AnalyticsEventType.WRONG_DIRECTION_DETECTED, track.trackId, track.confidence, [track.boundingBox], {
              behaviorType: 'WRONG_DIRECTION',
              lineId: line.id,
              directionVector: avgVel,
            }));
            break;
          }
        }
      }

      state.lastPosition = { cx, cy };
    }

    // Prune stale track states (not seen for 30 s)
    for (const [id, st] of this.trackStates.entries()) {
      if (now - st.lastSeenMs > 30_000) this.trackStates.delete(id);
    }

    this.eventCount += events.length;
    return events;
  }

  async onTrackUpdate(_track: TrackedObject, _context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    return [];
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return { status: 'HEALTHY', latencyMs: 0, frameCount: this.frameCount, eventCount: this.eventCount };
  }

  async dispose(): Promise<void> {
    this.trackStates.clear();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private averageVelocity(history: Array<{ dx: number; dy: number }>): { dx: number; dy: number } {
    if (!history.length) return { dx: 0, dy: 0 };
    const sum = history.reduce((a, v) => ({ dx: a.dx + v.dx, dy: a.dy + v.dy }), { dx: 0, dy: 0 });
    return { dx: sum.dx / history.length, dy: sum.dy / history.length };
  }

  private buildEvent(
    frame: VideoFrame,
    context: AnalyticsContext,
    type: AnalyticsEventType,
    trackId: string,
    confidence: number,
    boundingBoxes: BoundingBox[],
    data: BehaviorData,
  ): AnalyticsEvent<BehaviorData> {
    return {
      id: analyticsPlatform.constructor.name + '-' + `AE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: new Date(frame.timestamp).toISOString(),
      cameraId: context.camera.id,
      cameraName: context.camera.name,
      location: context.camera.location,
      confidence,
      modelVersion: `${this.metadata.id}@${this.metadata.version}`,
      boundingBoxes,
      trackId,
      data,
    };
  }
}
