import { QueuedFrame, VideoFrame, FramePriority } from './interfaces';

export interface SchedulerStats {
  receivedCount: number;
  processedCount: number;
  droppedCount: number;
  queueDepth: number;
  activeBackpressure: boolean;
}

export class FrameScheduler {
  private static instance: FrameScheduler;
  private queue: QueuedFrame[] = [];
  private maxQueueCapacity = 150; // Dynamic capacity threshold
  private framePool: VideoFrame[] = []; // Zero-copy buffer reuse pool
  private maxPoolSize = 200;

  private stats: SchedulerStats = {
    receivedCount: 0,
    processedCount: 0,
    droppedCount: 0,
    queueDepth: 0,
    activeBackpressure: false
  };

  private constructor() {
    this.preallocatePool();
  }

  public static getInstance(): FrameScheduler {
    if (!FrameScheduler.instance) {
      FrameScheduler.instance = new FrameScheduler();
    }
    return FrameScheduler.instance;
  }

  /**
   * Pre-allocates a pool of continuous frame objects to avoid memory fragmentation.
   */
  private preallocatePool() {
    for (let i = 0; i < this.maxPoolSize; i++) {
      this.framePool.push({
        id: `pool_idx_${i}`,
        cameraId: '',
        timestamp: 0,
        width: 0,
        height: 0,
        buffer: Buffer.alloc(0),
        format: 'RGB'
      });
    }
  }

  /**
   * Acquires an empty, reusable VideoFrame shell from the zero-copy buffer pool.
   */
  public acquireFrameShell(): VideoFrame {
    if (this.framePool.length > 0) {
      return this.framePool.pop()!;
    }
    // High-concurrency fallback buffer
    return {
      id: `dynamic_alloc_${Math.random().toString(36).substr(2, 9)}`,
      cameraId: '',
      timestamp: Date.now(),
      width: 0,
      height: 0,
      buffer: Buffer.alloc(0),
      format: 'RGB'
    };
  }

  /**
   * Returns a processed frame back to the zero-copy reuse pool.
   */
  public releaseFrame(frame: VideoFrame) {
    if (frame.id.startsWith('pool_idx_') && this.framePool.length < this.maxPoolSize) {
      frame.cameraId = '';
      frame.timestamp = 0;
      frame.width = 0;
      frame.height = 0;
      frame.buffer = Buffer.alloc(0);
      this.framePool.push(frame);
    }
  }

  /**
   * Schedules an ingested frame, performing dynamic drops under heavy backpressure constraints.
   */
  public scheduleFrame(frame: VideoFrame, priority: FramePriority, targetPlugins: string[]): boolean {
    this.stats.receivedCount++;

    // Backpressure analysis: Measure current buffer fullness
    const queueRatio = this.queue.length / this.maxQueueCapacity;
    this.stats.activeBackpressure = queueRatio >= 0.75;

    if (this.queue.length >= this.maxQueueCapacity) {
      // Hard backpressure reached.
      if (priority === 'CRITICAL') {
        // Critical frame (Intrusion/Fire) MUST NOT be dropped. Drop the oldest LOW/NORMAL frame instead.
        const lowPriorityIndex = this.queue.findIndex(item => item.priority === 'LOW' || item.priority === 'NORMAL');
        if (lowPriorityIndex !== -1) {
          const droppedItem = this.queue.splice(lowPriorityIndex, 1)[0];
          this.releaseFrame(droppedItem.frame);
          this.stats.droppedCount++;
          console.warn(`[AI FrameScheduler] Dropped low priority frame from camera ${droppedItem.frame.cameraId} to secure critical frame.`);
        } else {
          // No low priority to drop, drop the oldest normal/high
          const droppedItem = this.queue.shift()!;
          this.releaseFrame(droppedItem.frame);
          this.stats.droppedCount++;
        }
      } else if (priority === 'HIGH' && queueRatio < 1.0) {
        // High priority frames can displace low priority items
        const lowPriorityIndex = this.queue.findIndex(item => item.priority === 'LOW');
        if (lowPriorityIndex !== -1) {
          const droppedItem = this.queue.splice(lowPriorityIndex, 1)[0];
          this.releaseFrame(droppedItem.frame);
          this.stats.droppedCount++;
        } else {
          this.stats.droppedCount++;
          this.releaseFrame(frame);
          return false;
        }
      } else {
        // Dropped frame protection in action: Throttling normal/low frames
        this.stats.droppedCount++;
        this.releaseFrame(frame);
        return false;
      }
    }

    // Dynamic FPS Throttling under backpressure
    if (this.stats.activeBackpressure && (priority === 'LOW' || priority === 'NORMAL')) {
      // Skip 50% of incoming lower priority frame analytical requests
      if (this.stats.receivedCount % 2 === 0) {
        this.stats.droppedCount++;
        this.releaseFrame(frame);
        return false;
      }
    }

    // Queue placing
    this.queue.push({ frame, priority, targetPlugins });
    this.stats.queueDepth = this.queue.length;
    return true;
  }

  /**
   * Pulls the next scheduled frame out of the pipeline buffer.
   */
  public nextFrame(): QueuedFrame | undefined {
    // Priority dispatching: Check CRITICAL frames first
    this.sortQueueByPriority();
    const item = this.queue.shift();
    if (item) {
      this.stats.processedCount++;
      this.stats.queueDepth = this.queue.length;
    }
    return item;
  }

  /**
   * Sorts queue ensuring CRITICAL and HIGH frames migrate to the front immediately.
   */
  private sortQueueByPriority() {
    const priorityWeight: Record<FramePriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1
    };

    this.queue.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
  }

  public getStats(): SchedulerStats {
    return { ...this.stats };
  }

  public clearQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.releaseFrame(item.frame);
    }
    this.stats.queueDepth = 0;
  }
}
