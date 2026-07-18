import { Camera } from '../types';
import { db } from './firestoreService';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';

export const cameraService = {
  getAllCameras: async (): Promise<Camera[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, "cameras"));
      const cameras: Camera[] = [];
      querySnapshot.forEach((doc) => {
        cameras.push({ id: doc.id, ...doc.data() } as Camera);
      });
      return cameras;
    } catch (e) {
      console.warn('Firestore getAllCameras failed:', e);
      return [];
    }
  },

  saveCamera: async (camera: Camera): Promise<void> => {
    try {
      const formattedCamera = {
        id: camera.id,
        name: camera.name,
        location: camera.location || "Tashqi Hudud",
        type: camera.type || "RTSP",
        streamUrl: camera.streamUrl,
        status: camera.status || "ONLINE",
        fps: camera.fps || 25,
        resolution: camera.resolution || "1920x1080",
        lastActive: new Date().toISOString(),
        focalLength: Number(camera.focalLength) || 2.8,
        sensorWidth: Number(camera.sensorWidth) || 4.8,
        sensorHeight: Number(camera.sensorHeight) || 3.6,
        recordingMode: camera.recordingMode || 'Continuous',
        retentionDays: Number(camera.retentionDays) || 30,
        manualRecordingActive: !!camera.manualRecordingActive,
        emergencyRecordingActive: !!camera.emergencyRecordingActive
      };
      
      await setDoc(doc(db, "cameras", camera.id), formattedCamera, { merge: true });
    } catch (e) {
      console.error('Firestore saveCamera failed:', e);
      throw e;
    }
  },

  deleteCamera: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, "cameras", id));
    } catch (e) {
      console.error('Firestore deleteCamera failed:', e);
      throw e;
    }
  },

  refreshStatus: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('/api/cameras/reconnect', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reconnect cameras');
      return await response.json();
    } catch (e) {
      console.error('REST API refreshStatus failed:', e);
      return { success: false, message: 'Server ulanishi xatosi' };
    }
  },

  diagnoseCamera: async (cameraId: string, streamUrl: string): Promise<{
    success: boolean;
    failedStep?: number;
    steps: { step: number; status: 'success' | 'failed'; message: string }[];
    logs: string[];
  }> => {
    try {
      const response = await fetch(`/api/cameras/${cameraId}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl }),
      });
      if (!response.ok) throw new Error('Failed to run diagnostics');
      return await response.json();
    } catch (e) {
      console.error('REST API diagnoseCamera failed:', e);
      return {
        success: false,
        failedStep: 1,
        steps: [
          { step: 1, status: 'failed', message: 'Mavjudlik testi (Ping) muvaffaqiyatsiz tugadi' }
        ],
        logs: ['Diagnostics API xatosi', String(e)]
      };
    }
  },

  scanSubnet: async (subnet: string): Promise<any[]> => {
    try {
      const response = await fetch('/api/cameras/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan subnet');
      }
      return await response.json();
    } catch (e: any) {
      console.error('REST API scanSubnet failed:', e);
      throw e; // Propagate for UI handling
    }
  },

  generateSecureLink: async (deviceId: string, expiryMinutes: number): Promise<string> => {
    throw new Error('Secure link generation must be performed server-side via /api/auth/generate-token');
  },

  generateStreamViewerLink: async (cameraId: string, expiryLabel: string): Promise<string> => {
    return `/api/cameras/${cameraId}/stream?ttl=${expiryLabel}`;
  }
};
