
import { User } from '../types';

/**
 * ARCHITECTURAL CHANGE NOTICE:
 * Client-side inference (face-api.js) has been REMOVED to comply with security requirements.
 * All biometric operations must now occur on the secure backend.
 */

declare const faceapi: any;

export const insightFaceService = {
  isLoaded: false,
  isLoading: false,

  loadModels: async () => {
    if (insightFaceService.isLoaded || insightFaceService.isLoading) return;
    insightFaceService.isLoading = true;
    try {
      console.log("Loading face-api.js models for real biometric enrollment...");
      await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      insightFaceService.isLoaded = true;
      console.log("Models loaded successfully.");
    } catch (e) {
      console.error("Failed to load face-api models:", e);
    } finally {
      insightFaceService.isLoading = false;
    }
  },

  detectAll: async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null): Promise<any[]> => {
    if (!input || !insightFaceService.isLoaded) return [];
    try {
      return await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                          .withFaceLandmarks()
                          .withFaceDescriptors();
    } catch (e) {
      console.error("Face detection error:", e);
      return [];
    }
  },

  getDescriptor: async (input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> => {
    if (!insightFaceService.isLoaded) {
      await insightFaceService.loadModels();
    }
    
    try {
      const detection = await faceapi.detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
                                     .withFaceLandmarks()
                                     .withFaceDescriptor();
      if (detection) {
        return detection.descriptor;
      }
    } catch (e) {
      console.error("Error generating face descriptor:", e);
    }
    return null;
  },

  findBestMatch: (descriptor: Float32Array | number[], users: any[]): { user: any, distance: number } | null => {
    if (!users || users.length === 0) return null;
    
    let bestUser = null;
    let minDistance = 0.6; // Threshold for face matching

    for (const user of users) {
      if (user.faceDescriptor && user.faceDescriptor.length > 0) {
        const enrolledDesc = new Float32Array(user.faceDescriptor);
        const queryDesc = new Float32Array(descriptor);
        
        // Compute Euclidean distance using faceapi or manual implementation
        let distance = 0;
        if (typeof faceapi !== 'undefined' && faceapi.euclideanDistance) {
          distance = faceapi.euclideanDistance(queryDesc, enrolledDesc);
        } else {
          for (let i = 0; i < queryDesc.length; i++) {
            distance += Math.pow(queryDesc[i] - enrolledDesc[i], 2);
          }
          distance = Math.sqrt(distance);
        }

        if (distance < minDistance) {
          minDistance = distance;
          bestUser = user;
        }
      }
    }

    if (bestUser) {
      return { user: bestUser, distance: minDistance };
    }
    return null;
  }
};
