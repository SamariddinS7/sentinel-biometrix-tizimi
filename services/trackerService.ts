
import { User, Vector3 } from '../types';

export interface TrackedFace {
  trackId: number;
  bbox: { x: number; y: number; w: number; h: number };
  velocity: { vx: number; vy: number }; // Linear velocity for motion prediction
  detectionScore: number;
  missedFrames: number;
  state: 'DETECTED' | 'LOST' | 'VERIFIED' | 'UNKNOWN' | 'AMBIGUOUS';
  identity?: User | null;
  similarity?: number;
  firstSeen: number;
  lastSeen: number;
  bestFaceImage?: string; // Base64 crop for recognition
  descriptor?: Float32Array | number[]; // Last known face descriptor for Re-ID
  
  // Timeline Data
  duration?: number; // Total seconds visible
  timelineStatus?: 'NEW' | 'VISIBLE' | 'LOST' | 'EXITED';
  
  // 3D Spatial Data (Computed by Backend)
  position3d?: Vector3;
}

export class TrackerService {
  // Client-side tracking logic is now largely superseded by Server-Side tracker
  // This class remains as a DTO definition / helper for frontend types.
  constructor() {}
}

export const trackerService = new TrackerService();
