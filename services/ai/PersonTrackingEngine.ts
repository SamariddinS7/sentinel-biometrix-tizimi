/**
 * Sentinel VMS — Person Tracking Engine
 *
 * Implements ByteTrack with per-component Kalman prediction.
 * Manages one KalmanByteTracker instance per camera.
 *
 * Guaranteed invariants:
 *  • Every Track ID maps to exactly one validated person detection.
 *  • Tracking begins ONLY after detection validation passes.
 *  • No fake IDs. No random IDs. No simulated tracks.
 *  • detectMotionBlobs() is NOT called here or anywhere in this module.
 *
 * Events emitted to vmsEventService:
 *   PersonDetected, PersonUpdated, PersonLost,
 *   TrackStarted, TrackUpdated, TrackEnded,
 *   DetectionRejected, DetectionRecovered
 */

import crypto from 'crypto';
import { db } from '../firestoreService';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { vmsEventService } from '../vmsEventService';
import { VmsAiEventType } from './DetectionTrackingEngine';
import { BoundingBox } from './interfaces';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIRM_FRAMES = 3;   // frames before tentative → confirmed
const MAX_LOST_FRAMES = 30; // frames before confirmed track is ended
const IOU_HIGH_CONF = 0.5;  // Stage 1 IoU gate (high-confidence matches)
const IOU_LOW_CONF = 0.35;  // Stage 2 IoU gate (BYTE — low-confidence recovery)
const HIGH_CONF_THRESHOLD = 0.5;
const LOW_CONF_THRESHOLD = 0.1;

// ─── Detection validation ─────────────────────────────────────────────────────

