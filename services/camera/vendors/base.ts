import { CameraCapabilities, CameraConfig, CameraHealth, CameraProvider, CameraState, CodecType, DeviceDetails, PtzCommand, StorageInfo, StreamProfile } from '../interfaces';
import { OnvifClient } from '../OnvifService';
import { RtspSession, rtspConnectionPool } from '../RtspConnectionPool';
import { securityManager } from '../security';
import { vmsEventService } from '../../vmsEventService';

export abstract class BaseCameraConnector implements CameraProvider {
  protected state: CameraState = 'DISCONNECTED';
  protected config!: CameraConfig;
  protected onvifClient: OnvifClient | null = null;
  protected activeStream: RtspSession | null = null;
  protected lastActiveTime: string = new Date().toISOString();
  protected failCount = 0;

  public async connect(config: CameraConfig): Promise<void> {
    this.config = config;
    this.transitionState('CONNECTING');
    this.lastActiveTime = new Date().toISOString();

    try {
      // 1. Decrypt password for handshake operations
      if (config.encryptedPassword) {
        this.config.encryptedPassword = securityManager.decrypt(config.encryptedPassword);
      }

      // 2. Initialize ONVIF operations if supported/mapped
      if (config.protocol.startsWith('ONVIF') || config.onvifPort > 0) {
        this.transitionState('AUTHENTICATING');
        this.onvifClient = new OnvifClient(this.config);
        await this.onvifClient.initializeServices();
        const authOk = await this.authenticate();
        if (!authOk) {
          throw new Error('Authentication challenge failed on handshake');
        }
      }

      // 3. Initiate raw RTSP stream ingestion
      this.activeStream = await rtspConnectionPool.getOrCreateSession(config.id, this.config, 'MAIN');
      
      this.transitionState('STREAMING');
      this.failCount = 0;
      
      vmsEventService.emit('CAMERA_CONNECTED', 'CameraConnector', {
        cameraId: config.id,
        msg: `Camera "${config.name}" connected and streaming successfully via RTSP.`
      }, 'SUCCESS');

    } catch (error: any) {
      this.failCount++;
      this.transitionState('ERROR');
      vmsEventService.emit('CAMERA_DISCONNECTED', 'CameraConnector', {
        cameraId: config.id,
        error: error.message || 'Unknown connector handshake exception'
      }, 'CRITICAL');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this.transitionState('DISCONNECTED');
    if (this.config) {
      rtspConnectionPool.releaseSession(this.config.id, 'MAIN');
    }
    this.activeStream = null;
    this.onvifClient = null;
  }

  public async authenticate(): Promise<boolean> {
    if (this.onvifClient) {
      try {
        await this.onvifClient.getDeviceInformation();
        return true;
      } catch (e) {
        vmsEventService.emit('SYSTEM_ERROR', 'CameraConnector', {
          cameraId: this.config.id,
          message: `ONVIF Authentication failed for user: ${this.config.username}`
        }, 'CRITICAL');
        return false;
      }
    }
    return true; // Assume true if raw RTSP bypasses SOAP auth
  }

  public async detectCapabilities(): Promise<CameraCapabilities> {
    if (this.onvifClient) {
      return await this.onvifClient.getCapabilities();
    }
    
    // Fallback static profile mapping for legacy cameras
    return {
      ptz: false,
      audioIn: false,
      audioOut: false,
      edgeStorage: false,
      firmwareUpgrade: false,
      onvifSupported: false,
      onvifProfiles: [],
      supportedResolutions: ['1920x1080', '1280x720'],
      supportedCodecs: ['H264'],
      irControl: false,
      ledControl: false,
      smartDetections: []
    };
  }

  public async getStreamUri(profile: StreamProfile): Promise<string> {
    if (this.onvifClient && profile !== 'MAIN') {
      const token = profile === 'SUB' ? 'Profile_2' : 'Profile_3';
      return await this.onvifClient.getStreamUri(token);
    }
    return this.config.streamUrl;
  }

  public abstract getSnapshot(): Promise<Buffer>;

  public async ptzControl(command: PtzCommand): Promise<void> {
    if (this.onvifClient) {
      await this.onvifClient.ptzControl(command);
    } else {
      throw new Error('PTZ operations are unsupported on raw RTSP stream feeds.');
    }
  }

  public async getHealth(): Promise<CameraHealth> {
    const streamStats = this.activeStream ? this.activeStream.getStats() : null;
    
    return {
      state: this.state,
      latencyMs: streamStats ? streamStats.latencyMs : 999,
      packetLossPct: streamStats ? streamStats.packetLossPct : 100.0,
      bandwidthBps: streamStats ? (streamStats.bitrateKbps * 1024) : 0,
      fps: streamStats ? streamStats.fps : 0,
      resolution: streamStats ? streamStats.resolution : this.config.resolution,
      codec: streamStats ? streamStats.codec : 'H264',
      recordingStatus: this.config.recordingMode !== 'None' ? 'ACTIVE' : 'IDLE',
      lastActive: this.lastActiveTime
    };
  }

  public async syncTime(ntpServer?: string): Promise<boolean> {
    if (this.onvifClient) {
      return await this.onvifClient.syncTime();
    }
    return false;
  }

  public async getSystemInfo(): Promise<DeviceDetails> {
    if (this.onvifClient) {
      return await this.onvifClient.getDeviceInformation();
    }
    return {
      vendor: 'Generic',
      model: 'RTSP Video Source',
      firmwareVersion: '1.0.0',
      serialNumber: 'LEGACY_DEV',
      macAddress: '00:00:00:00:00:00',
      hardwareId: 'RTSP_BYPASS'
    };
  }

  public abstract setLedControl(enabled: boolean, intensity?: number): Promise<boolean>;
  public abstract setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean>;
  public abstract getStorageState(): Promise<StorageInfo>;

  protected transitionState(newState: CameraState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastActiveTime = new Date().toISOString();
    
    console.log(`[Camera State] ${this.config?.name || 'Device'} transition: ${oldState} -> ${newState}`);
    
    if (this.config) {
      vmsEventService.emit(
        newState === 'ERROR' || newState === 'OFFLINE' ? 'CAMERA_DISCONNECTED' : 'CAMERA_CONNECTED',
        'CameraStateEngine',
        { cameraId: this.config.id, oldState, newState },
        newState === 'ERROR' || newState === 'OFFLINE' ? 'CRITICAL' : 'INFO'
      );
    }
  }
}
