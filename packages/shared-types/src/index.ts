
import { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
  }
}

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  EMPLOYEE = 'EMPLOYEE',
  STUDENT = 'STUDENT'
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  EARLY_LEAVE = 'EARLY_LEAVE'
}

export interface User {
  id: string;
  fullName: string;
  email?: string; // Added for profile management
  role: UserRole;
  department: string;
  enrolledDate: string;
  hasEmbedding: boolean;
  lastActive: string;
  avatarUrl: string;
  faceDescriptor?: number[]; 
  permissions?: string[]; // RBAC permissions
}

export interface AuthSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
  location?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  module: string;
  timestamp: string;
  details: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  user: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  department: string;
  timestamp: string; 
  checkIn: string;   
  checkOut: string | null; 
  status: AttendanceStatus;
  confidenceScore: number; 
  livenessVerified: boolean;
  nodeId: string; 
}

export interface SystemStats {
  totalUsers: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  securityAlerts: number;
}

// --- CAMERA MODULE TYPES ---

export enum CameraType {
  USB = 'USB',
  RTSP = 'RTSP',
  REMOTE = 'REMOTE_LINK'
}

export enum CameraStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  CONNECTING = 'CONNECTING'
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  type: CameraType;
  streamUrl: string; 
  status: CameraStatus;
  fps: number;
  resolution: string;
  lastActive: string;
  errorMsg?: string;
  // Part 1: Real Optical Parameters
  focalLength: number; // mm (e.g., 2.8, 3.6, 6.0)
  sensorWidth: number; // mm (e.g., 4.8 for 1/3")
  sensorHeight: number; // mm (e.g., 3.6 for 1/3")
  recordingMode?: 'Continuous' | 'Motion' | 'Schedule' | 'Manual' | 'None';
  retentionDays?: number;
  manualRecordingActive?: boolean;
  emergencyRecordingActive?: boolean;
}

// --- BIOMETRIC & AI TYPES ---

export interface BiometricConfig {
    engine: 'InsightFace' | 'FaceNet';
    backendUrl: string;
    thresholds: {
        detection: number;
        recognition: number;
    };
}

export interface FaceAnalysisResult {
    estimatedAge: string;
    expression: string;
    features: string;
    wearables: string;
    livenessConfidence: number;
}

// --- SPATIAL ANALYTICS TYPES (NEW) ---

export interface Point {
    x: number;
    y: number;
}

export interface MapZone {
    id: string;
    name: string;
    type: 'entrance' | 'exit' | 'restricted' | 'safe';
    points: Point[]; // Polygon vertices
    color: string;
}

// Part 3: Physical Geometry for Clipping
export interface MapWall {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    height?: number; // For 3D extrusions
}

export interface MapCameraPlacement {
    cameraId: string; // Links to Camera.id
    x: number;
    y: number;
    rotation: number; // Degrees 0-360
    height: number; // Meters from floor
    pitch: number; // Degrees tilt (0 = horizontal)
}

export interface FloorPlan {
    id: string;
    name: string;
    imageUrl: string;
    width: number; // Real world meters or pixels
    height: number;
    scale: number; // Pixels per meter
    zones: MapZone[];
    walls: MapWall[]; // Obstacles that block FOV
    cameras: MapCameraPlacement[];
}

export interface TrajectoryPoint {
    x: number;
    y: number;
    timestamp: number;
}

export interface ActiveTrack {
    trackId: string;
    personName: string;
    role: string;
    path: TrajectoryPoint[];
    currentZoneId?: string;
    velocity: number;
    // New: Backend provided 3D Position
    position3d?: Vector3;
}

// --- 3D DIGITAL TWIN TYPES ---

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Camera3D extends Camera {
    position: Vector3;
    rotation: Vector3; // Euler angles in radians [x, y, z]
    fov: number; // Vertical FOV in degrees
    aspectRatio: number; // Width / Height
    depth: number; // Max effective view distance in meters
    coverageColor: string;
    isCalibrating?: boolean; // UI state
}

export interface Wall3D {
    id: string;
    position: Vector3;
    size: Vector3; // Width, Height, Depth
    color?: string;
    opacity?: number;
}

