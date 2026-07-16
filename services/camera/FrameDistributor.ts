/**
 * Sentinel VMS — Frame Distributor
 *
 * Single consumer of the Frame Queue. Distributes the same decoded frame
 * to multiple registered consumers via named channels.
 *
 * RULE: Never decode the same stream more than once.
 * All consumers MUST register here — they may NOT tap the stream directly.
 *
 * Built-in consumer slots:
 *   LIVE_VIEW, RECORDER, SNAPSHOT, AI_ENGINE,
 *   VIDEO_WALL, DIGITAL_TWIN, SOC, PLAYBACK
 */

import { frameQueueManager, VmsFrame } from './FrameQueue';

export type ConsumerChannel =
  | 'LIVE_VIEW'
  | 'RECORDER'
  | 'SNAPSHOT'
  | 'AI_ENGINE'
  | 'VIDEO_WALL'
  | 'DIGITAL_TWIN'
  | 'SOC'
  | 'PLAYBACK'
  | string; // Extensible for future modules

export type FrameConsumer = (frame: VmsFrame) => void | Promise<void>;

export interface ConsumerRegistration {
  channel: ConsumerChannel;
  cameraId: string; // '*' = all cameras
  consumer: FrameConsumer;
  registeredAt: number;
}

interface DistributorStats {
  totalFramesDistributed: number;
  totalConsumers: number;
  perChannel: Record<string, number>;
}

class FrameDistributor {
  private static instance: FrameDistributor;

  /** channel → cameraId → consumer list */
  private consumers: Map<ConsumerChannel, Map<string, FrameConsumer[]>> = new Map();
  private stats: DistributorStats = {
    totalFramesDistributed: 0,
    totalConsumers: 0,
    perChannel: {},
  };

  private constructor() {
    // Subscribe to all frames from FrameQueueManager
    frameQueueManager.on('frame', (frame: VmsFrame) => {
      this.distribute(frame);
    });
  }

  public static getInstance(): FrameDistributor {
    if (!FrameDistributor.instance) {
      FrameDistributor.instance = new FrameDistributor();
    }
    return FrameDistributor.instance;
  }

  /**
   * Register a consumer for a specific channel and camera (or all cameras).
   * @param channel Named consumer slot (LIVE_VIEW, RECORDER, …)
   * @param cameraId Camera ID to subscribe to, or '*' for all cameras
   * @param consumer Callback that receives each frame — MUST NOT block
   */
  public register(
    channel: ConsumerChannel,
    cameraId: string,
    consumer: FrameConsumer,
  ): void {
    if (!this.consumers.has(channel)) {
      this.consumers.set(channel, new Map());
    }
    const channelMap = this.consumers.get(channel)!;
    if (!channelMap.has(cameraId)) {
      channelMap.set(cameraId, []);
    }
    channelMap.get(cameraId)!.push(consumer);
    this.stats.totalConsumers++;
    this.stats.perChannel[channel] = (this.stats.perChannel[channel] ?? 0) + 1;
  }

  /**
   * Unregister a specific consumer function.
   */
  public unregister(
    channel: ConsumerChannel,
    cameraId: string,
    consumer: FrameConsumer,
  ): void {
    const channelMap = this.consumers.get(channel);
    if (!channelMap) return;
    const list = channelMap.get(cameraId);
    if (!list) return;
    const idx = list.indexOf(consumer);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.stats.totalConsumers = Math.max(0, this.stats.totalConsumers - 1);
      this.stats.perChannel[channel] = Math.max(0, (this.stats.perChannel[channel] ?? 0) - 1);
    }
  }

  /**
   * Remove all consumers for a camera across all channels.
   * Call when a camera is deregistered.
   */
  public deregisterCamera(cameraId: string): void {
    for (const channelMap of this.consumers.values()) {
      channelMap.delete(cameraId);
    }
  }

  /**
   * Distribute one frame to all matching consumers.
   * Consumers receive the same Buffer reference (no copy).
   * Each consumer is called asynchronously (fire-and-forget) to prevent head-of-line blocking.
   */
  private distribute(frame: VmsFrame): void {
    this.stats.totalFramesDistributed++;

    for (const [, channelMap] of this.consumers) {
      // Per-camera consumers
      const cameraConsumers = channelMap.get(frame.cameraId) ?? [];
      // Wildcard consumers (subscribe to all cameras)
      const wildcardConsumers = channelMap.get('*') ?? [];

      const all = [...cameraConsumers, ...wildcardConsumers];
      for (const fn of all) {
        // Non-blocking delivery — errors in consumers must not crash the distributor
        try {
          const result = fn(frame);
          if (result instanceof Promise) {
            result.catch(() => {});
          }
        } catch {
          // Consumer threw synchronously — isolate failure
        }
      }
    }
  }

  public getStats(): DistributorStats {
    return { ...this.stats };
  }

  public listConsumers(): { channel: ConsumerChannel; cameraId: string; count: number }[] {
    const result: { channel: ConsumerChannel; cameraId: string; count: number }[] = [];
    for (const [channel, channelMap] of this.consumers) {
      for (const [cameraId, list] of channelMap) {
        result.push({ channel, cameraId, count: list.length });
      }
    }
    return result;
  }
}

export const frameDistributor = FrameDistributor.getInstance();
