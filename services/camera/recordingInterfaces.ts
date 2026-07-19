export interface StorageVolumeHealth {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'CRITICAL';
  readSpeedBps: number;
  writeSpeedBps: number;
  latencyMs: number;
  iops: number;
  errorCount: number;
  lastChecked: string;
}

export interface VideoSegment {
  id: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  durationSec: number;
  fileSizeBytes: number;
  filePath: string;
  checksum: string;
  isLocked: boolean;
  recordingMode: 'CONTINUOUS' | 'EVENT' | 'MOTION' | 'ALARM' | 'MANUAL';
}

export interface SegmentMetadata {
  codec: string;
  resolution: string;
  fps: number;
  bitrate: number;
  watermarkSignature?: string;
  events?: string[]; // Embedded event tags for smart playback (e.g., face ids, vehicle plates)
}

export interface StorageProvider {
  id: string;
  name: string;
  type: 'LOCAL' | 'NAS' | 'SAN' | 'OBJECT' | 'CLOUD' | 'HYBRID';
  mountPoint: string;

  // Connection & Lifecycle
  initialize(): Promise<void>;
  getHealth(): Promise<StorageVolumeHealth>;

  // File Operations (Segment-based)
  writeSegment(cameraId: string, timestamp: number, durationSec: number, data: Buffer, metadata: SegmentMetadata): Promise<string>;
  readSegment(segmentId: string): Promise<Buffer>;
  deleteSegment(segmentId: string): Promise<void>;

  // Query Operations
  listSegments(cameraId: string, startTime: number, endTime: number): Promise<VideoSegment[]>;
  getSegmentMetadata(segmentId: string): Promise<SegmentMetadata>;

  // Retention and Locks
  setSegmentLock(segmentId: string, isLocked: boolean): Promise<void>;
  getStorageUsage(): Promise<{ totalBytes: number; usedBytes: number; freeBytes: number }>;
}

export interface NvrHealth {
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  cpuUsagePct: number;
  memoryUsagePct: number;
  activeChannels: number;
  maxChannels: number;
  latencyMs: number;
}

export interface NvrCameraInfo {
  nvrCameraId: string;
  channelNumber: number;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  isRecording: boolean;
  ipAddress: string;
}

export interface NvrRecordingRange {
  startTime: number;
  endTime: number;
  durationSec: number;
  recordingType: 'CONTINUOUS' | 'EVENT' | 'MOTION' | 'ALARM' | 'MANUAL';
}

export interface NvrCapabilities {
  ptzControl: boolean;
  smartDetections: boolean;
  edgeSynchronization: boolean;
  subStreams: boolean;
  audioRecording: boolean;
}

export interface NvrProvider {
  id: string;
  name: string;
  type: 'HIKVISION' | 'DAHUA' | 'SYNOLOGY' | 'BLUEIRIS' | 'FRIGATE' | 'AGENT_DVR' | 'GENERIC_ONVIF';
  ipAddress: string;
  port: number;

  // Connectivity
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getHealth(): Promise<NvrHealth>;

  // Camera Management via NVR
  listCameras(): Promise<NvrCameraInfo[]>;
  getCameraStreamUrl(nvrCameraId: string, profile: 'MAIN' | 'SUB'): Promise<string>;

  // Playback Operations (Redirect to NVR Storage)
  getPlaybackStreamUrl(nvrCameraId: string, startTime: number, endTime: number): Promise<string>;
  searchRecordings(nvrCameraId: string, startTime: number, endTime: number): Promise<NvrRecordingRange[]>;

  // Edge / On-board Sync
  triggerManualRecording(nvrCameraId: string, durationSec: number): Promise<boolean>;
  getNvrCapabilities(): Promise<NvrCapabilities>;
}
