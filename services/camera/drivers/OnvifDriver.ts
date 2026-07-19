/**
 * Sentinel VMS — ONVIF Camera Driver (Profile S & Profile T)
 *
 * Implements ICameraDriver for ONVIF-compliant cameras.
 * Combines ONVIF SOAP services (services/camera/onvif.ts) with RTSP streaming
 * via RtspConnectionPool — ensuring a single stream decode path.
 *
 * Supported protocols: ONVIF_S, ONVIF_T
 * Supported brands: Hikvision, Dahua, Axis, Bosch, Hanwha, Uniview, Tiandy, TP-Link VIGI, and all ONVIF-compliant cameras.
 */

import http from 'http';
import {
  AbstractCameraDriver,
} from './CameraDriver';
import { OnvifClient } from '../OnvifService';
import { rtspConnectionPool } from '../RtspConnectionPool';
import { securityManager } from '../security';
import {
  CameraCapabilities,
  CameraConfig,
  CameraProtocol,
  DeviceDetails,
  PtzCommand,
  StreamProfile,
  StorageInfo,
} from '../interfaces';
import { vmsEventService } from '../../vmsEventService';

export class OnvifDriver extends AbstractCameraDriver {
  readonly driverId = 'onvif';
  readonly protocol: CameraProtocol = 'ONVIF_S';

  private onvifClient: OnvifClient | null = null;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(config: CameraConfig): Promise<void> {
    this._config = config;
    this.setState('CONNECTING');

    if (config.encryptedPassword) {
      try {
        config.encryptedPassword = securityManager.decrypt(config.encryptedPassword);
      } catch {
        // Not encrypted — use as-is
      }
    }

    try {
      // Phase 1: ONVIF service discovery
      this.setState('AUTHENTICATING');
      this.onvifClient = new OnvifClient(config);
      await this.onvifClient.initializeServices();

      // Phase 2: Authenticate via GetDeviceInformation
      const info = await this.onvifClient.getDeviceInformation();
      if (!info.vendor) throw new Error('ONVIF authentication failed — no device info returned');

      // Phase 3: Resolve stream URI and initiate RTSP
      const streamUri = await this.onvifClient.getStreamUri('Profile_1');
      config.streamUrl = streamUri;

      await rtspConnectionPool.getOrCreateSession(config.id, config, 'MAIN');
      this.setState('STREAMING');
      this._connectedAt = Date.now();

      vmsEventService.emit('CAMERA_CONNECTED', 'OnvifDriver', {
        cameraId: config.id,
        vendor: info.vendor,
        model: info.model,
        firmware: info.firmwareVersion,
      }, 'SUCCESS');
    } catch (err: any) {
      this.setState('ERROR');
      this.emit('error', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this._config) {
      rtspConnectionPool.releaseSession(this._config.id, 'MAIN');
      rtspConnectionPool.releaseSession(this._config.id, 'SUB');
    }
    this.onvifClient = null;
    this.setState('DISCONNECTED');
  }

  async startStream(profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this._config || !this.onvifClient) throw new Error('Driver not connected');
    const token = profile === 'MAIN' ? 'Profile_1' : profile === 'SUB' ? 'Profile_2' : 'Profile_3';
    const uri = await this.onvifClient.getStreamUri(token);
    this._config.streamUrl = uri;
    await rtspConnectionPool.getOrCreateSession(this._config.id, this._config, profile);
    this.setState('STREAMING');
    return uri;
  }

  async stopStream(profile: StreamProfile = 'MAIN'): Promise<void> {
    if (this._config) rtspConnectionPool.releaseSession(this._config.id, profile);
  }

  async getStreamUri(profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this.onvifClient) throw new Error('ONVIF client not initialised');
    const token = profile === 'MAIN' ? 'Profile_1' : profile === 'SUB' ? 'Profile_2' : 'Profile_3';
    return this.onvifClient.getStreamUri(token);
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────────

