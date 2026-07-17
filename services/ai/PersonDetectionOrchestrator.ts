/**
 * Sentinel VMS — Person Detection Orchestrator
 *
 * Singleton that wires:
 *   PersonDetectorPlugin (ONNX YOLOv8n)
 *     → DetectionValidationEngine (7-gate validator in PersonTrackingEngine)
 *       → PersonTrackingEngine (ByteTrack + Kalman)
 *         → vmsEventService (8 event types)
 *         → Firestore (detection_history, tracks, ai_stats)
 *
 * This is the ONLY path through which person detections may enter
 * the InferencePipeline. No other module may call detect() or
 * access camera frames directly for person detection.
 *
 * Used by:
 *   InferencePipeline.ts — Stage 1 + Stage 2
 *   server.ts            — REST API routes /api/ai/persons/*
 */

import * as path from 'path';
import { ModelManager } from './ModelManager';
import { PersonDetectorPlugin } from './plugins/PersonDetectorPlugin';
import { personTrackingEngine, KalmanBoxTracker } from './PersonTrackingEngine';
import { VideoFrame, BoundingBox } from './interfaces';

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class PersonDetectionOrchestrator {
  private static instance: PersonDetectionOrchestrator;

  private plugin: PersonDetectorPlugin;
  private modelManager = ModelManager.getInstance();
  private isRegistered = false;

  // Rolling performance telemetry (last 60 cycles)
  private inferenceTimings: number[] = [];
  private processingTimings: number[] = [];
  private cycleCount = 0;
  private lastCycleTs = Date.now();

  private constructor() {
    this.plugin = new PersonDetectorPlugin();
  }

  public static getInstance(): PersonDetectionOrchestrator {
    if (!PersonDetectionOrchestrator.instance) {
      PersonDetectionOrchestrator.instance = new PersonDetectionOrchestrator();
    }
    return PersonDetectionOrchestrator.instance;
  }

  // ─── Startup ───────────────────────────────────────────────────────────────

  /**
   * Registers and loads the PersonDetectorPlugin into ModelManager.
   * Called once at server startup from InferencePipeline.registerCorePlugins().
   */
  public async initialize(useGpu = false): Promise<boolean> {
    if (this.isRegistered) return true;

    try {
      const registered = await this.modelManager.registerAndLoadPlugin(
        this.plugin,
        { threshold: 0.25, extraParams: { iouThreshold: 0.45 } },
        { type: useGpu ? 'CUDA' : 'CPU', index: 0 },
      );
      this.isRegistered = registered;
      if (registered) {
        console.log('[PersonOrchestrator] PersonDetectorPlugin registered and loaded.');
      } else {
        console.warn('[PersonOrchestrator] PersonDetectorPlugin failed to load. ' +
          'Person detection will return empty results until model is available.');
      }
      return registered;
    } catch (err: any) {
      console.error('[PersonOrchestrator] Init error:', err.message);
      return false;
    }
  }

  // ─── Core detection + tracking pipeline ────────────────────────────────────

  /**
   * Process one frame through the full person detection + tracking pipeline.
   * Called by InferencePipeline Stage 1 + Stage 2.
   *
   * Returns the current active tracks for this camera after the update.
   */
  public async processFrame(frame: VideoFrame): Promise<KalmanBoxTracker[]> {
    const start = Date.now();
    this.cycleCount++;
    this.lastCycleTs = start;

    // ── Stage 1: ONNX inference ─────────────────────────────────────────────
    let rawDetections: Array<{ id: string; confidence: number; box?: BoundingBox }> = [];

    const pluginInstance = this.modelManager.getPlugin('core.person_detector');
    if (pluginInstance && pluginInstance.state === 'LOADED') {
      try {
        const payload = await pluginInstance.infer(frame);
        rawDetections = (payload.detections ?? []).map(d => ({
          id: d.id,
          confidence: d.confidence,
          box: d.box,
        }));

        const inferMs = Date.now() - start;
        this.inferenceTimings.push(inferMs);
        if (this.inferenceTimings.length > 60) this.inferenceTimings.shift();
      } catch (err: any) {
        console.error('[PersonOrchestrator] Inference error:', err.message);
        // Return current active tracks unmodified — do not fall back to motion detection
        return personTrackingEngine.getCurrentTracks(frame.cameraId).map(t => ({
          trackId: t.trackId,
          getBbox: () => t.boundingBox,
          getMotionVector: () => t.motionVector,
          isConfirmed: t.isConfirmed,
          missedFrames: t.missedFrames,
          lastConfidence: t.confidence,
          totalFrames: t.totalFrames,
        } as unknown as KalmanBoxTracker));
      }
    }
    // If plugin not loaded: rawDetections stays empty — no motion detection fallback.

    // ── Stage 2: Validation + ByteTrack ────────────────────────────────────
    const tracks = await personTrackingEngine.processFrame(
      frame.cameraId,
      rawDetections,
      frame.id,
      frame.timestamp,
      this.plugin.config.threshold ?? 0.25,
    );

    const totalMs = Date.now() - start;
    this.processingTimings.push(totalMs);
    if (this.processingTimings.length > 60) this.processingTimings.shift();

    return tracks;
  }

  // ─── API surface ────────────────────────────────────────────────────────────

  public getCurrentPersons(cameraId?: string) {
    return personTrackingEngine.getCurrentTracks(cameraId);
  }

  public getStats(cameraId?: string) {
    return personTrackingEngine.getStats(cameraId);
  }

  public getHealth(): {
    pluginState: string;
    modelLoaded: boolean;
    modelExists: boolean;
    avgInferenceMs: number;
    avgTotalMs: number;
    cyclesProcessed: number;
    activeCameras: number;
    totalActivePersons: number;
  } {
    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    return {
      pluginState: this.plugin.state,
      modelLoaded: this.plugin.isModelLoaded(),
      modelExists: this.plugin.getModelExists(),
      avgInferenceMs: this.plugin.getAvgLatencyMs(),
      avgTotalMs: avg(this.processingTimings),
      cyclesProcessed: this.cycleCount,
      activeCameras: personTrackingEngine.getActiveCameraCount(),
      totalActivePersons: personTrackingEngine.getTotalActivePersons(),
    };
  }

  public getPerformanceMetrics() {
    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
    const p95 = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95)];
    };

    return {
      model: {
        id: 'yolov8n',
        inferenceCount: this.plugin.getInferenceCount(),
        avgInferenceMs: Math.round(avg(this.inferenceTimings)),
        p95InferenceMs: p95(this.inferenceTimings),
      },
      pipeline: {
        totalCycles: this.cycleCount,
        avgTotalMs: Math.round(avg(this.processingTimings)),
        p95TotalMs: p95(this.processingTimings),
        lastCycleMs: this.processingTimings[this.processingTimings.length - 1] ?? 0,
      },
      tracking: {
        activeCameras: personTrackingEngine.getActiveCameraCount(),
        confirmedPersons: personTrackingEngine.getTotalActivePersons(),
        statsPerCamera: personTrackingEngine.getStats(),
      },
    };
  }

  public isReady(): boolean {
    return this.isRegistered && this.plugin.isModelLoaded();
  }
}

export const personDetectionOrchestrator = PersonDetectionOrchestrator.getInstance();