export interface ValidatedDetection {
  id: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface ValidationRejection {
  reason: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface ValidationResult {
  accepted: ValidatedDetection[];
  rejected: ValidationRejection[];
}

/**
 * Seven-gate detection validator.
 * Rejects shadows, reflections, noise, and non-human aspect ratios.
 */
export function validateDetections(
  raw: Array<{ id: string; confidence: number; box?: BoundingBox }>,
  minConfidence: number = 0.25,
): ValidationResult {
  const accepted: ValidatedDetection[] = [];
  const rejected: ValidationRejection[] = [];

  for (const det of raw) {
    const box = det.box;
    if (!box) {
      rejected.push({ reason: 'missing bounding box', confidence: det.confidence, boundingBox: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 } });
      continue;
    }

    // Gate 1: confidence
    if (det.confidence < minConfidence) {
      rejected.push({ reason: `confidence ${det.confidence.toFixed(3)} < ${minConfidence}`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    // Gate 2: bounding box coordinate validity
    if (box.xMin < 0 || box.yMin < 0 || box.xMax > 1 || box.yMax > 1) {
      rejected.push({ reason: 'coordinates out of [0,1] range', confidence: det.confidence, boundingBox: box });
      continue;
    }
    if (box.xMin >= box.xMax || box.yMin >= box.yMax) {
      rejected.push({ reason: 'degenerate bounding box', confidence: det.confidence, boundingBox: box });
      continue;
    }

    const w = box.xMax - box.xMin;
    const h = box.yMax - box.yMin;
    const area = w * h;
    const aspect = h / w; // height/width

    // Gate 3: aspect ratio — humans are taller than wide, but can crouch/sit
    if (aspect < 0.3 || aspect > 6.0) {
      rejected.push({ reason: `aspect ratio ${aspect.toFixed(2)} outside [0.3, 6.0]`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    // Gate 4: minimum size — too small = noise or distant background
    if (area < 0.003) {
      rejected.push({ reason: `area ${area.toFixed(5)} < 0.003 (too small)`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    // Gate 5: maximum size — full-frame bbox is almost certainly background
    if (area > 0.92) {
      rejected.push({ reason: `area ${area.toFixed(3)} > 0.92 (too large)`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    // Gate 6: minimum height — very flat detections are artefacts
    if (h < 0.02) {
      rejected.push({ reason: `height ${h.toFixed(4)} < 0.02 (not visible)`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    // Gate 7: minimum width
    if (w < 0.01) {
      rejected.push({ reason: `width ${w.toFixed(4)} < 0.01 (sliver)`, confidence: det.confidence, boundingBox: box });
      continue;
    }

    accepted.push({ id: det.id, confidence: det.confidence, boundingBox: box });
  }

  return { accepted, rejected };
}

// ─── Scalar Kalman filter (2-state: position + velocity) ─────────────────────

class ScalarKalman {
  private pos: number;
  private vel: number = 0;
  private Ppp: number = 10; // position variance
  private Ppv: number = 0;  // pos-vel covariance
  private Pvv: number = 10; // velocity variance

  constructor(initPos: number, private r: number = 1.0, private q: number = 0.008) {
    this.pos = initPos;
  }

  predict(dt = 1): number {
    this.pos += this.vel * dt;
    const Ppp = this.Ppp + 2 * dt * this.Ppv + dt * dt * this.Pvv + this.q;
    const Ppv = this.Ppv + dt * this.Pvv;
    const Pvv = this.Pvv + this.q * 0.25;
    this.Ppp = Ppp;
    this.Ppv = Ppv;
    this.Pvv = Pvv;
    return this.pos;
  }

  update(measurement: number): void {
    const residual = measurement - this.pos;
    const S = this.Ppp + this.r;
    const Kp = this.Ppp / S;
    const Kv = this.Ppv / S;
    this.pos += Kp * residual;
    this.vel += Kv * residual;
    this.Ppp = Math.max(0, (1 - Kp) * this.Ppp);
    this.Ppv = (1 - Kp) * this.Ppv;
    this.Pvv = Math.max(0, this.Pvv - Kv * this.Ppv);
  }

  get value(): number { return this.pos; }
  get velocity(): number { return this.vel; }
}

// ─── Kalman bounding-box tracker (per track) ─────────────────────────────────

export class KalmanBoxTracker {
  public readonly trackId: string;
  public missedFrames = 0;
  public totalFrames = 1;
  public isConfirmed = false;
  public lastConfidence = 0;
  public wasLost = false; // true if missed ≥ 1 frame and then re-matched

  private kx: ScalarKalman;
  private ky: ScalarKalman;
  private kw: ScalarKalman;
  private kh: ScalarKalman;

  constructor(trackId: string, bbox: BoundingBox, confidence: number) {
    this.trackId = trackId;
    this.lastConfidence = confidence;
    this.kx = new ScalarKalman(bbox.xMin);
    this.ky = new ScalarKalman(bbox.yMin);
    this.kw = new ScalarKalman(bbox.xMax - bbox.xMin);
    this.kh = new ScalarKalman(bbox.yMax - bbox.yMin);
  }

  /** Advance state by one frame; returns predicted bbox. */
  predict(): BoundingBox {
    const x = this.kx.predict();
    const y = this.ky.predict();
    const w = Math.max(0.01, this.kw.predict());
    const h = Math.max(0.01, this.kh.predict());
    this.missedFrames++;
    return {
      xMin: Math.max(0, x),
      yMin: Math.max(0, y),
      xMax: Math.min(1, x + w),
      yMax: Math.min(1, y + h),
    };
  }

  /** Correct state with a matched detection. */
  update(bbox: BoundingBox, confidence: number): void {
    const w = bbox.xMax - bbox.xMin;
    const h = bbox.yMax - bbox.yMin;
    this.kx.update(bbox.xMin);
    this.ky.update(bbox.yMin);
    this.kw.update(w);
    this.kh.update(h);
    if (this.missedFrames > 0) this.wasLost = true;
    this.missedFrames = 0;
    this.totalFrames++;
    this.lastConfidence = confidence;
    if (this.totalFrames >= CONFIRM_FRAMES) this.isConfirmed = true;
  }

  /** Current smoothed bbox (post-update). */
  getBbox(): BoundingBox {
    const w = Math.max(0.01, this.kw.value);
    const h = Math.max(0.01, this.kh.value);
    return {
      xMin: Math.max(0, this.kx.value),
      yMin: Math.max(0, this.ky.value),
      xMax: Math.min(1, this.kx.value + w),
      yMax: Math.min(1, this.ky.value + h),
    };
  }

  getMotionVector(): { dx: number; dy: number } {
    return { dx: this.kx.velocity, dy: this.ky.velocity };
  }
}

// ─── IoU helpers ─────────────────────────────────────────────────────────────

function iou(a: BoundingBox, b: BoundingBox): number {
  const ix1 = Math.max(a.xMin, b.xMin);
  const iy1 = Math.max(a.yMin, b.yMin);
  const ix2 = Math.min(a.xMax, b.xMax);
  const iy2 = Math.min(a.yMax, b.yMax);
  if (ix1 >= ix2 || iy1 >= iy2) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const aArea = (a.xMax - a.xMin) * (a.yMax - a.yMin);
  const bArea = (b.xMax - b.xMin) * (b.yMax - b.yMin);
  const union = aArea + bArea - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Greedy IoU matching. Returns [trackIdx, detIdx] pairs and unmatched lists.
 * O(T×D) — sufficient for T, D < 200 per camera.
 */
function greedyMatch(
  predictedBoxes: BoundingBox[],
  detBoxes: BoundingBox[],
  iouThreshold: number,
): { matches: [number, number][]; unmatchedTracks: number[]; unmatchedDets: number[] } {
  const matches: [number, number][] = [];
  const matchedTracks = new Set<number>();
  const matchedDets = new Set<number>();

  // Build IoU matrix
  const matrix: number[][] = predictedBoxes.map(p => detBoxes.map(d => iou(p, d)));

  // Greedy: pick highest IoU pairs
  const allScores: { t: number; d: number; v: number }[] = [];
  for (let t = 0; t < matrix.length; t++) {
    for (let d = 0; d < matrix[t].length; d++) {
      if (matrix[t][d] > iouThreshold) allScores.push({ t, d, v: matrix[t][d] });
    }
  }
  allScores.sort((a, b) => b.v - a.v);

  for (const { t, d } of allScores) {
    if (!matchedTracks.has(t) && !matchedDets.has(d)) {
      matches.push([t, d]);
      matchedTracks.add(t);
      matchedDets.add(d);
    }
  }

  const unmatchedTracks = predictedBoxes.map((_, i) => i).filter(i => !matchedTracks.has(i));
  const unmatchedDets = detBoxes.map((_, i) => i).filter(i => !matchedDets.has(i));
  return { matches, unmatchedTracks, unmatchedDets };
}

// ─── Per-camera ByteTrack + Kalman tracker ───────────────────────────────────

export class KalmanByteTracker {
  private tracks: Map<string, KalmanBoxTracker> = new Map();
  private nextNum = 1;

  constructor(public readonly cameraId: string) {}

  /**
   * Run one ByteTrack update cycle.
   * Returns all currently active tracks after the update.
   */
  update(
    detections: ValidatedDetection[],
    timestampMs: number,
  ): {
    updated: KalmanBoxTracker[];
    started: KalmanBoxTracker[];
    ended: KalmanBoxTracker[];
    recovered: KalmanBoxTracker[];
  } {
    const started: KalmanBoxTracker[] = [];
    const ended: KalmanBoxTracker[] = [];
    const recovered: KalmanBoxTracker[] = [];

    const allTracks = Array.from(this.tracks.values());

    // 1. Predict all tracks (Kalman step)
    const predictedBoxes = allTracks.map(t => t.predict());
    // Note: predict() increments missedFrames; we'll reset it for matched ones

    // 2. Split detections by confidence
    const highConf = detections.filter(d => d.confidence >= HIGH_CONF_THRESHOLD);
    const lowConf = detections.filter(d => d.confidence >= LOW_CONF_THRESHOLD && d.confidence < HIGH_CONF_THRESHOLD);

    // ── Stage 1: high-confidence → all tracks ──────────────────────────────
    const { matches: m1, unmatchedTracks: ut1, unmatchedDets: ud1 } = greedyMatch(
      predictedBoxes,
      highConf.map(d => d.boundingBox),
      IOU_HIGH_CONF,
    );

    for (const [ti, di] of m1) {
      const tracker = allTracks[ti];
      const det = highConf[di];
      const wasLostBefore = tracker.missedFrames > 0; // was already missed once before stage 1 ran
      tracker.update(det.boundingBox, det.confidence);
      if (wasLostBefore && tracker.isConfirmed) recovered.push(tracker);
    }

    // ── Stage 2: low-confidence → unmatched tracks (BYTE occlusion recovery)
    const unmatchedTrackers2 = ut1.map(i => allTracks[i]);
    const { matches: m2, unmatchedTracks: ut2 } = greedyMatch(
      unmatchedTrackers2.map(t => t.getBbox()),
      lowConf.map(d => d.boundingBox),
      IOU_LOW_CONF,
    );

    for (const [ti, di] of m2) {
      const tracker = unmatchedTrackers2[ti];
      const det = lowConf[di];
      tracker.update(det.boundingBox, det.confidence);
    }

    // ── New tracks from unmatched high-confidence detections ───────────────
    const confirmedUnmatched = ud1.filter(di => {
      // Only start a new track for high-confidence unmatched dets
      return highConf[di].confidence >= HIGH_CONF_THRESHOLD;
    });

    for (const di of confirmedUnmatched) {
      const det = highConf[di];
      const trackId = `${this.cameraId}_trk_${this.nextNum++}`;
      const tracker = new KalmanBoxTracker(trackId, det.boundingBox, det.confidence);
      this.tracks.set(trackId, tracker);
      started.push(tracker);
    }

    // ── Expire lost tracks ─────────────────────────────────────────────────
    for (const tracker of allTracks) {
      if (tracker.missedFrames > MAX_LOST_FRAMES) {
        this.tracks.delete(tracker.trackId);
        ended.push(tracker);
      }
    }

    const updated = Array.from(this.tracks.values()).filter(
      t => !started.includes(t) && !ended.includes(t),
    );

    return { updated, started, ended, recovered };
  }

  getActiveTracks(): KalmanBoxTracker[] {
    return Array.from(this.tracks.values());
  }

  getActiveCount(): number { return this.tracks.size; }

  reset(): void {
    this.tracks.clear();
    this.nextNum = 1;
  }
}

// ─── Firestore schema ─────────────────────────────────────────────────────────

async function writeDetectionRecord(
  cameraId: string,
  frameId: string,
  trackId: string,
  confidence: number,
  bbox: BoundingBox,
  timestampMs: number,
): Promise<void> {
  try {
    const ref = doc(collection(db, 'person_detections'), `${cameraId}_${frameId}_${trackId}`);
    await setDoc(ref, {
      cameraId,
      frameId,
      trackId,
      confidence,
      bbox,
      timestamp: new Date(timestampMs).toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch { /* Non-fatal — detection display is not blocked by Firestore */ }
}

async function writeTrackRecord(
  cameraId: string,
  trackId: string,
  event: 'STARTED' | 'UPDATED' | 'ENDED' | 'RECOVERED',
  bbox: BoundingBox,
  confidence: number,
  totalFrames: number,
  timestampMs: number,
): Promise<void> {
  try {
    const ref = doc(collection(db, 'person_tracks'), `${cameraId}_${trackId}`);
    if (event === 'STARTED') {
      await setDoc(ref, {
        cameraId,
        trackId,
        startedAt: new Date(timestampMs).toISOString(),
        lastUpdatedAt: new Date(timestampMs).toISOString(),
        lastBbox: bbox,
        lastConfidence: confidence,
        totalFrames,
        state: 'TRACKING',
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        lastUpdatedAt: new Date(timestampMs).toISOString(),
        lastBbox: bbox,
        lastConfidence: confidence,
        totalFrames,
        state: event === 'ENDED' ? 'ENDED' : 'TRACKING',
      });
    }
  } catch { /* Non-fatal */ }
}

// ─── Event emission ───────────────────────────────────────────────────────────

function eventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function emitPersonEvent(
  type: VmsAiEventType | string,
  cameraId: string,
  trackId: string,
  bbox: BoundingBox,
  confidence: number,
  extra?: Record<string, unknown>,
): void {
  vmsEventService.emit('AI_DETECTION_FINISHED', 'PersonTrackingEngine', {
    eventType: type,
    eventId: eventId('pd'),
    timestamp: new Date().toISOString(),
    cameraId,
    trackId,
    boundingBox: bbox,
    confidence,
    ...extra,
  }, type === VmsAiEventType.OBJECT_LOST ? 'WARNING' : 'INFO');
}

// ─── PersonTrackingEngine (singleton) ────────────────────────────────────────

export class PersonTrackingEngine {
  private static instance: PersonTrackingEngine;
  private cameraTrackers: Map<string, KalmanByteTracker> = new Map();

  // Rolling stats per camera
  private stats: Map<string, {
    totalDetections: number;
    totalTracksStarted: number;
    totalTracksEnded: number;
    totalRejections: number;
    lastUpdated: number;
  }> = new Map();

  private constructor() {}

  public static getInstance(): PersonTrackingEngine {
    if (!PersonTrackingEngine.instance) {
      PersonTrackingEngine.instance = new PersonTrackingEngine();
    }
    return PersonTrackingEngine.instance;
  }

  private getTracker(cameraId: string): KalmanByteTracker {
    if (!this.cameraTrackers.has(cameraId)) {
      this.cameraTrackers.set(cameraId, new KalmanByteTracker(cameraId));
    }
    return this.cameraTrackers.get(cameraId)!;
  }

  private ensureStats(cameraId: string) {
    if (!this.stats.has(cameraId)) {
      this.stats.set(cameraId, {
        totalDetections: 0,
        totalTracksStarted: 0,
        totalTracksEnded: 0,
        totalRejections: 0,
        lastUpdated: Date.now(),
      });
    }
    return this.stats.get(cameraId)!;
  }

  /**
   * Main entry point called by InferencePipeline Stage 2.
   *
   * @param cameraId  Camera that produced the frame
   * @param rawDets   Raw detections from PersonDetectorPlugin (ONNX output)
   * @param frameId   Frame identifier
   * @param timestampMs Frame wall-clock timestamp
   * @param minConf   Confidence threshold (default 0.25)
   */
  public async processFrame(
    cameraId: string,
    rawDets: Array<{ id: string; confidence: number; box?: BoundingBox }>,
    frameId: string,
    timestampMs: number,
    minConf = 0.25,
  ): Promise<KalmanBoxTracker[]> {

    const s = this.ensureStats(cameraId);
    s.lastUpdated = timestampMs;

    // ── Validation gate ─────────────────────────────────────────────────────
    const { accepted, rejected } = validateDetections(rawDets, minConf);

    // Emit DetectionRejected for anything that failed validation
    for (const r of rejected) {
      s.totalRejections++;
      emitPersonEvent('ai.event.detection_rejected', cameraId, 'none', r.boundingBox, r.confidence, {
        rejectionReason: r.reason,
      });
    }

    s.totalDetections += accepted.length;

    // ── ByteTrack update ────────────────────────────────────────────────────
    const tracker = this.getTracker(cameraId);
    const { updated, started, ended, recovered } = tracker.update(accepted, timestampMs);

    // ── Event emission + Firestore writes ───────────────────────────────────

    for (const t of started) {
      s.totalTracksStarted++;
      emitPersonEvent(VmsAiEventType.TRACK_STARTED, cameraId, t.trackId, t.getBbox(), t.lastConfidence);
      writeTrackRecord(cameraId, t.trackId, 'STARTED', t.getBbox(), t.lastConfidence, t.totalFrames, timestampMs);
    }

    for (const t of recovered) {
      emitPersonEvent('ai.event.detection_recovered', cameraId, t.trackId, t.getBbox(), t.lastConfidence);
      writeTrackRecord(cameraId, t.trackId, 'RECOVERED', t.getBbox(), t.lastConfidence, t.totalFrames, timestampMs);
    }

    for (const t of updated) {
      emitPersonEvent('ai.event.track_updated', cameraId, t.trackId, t.getBbox(), t.lastConfidence, {
        motionVector: t.getMotionVector(),
        totalFrames: t.totalFrames,
      });
      if (t.isConfirmed) {
        const isFirstConfirm = t.totalFrames === CONFIRM_FRAMES;
        emitPersonEvent(
          isFirstConfirm ? VmsAiEventType.OBJECT_DETECTED : 'ai.event.person_updated',
          cameraId, t.trackId, t.getBbox(), t.lastConfidence,
        );
        // Firestore write for every Nth frame to avoid write storms
        if (t.totalFrames % 5 === 0) {
          writeTrackRecord(cameraId, t.trackId, 'UPDATED', t.getBbox(), t.lastConfidence, t.totalFrames, timestampMs);
          writeDetectionRecord(cameraId, frameId, t.trackId, t.lastConfidence, t.getBbox(), timestampMs);
        }
      }
    }

    for (const t of ended) {
      s.totalTracksEnded++;
      emitPersonEvent(VmsAiEventType.TRACK_ENDED, cameraId, t.trackId, t.getBbox(), t.lastConfidence, {
        totalFrames: t.totalFrames,
      });
      if (t.isConfirmed) {
        emitPersonEvent(VmsAiEventType.OBJECT_LOST, cameraId, t.trackId, t.getBbox(), t.lastConfidence);
      }
      writeTrackRecord(cameraId, t.trackId, 'ENDED', t.getBbox(), t.lastConfidence, t.totalFrames, timestampMs);
    }

    return tracker.getActiveTracks();
  }

  // ─── API surface ────────────────────────────────────────────────────────────

  public getCurrentTracks(cameraId?: string): Array<{
    cameraId: string;
    trackId: string;
    boundingBox: BoundingBox;
    confidence: number;
    totalFrames: number;
    motionVector: { dx: number; dy: number };
    isConfirmed: boolean;
    missedFrames: number;
  }> {
    const result = [];
    for (const [camId, tracker] of this.cameraTrackers.entries()) {
      if (cameraId && camId !== cameraId) continue;
      for (const t of tracker.getActiveTracks()) {
        result.push({
          cameraId: camId,
          trackId: t.trackId,
          boundingBox: t.getBbox(),
          confidence: t.lastConfidence,
          totalFrames: t.totalFrames,
          motionVector: t.getMotionVector(),
          isConfirmed: t.isConfirmed,
          missedFrames: t.missedFrames,
        });
      }
    }
    return result;
  }

  public getStats(cameraId?: string): Record<string, {
    activeTracks: number;
    totalDetections: number;
    totalTracksStarted: number;
    totalTracksEnded: number;
    totalRejections: number;
    lastUpdated: number;
  }> {
    const out: Record<string, any> = {};
    for (const [camId, s] of this.stats.entries()) {
      if (cameraId && camId !== cameraId) continue;
      out[camId] = {
        ...s,
        activeTracks: this.cameraTrackers.get(camId)?.getActiveCount() ?? 0,
      };
    }
    return out;
  }

  public resetCamera(cameraId: string): void {
    this.cameraTrackers.get(cameraId)?.reset();
    this.stats.delete(cameraId);
  }

  public getActiveCameraCount(): number { return this.cameraTrackers.size; }

  public getTotalActivePersons(): number {
    let total = 0;
    for (const tracker of this.cameraTrackers.values()) {
      total += tracker.getActiveTracks().filter(t => t.isConfirmed).length;
    }
    return total;
  }
}

export const personTrackingEngine = PersonTrackingEngine.getInstance();
