
import { Camera } from '../types';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache } from './firestoreService';
import { mockCameras } from './mockData';

const CACHE_KEY = 'sentinel_cameras_cache';

export const cameraService = {
  getAllCameras: async (): Promise<Camera[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, 'cameras'));
      const cameras = querySnapshot.docs.map(doc => doc.data() as Camera);
      if (cameras.length > 0) {
        setLocalCache(CACHE_KEY, cameras);
      }
      return cameras.length > 0 ? cameras : getLocalCache(CACHE_KEY, mockCameras);
    } catch (e) {
      console.warn('Firestore getAllCameras failed, falling back to local cache:', e);
      return getLocalCache(CACHE_KEY, mockCameras);
    }
  },

  saveCamera: async (camera: Camera): Promise<void> => {
    // Save to local cache first
    const current = getLocalCache<Camera>(CACHE_KEY, mockCameras);
    const exists = current.findIndex(c => c.id === camera.id);
    if (exists >= 0) {
      current[exists] = camera;
    } else {
      current.push(camera);
    }
    setLocalCache(CACHE_KEY, current);

    // Try syncing with Firestore
    try {
      await setDoc(doc(db, 'cameras', camera.id), camera);
    } catch (e) {
      console.warn(`Firestore saveCamera for ${camera.id} failed, saved locally:`, e);
    }
  },

  deleteCamera: async (id: string): Promise<void> => {
    // Delete from local cache first
    const current = getLocalCache<Camera>(CACHE_KEY, mockCameras);
    const updated = current.filter(c => c.id !== id);
    setLocalCache(CACHE_KEY, updated);

    // Try syncing with Firestore
    try {
      await deleteDoc(doc(db, 'cameras', id));
    } catch (e) {
      console.warn(`Firestore deleteCamera for ${id} failed, deleted locally:`, e);
    }
  },

  // Mock implementation of the Secure Link Generator (Device Enrollment)
  generateSecureLink: (deviceId: string, expiryMinutes: number): Promise<string> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
                dev: deviceId,
                exp: Date.now() + expiryMinutes * 60000,
                nonce: Math.random().toString(36).substring(7)
            }))}.SIGNATURE_HASH_SECURE`;
            
            resolve(`https://sentinel-core.internal/connect?token=${mockToken}`);
        }, 800);
    });
  },

  // Generate a read-only stream viewer link (Sharing)
  generateStreamViewerLink: (cameraId: string, expiryLabel: string): Promise<string> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            resolve(`https://stream.sentinel.sys/view/${cameraId}/index.m3u8?token=${token}&ttl=${expiryLabel}`);
        }, 600);
    });
  }
};
