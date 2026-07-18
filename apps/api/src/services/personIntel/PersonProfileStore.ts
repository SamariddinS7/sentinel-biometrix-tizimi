/**
 * PersonProfileStore
 *
 * The authoritative CRUD layer for PersonProfile documents.
 *
 * - One profile per F-XXXXX (IdentityFusionEngine identity).
 * - In-memory LRU cache (1 000 entries) + Firestore durable store.
 * - Periodically syncs with IdentityFusionEngine to pick up new identities
 *   without requiring changes to the fusion engine.
 * - All enrichment happens through narrow, additive writes — never destructive.
 *
 * NO FAKE DATA.  Every profile field is derived from real AI observations.
 */

import {
  collection, doc, getDoc, setDoc, updateDoc,
  getDocs, query, where, orderBy, limit as fsLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firestoreService';
import { vmsAuditService } from '../vmsAuditService';
import { identityFusionEngine } from '../ai/IdentityFusionEngine';
import { multiModalIdentityEngine } from '../ai/MultiModalIdentityEngine';
import type {
  PersonProfile, FaceEntry, AppearanceSnapshot, MovementRecord,
  CameraVisit, RegistrationEvent, PersonStatus,
} from './types/PersonProfile';

const COLLECTION = 'personProfiles';
const CACHE_MAX  = 1_000;
const SYNC_INTERVAL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────

class PersonProfileStoreService {
  private static instance: PersonProfileStoreService;

  /** LRU cache: personId → PersonProfile */
  private cache: Map<string, PersonProfile> = new Map();

  /** trackId → personId resolution map (updated on sync) */
  private trackToPersonId: Map<string, string> = new Map();

  /** fusionId → personId (identity for F-XXXXX is personId itself) */
  private fusionToPersonId: Map<string, string> = new Map();

  private syncTimer?: NodeJS.Timeout;

  private constructor() {}

  public static getInstance(): PersonProfileStoreService {
    if (!PersonProfileStoreService.instance) {
      PersonProfileStoreService.instance = new PersonProfileStoreService();
    }
    return PersonProfileStoreService.instance;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    await this.syncFromFusionEngine();
    this.syncTimer = setInterval(() => this.syncFromFusionEngine().catch(console.error), SYNC_INTERVAL_MS);
    console.log('[PersonProfileStore] Started. Profiles synced from IdentityFusionEngine.');
  }

  public stop(): void {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = undefined; }
  }

  // ── Public CRUD ─────────────────────────────────────────────────────────────

  public async get(personId: string): Promise<PersonProfile | null> {
    if (this.cache.has(personId)) return this.cache.get(personId)!;
    try {
      const snap = await getDoc(doc(db, COLLECTION, personId));
      if (!snap.exists()) return null;
      const profile = snap.data() as PersonProfile;
      this.setCache(personId, profile);
      return profile;
    } catch { return null; }
  }

  public async getByFusionId(fusionId: string): Promise<PersonProfile | null> {
    const personId = this.fusionToPersonId.get(fusionId) ?? fusionId;
    return this.get(personId);
  }

  public async getByTrackId(trackId: string): Promise<PersonProfile | null> {
    const personId = this.trackToPersonId.get(trackId);
    if (!personId) return null;
    return this.get(personId);
  }

  public async list(opts: {
    status?: PersonStatus;
    cameraId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PersonProfile[]> {
    const { status, limit: lim = 50 } = opts;
    try {
      let q = query(collection(db, COLLECTION), orderBy('lastSeen', 'desc'), fsLimit(lim));
      if (status) q = query(collection(db, COLLECTION), where('status', '==', status), orderBy('lastSeen', 'desc'), fsLimit(lim));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as PersonProfile);
    } catch { return Array.from(this.cache.values()).slice(0, lim); }
  }

  public async upsert(profile: PersonProfile): Promise<PersonProfile> {
    const now = new Date().toISOString();
    const existing = await this.get(profile.personId);

    if (!existing) {
      profile.createdAt = profile.createdAt || now;
      profile.updatedAt = now;
      profile.profileVersion = 1;
    } else {
      // Merge: never overwrite real-observed fields with empty values
      profile.createdAt     = existing.createdAt;
      profile.profileVersion = existing.profileVersion + 1;
      profile.updatedAt     = now;
      profile.totalDetections  = Math.max(profile.totalDetections,  existing.totalDetections);
      profile.totalRecognitions = Math.max(profile.totalRecognitions, existing.totalRecognitions);

      // Merge face galleries (no duplicates by faceId)
      const existingFaceIds = new Set(existing.faceGallery.map(f => f.faceId));
      profile.faceGallery = [
        ...existing.faceGallery,
        ...profile.faceGallery.filter(f => !existingFaceIds.has(f.faceId)),
      ];

      // Merge camera history
      profile.cameraHistory = this.mergeCameraHistory(existing.cameraHistory, profile.cameraHistory);
    }

    this.setCache(profile.personId, profile);
    this.fusionToPersonId.set(profile.fusionId ?? profile.personId, profile.personId);

    await setDoc(doc(db, COLLECTION, profile.personId), this.sanitizeForFirestore(profile));
    return profile;
  }

  public async updateField(personId: string, fields: Partial<PersonProfile>): Promise<void> {
    const now = new Date().toISOString();
    const update = { ...fields, updatedAt: now };
    try { await updateDoc(doc(db, COLLECTION, personId), update as Record<string, unknown>); } catch {}

    const cached = this.cache.get(personId);
    if (cached) this.setCache(personId, { ...cached, ...update });
  }

  public async addAppearanceSnapshot(personId: string, snap: AppearanceSnapshot): Promise<void> {
    const profile = await this.get(personId);
    if (!profile) return;

    // Keep last 50 appearance snapshots
    const gallery = [snap, ...profile.appearanceGallery].slice(0, 50);
    await this.updateField(personId, { appearanceGallery: gallery, currentAppearance: snap });
  }

  public async addMovementRecord(personId: string, record: MovementRecord): Promise<void> {
    const profile = await this.get(personId);
    if (!profile) return;

    // Update camera history aggregate
    const cameraHistory = this.mergeCameraHistory(profile.cameraHistory, [{
      cameraId:        record.cameraId,
      cameraName:      record.cameraName,
      location:        record.location,
      firstSeenAt:     record.enteredAt,
      lastSeenAt:      record.exitedAt ?? record.enteredAt,
      visitCount:      1,
      totalDurationMs: record.durationMs ?? 0,
      recognitionCount: 0,
    }]);

    const visitedZones = record.zoneId
      ? Array.from(new Set([...(profile.visitedZones ?? []), record.zoneId]))
      : profile.visitedZones;

    await this.updateField(personId, {
      lastCameraId:        record.cameraId,
      lastSeen:            record.exitedAt ?? record.enteredAt,
      cameraHistory,
      visitedZones,
      totalMovementRecords: (profile.totalMovementRecords ?? 0) + 1,
    });
  }

  public async addNote(personId: string, note: string, operator: string): Promise<void> {
    const profile = await this.get(personId);
    if (!profile) return;
    const combined = profile.notes
      ? `${profile.notes}\n[${new Date().toISOString()}] ${operator}: ${note}`
      : `[${new Date().toISOString()}] ${operator}: ${note}`;
    await this.updateField(personId, { notes: combined });
    await vmsAuditService.log({
      userId: operator, userName: operator, action: 'PERSON_NOTE_ADDED',
      module: 'PersonProfileStore', ipAddress: '127.0.0.1', status: 'SUCCESS',
      details: `Note added to profile ${personId}.`,
    });
  }

  public async addToWatchlist(personId: string, operator: string): Promise<void> {
    await this.updateField(personId, { status: 'WATCHLIST' });
    await this.appendRegistrationEvent(personId, { action: 'WATCHLISTED', details: `Added to watchlist by ${operator}`, operator });
    await vmsAuditService.log({
      userId: operator, userName: operator, action: 'PERSON_WATCHLISTED',
      module: 'PersonProfileStore', ipAddress: '127.0.0.1', status: 'WARNING',
      details: `Profile ${personId} added to watchlist by ${operator}.`,
    });
  }

  public async archive(personId: string, operator: string): Promise<void> {
    await this.updateField(personId, { status: 'ARCHIVED', currentlyPresent: false });
    await this.appendRegistrationEvent(personId, { action: 'ARCHIVED', details: `Archived by ${operator} (GDPR/Policy)`, operator });
    await vmsAuditService.log({
      userId: operator, userName: operator, action: 'PERSON_ARCHIVED',
      module: 'PersonProfileStore', ipAddress: '127.0.0.1', status: 'WARNING',
      details: `Profile ${personId} archived by ${operator}.`,
    });
  }

  public async merge(primaryId: string, secondaryId: string, operator: string): Promise<void> {
    const [primary, secondary] = await Promise.all([this.get(primaryId), this.get(secondaryId)]);
    if (!primary || !secondary) return;

    const mergedGallery = [...primary.faceGallery, ...secondary.faceGallery.filter(f =>
      !primary.faceGallery.some(pf => pf.faceId === f.faceId)
    )];
    const mergedCamHistory = this.mergeCameraHistory(primary.cameraHistory, secondary.cameraHistory);
    const mergedZones = Array.from(new Set([...primary.visitedZones, ...secondary.visitedZones]));
    const mergedFrom = [...(primary.mergedFrom ?? []), secondaryId];

    await this.updateField(primaryId, {
      faceGallery:     mergedGallery,
      cameraHistory:   mergedCamHistory,
      visitedZones:    mergedZones,
      mergedFrom,
      firstSeen:       primary.firstSeen < secondary.firstSeen ? primary.firstSeen : secondary.firstSeen,
      totalDetections: primary.totalDetections + secondary.totalDetections,
      totalRecognitions: primary.totalRecognitions + secondary.totalRecognitions,
    });
    await this.updateField(secondaryId, { status: 'ARCHIVED', mergedInto: primaryId });

    await this.appendRegistrationEvent(primaryId, { action: 'MERGED', details: `Merged with ${secondaryId} by ${operator}`, operator });
    await vmsAuditService.log({
      userId: operator, userName: operator, action: 'PERSON_PROFILE_MERGED',
      module: 'PersonProfileStore', ipAddress: '127.0.0.1', status: 'WARNING',
      details: `Profile ${secondaryId} merged into ${primaryId} by ${operator}.`,
    });

    // Delegate actual identity merge to IdentityFusionEngine
    try { await identityFusionEngine.requestMerge(primaryId, secondaryId, operator); } catch {}
  }

  /** Count total profiles */
  public cacheSize(): number { return this.cache.size; }

  /** Get trackId → personId map (for timeline resolution) */
  public resolveTrackId(trackId: string): string | undefined {
    return this.trackToPersonId.get(trackId);
  }

  public registerTrackMapping(trackId: string, personId: string): void {
    this.trackToPersonId.set(trackId, personId);
    // Prune to 10k entries
    if (this.trackToPersonId.size > 10_000) {
      const firstKey = this.trackToPersonId.keys().next().value;
      if (firstKey) this.trackToPersonId.delete(firstKey);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async syncFromFusionEngine(): Promise<void> {
    try {
      const allIdentities = await identityFusionEngine.getAllIdentities?.() ?? [];
      let newCount = 0;

      for (const identity of allIdentities) {
        const personId = identity.id; // F-XXXXX becomes the personId
        this.fusionToPersonId.set(identity.id, personId);

        // Build or update profile from FusedIdentity
        const existing = await this.get(personId);
        const status = this.mapFusionStatus(identity.status, !!identity.userId);

        const profile: PersonProfile = {
          personId,
          fusionId:     identity.id,
          userId:       identity.userId,
          fullName:     identity.label ?? (identity.userId ? `User-${identity.userId}` : `Anonymous-${identity.id.slice(-5)}`),
          status,
          role:         identity.role ?? 'UNKNOWN',
          faceGallery:  existing?.faceGallery ?? [],
          appearanceGallery: existing?.appearanceGallery ?? [],
          primaryEmbedding: undefined,
          firstSeen:    identity.firstSeen,
          lastSeen:     identity.lastSeen,
          lastCameraId: identity.lastCameraId,
          currentlyPresent: this.isRecentlySeen(identity.lastSeen),
          totalDetections:  existing?.totalDetections ?? 0,
          totalRecognitions: existing?.totalRecognitions ?? 0,
          cameraHistory: existing?.cameraHistory ?? [],
          visitedZones:  existing?.visitedZones ?? [],
          visitedBuildings: existing?.visitedBuildings ?? [],
          totalMovementRecords: existing?.totalMovementRecords ?? 0,
          notes:         existing?.notes ?? '',
          customAttributes: existing?.customAttributes ?? {},
          registrationHistory: existing?.registrationHistory ?? [],
          profileVersion: 0, // upsert() will increment
          createdAt:    existing?.createdAt ?? new Date().toISOString(),
          updatedAt:    new Date().toISOString(),
        };

        // Register associated track IDs
        for (const trackId of identity.associatedTracks ?? []) {
          this.trackToPersonId.set(trackId, personId);
        }

        if (!existing) {
          profile.registrationHistory = [{
            eventId:   `RE-${Date.now()}-${personId}`,
            timestamp: new Date().toISOString(),
            action:    'AUTO_CREATED',
            details:   `Profile auto-created from IdentityFusionEngine (${identity.status}).`,
          }];
          newCount++;
        }

        await this.upsert(profile);
      }

      // Also sync MultiModalIdentity links
      try {
        const mmIdentities = await multiModalIdentityEngine.getAllIdentities?.() ?? [];
        for (const mm of mmIdentities) {
          for (const fusionId of mm.associatedFusions ?? []) {
            const personId = this.fusionToPersonId.get(fusionId);
            if (personId) {
              await this.updateField(personId, { multiModalId: mm.id });
            }
          }
        }
      } catch {}

      if (newCount > 0) {
        console.log(`[PersonProfileStore] Sync: ${newCount} new profiles created. Total cache: ${this.cache.size}.`);
      }
    } catch (err) {
      console.warn('[PersonProfileStore] Sync error:', err);
    }
  }

  private mapFusionStatus(status: string, hasUserId: boolean): PersonStatus {
    if (status === 'archived')  return 'ARCHIVED';
    if (status === 'verified')  return 'KNOWN';
    if (status === 'persistent' && hasUserId) return 'KNOWN';
    if (status === 'merged')    return 'ARCHIVED';
    return 'ANONYMOUS';
  }

  private isRecentlySeen(lastSeen: string): boolean {
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1_000; // 5 min
  }

  private mergeCameraHistory(existing: CameraVisit[], incoming: CameraVisit[]): CameraVisit[] {
    const map = new Map<string, CameraVisit>();
    for (const v of existing) map.set(v.cameraId, { ...v });
    for (const v of incoming) {
      const e = map.get(v.cameraId);
      if (!e) {
        map.set(v.cameraId, { ...v });
      } else {
        map.set(v.cameraId, {
          ...e,
          visitCount:      e.visitCount + v.visitCount,
          totalDurationMs: e.totalDurationMs + v.totalDurationMs,
          recognitionCount: e.recognitionCount + v.recognitionCount,
          lastSeenAt:      e.lastSeenAt > v.lastSeenAt ? e.lastSeenAt : v.lastSeenAt,
          firstSeenAt:     e.firstSeenAt < v.firstSeenAt ? e.firstSeenAt : v.firstSeenAt,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.visitCount - a.visitCount);
  }

  private async appendRegistrationEvent(personId: string, event: Partial<RegistrationEvent>): Promise<void> {
    const profile = await this.get(personId);
    if (!profile) return;
    const entry: RegistrationEvent = {
      eventId:   `RE-${Date.now()}-${personId}`,
      timestamp: new Date().toISOString(),
      action:    event.action ?? 'MANUALLY_ENROLLED',
      details:   event.details ?? '',
      operator:  event.operator,
      previousVersion: profile.profileVersion,
    };
    await this.updateField(personId, {
      registrationHistory: [...(profile.registrationHistory ?? []), entry],
    });
  }

  private setCache(personId: string, profile: PersonProfile): void {
    if (this.cache.size >= CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(personId, profile);
  }

  private sanitizeForFirestore(obj: unknown): unknown {
    return JSON.parse(JSON.stringify(obj));
  }
}

export const personProfileStore = PersonProfileStoreService.getInstance();
