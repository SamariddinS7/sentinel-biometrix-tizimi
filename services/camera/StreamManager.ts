/**
 * Sentinel VMS — Stream Manager
 *
 * Single point of control for all active camera streams.
 * Responsibilities:
 *   • Open / close / reconnect streams
 *   • Codec detection, frame timestamping, latency measurement
 *   • Bandwidth and resolution monitoring
 *   • FPS measurement
 *   • Feed raw frames into the FrameQueue (the only path to downstream consumers)
 *
 * This module performs NO AI inference.
 * It decodes each stream ONCE and publishes frames to the FrameQueue.
 * FrameDistributor handles all downstream fan-out.
 */

import { EventEmitter } from 'events';
import { ICameraDriver } from './drivers/CameraDriver';
import { RtspDriver } from './drivers/RtspDriver';
import { OnvifDriver } from './drivers/OnvifDriver';
import { HttpSnapshotDriver } from './drivers/HttpSnapshotDriver';
import { UsbDriver } from './drivers/UsbDriver';
import { frameQueueManager, VmsFrame } from './FrameQueue';
import { frameDistributor } from './FrameDistributor';
import { CameraConfig, CameraProtocol, CodecType, StreamProfile } from './interfaces';
import { vmsEventService } from '../vmsEventService';

export interface StreamSession {
  cameraId: string;
  driver: ICameraDriver;
  profile: StreamProfile;
  openedAt: number;
  lastFrameAt: number | null;
  frameCount: number;
  totalBytesRx: number;
  codecDetected: CodecType | null;
  resolutionDetected: string | null;
  latencyMs: number;
  fpsSmoothed: number;
  bandwidthKbps: number;
}

export interface StreamStats {
  cameraId: string;
  profile: StreamProfile;
  state: string;
  openedAt: number;
  uptimeSec: number;
  frameCount: number;
  fpsSmoothed: number;
  bandwidthKbps: number;
  latencyMs: number;
  codec: string | null;
  resolution: string | null;
}

const FPS_SMOOTHING = 0.2; // EMA alpha

class StreamManager extends EventEmitter {
  private static instance: StreamManager;
  private sessions: Map<string, StreamSession> = new Map();

  private constructor() {
    super();
    this.setMaxListeners(256);
  }

  public static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  // ─── Driver factory ────────────────────────────────────────────────────────

  /**
   * Instantiate the correct driver for a given protocol.
   * This is the ONLY place in the system where concrete drivers are constructed.
   */
  public createDriver(protocol: CameraProtocol): ICameraDriver {
    switch (protocol) {
      case 'RTSP':
      case 'RTSPS':
      case 'RTP_UDP':
      case 'RTP_TCP':
        return new RtspDriver();
      case 'ONVIF_S':
      case 'ONVIF_T':
      case 'ONVIF_G':
      case 'ONVIF_M':
        return new OnvifDriver();
      case 'HTTP':
      case 'HTTPS':
        return new HttpSnapshotDriver();
      default:
        // 'USB' and unknown types → local testing driver
        return new UsbDriver();
    }
  }

  // ─── Open / close streams ─────────────────────────────────────────────────

  /**
   * Open a stream for a camera. Creates the frame queue entry and
   * subscribes the driver frame events to the queue.
   */
  public async openStream(
    config: CameraConfig,
    profile: StreamProfile = 'MAIN',
  ): Promise<StreamSession> {
    const key = this.sessionKey(config.id, profile);

    if (this.sessions.has(key)) {
      return this.sessions.get(key)!;
    }

    const driver = this.createDriver(config.protocol ?? 'RTSP');

    // Connect driver to hardware
    await driver.connect(config);

    // Create frame queue slot
    frameQueueManager.createQueue(config.id);

    // Subscribe driver 'frame' events → frame queue
    driver.on('frame', (rawFrame: Buffer) => {
      const stats = driver.getStreamStats();
      frameQueueManager.enqueue(
        config.id,
        rawFrame,
        this.parseWidth(stats.resolution),
        this.parseHeight(stats.resolution),
        stats.codec ?? 'H264',
        { profile, latencyMs: stats.latencyMs },
      );
    });

    // Start the actual stream
    await driver.startStream(profile);

    const session: StreamSession = {
      cameraId: config.id,
      driver,
      profile,
      openedAt: Date.now(),
      lastFrameAt: null,
      frameCount: 0,
      totalBytesRx: 0,
      codecDetected: null,
      resolutionDetected: null,
      latencyMs: 0,
      fpsSmoothed: 0,
      bandwidthKbps: 0,
    };

    this.sessions.set(key, session);

    // Update session stats on each frame from queue
    frameQueueManager.on('frame', (frame: VmsFrame) => {
      if (frame.cameraId !== config.id) return;
      const s = this.sessions.get(key);
      if (!s) return;

      s.frameCount++;
      const now = Date.now();
      if (s.lastFrameAt !== null) {
        const interval = now - s.lastFrameAt;
        const instantFps = 1000 / Math.max(1, interval);
        s.fpsSmoothed = s.fpsSmoothed === 0
          ? instantFps
          : (FPS_SMOOTHING * instantFps + (1 - FPS_SMOOTHING) * s.fpsSmoothed);
      }
      s.lastFrameAt = now;
      s.totalBytesRx += frame.data.length;
      s.bandwidthKbps = Math.round((frame.data.length * 8) / 1000);
      s.codecDetected = frame.codec;
      s.resolutionDetected = `${frame.width}x${frame.height}`;
    });

    // Driver state change events
    driver.on('stateChange', ({ next }: { next: string }) => {
      this.emit('streamStateChange', { cameraId: config.id, profile, state: next });
      vmsEventService.emit(
        next === 'STREAMING' ? 'CAMERA_CONNECTED' : 'CAMERA_DISCONNECTED',
        'StreamManager',
        { cameraId: config.id, profile, state: next },
        next === 'STREAMING' ? 'INFO' : 'WARNING',
      );
    });

    driver.on('error', (err: Error) => {
      this.emit('streamError', { cameraId: config.id, profile, error: err.message });
    });

    this.emit('streamOpened', { cameraId: config.id, profile });
    return session;
  }