  async getSnapshot(_profile: StreamProfile = 'MAIN'): Promise<Buffer> {
    if (!this._config) throw new Error('Driver not connected');
    // ONVIF GetSnapshotUri → HTTP GET for actual image
    // Fallback to Hikvision-style HTTP snapshot
    const snapshotUri = await this.resolveSnapshotUri();
    return this.fetchSnapshot(snapshotUri);
  }

  private async resolveSnapshotUri(): Promise<string> {
    if (!this._config) throw new Error('No config');
    const ip = this._config.ip;
    const port = this._config.onvifPort || 80;
    const vendor = (this._config.type ?? '').toUpperCase();

    // Use vendor-specific known paths (faster than ONVIF GetSnapshotUri)
    if (vendor === 'HIKVISION') return `http://${ip}:${this._config.port ?? 80}/ISAPI/Streaming/channels/101/picture`;
    if (vendor === 'DAHUA') return `http://${ip}:${port}/cgi-bin/snapshot.cgi`;
    if (vendor === 'AXIS') return `http://${ip}/axis-cgi/jpg/image.cgi`;
    if (vendor === 'HANWHA') return `http://${ip}/stw-cgi/image.cgi?msubmenu=jpeg&action=view`;
    if (vendor === 'BOSCH') return `http://${ip}/snap.jpg`;
    return `http://${ip}:${port}/onvif/snapshot`;
  }

  private fetchSnapshot(uri: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const url = new URL(uri);
      const auth = Buffer.from(
        `${this._config!.username}:${this._config!.encryptedPassword ?? ''}`,
      ).toString('base64');

      const req = http.request(
        {
          method: 'GET',
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname + url.search,
          headers: {
            Authorization: `Basic ${auth}`,
            'User-Agent': 'Sentinel-ONVIF-Snapshot/1.0',
          },
          timeout: 6000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks);
            if ((res.statusCode ?? 0) >= 400) {
              reject(new Error(`Snapshot HTTP ${res.statusCode}`));
            } else {
              resolve(body);
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Snapshot timeout')); });
      req.end();
    });
  }

  // ─── PTZ ──────────────────────────────────────────────────────────────────

  async ptzControl(command: PtzCommand): Promise<void> {
    if (!this.onvifClient) throw new Error('ONVIF client not initialised');
    await this.onvifClient.ptzControl(command);
  }

  // ─── Capabilities ──────────────────────────────────────────────────────────

  async getCapabilities(): Promise<CameraCapabilities> {
    if (this.onvifClient) {
      return this.onvifClient.getCapabilities();
    }
    return {
      ptz: false,
      audioIn: true,
      audioOut: false,
      edgeStorage: true,
      firmwareUpgrade: true,
      onvifSupported: true,
      onvifProfiles: ['S', 'T'],
      supportedResolutions: ['1920x1080', '1280x720'],
      supportedCodecs: ['H264', 'H265'],
      irControl: true,
      ledControl: false,
      smartDetections: ['MOTION_DETECTION'],
    };
  }

  async getMetadata(): Promise<DeviceDetails> {
    if (this.onvifClient) {
      return this.onvifClient.getDeviceInformation();
    }
    return {
      vendor: this._config?.type ?? 'ONVIF Camera',
      model: 'Generic ONVIF',
      firmwareVersion: 'N/A',
      serialNumber: 'N/A',
      macAddress: '00:00:00:00:00:00',
      hardwareId: `onvif_${this._config?.ip ?? 'unknown'}`,
    };
  }

  // ─── Hardware control ──────────────────────────────────────────────────────

  async syncTime(ntpServer?: string): Promise<boolean> {
    if (!this.onvifClient) return false;
    return this.onvifClient.syncTime();
  }

  async setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean> {
    if (!this.onvifClient) return false;
    return this.onvifClient.setIrCutFilter(mode);
  }

  async setLedControl(_enabled: boolean, _intensity?: number): Promise<boolean> {
    return false; // Not in ONVIF standard — vendor extension required
  }

  async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, state: 'NORMAL' };
  }
}
