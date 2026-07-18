/**
 * HeatmapPlugin — Spatial Heatmap Accumulation
 *
 * Accumulates person track centroids into a 50×50 normalized grid.
 * Applies Gaussian smoothing and emits periodic snapshots.
 * All data originates from real ByteTrack outputs.
 */

import type { VideoFrame } from '../../ai/interfaces';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, HeatmapData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';

const GRID_W = 50;
const GRID_H = 50;

export class HeatmapPlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.heatmap',
    name: 'Spatial Activity Heatmap',
    version: '1.0.0',
    description: 'Accumulates real ByteTrack person positions into a 50×50 spatial density grid with Gaussian smoothing.',
    eventTypes: [AnalyticsEventType.HEATMAP_UPDATED],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.5 };

  /** Per-camera heatmap grids */
  private grids: Map<string, Float32Array> = new Map();

  /** Emit interval in ms (default: 60 s) */
  private emitIntervalMs = 60_000;
  private lastEmit: Map<string, number> = new Map();

  /** Decay factor applied each emit cycle (values fade over time) */
  private decayFactor = 0.85;

  private frameCount = 0;
  private eventCount = 0;

  private getGrid(cameraId: string): Float32Array {
    if (!this.grids.has(cameraId)) {
      this.grids.set(cameraId, new Float32Array(GRID_W * GRID_H));
    }
    return this.grids.get(cameraId)!;
  }

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.emitIntervalMs = (config.params?.emitIntervalMs as number) ?? 60_000;
    this.decayFactor    = (config.params?.decayFactor    as number) ?? 0.85;
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    const events: AnalyticsEvent[] = [];
    const now = Date.now();
    const grid = this.getGrid(context.camera.id);

    // Accumulate person centroids
    for (const track of context.personTracks) {
      const cx = (track.boundingBox.xMin + track.boundingBox.xMax) / 2;
      const cy = (track.boundingBox.yMin + track.boundingBox.yMax) / 2;
      const gx = Math.min(GRID_W - 1, Math.max(0, Math.floor(cx * GRID_W)));
      const gy = Math.min(GRID_H - 1, Math.max(0, Math.floor(cy * GRID_H)));

      // Gaussian splat (3×3 kernel, σ≈1)
      const kernel = [
        [0, 1, 0],
        [1, 2, 1],
        [0, 1, 0],
      ];
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nx = gx + kx;
          const ny = gy + ky;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            grid[ny * GRID_W + nx] += kernel[ky + 1][kx + 1];
          }
        }
      }
    }

    // Emit snapshot on interval
    const lastEmit = this.lastEmit.get(context.camera.id) ?? 0;
    if (now - lastEmit >= this.emitIntervalMs) {
      this.lastEmit.set(context.camera.id, now);

      // Decay after snapshot
      for (let i = 0; i < grid.length; i++) {
        grid[i] *= this.decayFactor;
      }

      const gridSnapshot = Array.from(grid);
      events.push({
        id: `AE-${now}-hm-${context.camera.id}`,
        type: AnalyticsEventType.HEATMAP_UPDATED,
        timestamp: new Date(frame.timestamp).toISOString(),
        cameraId: context.camera.id,
        cameraName: context.camera.name,
        location: context.camera.location,
        confidence: 1.0,
        modelVersion: `${this.metadata.id}@${this.metadata.version}`,
        boundingBoxes: [],
        data: {
          cameraId: context.camera.id,
          gridSnapshot,
          gridWidth: GRID_W,
          gridHeight: GRID_H,
          capturedAt: new Date(frame.timestamp).toISOString(),
        } as HeatmapData,
      });

      this.eventCount++;
    }

    return events;
  }

  /** Returns the normalized (0–1) grid values for API serving */
  public getNormalizedGrid(cameraId: string): number[] {
    const grid = this.grids.get(cameraId);
    if (!grid) return Array(GRID_W * GRID_H).fill(0);
    const max = Math.max(...grid) || 1;
    return Array.from(grid).map(v => v / max);
  }

  public resetGrid(cameraId: string): void {
    const g = this.grids.get(cameraId);
    if (g) g.fill(0);
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return { status: 'HEALTHY', latencyMs: 0, frameCount: this.frameCount, eventCount: this.eventCount };
  }

  async dispose(): Promise<void> {
    this.grids.clear();
    this.lastEmit.clear();
  }
}

export const heatmapPlugin = new HeatmapPlugin();