export interface Entity3D {
    id: string;
    type: 'PERSON' | 'ASSET' | 'ROBOT';
    position: Vector3;
    velocity: Vector3;
    label: string;
    role: string; // determines color
    status: 'ACTIVE' | 'LOST' | 'EXITED';
    lastUpdate: number;
    // Part 4: Trajectory & Timeline
    trajectory: Vector3[]; // History of positions
    firstSeen: number;     // Timestamp
    duration: number;      // Seconds
    // Part 5: Security Layer
    currentZoneId?: string; // which zone they are currently in
    isViolating?: boolean;  // is triggering an alert
    trackedBy?: string;
}

export interface ZonePolicy {
    allowedRoles: string[];
    maxDwellTimeSec: number;
}

export interface Zone3D {
    id: string;
    name: string;
    type: 'RESTRICTED' | 'SAFE' | 'TRANSIT';
    position: Vector3; // Center
    dimensions: Vector3; // Width, Height, Depth
    color: string;
    floorId: string;
    policy?: ZonePolicy;
}

export interface SecurityAlert {
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    timestamp: number;
    entityId: string;
    zoneId?: string;
    type?: string;
    status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
    assignedTo?: string;
    resolutionNotes?: string;
    escalatedAt?: number;
    resolvedAt?: number;
    notesHistory?: Array<{ timestamp: number; operator: string; text: string; action: string }>;
}

// --- SETTINGS TYPES ---

export interface GeneralSettings {
  systemName: string;
  organizationName: string;
  timezone: string;
  dateFormat: string;
  language: string;
  workingDays: string[]; 
  workStart: string;
  workEnd: string;
}

export interface FaceRecSettings {
  modelType: 'ArcFace' | 'FaceNet' | 'SsdMobileNet';
  detectionThreshold: number; 
  similarityThreshold: number; 
  minFaceQuality: number;
  multiFaceMode: 'Ignore' | 'First' | 'All';
  maskDetection: 'Allowed' | 'Strict' | 'Separate_Threshold';
  alignFaces: boolean;
}

export interface LivenessSettings {
  enabled: boolean;
  checkEyeBlink: boolean;
  checkHeadMove: boolean;
  confidenceThreshold: number;
  maxAttempts: number;
  lockoutDuration: number; 
}

export interface CameraSettings {
  defaultCameraId: string;
  resolution: string;
  fpsLimit: number;
  autoExposure: boolean;
  healthCheckInterval: number;
}

export interface AttendanceRules {
  mode: 'CheckIn_Only' | 'CheckIn_CheckOut';
  gracePeriod: number; 
  lateThreshold: number;
  earlyLeaveThreshold: number;
  autoCheckout: string; 
  preventDuplicateInterval: number; 
}

export interface SecuritySettings {
  adminPasswordExpiry: number; 
  minPasswordLength: number;
  dataRetentionDays: number;
  gdprCompliance: boolean;
  anonymizeData: boolean;
  requireAdminApprovalForEnrollment: boolean;
}

export interface PerformanceSettings {
  recognitionInterval: number; 
  maxThreads: number;
  gpuEnabled: boolean;
  batchSize: number;
}

export interface LoggingSettings {
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  retentionDays: number;
  auditTrailEnabled: boolean;
}

export interface Notification {
  id: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface NotificationSettings {
  enableEmail: boolean;
  enableWebhook: boolean;
  webhookUrl: string;
  alertOnUnknown: boolean;
  alertOnSpoof: boolean;
  // New preferences
  enablePush: boolean;
  alertOnLate: boolean;
  alertOnEarlyLeave: boolean;
  alertOnSystemError: boolean;
  emailRecipients: string;
}

export interface BackupSettings {
  autoBackup: boolean;
  backupInterval: 'Daily' | 'Weekly' | 'Monthly';
  encryptBackups: boolean;
  lastBackupDate: string | null;
}

export interface SystemSettings {
  general: GeneralSettings;
  faceRec: FaceRecSettings;
  liveness: LivenessSettings;
  camera: CameraSettings;
  rules: AttendanceRules;
  security: SecuritySettings;
  performance: PerformanceSettings;
  logging: LoggingSettings;
  notifications: NotificationSettings;
  backup: BackupSettings;
}
