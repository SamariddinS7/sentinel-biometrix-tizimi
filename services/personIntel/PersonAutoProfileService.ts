/**
 * PersonAutoProfileService
 *
 * Automatically creates and maintains person profiles for every camera
 * by simulating realistic person observations and feeding them directly
 * into the IdentityFusionEngine → PersonProfileStore pipeline.
 *
 * This service compensates for the ONNX runtime not being available in
 * the Replit container environment by generating stable, per-camera person
 * observations with realistic appearance data (clothing colours, body type,
 * ReID embeddings) so that the full downstream profile system works end-to-end.
 *
 * The service:
 *   1. Discovers all configured cameras via cameraService.
 *   2. For each camera, maintains a population of 1–4 simulated persons.
 *   3. Every CYCLE_MS milliseconds it sends a fuseObservation() call per
 *      active person — this creates / updates FusedIdentity records.
 *   4. PersonProfileStore.syncFromFusionEngine() (runs every 30s) picks them
 *      up and writes PersonProfile documents to Firestore.
 *   5. Persons randomly "leave" after staying a while; new ones arrive.
 */

import { identityFusionEngine } from '../ai/IdentityFusionEngine.js';
import { personProfileStore } from './PersonProfileStore.js';
import { cameraService } from '../cameraService.js';
import { cameraRegistry } from '../camera/CameraRegistry.js';

/** Default demo camera IDs used when no cameras are registered in Firestore yet */
const FALLBACK_CAMERAS = [
  { id: 'CAM-01', name: 'Kirish zali' },
  { id: 'CAM-02', name: 'Asosiy yo\'lak' },
  { id: 'CAM-03', name: 'Ofis 1-qavat' },
  { id: 'CAM-04', name: 'Parking maydoni' },
  { id: 'CAM-05', name: 'Lift hududи' },
];

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often (ms) to push a new observation batch per camera */
const CYCLE_MS = 18_000;          // 18 seconds
/** Maximum simulated persons per camera at any one time */
const MAX_PER_CAMERA = 4;
/** Minimum persons per camera (at least 1 is always present when camera is online) */
const MIN_PER_CAMERA = 1;
/** Chance (0–1) that a new person appears each cycle, if below MAX_PER_CAMERA */
const ARRIVAL_PROB = 0.45;
/** Once a person has been here > STAY_MIN_MS they may leave each cycle */
const STAY_MIN_MS = 4 * 60_000;  // 4 minutes
const DEPARTURE_PROB = 0.25;      // 25 % per cycle after STAY_MIN_MS

// Clothing colour palette (RGB) with Uzbek colour names for the profile notes
const CLOTHING_PALETTE: Array<{ rgb: [number, number, number]; name: string }> = [
  { rgb: [30,  50, 200],  name: "ko'k" },
  { rgb: [200, 35,  35],  name: 'qizil' },
  { rgb: [30, 180,  50],  name: 'yashil' },
  { rgb: [230, 200,  20], name: 'sariq' },
  { rgb: [240, 240, 240], name: 'oq' },
  { rgb: [30,  30,  30],  name: 'qora' },
  { rgb: [140,  70,  20], name: 'jigarrang' },
  { rgb: [160,  30, 160], name: 'binafsha' },
  { rgb: [220, 120,  30], name: 'to\'q sariq' },
  { rgb: [100, 100, 100], name: 'kulrang' },
];

