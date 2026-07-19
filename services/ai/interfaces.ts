export type DeviceType = 'CPU' | 'CUDA' | 'TENSOR_RT' | 'ONNX_RUNTIME' | 'OPENVINO';

export interface RuntimeDevice {
  type: DeviceType;
  index: number; // GPU/device index (e.g. 0 for GPU 0, CPU defaults to 0)
}

export type PluginState = 'UNLOADED' | 'LOADING' | 'LOADED' | 'ERROR';

export interface AiPluginMetadata {
  id: string;
  name: string;
  version: string;
  vendor: string;
  supportedDevices: DeviceType[];
  description: string;
}

export interface PluginConfig {
  threshold: number;
  maxResults?: number;
  extraParams?: Record<string, any>;
}

/**
 * Common bounding box in normalized coordinates [0.0, 1.0]
 */
export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/**
 * Skeletal joint point
 */
export interface Keypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}

/**
 * Structured outputs for AI engine modules
 */
export interface BaseDetection {
  id: string; // Dynamic trace/track tracking ID
  confidence: number;
  classLabel: string;
  box?: BoundingBox;
}

export interface FaceDescriptor extends BaseDetection {
  embedding?: number[]; // 512-dim vector for identification
  age?: number;
  gender?: 'M' | 'F' | 'UNKNOWN';
  livenessScore?: number;
}

export interface OcrResult extends BaseDetection {
  text: string;
  language?: string;
}

export interface SkeletalPose {
  keypoints: Keypoint[];
  score: number;
}

export interface DynamicDetectionPayload {
  cameraId: string;
  timestamp: number;
  frameId: string;
  detections?: BaseDetection[];
  faces?: FaceDescriptor[];
  ocr?: OcrResult[];
  poses?: SkeletalPose[];
  metadata?: Record<string, any>;
}

/**
 * Strictly defined AI event payloads. No simulated or random dummy data.
 */
export interface PersonDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  trackId: string;
  confidence: number;
  box: BoundingBox;
}

export interface VehicleDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  trackId: string;
  vehicleType: string; // e.g. Car, Truck, Motorcycle, Bus
  confidence: number;
  box: BoundingBox;
}

export interface FaceDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  trackId: string;
  confidence: number;
  box: BoundingBox;
}

export interface FaceRecognizedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  trackId: string;
  personId: string; // Database mapped profile ID
  name: string;
  confidence: number;
  box: BoundingBox;
}

export interface FireDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  confidence: number;
  box?: BoundingBox;
  isExtensive: boolean;
}

export interface SmokeDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  confidence: number;
  box?: BoundingBox;
}

export interface CrowdDetectedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  headCount: number;
  densityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  box?: BoundingBox;
}

export interface PPEViolationEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  trackId: string;
  missingItems: Array<'HELMET' | 'VEST' | 'GLASSES' | 'GLOVES'>;
  confidence: number;
  box: BoundingBox;
}

export interface OCRCompletedEvent {
  cameraId: string;
  timestamp: number;
  frameId: string;
  text: string;
  confidence: number;
  box: BoundingBox;
}

export interface TrackingLostEvent {
  cameraId: string;
  timestamp: number;
  trackId: string;
  classLabel: string;
}

export interface TrackingRecoveredEvent {
  cameraId: string;
  timestamp: number;
  trackId: string;
  classLabel: string;
  box: BoundingBox;
}

/**
 * Union types of all official AI Events published to vmsEventService
 */
export type AiEventMap = {
  PersonDetected: PersonDetectedEvent;
  VehicleDetected: VehicleDetectedEvent;
  FaceDetected: FaceDetectedEvent;
  FaceRecognized: FaceRecognizedEvent;
  FireDetected: FireDetectedEvent;
  SmokeDetected: SmokeDetectedEvent;
  CrowdDetected: CrowdDetectedEvent;
  PPEViolation: PPEViolationEvent;
  OCRCompleted: OCRCompletedEvent;
  TrackingLost: TrackingLostEvent;
  TrackingRecovered: TrackingRecoveredEvent;
};

/**
 * Input Frame buffer layout
 */
export interface VideoFrame {
  id: string;
  cameraId: string;
  timestamp: number;
  width: number;
  height: number;
  buffer: Buffer; // Raw frame pixels
  format: 'RGBA' | 'RGB' | 'NV12';
}

export type FramePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface QueuedFrame {
  frame: VideoFrame;
  priority: FramePriority;
  targetPlugins: string[]; // Active plugins listening to this frame
}

/**
 * The unified interface representing an AI Engine Plugin.
 * Decoupled from external components to enforce security containment boundaries.
 */
export interface AiPlugin {
  metadata: AiPluginMetadata;
  state: PluginState;
  config: PluginConfig;

  /**
   * Boots the plugin dependencies and parses starting configurations.
   */
  initialize(config: PluginConfig): Promise<boolean>;

  /**
   * Binds the AI network representation (.engine, .onnx, .xml/.bin) to target hardware devices.
   */
  load(device: RuntimeDevice): Promise<boolean>;

  /**
   * Performs forward propagation over the target frame buffer.
   * Return real native detections. Returns empty array if no matches occur.
   */
  infer(frame: VideoFrame): Promise<DynamicDetectionPayload>;

  /**
   * Formally deallocates acceleration context pools, releasing GPU VRAM pointers.
   */
  unload(): Promise<boolean>;

  /**
   * Measures active model pipeline statistics (latency jitter, sensor health).
   */
  healthCheck(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    latencyMs: number;
    error?: string;
  }>;
}
