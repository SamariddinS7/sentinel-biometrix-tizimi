/**
 * Sentinel VMS — Person Detector Plugin (YOLOv8n · ONNX Runtime)
 *
 * The ONLY authorised source of person detection in the system.
 * Every detection originates from real ONNX inference — never from
 * motion detection, pixel heuristics, or any simulated source.
 *
 * Model  : YOLOv8n (Ultralytics) — COCO class 0 = person
 * Runtime: onnxruntime-node (Microsoft, MIT licence)
 * Input  : [1, 3, 640, 640] NCHW float32, normalised 0–1, letterboxed
 * Output : [1, 84, 8400] — rows 0-3: cx/cy/w/h; row 4: person score
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import jpeg from 'jpeg-js';
import { BaseAiPlugin } from './BaseAiPlugin';
import {
  AiPluginMetadata,
  RuntimeDevice,
  VideoFrame,
  DynamicDetectionPayload,
  BaseDetection,
  BoundingBox,
} from '../interfaces';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawCandidate {
  score: number;
  x1: number; y1: number;
  x2: number; y2: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_DIR = path.join(process.cwd(), 'models', 'weights');
const MODEL_FILE = path.join(MODEL_DIR, 'yolov8n.onnx');
const MODEL_URL =
  'https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx';

const YOLO_INPUT_SIZE = 640;
const YOLO_ANCHORS = 8400;
const YOLO_NUM_CLASSES = 80;
const YOLO_PERSON_CLASS = 0; // COCO class 0 = person
const PAD_VALUE = 114 / 255; // letterbox grey (0.4471…)

// ─── Plugin ──────────────────────────────────────────────────────────────────

export class PersonDetectorPlugin extends BaseAiPlugin {
  public metadata: AiPluginMetadata = {
    id: 'core.person_detector',
    name: 'Person Detector Plugin (YOLOv8n)',
    version: '1.0.0',
    vendor: 'Sentinel Biometrik · Ultralytics',
    supportedDevices: ['CPU', 'CUDA', 'ONNX_RUNTIME'],
    description:
      'Real ONNX inference — detects persons in all poses, views, ' +
      'lighting conditions and partial occlusion. ' +
      'No motion detection. No fake data. No simulation.',
  };

  // Lazily imported to avoid top-level require issues before install
  private ort: typeof import('onnxruntime-node') | null = null;
  private session: import('onnxruntime-node').InferenceSession | null = null;

  // Rolling inference latency (last 30 frames)
  private latencyBuffer: number[] = [];
  private inferenceCount = 0;

  // ─── BaseAiPlugin hooks ────────────────────────────────────────────────────

  protected async onLoadModel(device: RuntimeDevice): Promise<boolean> {
    try {
      this.ort = await import('onnxruntime-node');
    } catch {
      console.error('[PersonDetector] onnxruntime-node is not installed. ' +
        'Run: npm install onnxruntime-node');
      return false;
    }

    // Ensure model file is present (download if absent)
    if (!fs.existsSync(MODEL_FILE)) {
      console.log('[PersonDetector] YOLOv8n model not found — downloading from Ultralytics…');
      try {
        await this.downloadModel(MODEL_URL, MODEL_FILE);
        console.log('[PersonDetector] Model downloaded successfully.');
      } catch (err: any) {
        console.error('[PersonDetector] Model download failed:', err.message);
        console.error('[PersonDetector] Place yolov8n.onnx at', MODEL_FILE, 'and restart.');
        return false;
      }
    }

    // onnxruntime-node v1.27+ uses 'cpu' / 'cuda' (lowercase) provider names.
    // Passing no executionProviders lets the runtime auto-select the best available backend.
    const providers: string[] =
      device.type === 'CUDA' ? ['cuda', 'cpu'] : ['cpu'];

    this.session = await this.ort.InferenceSession.create(MODEL_FILE, {
      executionProviders: providers,
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
    });

    // Warm-up inference: feed a blank 640×640 frame so ONNX compiles kernels
    await this.runWarmup();
    console.log(`[PersonDetector] YOLOv8n loaded on ${device.type}:${device.index}. ` +
      `Input: ${this.session.inputNames.join(', ')} | ` +
      `Output: ${this.session.outputNames.join(', ')}`);
    return true;
  }

  protected async onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    if (!this.session || !this.ort) {
      return this.emptyPayload(frame);
    }

    const start = Date.now();

    // 1. Decode JPEG if needed → RGBA Uint8Array
    let rgba: Uint8Array;
    let srcW = frame.width;
    let srcH = frame.height;

    if (this.isJpeg(frame.buffer)) {
      try {
        const decoded = jpeg.decode(frame.buffer, { useTArray: true });
        rgba = decoded.data;
        srcW = decoded.width;
        srcH = decoded.height;
      } catch {
        return this.emptyPayload(frame);
      }
    } else {
      // Assume RGB — convert to RGBA by inserting alpha channel
      rgba = this.rgbToRgba(frame.buffer, srcW, srcH);
    }

    // 2. Letterbox resize → CHW float32 tensor
    const { tensor, padX, padY, scale } = this.letterboxAndNormalise(rgba, srcW, srcH);

    // 3. ONNX inference
    const inputName = this.session.inputNames[0];   // 'images'
    const outputName = this.session.outputNames[0]; // 'output0'
    const inputTensor = new this.ort.Tensor('float32', tensor, [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE]);
    const results = await this.session.run({ [inputName]: inputTensor });
    const output = results[outputName];

    // 4. Postprocess → person detections
    const threshold = this.config.threshold ?? 0.25;
    const iouThreshold = (this.config.extraParams?.iouThreshold as number) ?? 0.45;
    const detections = this.postprocess(
      output.data as Float32Array,
      threshold,
      iouThreshold,
      padX,
      padY,
      scale,
    );

    // Track latency
    const ms = Date.now() - start;
    this.latencyBuffer.push(ms);
    if (this.latencyBuffer.length > 30) this.latencyBuffer.shift();
    this.inferenceCount++;

    return {
      cameraId: frame.cameraId,
      timestamp: frame.timestamp,
      frameId: frame.id,
      detections,
      metadata: {
        inferenceMs: ms,
        avgInferenceMs: this.avgLatency(),
        modelId: 'yolov8n',
        anchorsEvaluated: YOLO_ANCHORS,
        personCandidates: detections.length,
      },
    };
  }

  protected async onUnloadModel(): Promise<void> {
    if (this.session) {
      await this.session.release?.();
      this.session = null;
    }
  }

  protected async onPerformDiagnostic(): Promise<boolean> {
    if (!this.session || !this.ort) return false;
    // Run a blank inference and verify it completes
    await this.runWarmup();
    return true;
  }

  // ─── Preprocessing ────────────────────────────────────────────────────────

  /**
   * Letterbox an RGBA frame into a 640×640 float32 CHW tensor.
   * Returns the padding offsets and scale factor so detections can be
   * mapped back to original frame coordinates.
   */
  private letterboxAndNormalise(
    rgba: Uint8Array,
    srcW: number,
    srcH: number,
  ): { tensor: Float32Array; padX: number; padY: number; scale: number } {
    const S = YOLO_INPUT_SIZE;
    const scale = Math.min(S / srcW, S / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = Math.floor((S - newW) / 2);
    const padY = Math.floor((S - newH) / 2);

    // CHW float32, initialised with letterbox grey
    const tensor = new Float32Array(3 * S * S).fill(PAD_VALUE);
    const planeR = 0 * S * S;
    const planeG = 1 * S * S;
    const planeB = 2 * S * S;

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        // Bilinear source coordinate
        const sx = (x / newW) * srcW;
        const sy = (y / newH) * srcH;

        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, srcW - 1);
        const y1 = Math.min(y0 + 1, srcH - 1);
        const wx = sx - x0;
        const wy = sy - y0;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = (y0 * srcW + x1) * 4;
        const i01 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;
        const w00 = (1 - wx) * (1 - wy);
        const w10 = wx * (1 - wy);
        const w01 = (1 - wx) * wy;
        const w11 = wx * wy;

        const dstIdx = (y + padY) * S + (x + padX);
        tensor[planeR + dstIdx] = (rgba[i00] * w00 + rgba[i10] * w10 + rgba[i01] * w01 + rgba[i11] * w11) / 255;
        tensor[planeG + dstIdx] = (rgba[i00 + 1] * w00 + rgba[i10 + 1] * w10 + rgba[i01 + 1] * w01 + rgba[i11 + 1] * w11) / 255;
        tensor[planeB + dstIdx] = (rgba[i00 + 2] * w00 + rgba[i10 + 2] * w10 + rgba[i01 + 2] * w01 + rgba[i11 + 2] * w11) / 255;
      }
    }

    return { tensor, padX, padY, scale };
  }

  // ─── Postprocessing ───────────────────────────────────────────────────────

  /**
   * Parse YOLOv8n output tensor [1, 84, 8400].
   * Rows 0-3: cx, cy, w, h in 640-px space.
   * Row 4   : person (class 0) probability.
   * Returns normalised [0,1] BoundingBoxes relative to the original frame.
   */
  private postprocess(
    data: Float32Array,
    confThreshold: number,
    iouThreshold: number,
    padX: number,
    padY: number,
    scale: number,
  ): BaseDetection[] {
    const A = YOLO_ANCHORS;
    const S = YOLO_INPUT_SIZE;
    const candidates: RawCandidate[] = [];

    for (let i = 0; i < A; i++) {
      // YOLOv8 output layout: rows 0-3 = bbox (cx,cy,w,h); row 4+class_idx = class score
      // COCO class 0 = person → row index 4
      const personScore = data[(4 + YOLO_PERSON_CLASS) * A + i];
      if (personScore < confThreshold) continue;

      const cx = data[0 * A + i];
      const cy = data[1 * A + i];
      const w  = data[2 * A + i];
      const h  = data[3 * A + i];

      // Convert from 640-px letterboxed space → [0,1] relative to original frame.
      // Letterbox: original pixel p → 640-space pixel = p * scale + pad
      // Inverse: 640-space pixel px → original norm = (px - pad) / scale / origSize
      // Since origSize = (S - 2*pad) / scale and normalised = px_orig / origSize,
      // the formula below is equivalent to: (px_640 - pad) / (S - 2*pad)
      const effW = S - 2 * padX;  // effective image width in 640-px space
      const effH = S - 2 * padY;  // effective image height in 640-px space
      const x1 = Math.max(0, Math.min(1, (cx - w / 2 - padX) / effW));
      const y1 = Math.max(0, Math.min(1, (cy - h / 2 - padY) / effH));
      const x2 = Math.max(0, Math.min(1, (cx + w / 2 - padX) / effW));
      const y2 = Math.max(0, Math.min(1, (cy + h / 2 - padY) / effH));

      if (x2 <= x1 || y2 <= y1) continue;

      candidates.push({ score: personScore, x1, y1, x2, y2 });
    }

    const kept = this.nms(candidates, iouThreshold);

    return kept.map((c, idx) => ({
      id: `pd_${Date.now()}_${idx}`,
      classLabel: 'person',
      confidence: Math.round(c.score * 1000) / 1000,
      box: { xMin: c.x1, yMin: c.y1, xMax: c.x2, yMax: c.y2 } as BoundingBox,
    }));
  }

  // ─── NMS ─────────────────────────────────────────────────────────────────

  private nms(candidates: RawCandidate[], iouThreshold: number): RawCandidate[] {
    candidates.sort((a, b) => b.score - a.score);
    const suppressed = new Uint8Array(candidates.length);
    const kept: RawCandidate[] = [];

    for (let i = 0; i < candidates.length; i++) {
      if (suppressed[i]) continue;
      kept.push(candidates[i]);
      for (let j = i + 1; j < candidates.length; j++) {
        if (!suppressed[j] && this.iou(candidates[i], candidates[j]) > iouThreshold) {
          suppressed[j] = 1;
        }
      }
    }
    return kept;
  }

  private iou(a: RawCandidate, b: RawCandidate): number {
    const ix1 = Math.max(a.x1, b.x1);
    const iy1 = Math.max(a.y1, b.y1);
    const ix2 = Math.min(a.x2, b.x2);
    const iy2 = Math.min(a.y2, b.y2);
    if (ix1 >= ix2 || iy1 >= iy2) return 0;
    const inter = (ix2 - ix1) * (iy2 - iy1);
    const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
    const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
    return inter / (aArea + bArea - inter);
  }

  // ─── Model download ───────────────────────────────────────────────────────

  private downloadModel(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const file = fs.createWriteStream(destPath);

      const followRedirect = (redirectUrl: string) => {
        https.get(redirectUrl, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            followRedirect(res.headers.location!);
            return;
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlinkSync(destPath);
            reject(new Error(`HTTP ${res.statusCode} downloading model`));
            return;
          }
          const total = parseInt(res.headers['content-length'] ?? '0', 10);
          let received = 0;
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (total > 0 && received % (1024 * 1024) < chunk.length) {
              const pct = Math.round((received / total) * 100);
              process.stdout.write(`\r[PersonDetector] Downloading model: ${pct}%`);
            }
          });
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            process.stdout.write('\n');
            resolve();
          });
        }).on('error', (err) => {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          reject(err);
        });
      };

      followRedirect(url);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async runWarmup(): Promise<void> {
    if (!this.session || !this.ort) return;
    const blank = new Float32Array(3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE).fill(0);
    const inputName = this.session.inputNames[0];
    const tensor = new this.ort.Tensor('float32', blank, [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE]);
    await this.session.run({ [inputName]: tensor });
  }

  private isJpeg(buf: Buffer | Uint8Array): boolean {
    return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }

  private rgbToRgba(rgb: Uint8Array, w: number, h: number): Uint8Array {
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0, j = 0; i < w * h; i++, j += 3) {
      rgba[i * 4]     = rgb[j];
      rgba[i * 4 + 1] = rgb[j + 1];
      rgba[i * 4 + 2] = rgb[j + 2];
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }

  private emptyPayload(frame: VideoFrame): DynamicDetectionPayload {
    return { cameraId: frame.cameraId, timestamp: frame.timestamp, frameId: frame.id, detections: [] };
  }

  private avgLatency(): number {
    if (this.latencyBuffer.length === 0) return 0;
    return Math.round(this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length);
  }

  /** Public accessors for orchestrator / API */
  public getInferenceCount(): number { return this.inferenceCount; }
  public getAvgLatencyMs(): number { return this.avgLatency(); }
  public isModelLoaded(): boolean { return this.session !== null; }
  public getModelPath(): string { return MODEL_FILE; }
  public getModelExists(): boolean { return fs.existsSync(MODEL_FILE); }
}
