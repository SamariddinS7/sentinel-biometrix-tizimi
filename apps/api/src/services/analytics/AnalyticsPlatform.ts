/**
 * AnalyticsPlatform — Enterprise Analytics & Safety Intelligence Core Engine
 *
 * Runs as a post-stage listener on top of the existing InferencePipeline.
 * The core never depends on any specific AI model or plugin implementation.
 *
 * Integration point:
 *   aiInferencePipeline.onFrameProcessed((cameraId, tracks) => {
 *     analyticsPlatform.submitFrame(frame, tracks, cameraId);
 *   });
 */

import { randomUUID } from 'crypto';
import type { VideoFrame } from '../ai/interfaces';
import type { TrackedObject } from '../ai/DetectionTrackingEngine';
import type { IAnalyticsPlugin, AnalyticsPluginConfig, AnalyticsContext } from './types/AnalyticsPlugin';
import type { AnalyticsEvent } from './types/AnalyticsEvent';
import { vmsEventService, VmsEventType } from '../vmsEventService';

// ─────────────────────────────────────────────────────────────────────────────
// Platform singleton
// ─────────────────────────────────────────────────────────────────────────────

class AnalyticsPlatformEngine {
  private static instance: AnalyticsPlatformEngine;

  /** Registered plugins keyed by plugin.id */
  private plugins: Map<string, IAnalyticsPlugin> = new Map();
  private pluginConfigs: Map<string, AnalyticsPluginConfig> = new Map();

  /** In-process event store (last 500 events per ring buffer) */
  private eventRing: AnalyticsEvent[] = [];
  private readonly RING_SIZE = 500;

  /** Per-camera zone/line config (loaded from area_map or settings) */
  private zoneMap: Map<string, AnalyticsContext['zones']> = new Map();
  private lineMap: Map<string, AnalyticsContext['lines']> = new Map();

  /** Camera name lookup */
  private cameraNames: Map<string, string> = new Map();
  private cameraLocations: Map<string, string> = new Map();

  /** Event listeners for downstream consumers (alarm broker, API, etc.) */
  private eventListeners: Set<(event: AnalyticsEvent) => void> = new Set();

  private frameCount = 0;
  private totalEventCount = 0;

  private constructor() {}

  public static getInstance(): AnalyticsPlatformEngine {
    if (!AnalyticsPlatformEngine.instance) {
      AnalyticsPlatformEngine.instance = new AnalyticsPlatformEngine();
    }
    return AnalyticsPlatformEngine.instance;
  }

  // ── Plugin registry ────────────────────────────────────────────────────────

  public async registerPlugin(
    plugin: IAnalyticsPlugin,
    config: Partial<AnalyticsPluginConfig> = {},
  ): Promise<void> {
    const fullConfig: AnalyticsPluginConfig = {
      enabled: true,
      confidenceThreshold: 0.5,
      ...config,
    };

    if (this.plugins.has(plugin.metadata.id)) {
      console.warn(`[AnalyticsPlatform] Plugin ${plugin.metadata.id} already registered. Replacing.`);
      await this.deregisterPlugin(plugin.metadata.id);
    }

    await plugin.initialize(fullConfig);
    this.plugins.set(plugin.metadata.id, plugin);
    this.pluginConfigs.set(plugin.metadata.id, fullConfig);
    console.log(`[AnalyticsPlatform] Plugin registered: ${plugin.metadata.name} (${plugin.metadata.id} v${plugin.metadata.version})`);
  }