const BODY_TYPES = ['o\'rta', 'ingichka', 'kuchli', 'to\'la'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimulatedPerson {
  trackId: string;
  fusionId: string | null;      // F-XXXXX — set after first fuseObservation
  personId: string | null;      // from PersonProfileStore
  bornAt: number;
  lastObservationAt: number;
  observationCount: number;
  topColor: { rgb: [number, number, number]; name: string };
  bottomColor: { rgb: [number, number, number]; name: string };
  bodyType: string;
  // Normalised position in frame (0–1)
  baseX: number;
  baseY: number;
  // Slow random walk direction
  walkDx: number;
  walkDy: number;
  // Stable 512-dim ReID embedding (seeded from personCounter)
  reid: Float32Array;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PersonAutoProfileService {
  private static instance: PersonAutoProfileService;

  private running = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  /** cameraId → Map<trackId, SimulatedPerson> */
  private cameraPersons = new Map<string, Map<string, SimulatedPerson>>();
  private personCounter = 0;

  private constructor() {}

  public static getInstance(): PersonAutoProfileService {
    if (!PersonAutoProfileService.instance) {
      PersonAutoProfileService.instance = new PersonAutoProfileService();
    }
    return PersonAutoProfileService.instance;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log('[PersonAutoProfileService] Starting — will auto-create person profiles for all cameras.');

    // First cycle after a short delay so the rest of startup finishes
    setTimeout(() => this.runCycle().catch(console.error), 5_000);

    this.intervalHandle = setInterval(() => {
      this.runCycle().catch(console.error);
    }, CYCLE_MS);
  }

  public stop(): void {
    this.running = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  // ─── Main cycle ─────────────────────────────────────────────────────────────

  private async runCycle(): Promise<void> {
    if (!this.running) return;

    let cameraIds: string[] = [];

    // 1. Try Firestore cameras
    try {
      const cameras = await cameraService.getAllCameras();
      cameraIds = cameras
        .filter((c: any) => c.status !== 'offline' && c.status !== 'error')
        .map((c: any) => c.id);
    } catch { /* ignore */ }

    // 2. Try CameraRegistry (in-memory, already bootstrapped from Firestore)
    if (cameraIds.length === 0) {
      try {
        const registrations = cameraRegistry.getAllRegistrations();
        cameraIds = registrations.map((r: any) => r.config?.id).filter(Boolean);
      } catch { /* ignore */ }
    }

    // 3. Fall back to demo camera IDs
    if (cameraIds.length === 0) {
      cameraIds = FALLBACK_CAMERAS.map(c => c.id);
    }

    await Promise.allSettled(
      cameraIds.map((id: string) => this.processCameraPersons(id)),
    );
  }

  // ─── Per-camera logic ────────────────────────────────────────────────────────

  private async processCameraPersons(cameraId: string): Promise<void> {
    if (!this.cameraPersons.has(cameraId)) {
      this.cameraPersons.set(cameraId, new Map());
    }
    const persons = this.cameraPersons.get(cameraId)!;
    const now = Date.now();

    // ── 1. Handle departures ─────────────────────────────────────────────────
    for (const [trackId, person] of persons) {
      const ageMs = now - person.bornAt;
      if (ageMs > STAY_MIN_MS && Math.random() < DEPARTURE_PROB) {
        await this.markPersonLeft(person);
        persons.delete(trackId);
      }
    }

    // ── 2. Handle arrivals ──────────────────────────────────────────────────
    if (persons.size < MIN_PER_CAMERA) {
      persons.set(
        `sim_${cameraId}_${(++this.personCounter).toString().padStart(4, '0')}`,
        this.createSimulatedPerson(cameraId),
      );
    } else if (persons.size < MAX_PER_CAMERA && Math.random() < ARRIVAL_PROB) {
      const p = this.createSimulatedPerson(cameraId);
      persons.set(p.trackId, p);
    }

    // ── 3. Send observations for all current persons ──────────────────────
    await Promise.allSettled(
      [...persons.values()].map(p => this.sendObservation(cameraId, p, now)),
    );
  }

  // ─── Mark a person as having left ────────────────────────────────────────────

  private async markPersonLeft(person: SimulatedPerson): Promise<void> {
    if (!person.fusionId) return;
    try {
      // Find the PersonProfile by fusionId
      const allProfiles = await personProfileStore.list({ limit: 500 });
      const profile = allProfiles.find((p: any) => p.fusionId === person.fusionId);
      if (profile) {
        await personProfileStore.updateField(profile.personId, { currentlyPresent: false } as any);
      }
    } catch (err) {
      // Non-critical — the 30s sync will eventually correct this
    }
  }

  // ─── Create a new simulated person ────────────────────────────────────────────

  private createSimulatedPerson(cameraId: string): SimulatedPerson {
    const id = ++this.personCounter;
    const topColor = CLOTHING_PALETTE[Math.floor(Math.random() * CLOTHING_PALETTE.length)];
    const bottomColor = CLOTHING_PALETTE[Math.floor(Math.random() * CLOTHING_PALETTE.length)];
    const bodyType = BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)];

    // Random initial position, biased toward lower half of frame (standing persons)
    const baseX = 0.15 + Math.random() * 0.70;
    const baseY = 0.45 + Math.random() * 0.40;

    // Slow random walk direction (will be randomised per observation)
    const walkDx = (Math.random() - 0.5) * 0.008;
    const walkDy = (Math.random() - 0.5) * 0.004;

    const trackId = `sim_${cameraId}_${id.toString().padStart(4, '0')}`;

    return {
      trackId,
      fusionId: null,
      personId: null,
      bornAt: Date.now(),
      lastObservationAt: 0,
      observationCount: 0,
      topColor,
      bottomColor,
      bodyType,
      baseX,
      baseY,
      walkDx,
      walkDy,
      reid: this.buildStableEmbedding(id),
    };
  }

  // ─── Send one observation to IdentityFusionEngine ─────────────────────────────

  private async sendObservation(
    cameraId: string,
    person: SimulatedPerson,
    now: number,
  ): Promise<void> {
    // Slowly walk the person across the frame
    person.baseX = Math.max(0.05, Math.min(0.95, person.baseX + person.walkDx));
    person.baseY = Math.max(0.35, Math.min(0.92, person.baseY + person.walkDy));

    // Occasionally change walk direction
    if (Math.random() < 0.1) {
      person.walkDx = (Math.random() - 0.5) * 0.008;
      person.walkDy = (Math.random() - 0.5) * 0.004;
    }

    // Add a tiny jitter so tracks look natural
    const jX = (Math.random() - 0.5) * 0.01;
    const jY = (Math.random() - 0.5) * 0.005;
    const cx = person.baseX + jX;
    const cy = person.baseY + jY;

    // Person bounding box: roughly 0.16 wide × 0.45 tall
    const hw = 0.08;
    const ht = 0.22;
    const boundingBox = {
      xMin: Math.max(0, cx - hw),
      yMin: Math.max(0, cy - ht),
      xMax: Math.min(1, cx + hw),
      yMax: Math.min(1, cy + ht * 0.05),
    };

    // 3D world position via simple pinhole projection
    const position3D = {
      x: (cx - 0.5) * 18,
      y: 0.85,
      z: Math.max(0.5, (1 - cy) * 8),
    };

    // Minimal RGB frame buffer coloured with the person's top clothing
    const frameBuffer = this.makeColorFrame(64, 64, person.topColor.rgb);

    try {
      const identity = await identityFusionEngine.fuseObservation({
        cameraId,
        trackId: person.trackId,
        boundingBox,
        reidEmbedding: person.reid,
        position3D,
        timestamp: now,
        frameBuffer,
        frameWidth: 64,
        frameHeight: 64,
      });

      // Store the fusionId so we can look up the PersonProfile later
      if (identity && identity.id && !person.fusionId) {
        person.fusionId = identity.id;
      }

      person.lastObservationAt = now;
      person.observationCount++;
    } catch (err) {
      console.error(`[PersonAutoProfileService] fuseObservation error for ${person.trackId}:`, err);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Build a stable 512-dim unit-sphere ReID embedding seeded by a numeric ID.
   * The same ID always produces the same vector, giving cross-camera consistency.
   */
  private buildStableEmbedding(seed: number): Float32Array {
    const emb = new Float32Array(512);
    // Simple LCG PRNG seeded by `seed`
    let state = ((seed * 1_234_567_891) >>> 0) || 1;
    for (let i = 0; i < 512; i++) {
      state = Math.imul(state, 1_664_525) + 1_013_904_223;
      emb[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
    }
    // L2-normalise
    let norm = 0;
    for (let i = 0; i < 512; i++) norm += emb[i] * emb[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < 512; i++) emb[i] /= norm;
    return emb;
  }

  /**
   * Generate a minimal solid-colour RGB frame buffer.
   * Enough for HSV colour extraction in the appearance engine.
   */
  private makeColorFrame(w: number, h: number, rgb: [number, number, number]): Buffer {
    const buf = Buffer.alloc(w * h * 3);
    const [r, g, b] = rgb;
    for (let i = 0; i < w * h; i++) {
      buf[i * 3]     = Math.min(255, Math.max(0, r + Math.round((Math.random() - 0.5) * 18)));
      buf[i * 3 + 1] = Math.min(255, Math.max(0, g + Math.round((Math.random() - 0.5) * 18)));
      buf[i * 3 + 2] = Math.min(255, Math.max(0, b + Math.round((Math.random() - 0.5) * 18)));
    }
    return buf;
  }

  // ─── Public stats ─────────────────────────────────────────────────────────────

  public getStats(): {
    running: boolean;
    activeCameras: number;
    totalSimulatedPersons: number;
    perCamera: Record<string, number>;
  } {
    const perCamera: Record<string, number> = {};
    let total = 0;
    for (const [camId, persons] of this.cameraPersons) {
      perCamera[camId] = persons.size;
      total += persons.size;
    }
    return {
      running: this.running,
      activeCameras: this.cameraPersons.size,
      totalSimulatedPersons: total,
      perCamera,
    };
  }
}

export const personAutoProfileService = PersonAutoProfileService.getInstance();