  /**
   * Close a stream and release all resources.
   */
  public async closeStream(cameraId: string, profile: StreamProfile = 'MAIN'): Promise<void> {
    const key = this.sessionKey(cameraId, profile);
    const session = this.sessions.get(key);
    if (!session) return;

    try {
      await session.driver.stopStream(profile);
      await session.driver.disconnect();
    } catch {
      // Best-effort cleanup
    }

    this.sessions.delete(key);
    frameDistributor.deregisterCamera(cameraId);
    frameQueueManager.destroyQueue(cameraId);

    this.emit('streamClosed', { cameraId, profile });
  }

  /**
   * Reconnect a stream — closes then reopens with the same config.
   */
  public async reconnectStream(config: CameraConfig, profile: StreamProfile = 'MAIN'): Promise<void> {
    await this.closeStream(config.id, profile);
    await this.openStream(config, profile);
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  public getSession(cameraId: string, profile: StreamProfile = 'MAIN'): StreamSession | null {
    return this.sessions.get(this.sessionKey(cameraId, profile)) ?? null;
  }

  public getDriver(cameraId: string, profile: StreamProfile = 'MAIN'): ICameraDriver | null {
    return this.getSession(cameraId, profile)?.driver ?? null;
  }

  public getAllStats(): StreamStats[] {
    return Array.from(this.sessions.values()).map(s => ({
      cameraId: s.cameraId,
      profile: s.profile,
      state: s.driver.state,
      openedAt: s.openedAt,
      uptimeSec: Math.round((Date.now() - s.openedAt) / 1000),
      frameCount: s.frameCount,
      fpsSmoothed: Math.round(s.fpsSmoothed * 10) / 10,
      bandwidthKbps: s.bandwidthKbps,
      latencyMs: s.latencyMs,
      codec: s.codecDetected,
      resolution: s.resolutionDetected,
    }));
  }

  public getStats(cameraId: string, profile: StreamProfile = 'MAIN'): StreamStats | null {
    const s = this.getSession(cameraId, profile);
    if (!s) return null;
    return {
      cameraId: s.cameraId,
      profile: s.profile,
      state: s.driver.state,
      openedAt: s.openedAt,
      uptimeSec: Math.round((Date.now() - s.openedAt) / 1000),
      frameCount: s.frameCount,
      fpsSmoothed: Math.round(s.fpsSmoothed * 10) / 10,
      bandwidthKbps: s.bandwidthKbps,
      latencyMs: s.latencyMs,
      codec: s.codecDetected,
      resolution: s.resolutionDetected,
    };
  }

  public isStreaming(cameraId: string, profile: StreamProfile = 'MAIN'): boolean {
    const session = this.getSession(cameraId, profile);
    return session?.driver.state === 'STREAMING';
  }

  public activeStreamCount(): number {
    return this.sessions.size;
  }

  // ─── Shutdown ──────────────────────────────────────────────────────────────

  public async shutdown(): Promise<void> {
    const closeTasks = Array.from(this.sessions.keys()).map(key => {
      const [cameraId, profile] = key.split('::');
      return this.closeStream(cameraId, profile as StreamProfile);
    });
    await Promise.allSettled(closeTasks);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private sessionKey(cameraId: string, profile: StreamProfile): string {
    return `${cameraId}::${profile}`;
  }

  private parseWidth(resolution: string): number {
    const match = resolution?.match(/^(\d+)x(\d+)$/);
    return match ? parseInt(match[1], 10) : 1920;
  }

  private parseHeight(resolution: string): number {
    const match = resolution?.match(/^(\d+)x(\d+)$/);
    return match ? parseInt(match[2], 10) : 1080;
  }
}

export const streamManager = StreamManager.getInstance();