  public async deregisterPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    await plugin.dispose();
    this.plugins.delete(id);
    this.pluginConfigs.delete(id);
    console.log(`[AnalyticsPlatform] Plugin deregistered: ${id}`);
  }

  public enablePlugin(id: string): void {
    const cfg = this.pluginConfigs.get(id);
    if (cfg) cfg.enabled = true;
  }

  public disablePlugin(id: string): void {
    const cfg = this.pluginConfigs.get(id);
    if (cfg) cfg.enabled = false;
  }

  public listPlugins(): Array<{ id: string; name: string; version: string; enabled: boolean }> {
    return Array.from(this.plugins.entries()).map(([id, p]) => ({
      id,
      name: p.metadata.name,
      version: p.metadata.version,
      enabled: this.pluginConfigs.get(id)?.enabled ?? false,
    }));
  }

  // ── Camera metadata ────────────────────────────────────────────────────────

  public setCameraInfo(cameraId: string, name: string, location: string): void {
    this.cameraNames.set(cameraId, name);
    this.cameraLocations.set(cameraId, location);
  }

  public setZones(cameraId: string, zones: AnalyticsContext['zones']): void {
    this.zoneMap.set(cameraId, zones);
  }

  public setLines(cameraId: string, lines: AnalyticsContext['lines']): void {
    this.lineMap.set(cameraId, lines);
  }

  // ── Frame submission ───────────────────────────────────────────────────────

  /**
   * Submit a decoded frame to all enabled plugins concurrently.
   * Called after InferencePipeline completes its 12 stages.
   *
   * @param frame        Decoded video frame (RGB buffer)
   * @param personTracks Confirmed tracks from ByteTrack (pipeline output)
   * @param allDetections All raw detections including vehicles
   */
  public async submitFrame(
    frame: VideoFrame,
    personTracks: TrackedObject[],
    allDetections: Array<{
      classLabel: string;
      classIndex: number;
      confidence: number;
      box: import('../ai/interfaces').BoundingBox;
      trackId?: string;
    }>,
  ): Promise<void> {
    this.frameCount++;

    const context: AnalyticsContext = {
      personTracks,
      allDetections,
      camera: {
        id: frame.cameraId,
        name: this.cameraNames.get(frame.cameraId) ?? frame.cameraId,
        location: this.cameraLocations.get(frame.cameraId) ?? 'Unknown',
      },
      zones: this.zoneMap.get(frame.cameraId) ?? [],
      lines: this.lineMap.get(frame.cameraId) ?? [],
    };

    // Run all enabled plugins concurrently
    const enabledPlugins = Array.from(this.plugins.entries())
      .filter(([id]) => this.pluginConfigs.get(id)?.enabled !== false)
      .map(([, p]) => p);

    const results = await Promise.allSettled(
      enabledPlugins.map(plugin =>
        plugin.processFrame(frame, context).catch(err => {
          console.error(`[AnalyticsPlatform] Plugin ${plugin.metadata.id} error on frame ${frame.id}:`, err);
          return [] as AnalyticsEvent[];
        }),
      ),
    );

    const allEvents: AnalyticsEvent[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allEvents.push(...r.value);
    }

    this.dispatchEvents(allEvents);

    if (allEvents.length > 0) {
      vmsEventService.emit(
        'ANALYTICS_COMPLETED' as VmsEventType,
        'AnalyticsPlatform',
        { frameId: frame.id, cameraId: frame.cameraId, eventCount: allEvents.length },
        'INFO',
      );
    }
  }

  // ── Event dispatch ─────────────────────────────────────────────────────────

  private dispatchEvents(events: AnalyticsEvent[]): void {
    for (const evt of events) {
      // Ring buffer
      this.eventRing.unshift(evt);
      if (this.eventRing.length > this.RING_SIZE) this.eventRing.pop();
      this.totalEventCount++;

      // Notify downstream consumers (alarm broker, evidence manager, search index)
      for (const listener of this.eventListeners) {
        try {
          listener(evt);
        } catch (e) {
          console.error('[AnalyticsPlatform] Event listener error:', e);
        }
      }

      // Also publish to the global VMS event bus so existing UI/alarm components pick it up
      try {
        vmsEventService.emit(
          evt.type as unknown as VmsEventType,
          evt.modelVersion,
          { ...(evt.data as Record<string, unknown>), cameraId: evt.cameraId, confidence: evt.confidence, boundingBoxes: evt.boundingBoxes, trackId: evt.trackId },
          evt.confidence > 0.85 ? 'CRITICAL' : evt.confidence > 0.6 ? 'WARNING' : 'INFO',
        );
      } catch {
        // event type may not be in VmsEventType union — non-fatal
      }
    }
  }

  public onEvent(listener: (event: AnalyticsEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // ── In-process query ───────────────────────────────────────────────────────

  public getEvents(filters?: {
    cameraId?: string;
    type?: string;
    since?: string;
    limit?: number;
  }): AnalyticsEvent[] {
    let results = [...this.eventRing];
    if (filters?.cameraId) results = results.filter(e => e.cameraId === filters.cameraId);
    if (filters?.type)     results = results.filter(e => e.type === filters.type);
    if (filters?.since) {
      const sinceMs = new Date(filters.since).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
    }
    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  public getStats(): {
    frameCount: number;
    totalEventCount: number;
    recentEventCount: number;
    pluginCount: number;
  } {
    return {
      frameCount: this.frameCount,
      totalEventCount: this.totalEventCount,
      recentEventCount: this.eventRing.length,
      pluginCount: this.plugins.size,
    };
  }

  // ── Plugin health ──────────────────────────────────────────────────────────

  public async getPluginHealth(): Promise<Record<string, import('./types/AnalyticsPlugin').AnalyticsPluginHealth>> {
    const result: Record<string, import('./types/AnalyticsPlugin').AnalyticsPluginHealth> = {};
    await Promise.allSettled(
      Array.from(this.plugins.entries()).map(async ([id, p]) => {
        result[id] = await p.healthCheck();
      }),
    );
    return result;
  }

  /** Unique event ID generator */
  public static newEventId(): string {
    return `AE-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }
}

export const analyticsPlatform = AnalyticsPlatformEngine.getInstance();
