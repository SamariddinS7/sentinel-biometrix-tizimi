/**
 * Sentinel VMS — HTTP Snapshot / MJPEG Driver
 *
 * Implements ICameraDriver for cameras that expose:
 *   • A JPEG snapshot URL (polled periodically)
 *   • An MJPEG multipart/x-mixed-replace stream
 *
 * Supported protocols: HTTP, HTTPS
 * Supported use cases: Basic IP cameras, NVR web interfaces, MJPEG webcams, HTTP-only cameras
 *
 * No RTSP, no ONVIF. Pure HTTP.
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { AbstractCameraDriver } from './CameraDriver';
import {
  CameraCapabilities,
  CameraConfig,
  CameraProtocol,
  DeviceDetails,
  StreamProfile,
  StorageInfo,
} from '../interfaces';

const DEFAULT_SNAPSHOT_INTERVAL_MS = 1000; // 1 FPS for HTTP snapshot mode

export class HttpSnapshotDriver extends AbstractCameraDriver {
  readonly driverId = 'http-snapshot';
  readonly protocol: CameraProtocol = 'HTTP';

  private pollTimer: NodeJS.Timeout | null = null;
  private mjpegController: AbortController | null = null;
  private frameCount = 0;
  private lastFrameAt = 0;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(config: CameraConfig): Promise<void> {
    this._config = config;
    this.setState('CONNECTING');

    // Validate URL
    const url = config.streamUrl || `http://${config.ip}/snapshot.jpg`;
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid HTTP camera URL: ${url}`);
    }

    this.setState('CONNECTED');
    this._connectedAt = Date.now();
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.stopMjpeg();
    this.setState('DISCONNECTED');
  }

  async startStream(profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this._config) throw new Error('Driver not connected');

    const url = this._config.streamUrl;
    const isMjpeg = url.includes('mjpeg') || url.includes('mjpg') ||
      this._config.protocol === 'HTTP';

    if (isMjpeg) {
      this.startMjpegCapture(url);
    } else {
      this.startSnapshotPolling(url);
    }

    this.setState('STREAMING');
    return url;
  }

  async stopStream(_profile: StreamProfile = 'MAIN'): Promise<void> {
    this.stopPolling();
    this.stopMjpeg();
    this.setState('CONNECTED');
  }

  async getStreamUri(_profile: StreamProfile = 'MAIN'): Promise<string> {
    return this._config?.streamUrl ?? '';
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  async getSnapshot(_profile: StreamProfile = 'MAIN'): Promise<Buffer> {
    if (!this._config) throw new Error('Driver not connected');
    const url = this.resolveSnapshotUrl();
    return this.fetchJpeg(url);
  }

  private resolveSnapshotUrl(): string {
    const cfg = this._config!;
    const base = cfg.streamUrl || `http://${cfg.ip}`;
    // Common MJPEG → snapshot URL patterns
    return base.replace('/video', '/snapshot').replace('/mjpeg', '/jpeg');
  }

  private fetchJpeg(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const parsed = new URL(url);
      const requester = parsed.protocol === 'https:' ? https : http;
      const auth = Buffer.from(
        `${this._config?.username ?? 'admin'}:${this._config?.encryptedPassword ?? ''}`,
      ).toString('base64');

      const req = requester.request(
        {
          method: 'GET',
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          headers: {
            Authorization: `Basic ${auth}`,
            'User-Agent': 'Sentinel-VMS-HTTP-Driver/1.0',
            Accept: 'image/jpeg,image/*',
          },
          timeout: 5000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 400) {
              reject(new Error(`HTTP ${res.statusCode} from snapshot endpoint`));
            } else {
              resolve(Buffer.concat(chunks));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HTTP snapshot timeout')); });
      req.end();
    });
  }

  // ─── MJPEG stream capture ──────────────────────────────────────────────────

  private startMjpegCapture(url: string): void {
    this.stopMjpeg();

    const parsed = new URL(url);
    const requester = parsed.protocol === 'https:' ? https : http;
    const auth = Buffer.from(
      `${this._config?.username ?? ''}:${this._config?.encryptedPassword ?? ''}`,
    ).toString('base64');

    const req = requester.request(
      {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        headers: {
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Sentinel-VMS-MJPEG/1.0',
        },
      },
      (res) => {
        let partBuffer = Buffer.alloc(0);
        const boundaryMatch = (res.headers['content-type'] ?? '').match(/boundary=([^\s;]+)/i);
        const boundary = Buffer.from(`--${boundaryMatch ? boundaryMatch[1] : 'frame'}`);

        res.on('data', (chunk: Buffer) => {
          partBuffer = Buffer.concat([partBuffer, chunk]);
          let boundaryIdx: number;

          while ((boundaryIdx = partBuffer.indexOf(boundary)) !== -1) {
            const afterBoundary = partBuffer.indexOf(Buffer.from('\r\n\r\n'), boundaryIdx);
            if (afterBoundary === -1) break;

            const dataStart = afterBoundary + 4;
            const nextBoundary = partBuffer.indexOf(boundary, dataStart);
            if (nextBoundary === -1) break;

            const jpegData = partBuffer.slice(dataStart, nextBoundary);
            if (jpegData.length > 0) {
              this.onFrameReceived(jpegData);
            }
            partBuffer = partBuffer.slice(nextBoundary);
          }
        });
        res.on('error', () => this.handleStreamError());
        res.on('close', () => this.handleStreamError());
      },
    );

    req.on('error', () => this.handleStreamError());
    req.end();
  }

  private startSnapshotPolling(url: string): void {
    this.stopPolling();
    const intervalMs = Math.round(1000 / (this._config?.fps || 1));

    this.pollTimer = setInterval(async () => {
      try {
        const frame = await this.fetchJpeg(url);
        this.onFrameReceived(frame);
      } catch {
        // Frame fetch failed — continue polling
      }
    }, intervalMs);
  }

  private onFrameReceived(jpegData: Buffer): void {
    this.frameCount++;
    const now = Date.now();
    if (this.lastFrameAt > 0) {
      const interval = now - this.lastFrameAt;
      this._streamStats.fps = Math.round(1000 / interval);
    }
    this.lastFrameAt = now;
    this._streamStats.bitrateKbps = Math.round((jpegData.length * 8) / 1000);
    this._streamStats.resolution = this._config?.resolution ?? '0x0';
    this.emit('frame', jpegData);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopMjpeg(): void {
    this.mjpegController?.abort();
    this.mjpegController = null;
  }

  private handleStreamError(): void {
    if (this._state !== 'STREAMING') return;
    this.setState('RECOVERING');
    this.emit('error', new Error('HTTP stream closed unexpectedly'));
  }

  // ─── Capabilities ──────────────────────────────────────────────────────────

  async getCapabilities(): Promise<CameraCapabilities> {
    return {
      ptz: false,
      audioIn: false,
      audioOut: false,
      edgeStorage: false,
      firmwareUpgrade: false,
      onvifSupported: false,
      onvifProfiles: [],
      supportedResolutions: [this._config?.resolution ?? '1280x720'],
      supportedCodecs: ['MJPEG'],
      irControl: false,
      ledControl: false,
      smartDetections: [],
    };
  }

  async getMetadata(): Promise<DeviceDetails> {
    return {
      vendor: 'Generic HTTP Camera',
      model: 'MJPEG / Snapshot',
      firmwareVersion: 'N/A',
      serialNumber: this._config?.id ?? 'N/A',
      macAddress: '00:00:00:00:00:00',
      hardwareId: `http_${this._config?.ip ?? 'unknown'}`,
    };
  }

  async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, state: 'NORMAL' };
  }
}
