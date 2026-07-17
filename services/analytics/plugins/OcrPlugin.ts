/**
 * OcrPlugin — General Scene OCR
 *
 * Applies Tesseract.js on configured Regions Of Interest (ROIs) in the frame.
 * ROIs are defined per-camera in the plugin config (normalized coordinates).
 *
 * No fake text. No random characters. Only emits when Tesseract returns
 * a result with confidence >= threshold.
 */

import type { VideoFrame } from '../../ai/interfaces';
import type { IAnalyticsPlugin, AnalyticsPluginMetadata, AnalyticsPluginConfig, AnalyticsPluginHealth, AnalyticsContext } from '../types/AnalyticsPlugin';
import type { AnalyticsEvent, OcrCompletedData } from '../types/AnalyticsEvent';
import { AnalyticsEventType } from '../types/AnalyticsEvent';

export interface OcrRegion {
  id: string;
  label: string;
  /** Normalized coordinates [0, 1] */
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  /** Minimum OCR confidence to emit [0, 1] */
  minConfidence?: number;
}

export class OcrPlugin implements IAnalyticsPlugin {
  readonly metadata: AnalyticsPluginMetadata = {
    id: 'analytics.ocr',
    name: 'Scene OCR Engine (Tesseract.js)',
    version: '1.0.0',
    description: 'Extracts text from configured ROIs in each video frame using Tesseract.js LSTM engine. No fake OCR.',
    eventTypes: [AnalyticsEventType.OCR_COMPLETED],
  };

  private config: AnalyticsPluginConfig = { enabled: true, confidenceThreshold: 0.65 };

  /** Configured OCR regions per camera */
  private regions: Map<string, OcrRegion[]> = new Map();

  private tesseractAvailable = false;
  private tesseractWorker: any = null;

  /** Rate-limit OCR: process at most every N ms per region */
  private ocrIntervalMs = 3_000;
  private lastOcrTs: Map<string, number> = new Map(); // `${cameraId}_${regionId}` → ts

  private frameCount = 0;
  private eventCount = 0;

  async initialize(config: AnalyticsPluginConfig): Promise<void> {
    this.config = config;
    this.ocrIntervalMs = (config.params?.ocrIntervalMs as number) ?? 3_000;

    // Load per-camera regions from config
    const configRegions = config.params?.regions as Record<string, OcrRegion[]> | undefined;
    if (configRegions) {
      for (const [camId, rois] of Object.entries(configRegions)) {
        this.regions.set(camId, rois);
      }
    }

    try {
      const { createWorker } = await import('tesseract.js');
      this.tesseractWorker = await createWorker('eng', 1, { logger: () => {} });
      this.tesseractAvailable = true;
      console.log('[OcrPlugin] Tesseract.js OCR worker ready.');
    } catch (err) {
      console.warn('[OcrPlugin] Tesseract.js unavailable. OCR disabled.', err);
    }
  }

  /** Add OCR regions for a specific camera at runtime */
  public setRegions(cameraId: string, regions: OcrRegion[]): void {
    this.regions.set(cameraId, regions);
  }

  async processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsEvent[]> {
    this.frameCount++;
    if (!this.tesseractAvailable || !this.tesseractWorker) return [];

    const events: AnalyticsEvent[] = [];
    const rois = this.regions.get(context.camera.id) ?? [];
    if (!rois.length || !frame.buffer.length || !frame.width || !frame.height) return [];

    const now = Date.now();

    await Promise.allSettled(rois.map(async roi => {
      const key = `${context.camera.id}_${roi.id}`;
      const last = this.lastOcrTs.get(key) ?? 0;
      if (now - last < this.ocrIntervalMs) return;
      this.lastOcrTs.set(key, now);

      // Crop ROI from RGB buffer
      const imgW = frame.width;
      const imgH = frame.height;
      const px1 = Math.floor(roi.xMin * imgW);
      const py1 = Math.floor(roi.yMin * imgH);
      const px2 = Math.floor(roi.xMax * imgW);
      const py2 = Math.floor(roi.yMax * imgH);
      const cropW = Math.max(1, px2 - px1);
      const cropH = Math.max(1, py2 - py1);

      if (cropW < 20 || cropH < 10) return;

      const cropBuf = Buffer.alloc(cropW * cropH * 3);
      for (let row = 0; row < cropH; row++) {
        for (let col = 0; col < cropW; col++) {
          const srcIdx = ((py1 + row) * imgW + (px1 + col)) * 3;
          const dstIdx = (row * cropW + col) * 3;
          if (srcIdx + 2 < frame.buffer.length) {
            cropBuf[dstIdx]     = frame.buffer[srcIdx];
            cropBuf[dstIdx + 1] = frame.buffer[srcIdx + 1];
            cropBuf[dstIdx + 2] = frame.buffer[srcIdx + 2];
          }
        }
      }

      try {
        const { data } = await this.tesseractWorker.recognize(cropBuf);
        const text = (data.text || '').trim();
        const conf = data.confidence / 100;
        const minConf = roi.minConfidence ?? this.config.confidenceThreshold;

        if (text.length >= 2 && conf >= minConf) {
          events.push({
            id: `AE-${Date.now()}-ocr-${key}`,
            type: AnalyticsEventType.OCR_COMPLETED,
            timestamp: new Date(frame.timestamp).toISOString(),
            cameraId: context.camera.id,
            cameraName: context.camera.name,
            location: context.camera.location,
            confidence: conf,
            modelVersion: `${this.metadata.id}@${this.metadata.version}`,
            boundingBoxes: [{ xMin: roi.xMin, yMin: roi.yMin, xMax: roi.xMax, yMax: roi.yMax }],
            data: {
              text,
              language: 'eng',
              regionId: roi.id,
            } as OcrCompletedData,
          });
          this.eventCount++;
        }
      } catch {
        // Non-fatal
      }
    }));

    return events;
  }

  async healthCheck(): Promise<AnalyticsPluginHealth> {
    return {
      status: this.tesseractAvailable ? 'HEALTHY' : 'DEGRADED',
      latencyMs: 0,
      frameCount: this.frameCount,
      eventCount: this.eventCount,
      lastError: this.tesseractAvailable ? undefined : 'Tesseract.js worker not initialised',
    };
  }

  async dispose(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate().catch(() => {});
      this.tesseractWorker = null;
    }
  }
}
