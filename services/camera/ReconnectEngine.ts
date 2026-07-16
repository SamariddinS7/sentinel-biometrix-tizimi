/**
 * Sentinel VMS — Reconnect Engine
 *
 * Manages per-camera reconnect state with exponential backoff.
 * Classifies failures as TEMPORARY or PERSISTENT.
 * Emits events on each reconnect attempt and on persistent failure.
 *
 * Backoff sequence: 2s → 4s → 8s → 16s → 32s → 60s → 120s (capped)
 */

import { EventEmitter } from 'events';
import { vmsEventService } from '../vmsEventService';

export type FailureClass = 'TEMPORARY' | 'PERSISTENT' | 'NETWORK_RECOVERY';

export interface ReconnectState {
  cameraId: string;
  attemptCount: number;
  lastAttemptAt: number | null;
  nextAttemptAt: number | null;
  failureClass: FailureClass | null;
  isReconnecting: boolean;
  consecutiveFailures: number;
}

const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 120_000;
const PERSISTENT_THRESHOLD = 10; // consecutive failures before classified PERSISTENT

export class ReconnectEngine extends EventEmitter {
  private static instance: ReconnectEngine;
  private states: Map<string, ReconnectState> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): ReconnectEngine {
    if (!ReconnectEngine.instance) {
      ReconnectEngine.instance = new ReconnectEngine();
    }
    return ReconnectEngine.instance;
  }

  /** Register a camera for reconnect management */
  public register(cameraId: string): void {
    if (!this.states.has(cameraId)) {
      this.states.set(cameraId, {
        cameraId,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        failureClass: null,
        isReconnecting: false,
        consecutiveFailures: 0,
      });
    }
  }

  /** Remove camera from reconnect management */
  public unregister(cameraId: string): void {
    this.cancelReconnect(cameraId);
    this.states.delete(cameraId);
  }

  /**
   * Schedule a reconnect attempt with exponential backoff.
   * @param reconnectFn Async function that performs the reconnect.
   *                    Should resolve on success, reject on failure.
   */
  public scheduleReconnect(
    cameraId: string,
    reconnectFn: () => Promise<void>,
    maxRetries = Infinity,
  ): void {
    this.register(cameraId);
    const state = this.states.get(cameraId)!;

    if (state.isReconnecting) return; // Already queued
    if (state.attemptCount >= maxRetries) {
      this.classifyFailure(cameraId, 'PERSISTENT');
      return;
    }

    const delay = this.calculateDelay(state.attemptCount);
    state.isReconnecting = true;
    state.nextAttemptAt = Date.now() + delay;
    this.states.set(cameraId, state);

    const timer = setTimeout(async () => {
      this.timers.delete(cameraId);
      await this.attemptReconnect(cameraId, reconnectFn, maxRetries);
    }, delay);

    this.timers.set(cameraId, timer);
  }

  private async attemptReconnect(
    cameraId: string,
    reconnectFn: () => Promise<void>,
    maxRetries: number,
  ): Promise<void> {
    const state = this.states.get(cameraId);
    if (!state) return;

    state.attemptCount++;
    state.lastAttemptAt = Date.now();
    state.isReconnecting = false;
    this.states.set(cameraId, state);

    this.emit('attempt', { cameraId, attempt: state.attemptCount });
    vmsEventService.emit('CAMERA_DISCONNECTED', 'ReconnectEngine', {
      cameraId,
      attempt: state.attemptCount,
      msg: `Reconnect attempt #${state.attemptCount} for camera ${cameraId}`,
    }, 'WARNING');

    try {
      await reconnectFn();
      this.onReconnectSuccess(cameraId);
    } catch {
      state.consecutiveFailures++;
      this.states.set(cameraId, state);

      if (state.consecutiveFailures >= PERSISTENT_THRESHOLD) {
        this.classifyFailure(cameraId, 'PERSISTENT');
        return;
      }

      this.classifyFailure(cameraId, 'TEMPORARY');
      // Schedule next attempt
      this.scheduleReconnect(cameraId, reconnectFn, maxRetries);
    }
  }

  /** Call this when a connection succeeds to reset backoff */
  public onReconnectSuccess(cameraId: string): void {
    const state = this.states.get(cameraId);
    if (!state) return;

    const wasRecovering = state.consecutiveFailures > 0;
    state.attemptCount = 0;
    state.consecutiveFailures = 0;
    state.failureClass = null;
    state.isReconnecting = false;
    state.nextAttemptAt = null;
    this.states.set(cameraId, state);

    if (wasRecovering) {
      this.emit('recovered', { cameraId });
      vmsEventService.emit('CAMERA_CONNECTED', 'ReconnectEngine', {
        cameraId,
        msg: `Camera ${cameraId} reconnected successfully after ${state.attemptCount} attempts.`,
      }, 'SUCCESS');
    }
  }

  /** Cancel any pending reconnect for a camera */
  public cancelReconnect(cameraId: string): void {
    const timer = this.timers.get(cameraId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(cameraId);
    }
    const state = this.states.get(cameraId);
    if (state) {
      state.isReconnecting = false;
      state.nextAttemptAt = null;
      this.states.set(cameraId, state);
    }
  }

  public getState(cameraId: string): ReconnectState | undefined {
    return this.states.get(cameraId);
  }

  public getAllStates(): ReconnectState[] {
    return Array.from(this.states.values());
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private calculateDelay(attempt: number): number {
    const delay = BASE_DELAY_MS * Math.pow(2, Math.min(attempt, 6));
    return Math.min(delay, MAX_DELAY_MS);
  }

  private classifyFailure(cameraId: string, cls: FailureClass): void {
    const state = this.states.get(cameraId);
    if (!state) return;
    state.failureClass = cls;
    this.states.set(cameraId, state);
    this.emit('failureClassified', { cameraId, class: cls });

    if (cls === 'PERSISTENT') {
      vmsEventService.emit('SYSTEM_ERROR', 'ReconnectEngine', {
        cameraId,
        msg: `Camera ${cameraId} classified as PERSISTENT FAILURE after ${state.consecutiveFailures} consecutive errors.`,
      }, 'CRITICAL');
    }
  }
}

export const reconnectEngine = ReconnectEngine.getInstance();
