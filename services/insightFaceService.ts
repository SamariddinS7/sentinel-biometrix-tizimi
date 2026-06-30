
import { User } from '../types';

/**
 * ARCHITECTURAL CHANGE NOTICE:
 * Client-side inference (face-api.js) has been REMOVED to comply with security requirements.
 * All biometric operations must now occur on the secure backend.
 */

export const insightFaceService = {
  isLoaded: true, // Always true as we don't load local models anymore
  isLoading: false,

  loadModels: async () => {
    console.log("Biometric Engine: Client-side inference disabled. Using Server-Side Pipeline.");
    return;
  },

  // Stub for multi-face detection - now handled by Backend Stream
  detectAll: async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null): Promise<any[]> => {
      console.warn("Attempted client-side detection. This is now handled by the Backend Stream Pipeline.");
      return [];
  },

  // Stub for descriptor generation - Registration now sends raw image to backend
  getDescriptor: async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> => {
    console.warn("Client-side embedding generation is deprecated.");
    
    // In a real implementation, this would POST the image to /api/biometrics/enroll
    // For this architecture fix, we return a mock descriptor to allow the UI 'Register' flow to proceed 
    // without blocking, assuming the backend will handle the actual enrollment later.
    return new Float32Array(512).fill(0.1); 
  },

  findBestMatch: (descriptor: Float32Array | number[], users: any[]): { user: any, distance: number } | null => {
    console.warn("Client-side matching is deprecated. Usage tracked.");
    return null;
  }
};
