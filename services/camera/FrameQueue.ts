/**
 * Sentinel VMS — Frame Queue
 *
 * Thread-safe (JS single-threaded, async-safe) bounded frame queue per camera.
 * DROP_OLDEST policy: if queue is full, oldest frame is discarded to prevent latency accumulation.
 *
 * No module may bypass the Frame Queue.
 * No AI inference is performed here.
 *
 * Mirrors the behaviour of Python's SmartFrameQueue in backend/face_recognition/frame_queue.py.
 */

import { EventEmitter } from 'events';
import { CodecType } from './interfaces';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface VmsFrame {
  /** Globally unique frame ID */
  id: string;
  /** Camera that produced this frame */
  cameraId: string;
  /** Unix timestamp (ms) of when the frame was captured */
  timestamp: number;
  /** Monotonically increasing sequence number per camera */
  sequenceNumber: number;
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Encoding format */
  codec: CodecType;
  /** Raw encoded frame data (JPEG / H264 NAL / MPEG4) */
  data: Buffer;
  /** Optional sidecar metadata */
  metadata?: Record<string, unknown>;
}

export interface QueueStats {
  cameraId: string;
  size: number;
  maxSize: number;
  totalFramesEnqueued: number;
  totalDropped: number;
  dropRate: number; // fraction 0–1
  lastFrameAt: number | null;
  avgIntervalMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-camera queue
// ─────────────────────────────────────────────────────────────────────────────

class CameraFrameQueue {
  private queue: VmsFrame[] = [];
  private dropCount = 0;
  private totalEnqueued = 0;
  private lastFrameAt: number | null = null;
  private intervalBuffer: number[] = [];

  constructor(
    public readonly cameraId: string,
    public readonly maxSize: number,
  ) {}

  enqueue(frame: VmsFrame): boolean {
    const now = Date.now();

    if (this.lastFrameAt !== null) {
      this.intervalBuffer.push(now - this.lastFrameAt);
      if (this.intervalBuffer.length > 50) this.intervalBuffer.shift();
    }
    this.lastFrameAt = now;
    this.totalEnqueued++;

    if (this.queue.length >= this.maxSize) {
      // DROP_OLDEST policy
      this.queue.shift();
      this.dropCount++;
      if (this.dropCount % 100 === 0) {
        process.stderr.write(
          `[FrameQueue] High latency: dropped ${this.dropCount} frames for camera ${this.cameraId}\n`,
        );
      }
    }

    this.queue.push(frame);
    return true;
  }

  dequeue(): VmsFrame | null {
    return this.queue.shift() ?? null;
  }

  peek(): VmsFrame | null {
    return this.queue[0] ?? null;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  getStats(): QueueStats {
    const avg =
      this.intervalBuffer.length > 0
        ? this.intervalBuffer.reduce((a, b) => a + b, 0) / this.intervalBuffer.length
        : null;

    return {
      cameraId: this.cameraId,
      size: this.queue.length,
      maxSize: this.maxSize,
      totalFramesEnqueued: this.totalEnqueued,
      totalDropped: this.dropCount,
      dropRate: this.totalEnqueued > 0 ? this.dropCount / this.totalEnqueued : 0,
      lastFrameAt: this.lastFrameAt,
      avgIntervalMs: avg,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Central Frame Queue Manager
// ─────────────────────────────────────────────────────────────────────────────

class FrameQueueManager extends EventEmitter {
  private static instance: FrameQueueManager;
  private queues: Map<string, CameraFrameQueue> = new Map();
  private sequenceCounters: Map<string, number> = new Map();

  /** Default queue depth per camera (≈ 4 seconds at 25 fps) */
  private readonly DEFAULT_MAX_SIZE = 100;

  private constructor() {
    super();
    this.setMaxListeners(256); // Support many camera subscriptions
  }

  public static getInstance(): FrameQueueManager {
    if (!FrameQueueManager.instance) {
      FrameQueueManager.instance = new FrameQueueManager();
    }
    return FrameQueueManager.instance;
  }

  /** Create a frame queue for a camera (idempotent) */
  public createQueue(cameraId: string, maxSize = this.DEFAULT_MAX_SIZE): void {
    if (!this.queues.has(cameraId)) {
      this.queues.set(cameraId, new CameraFrameQueue(cameraId, maxSize));
      this.sequenceCounters.set(cameraId, 0);
    }
  }

  /** Remove a camera's frame queue */
  public destroyQueue(cameraId: string): void {
    const q = this.queues.get(cameraId);
    if (q) {
      q.clear();
      this.queues.delete(cameraId);
      this.sequenceCounters.delete(cameraId);
    }
  }

  /**
   * Enqueue a frame. Emits 'frame' event so FrameDistributor can fan-out.
   * Every source MUST call this — no direct delivery to consumers.
   */
  public enqueue(
    cameraId: string,
    data: Buffer,
    width: number,
    height: number,
    codec: CodecType = 'H264',
    metadata?: Record<string, unknown>,
  ): void {
    this.createQueue(cameraId); // Auto-create if missing

    const seq = (this.sequenceCounters.get(cameraId) ?? 0) + 1;
    this.sequenceCounters.set(cameraId, seq);

    const frame: VmsFrame = {
      id: `${cameraId}_${seq}_${Date.now()}`,
      cameraId,
      timestamp: Date.now(),
      sequenceNumber: seq,
      width,
      height,
      codec,
      data,
      metadata,
    };

    this.queues.get(cameraId)!.enqueue(frame);
    // Notify FrameDistributor (and any other subscriber) immediately
    this.emit('frame', frame);
  }

  /** Dequeue the oldest frame for a camera (pull model) */
  public dequeue(cameraId: string): VmsFrame | null {
    return this.queues.get(cameraId)?.dequeue() ?? null;
  }

  public getStats(cameraId: string): QueueStats | null {
    return this.queues.get(cameraId)?.getStats() ?? null;
  }

  public getAllStats(): QueueStats[] {
    return Array.from(this.queues.values()).map(q => q.getStats());
  }

  public queueCount(): number {
    return this.queues.size;
  }
}

export const frameQueueManager = FrameQueueManager.getInstance();
