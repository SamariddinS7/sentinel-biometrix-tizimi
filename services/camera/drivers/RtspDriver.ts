/**
 * Sentinel VMS — RTSP / RTSPS Camera Driver
 *
 * Implements ICameraDriver for RTSP and RTSPS streams.
 * Wraps the existing RtspSession (services/camera/rtsp.ts) and
 * RtspConnectionPool — never duplicates stream decoding.
 *
 * Supported protocols: RTSP, RTSPS, RTP_UDP, RTP_TCP
 *
 * Snapshot: Retrieved via HTTP (Hikvision /ISAPI/Streaming/channels/101/picture,
 * Dahua /cgi-bin/snapshot.cgi, generic /snapshot.jpg) using vendor-specific paths.
 */

import http from 'http';
import https from 'https';
import { AbstractCameraDriver, StreamStats } from './CameraDriver';
import { RtspSession, rtspConnectionPool } from '../RtspConnectionPool';
import { securityManager } from '../security';
import {
  CameraCapabilities,
  CameraConfig,
  CameraProtocol,
  CodecType,
  DeviceDetails,
  StreamProfile,
} from '../interfaces';
import { vmsEventService } from '../../vmsEventService';

export class RtspDriver extends AbstractCameraDriver {
  readonly driverId = 'rtsp';
  readonly protocol: CameraProtocol = 'RTSP';

  private session: RtspSession | null = null;
  private activeSessions: Map<StreamProfile, RtspSession> = new Map();

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(config: CameraConfig): Promise<void> {
    this._config = config;
    this.setState('CONNECTING');

    // Decrypt password for transport
    if (config.encryptedPassword) {
      try {
        config.encryptedPassword = securityManager.decrypt(config.encryptedPassword);
      } catch {
        // Not encrypted — use as-is
      }
    }

    try {
      this.session = await rtspConnectionPool.getOrCreateSession(config.id, config, 'MAIN');
      this.activeSessions.set('MAIN', this.session);
      this.setState('STREAMING');
      this._connectedAt = Date.now();

      const stats = this.session.getStats();
      this._streamStats = {
        fps: stats.fps,
        bitrateKbps: stats.bitrateKbps,
        packetLossPct: stats.packetLossPct,
        latencyMs: stats.latencyMs,
        resolution: stats.resolution,
        codec: stats.codec,
        reconnectCount: this._reconnectCount,
        uptimeMs: 0,
      };

      vmsEventService.emit('CAMERA_CONNECTED', 'RtspDriver', {
        cameraId: config.id,
        protocol: this.protocol,
        streamUrl: config.streamUrl,
      }, 'SUCCESS');
    } catch (err: any) {
      this.setState('ERROR');
      this.emit('error', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    for (const [profile] of this.activeSessions) {
      rtspConnectionPool.releaseSession(this._config?.id ?? '', profile);
    }
    this.activeSessions.clear();
    this.session = null;
    this.setState('DISCONNECTED');
  }

  async startStream(profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this._config) throw new Error('Driver not connected');

    const s = await rtspConnectionPool.getOrCreateSession(this._config.id, this._config, profile);
    this.activeSessions.set(profile, s);
    this.setState('STREAMING');
    return this._config.streamUrl;
  }

  async stopStream(profile: StreamProfile = 'MAIN'): Promise<void> {
    if (!this._config) return;
    rtspConnectionPool.releaseSession(this._config.id, profile);
    this.activeSessions.delete(profile);
    if (this.activeSessions.size === 0) this.setState('CONNECTED');
  }

  async getStreamUri(profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this._config) throw new Error('Driver not connected');
    const url = this._config.streamUrl;

    // Vendor-specific sub-stream URL rewriting
    if (profile === 'MAIN') return url;
    if (this._config.type === 'HIKVISION') {
      return url.replace('/Streaming/Channels/101', '/Streaming/Channels/102');
    }
    if (this._config.type === 'DAHUA') {
      return url.replace('subtype=0', 'subtype=1');
    }
    if (this._config.type === 'AXIS') {
      return url.replace('stream=1', 'stream=2');
    }
    return url;
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  async getSnapshot(_profile: StreamProfile = 'MAIN'): Promise<Buffer> {
    if (!this._config) throw new Error('Driver not connected');
    const { ip, port, username, encryptedPassword, type } = this._config;
    const pw = encryptedPassword ?? '';
    const snapshotPath = this.resolveSnapshotPath(type ?? '');

    return new Promise<Buffer>((resolve, reject) => {
      const auth = Buffer.from(`${username}:${pw}`).toString('base64');
      const options: http.RequestOptions = {
        hostname: ip,
        port: port || 80,
        path: snapshotPath,
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Sentinel-VMS-Snapshot/1.0',
        },
        timeout: 5000,
      };

      const scheme = this._config?.protocol === 'RTSPS' ? https : http;
      const req = scheme.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Snapshot HTTP ${res.statusCode} for ${ip}${snapshotPath}`));
          } else {
            resolve(body);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Snapshot timeout')); });
      req.end();
    });
  }

  private resolveSnapshotPath(vendor: string): string {
    const v = vendor.toUpperCase();
    if (v === 'HIKVISION') return '/ISAPI/Streaming/channels/101/picture';
    if (v === 'DAHUA') return '/cgi-bin/snapshot.cgi';
    if (v === 'AXIS') return '/axis-cgi/jpg/image.cgi';
    if (v === 'UNIVIEW' || v === 'UNV') return '/onvif/snapshot/1/1';
    if (v === 'REOLINK') return '/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=1';
    if (v === 'HANWHA') return '/stw-cgi/image.cgi?msubmenu=jpeg&action=view';
    if (v === 'BOSCH') return '/snap.jpg';
    if (v === 'TAPO' || v === 'TPLINK_VIGI') return '/snapshot.jpg';
    return '/snapshot.jpg'; // Generic fallback
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
      supportedResolutions: ['1920x1080', '1280x720', '640x480'],
      supportedCodecs: [this._streamStats.codec ?? 'H264'] as CodecType[],
      irControl: false,
      ledControl: false,
      smartDetections: [],
    };
  }

  async getMetadata(): Promise<DeviceDetails> {
    return {
      vendor: this._config?.type ?? 'Generic RTSP',
      model: 'IP Camera (RTSP)',
      firmwareVersion: 'N/A',
      serialNumber: this._config?.id ?? 'N/A',
      macAddress: '00:00:00:00:00:00',
      hardwareId: `rtsp_${this._config?.ip ?? 'unknown'}`,
    };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  getStreamStats(): StreamStats {
    if (this.session) {
      const s = this.session.getStats();
      this._streamStats = {
        fps: s.fps,
        bitrateKbps: s.bitrateKbps,
        packetLossPct: s.packetLossPct,
        latencyMs: s.latencyMs,
        resolution: s.resolution,
        codec: s.codec,
        reconnectCount: this._reconnectCount,
        uptimeMs: this._connectedAt ? Date.now() - this._connectedAt : 0,
      };
    }
    return { ...this._streamStats };
  }
}
