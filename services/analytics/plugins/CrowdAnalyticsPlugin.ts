/**
 * CrowdAnalyticsPlugin — Crowd Density, Occupancy, Queue, People Counting
 *
 * All metrics are derived from real ByteTrack person track counts.
 * No mock data. Density thresholds are configurable.
 */

import type { VideoFrame } from '../../ai/interfaces';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, CrowdData, OccupancyData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';

interface ZoneOccupancy {
  zoneId: string;
  zoneName: string;
  count: number;
  lastUpdatedMs: number;
}

interface TrackVelocity {
  trackId: string;
  dx: number;
  dy: number;
  cx: number;
  cy: number;
}

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

export class CrowdAnalyticsPlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.crowd',
    name: 'Crowd Density & Occupancy Analytics',
    version: '1.0.0',
    description: 'Real-time people counting, crowd density, zone occupancy, and queue detection from ByteTrack outputs.',
    eventTypes: [
      AnalyticsEventType.CROWD_DETECTED,
      AnalyticsEventType.OCCUPANCY_UPDATED,
      AnalyticsEventType.QUEUE_DETECTED,
      AnalyticsEventType.PEOPLE_COUNT_UPDATED,
    ],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.5 };

  /** Crowd alert threshold (people count) */
  private crowdThreshold = 10;
  /** Queue: min persons clustering with low velocity */
  private queueMinPersons = 3;
  /** Queue: max average speed (normalized coords/frame) */
  private queueMaxVelocity = 0.005;
  /** Occupancy update emit interval in ms */
  private occupancyUpdateIntervalMs = 5000;

  private lastOccupancyEmit: Map<string, number> = new Map(); // cameraId → timestamp
  private lastCrowdAlert: Map<string, number> = new Map();
  private zoneOccupancyHistory: Map<string, ZoneOccupancy[]> = new Map();

  private frameCount = 0;
  private eventCount = 0;

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.crowdThreshold   = (config.params?.crowdThreshold   as number) ?? 10;
    this.queueMinPersons  = (config.params?.queueMinPersons  as number) ?? 3;
    this.occupancyUpdateIntervalMs = (config.params?.occupancyUpdateIntervalMs as number) ?? 5000;
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    const events: AnalyticsEvent[] = [];
    const now = Date.now();

    const tracks = context.personTracks;
    const headCount = tracks.length;

    // ── People Count Update ────────────────────────────────────────────────
    const lastOcc = this.lastOccupancyEmit.get(context.camera.id) ?? 0;
    if (now - lastOcc >= this.occupancyUpdateIntervalMs) {
      this.lastOccupancyEmit.set(context.camera.id, now);
      events.push({
        id: `AE-${now}-pc-${context.camera.id}`,
        type: AnalyticsEventType.PEOPLE_COUNT_UPDATED,
        timestamp: new Date(frame.timestamp).toISOString(),
        cameraId: context.camera.id,
        cameraName: context.camera.name,
        location: context.camera.location,
        confidence: 1.0,
        modelVersion: `${this.metadata.id}@${this.metadata.version}`,
        boundingBoxes: [],
        data: { count: headCount, zoneId: 'global' } as OccupancyData,
      });
    }

    // ── Crowd Detection ────────────────────────────────────────────────────
    const densityLevel = headCount >= 30 ? 'CRITICAL'
                       : headCount >= 20 ? 'HIGH'
                       : headCount >= this.crowdThreshold ? 'MEDIUM'
                       : 'LOW';

    if (headCount >= this.crowdThreshold) {
      const lastCrowd = this.lastCrowdAlert.get(context.camera.id) ?? 0;
      if (now - lastCrowd >= 30_000) { // throttle: 30 s
        this.lastCrowdAlert.set(context.camera.id, now);
        const conf = Math.min(0.99, 0.5 + (headCount / 50) * 0.49);
        events.push({
          id: `AE-${now}-crowd-${context.camera.id}`,
          type: AnalyticsEventType.CROWD_DETECTED,
          timestamp: new Date(frame.timestamp).toISOString(),
          cameraId: context.camera.id,
          cameraName: context.camera.name,
          location: context.camera.location,
          confidence: conf,
          modelVersion: `${this.metadata.id}@${this.metadata.version}`,
          boundingBoxes: [],
          data: { headCount, densityLevel } as CrowdData,
        });
      }
    }

    // ── Zone Occupancy ─────────────────────────────────────────────────────
    for (const zone of context.zones) {
      const inZone = tracks.filter(t => {
        const cx = (t.boundingBox.xMin + t.boundingBox.xMax) / 2;
        const cy = (t.boundingBox.yMin + t.boundingBox.yMax) / 2;
        return pointInPolygon(cx, cy, zone.points);
      });

      const zoneKey = `${context.camera.id}_${zone.id}`;
      const lastZoneOcc = this.lastOccupancyEmit.get(zoneKey) ?? 0;
      if (now - lastZoneOcc >= this.occupancyUpdateIntervalMs) {
        this.lastOccupancyEmit.set(zoneKey, now);
        events.push({
          id: `AE-${now}-occ-${zoneKey}`,
          type: AnalyticsEventType.OCCUPANCY_UPDATED,
          timestamp: new Date(frame.timestamp).toISOString(),
          cameraId: context.camera.id,
          cameraName: context.camera.name,
          location: zone.name,
          confidence: 1.0,
          modelVersion: `${this.metadata.id}@${this.metadata.version}`,
          boundingBoxes: [],
          data: { count: inZone.length, zoneId: zone.id } as OccupancyData,
        });
      }
    }

    // ── Queue Detection ────────────────────────────────────────────────────
    if (headCount >= this.queueMinPersons) {
      const trackVelocities: TrackVelocity[] = tracks.map(t => ({
        trackId: t.trackId,
        dx: t.motionVector.dx,
        dy: t.motionVector.dy,
        cx: (t.boundingBox.xMin + t.boundingBox.xMax) / 2,
        cy: (t.boundingBox.yMin + t.boundingBox.yMax) / 2,
      }));

      const slowTracks = trackVelocities.filter(v =>
        Math.sqrt(v.dx ** 2 + v.dy ** 2) < this.queueMaxVelocity,
      );

      if (slowTracks.length >= this.queueMinPersons) {
        // Check if slow tracks are spatially clustered (within 0.3 normalized width)
        const clusters = this.clusterTracks(slowTracks, 0.25);
        for (const cluster of clusters) {
          if (cluster.length >= this.queueMinPersons) {
            const queueKey = `${context.camera.id}-queue`;
            const lastQueue = this.lastCrowdAlert.get(queueKey) ?? 0;
            if (now - lastQueue >= 20_000) {
              this.lastCrowdAlert.set(queueKey, now);
              const conf = Math.min(0.95, 0.55 + (cluster.length / 20) * 0.4);
              events.push({
                id: `AE-${now}-queue-${context.camera.id}`,
                type: AnalyticsEventType.QUEUE_DETECTED,
                timestamp: new Date(frame.timestamp).toISOString(),
                cameraId: context.camera.id,
                cameraName: context.camera.name,
                location: context.camera.location,
                confidence: conf,
                modelVersion: `${this.metadata.id}@${this.metadata.version}`,
                boundingBoxes: [],
                data: {
                  headCount: cluster.length,
                  densityLevel: cluster.length >= 10 ? 'HIGH' : 'MEDIUM',
                  isQueue: true,
                } as CrowdData,
              });
            }
          }
        }
      }
    }

    this.eventCount += events.length;
    return events;
  }

  /** Simple greedy spatial clustering */
  private clusterTracks(tracks: TrackVelocity[], maxDist: number): TrackVelocity[][] {
    const visited = new Set<string>();
    const clusters: TrackVelocity[][] = [];

    for (const seed of tracks) {
      if (visited.has(seed.trackId)) continue;
      const cluster = [seed];
      visited.add(seed.trackId);
      for (const other of tracks) {
        if (visited.has(other.trackId)) continue;
        const dist = Math.sqrt((seed.cx - other.cx) ** 2 + (seed.cy - other.cy) ** 2);
        if (dist <= maxDist) {
          cluster.push(other);
          visited.add(other.trackId);
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return { status: 'HEALTHY', latencyMs: 0, frameCount: this.frameCount, eventCount: this.eventCount };
  }

  async dispose(): Promise<void> {
    this.lastOccupancyEmit.clear();
    this.lastCrowdAlert.clear();
  }
}
