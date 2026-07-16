/**
 * Sentinel VMS — Abstract Camera Driver
 *
 * Every protocol implementation (RTSP, ONVIF, HTTP, USB) MUST extend this class.
 * Higher layers only interact with ICameraDriver — never with protocol-specific code.
 *
 * Pipeline:  Camera → CameraDriver → StreamManager → FrameQueue → FrameDistributor → Consumers
 */

import { EventEmitter } from 'events';
import {
  CameraConfig,
  CameraCapabilities,
  CameraHealth,
  CameraState,
  CameraProtocol,
  DeviceDetails,
  PtzCommand,
  StorageInfo,
  StreamProfile,
  CodecType,
} from '../interfaces';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamStats {
  fps: number;
  bitrateKbps: number;
  packetLossPct: number;
  latencyMs: number;
  resolution: string;
  codec: CodecType;
  reconnectCount: number;
  uptimeMs: number;
}

export interface DriverCapabilityProbe {
  rtspReachable: boolean;
  onvifReachable: boolean;
  authRequired: boolean;
  authPassed: boolean;
  codecsDetected: CodecType[];
  profilesDetected: string[];
  latencyMs: number;
}

/**
 * ICameraDriver — the only interface higher layers may depend on.
 * Never import a concrete driver class outside the drivers/ directory.
 */
export interface ICameraDriver {
  /** Unique driver identifier */
  readonly driverId: string;

  /** Supported protocol */
  readonly protocol: CameraProtocol;

  /** Current connection state */
  readonly state: CameraState;

  /** Connect to the physical device */
  connect(config: CameraConfig): Promise<void>;

  /** Gracefully disconnect and release resources */
  disconnect(): Promise<void>;

  /** Reconnect using the last known config */
  reconnect(): Promise<void>;

  /** Start streaming on a given profile (MAIN / SUB / THIRD) */
  startStream(profile?: StreamProfile): Promise<string>;

  /** Stop streaming the given profile */
  stopStream(profile?: StreamProfile): Promise<void>;

  /** Poll real-time health metrics */
  healthCheck(): Promise<CameraHealth>;

  /** Capture a JPEG snapshot */
  getSnapshot(profile?: StreamProfile): Promise<Buffer>;

  /** Query device capabilities */
  getCapabilities(): Promise<CameraCapabilities>;

  /** Get device hardware metadata */
  getMetadata(): Promise<DeviceDetails>;

  /** Resolve live stream URI for the given profile */
  getStreamUri(profile?: StreamProfile): Promise<string>;

  /** PTZ command (no-op on fixed cameras) */
  ptzControl(command: PtzCommand): Promise<void>;

  /** Sync device RTC with NTP or host clock */
  syncTime(ntpServer?: string): Promise<boolean>;

  /** Control on-board LED */
  setLedControl(enabled: boolean, intensity?: number): Promise<boolean>;

  /** Set IR-Cut filter mode */
  setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean>;

  /** Query on-board storage state */
  getStorageState(): Promise<StorageInfo>;

  /** Get real-time stream statistics */
  getStreamStats(): StreamStats;

  /** Subscribe to driver events */
  on(event: 'frame' | 'stateChange' | 'error' | 'reconnecting', listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstract base class
// ─────────────────────────────────────────────────────────────────────────────

export abstract class AbstractCameraDriver extends EventEmitter implements ICameraDriver {
  abstract readonly driverId: string;
  abstract readonly protocol: CameraProtocol;

  protected _state: CameraState = 'DISCONNECTED';
  protected _config: CameraConfig | null = null;
  protected _reconnectCount = 0;
  protected _connectedAt: number | null = null;

  protected _streamStats: StreamStats = {
    fps: 0,
    bitrateKbps: 0,
    packetLossPct: 0,
    latencyMs: 0,
    resolution: '0x0',
    codec: 'H264',
    reconnectCount: 0,
    uptimeMs: 0,
  };

  get state(): CameraState {
    return this._state;
  }

  protected setState(next: CameraState): void {
    if (this._state === next) return;
    const prev = this._state;
    this._state = next;
    if (next === 'CONNECTED' || next === 'STREAMING') {
      this._connectedAt = this._connectedAt ?? Date.now();
    }
    this.emit('stateChange', { prev, next, ts: Date.now() });
  }

  abstract connect(config: CameraConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract startStream(profile?: StreamProfile): Promise<string>;
  abstract stopStream(profile?: StreamProfile): Promise<void>;
  abstract getSnapshot(profile?: StreamProfile): Promise<Buffer>;
  abstract getCapabilities(): Promise<CameraCapabilities>;
  abstract getMetadata(): Promise<DeviceDetails>;
  abstract getStreamUri(profile?: StreamProfile): Promise<string>;

  async reconnect(): Promise<void> {
    if (!this._config) throw new Error('Cannot reconnect: driver was never connected');
    this._reconnectCount++;
    this._streamStats.reconnectCount = this._reconnectCount;
    this.setState('RECOVERING');
    this.emit('reconnecting', { attempt: this._reconnectCount, cameraId: this._config.id });
    await this.disconnect();
    await this.connect(this._config);
  }

  async healthCheck(): Promise<CameraHealth> {
    return {
      state: this._state,
      latencyMs: this._streamStats.latencyMs,
      packetLossPct: this._streamStats.packetLossPct,
      bandwidthBps: this._streamStats.bitrateKbps * 1024,
      fps: this._streamStats.fps,
      resolution: this._streamStats.resolution,
      codec: this._streamStats.codec,
      recordingStatus: 'IDLE',
      lastActive: new Date().toISOString(),
    };
  }

  async ptzControl(_command: PtzCommand): Promise<void> {
    // Default: not supported — subclasses override
    throw new Error(`PTZ not supported by driver: ${this.driverId}`);
  }

  async syncTime(_ntpServer?: string): Promise<boolean> {
    return false;
  }

  async setLedControl(_enabled: boolean, _intensity?: number): Promise<boolean> {
    return false;
  }

  async setIrCutFilter(_mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    return false;
  }

  async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, state: 'NORMAL' };
  }

  async authenticate(): Promise<boolean> {
    return true;
  }

  async detectCapabilities(): Promise<CameraCapabilities> {
    return this.getCapabilities();
  }

  getStreamStats(): StreamStats {
    if (this._connectedAt) {
      this._streamStats.uptimeMs = Date.now() - this._connectedAt;
    }
    return { ...this._streamStats };
  }
}
