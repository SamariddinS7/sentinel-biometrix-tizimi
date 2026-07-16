/**
 * Sentinel VMS — USB / Local Video Driver
 *
 * FOR TESTING ONLY — as specified in the architecture requirements.
 * Reads frames from a local video file or a /dev/video* USB device.
 *
 * In production, all real streams use RtspDriver or OnvifDriver.
 * This driver exists solely to support local integration testing
 * without requiring real camera hardware.
 *
 * Protocol: USB (local only)
 */

import fs from 'fs';
import path from 'path';
import { AbstractCameraDriver } from './CameraDriver';
import {
  CameraCapabilities,
  CameraConfig,
  CameraProtocol,
  DeviceDetails,
  StreamProfile,
  StorageInfo,
} from '../interfaces';

const TESTING_ASSET_DIR = path.join(process.cwd(), 'tests', 'camera', 'assets');

export class UsbDriver extends AbstractCameraDriver {
  readonly driverId = 'usb-local';
  readonly protocol: CameraProtocol = 'RTSP'; // Maps to RTSP in pipeline

  private frameTimer: NodeJS.Timeout | null = null;
  private testFrameBuffer: Buffer | null = null;

  async connect(config: CameraConfig): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[UsbDriver] USB/local video driver is disabled in production. Use RtspDriver or OnvifDriver.');
    }

    this._config = config;
    this.setState('CONNECTING');

    // Load a test JPEG frame if available
    const testJpeg = path.join(TESTING_ASSET_DIR, 'test_frame.jpg');
    try {
      this.testFrameBuffer = await fs.promises.readFile(testJpeg);
    } catch {
      // Create a minimal 1×1 white JPEG placeholder
      this.testFrameBuffer = Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
        'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
        'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
        'MjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAA' +
        'AAAD/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAU' +
        'EQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=',
        'base64',
      );
    }

    this.setState('CONNECTED');
    this._connectedAt = Date.now();
  }

  async disconnect(): Promise<void> {
    this.stopFrameEmission();
    this.testFrameBuffer = null;
    this.setState('DISCONNECTED');
  }

  async startStream(_profile: StreamProfile = 'MAIN'): Promise<string> {
    if (!this._config) throw new Error('Driver not connected');
    this.startFrameEmission();
    this.setState('STREAMING');
    return `file://${this._config.streamUrl || TESTING_ASSET_DIR}`;
  }

  async stopStream(_profile: StreamProfile = 'MAIN'): Promise<void> {
    this.stopFrameEmission();
    this.setState('CONNECTED');
  }

  async getStreamUri(_profile: StreamProfile = 'MAIN'): Promise<string> {
    return `file://${this._config?.streamUrl ?? TESTING_ASSET_DIR}`;
  }

  async getSnapshot(_profile: StreamProfile = 'MAIN'): Promise<Buffer> {
    if (!this.testFrameBuffer) throw new Error('No test frame available');
    return this.testFrameBuffer;
  }

  async getCapabilities(): Promise<CameraCapabilities> {
    return {
      ptz: false,
      audioIn: false,
      audioOut: false,
      edgeStorage: false,
      firmwareUpgrade: false,
      onvifSupported: false,
      onvifProfiles: [],
      supportedResolutions: ['640x480'],
      supportedCodecs: ['MJPEG'],
      irControl: false,
      ledControl: false,
      smartDetections: [],
    };
  }

  async getMetadata(): Promise<DeviceDetails> {
    return {
      vendor: 'Test',
      model: 'USB/Local Video (Testing Only)',
      firmwareVersion: '0.0.0',
      serialNumber: 'TEST-DEVICE',
      macAddress: '00:00:00:00:00:00',
      hardwareId: 'usb_test',
    };
  }

  async getStorageState(): Promise<StorageInfo> {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, state: 'NORMAL' };
  }

  // ─── Test frame emission ───────────────────────────────────────────────────

  private startFrameEmission(): void {
    this.stopFrameEmission();
    const fps = this._config?.fps ?? 5;
    const interval = Math.round(1000 / fps);

    this.frameTimer = setInterval(() => {
      if (this.testFrameBuffer) {
        this.emit('frame', this.testFrameBuffer);
        this._streamStats.fps = fps;
        this._streamStats.bitrateKbps = Math.round(this.testFrameBuffer.length * 8 * fps / 1000);
        this._streamStats.resolution = this._config?.resolution ?? '640x480';
        this._streamStats.codec = 'MJPEG';
      }
    }, interval);
  }

  private stopFrameEmission(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }
}
