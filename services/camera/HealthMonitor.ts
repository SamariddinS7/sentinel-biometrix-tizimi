/**
 * Sentinel VMS — Camera Health Monitor
 *
 * Continuously monitors all registered cameras every POLL_INTERVAL_MS.
 * Computes a health score (0–100) from multiple signal sources.
 * Persists health history to Firestore.
 * Triggers reconnect via ReconnectEngine on degradation.
 */

import { EventEmitter } from 'events';
import { db } from '../firestoreService';
import { doc, setDoc } from 'firebase/firestore';
import { vmsEventService } from '../vmsEventService';
import { CameraHealth, CameraState } from './interfaces';

export interface CameraHealthRecord {
  cameraId: string;
  score: number;           // 0–100 composite health score
  state: CameraState;
  latencyMs: number;
  packetLossPct: number;
  bandwidthBps: number;
  fps: number;
  resolution: string;
  codec: string;
  reconnectCount: number;
  recordingStatus: string;
  lastCheckedAt: string;
}

export interface HealthThresholds {
  maxLatencyMs: number;         // Above this → degraded
  maxPacketLossPct: number;     // Above this → degraded
  minFps: number;               // Below this → degraded
  offlineAfterMs: number;       // No update in this window → OFFLINE
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  maxLatencyMs: 300,
  maxPacketLossPct: 5,
  minFps: 5,
  offlineAfterMs: 60_000,
};

const POLL_INTERVAL_MS = 10_000;
const HISTORY_LENGTH = 20; // Keep last N records in memory per camera

type HealthProvider = (cameraId: string) => Promise<CameraHealth>;

class HealthMonitor extends EventEmitter {
  private static instance: HealthMonitor;

  private cameras: Map<string, { provider: HealthProvider; reconnectFn?: () => void }> = new Map();
  private healthCache: Map<string, CameraHealthRecord> = new Map();
  private historyCache: Map<string, CameraHealthRecord[]> = new Map();
  private thresholds: HealthThresholds = { ...DEFAULT_THRESHOLDS };
  private pollTimer: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setMaxListeners(128);
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  public register(
    cameraId: string,
    provider: HealthProvider,
    reconnectFn?: () => void,
  ): void {
    this.cameras.set(cameraId, { provider, reconnectFn });
    if (!this.pollTimer) this.startPolling();
  }

  public unregister(cameraId: string): void {
    this.cameras.delete(cameraId);
    this.healthCache.delete(cameraId);
    if (this.cameras.size === 0) this.stopPolling();
  }

  public setThresholds(t: Partial<HealthThresholds>): void {
    this.thresholds = { ...this.thresholds, ...t };
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAll(), POLL_INTERVAL_MS);
    // Run immediately on first register
    setImmediate(() => this.pollAll());
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollAll(): Promise<void> {
    const checks = Array.from(this.cameras.entries()).map(([id, entry]) =>
      this.pollOne(id, entry.provider, entry.reconnectFn),
    );
    await Promise.allSettled(checks);
  }

  private async pollOne(
    cameraId: string,
    provider: HealthProvider,
    reconnectFn?: () => void,
  ): Promise<void> {
    let health: CameraHealth;

    try {
      health = await Promise.race([
        provider(cameraId),
        new Promise<CameraHealth>((_, reject) =>
          setTimeout(() => reject(new Error('health check timeout')), 5000),
        ),
      ]);
    } catch {
      // Provider unreachable → treat as offline
      health = {
        state: 'OFFLINE',
        latencyMs: 9999,
        packetLossPct: 100,
        bandwidthBps: 0,
        fps: 0,
        resolution: '0x0',
        codec: 'H264',
        recordingStatus: 'ERROR',
        lastActive: new Date().toISOString(),
      };
    }

    const score = this.computeScore(health);
    const prev = this.healthCache.get(cameraId);

    const record: CameraHealthRecord = {
      cameraId,
      score,
      state: health.state,
      latencyMs: health.latencyMs,
      packetLossPct: health.packetLossPct,
      bandwidthBps: health.bandwidthBps,
      fps: health.fps,
      resolution: health.resolution,
      codec: health.codec,
      reconnectCount: 0,
      recordingStatus: health.recordingStatus,
      lastCheckedAt: new Date().toISOString(),
    };

    this.healthCache.set(cameraId, record);

    // Append to history
    const history = this.historyCache.get(cameraId) ?? [];
    history.push(record);
    if (history.length > HISTORY_LENGTH) history.shift();
    this.historyCache.set(cameraId, history);

    // Emit change event
    this.emit('health', record);
    if (prev && prev.state !== record.state) {
      this.emit('stateChange', { cameraId, prev: prev.state, next: record.state });
    }

    // Trigger reconnect if degraded
    if (score < 30 && reconnectFn) {
      reconnectFn();
    }

    // Persist to Firestore (non-blocking)
    this.persistHealth(record);
  }

  // ─── Scoring ───────────────────────────────────────────────────────────────

  private computeScore(h: CameraHealth): number {
    if (h.state === 'OFFLINE' || h.state === 'ERROR') return 0;

    let score = 100;

    // Latency penalty
    if (h.latencyMs > this.thresholds.maxLatencyMs) {
      score -= Math.min(30, Math.floor((h.latencyMs - this.thresholds.maxLatencyMs) / 10));
    }

    // Packet loss penalty
    if (h.packetLossPct > this.thresholds.maxPacketLossPct) {
      score -= Math.min(30, Math.floor(h.packetLossPct * 2));
    }

    // FPS penalty
    if (h.fps < this.thresholds.minFps && h.fps >= 0) {
      score -= Math.min(25, Math.floor((this.thresholds.minFps - h.fps) * 3));
    }

    // State adjustments
    if (h.state === 'RECOVERING') score = Math.min(score, 50);
    if (h.state === 'CONNECTING' || h.state === 'AUTHENTICATING') score = Math.min(score, 70);
    if (h.recordingStatus === 'ERROR') score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async persistHealth(record: CameraHealthRecord): Promise<void> {
    try {
      await setDoc(
        doc(db, 'cameraHealth', record.cameraId),
        {
          ...record,
          updatedAt: record.lastCheckedAt,
        },
        { merge: true },
      );
    } catch {
      // Firestore unavailable — health stays in memory
    }
  }

  // ─── Public query ──────────────────────────────────────────────────────────

  public getHealth(cameraId: string): CameraHealthRecord | null {
    return this.healthCache.get(cameraId) ?? null;
  }

  public getAllHealth(): CameraHealthRecord[] {
    return Array.from(this.healthCache.values());
  }

  public getHistory(cameraId: string): CameraHealthRecord[] {
    return this.historyCache.get(cameraId) ?? [];
  }

  public shutdown(): void {
    this.stopPolling();
    this.cameras.clear();
  }
}

export const healthMonitor = HealthMonitor.getInstance();
