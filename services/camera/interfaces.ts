export type CameraProtocol =
  | 'RTSP'
  | 'RTSPS'
  | 'RTP_UDP'
  | 'RTP_TCP'
  | 'HTTP'
  | 'HTTPS'
  | 'ONVIF_S'
  | 'ONVIF_T'
  | 'ONVIF_G'
  | 'ONVIF_M';

export type CameraState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'STREAMING'
  | 'RECOVERING'
  | 'UPDATING'
  | 'ERROR'
  | 'OFFLINE';

export type StreamProfile = 'MAIN' | 'SUB' | 'THIRD';

export type CodecType = 'H264' | 'H264_PLUS' | 'H265' | 'H265_PLUS' | 'MJPEG';

export interface CameraConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  rtspPort: number;
  onvifPort: number;
  username: string;
  encryptedPassword?: string; // Encrypted using AES-256-GCM
  streamUrl: string;
  type: string; // Vendor name, e.g., 'HIKVISION', 'DAHUA'
  protocol: CameraProtocol;
  transport: 'TCP' | 'UDP';
  fps: number;
  resolution: string;
  recordingMode: 'Continuous' | 'Motion' | 'Manual' | 'None';
  retentionDays: number;
  status?: 'ONLINE' | 'OFFLINE';
}

export interface CameraCapabilities {
  ptz: boolean;
  audioIn: boolean;
  audioOut: boolean;
  edgeStorage: boolean;
  firmwareUpgrade: boolean;
  onvifSupported: boolean;
  onvifProfiles: ('S' | 'T' | 'G' | 'M')[];
  supportedResolutions: string[];
  supportedCodecs: CodecType[];
  irControl: boolean;
  ledControl: boolean;
  smartDetections: string[]; // Line crossing, intrusion, face detection
}

export interface PtzCommand {
  action: 'MOVE_CONTINUOUS' | 'MOVE_ABSOLUTE' | 'MOVE_RELATIVE' | 'STOP' | 'PRESET_GOTO' | 'PRESET_SET' | 'ZOOM';
  pan?: number;  // -1.0 to 1.0
  tilt?: number; // -1.0 to 1.0
  zoom?: number; // -1.0 to 1.0
  speed?: number; // 0.0 to 1.0
  presetToken?: string;
}

export interface CameraHealth {
  state: CameraState;
  latencyMs: number;
  packetLossPct: number;
  bandwidthBps: number;
  fps: number;
  resolution: string;
  codec: CodecType;
  recordingStatus: 'ACTIVE' | 'IDLE' | 'ERROR';
  temperature?: number; // °C (if supported by HW)
  cpuUsagePct?: number;
  memoryUsagePct?: number;
  lastActive: string;
}

export interface DeviceDetails {
  vendor: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  macAddress: string;
  hardwareId: string;
}

export interface StorageInfo {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  state: 'NORMAL' | 'FULL' | 'UNFORMATTED' | 'ERROR';
}

export interface CameraProvider {
  /**
   * Connect to physical camera device and bind resources
   */
  connect(config: CameraConfig): Promise<void>;

  /**
   * Safe disconnect and socket pool release
   */
  disconnect(): Promise<void>;

  /**
   * Authenticate with credentials rotation checks
   */
  authenticate(): Promise<boolean>;

  /**
   * Query device for complete capability list
   */
  detectCapabilities(): Promise<CameraCapabilities>;

  /**
   * Retrieve active stream URL (Main, Sub or Third Stream)
   */
  getStreamUri(profile: StreamProfile): Promise<string>;

  /**
   * Captures raw JPEG frame bytes directly from camera pipeline
   */
  getSnapshot(): Promise<Buffer>;

  /**
   * Control Pan-Tilt-Zoom hardware motor assemblies
   */
  ptzControl(command: PtzCommand): Promise<void>;

  /**
   * Query real-time diagnostics parameters
   */
  getHealth(): Promise<CameraHealth>;

  /**
   * Sync on-board RTC time with an NTP or system clock
   */
  syncTime(ntpServer?: string): Promise<boolean>;

  /**
   * Query physical hardware descriptors
   */
  getSystemInfo(): Promise<DeviceDetails>;

  /**
   * Configure physical parameters: LED controls
   */
  setLedControl(enabled: boolean, intensity?: number): Promise<boolean>;

  /**
   * Configure IR-Cut filter mode
   */
  setIrCutFilter(mode: 'DAY' | 'NIGHT' | 'AUTO'): Promise<boolean>;

  /**
   * Get telemetry of edge micro-SD card
   */
  getStorageState(): Promise<StorageInfo>;
}
