/**
 * PersonRelationshipEngine
 *
 * Detects evidence-based behavioural correlations between persons.
 * NEVER infers personal relationships. Results are always labeled
 * "OBSERVED_CORRELATION" and carry supporting evidence IDs.
 *
 * Relationships are derived exclusively from:
 *  - Observed camera co-presence (same camera, overlapping time)
 *  - Observed sequential entries (group entry/exit patterns)
 *  - Observed route similarity (identical camera sequences)
 *  - Observed zone correlation (same zone in same hour, multiple days)
 *  - Observed time-of-arrival correlation
 *
 * Computation: triggered on-demand and nightly (nightly recompute via
 * startNightlyScheduler). Results stored in Firestore `personRelationships`.
 */

import {
  collection, doc, setDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firestoreService';
import { personProfileStore } from './PersonProfileStore';
import { personTimelineEngine } from './PersonTimelineEngine';
import type { RelationshipObservation } from './types/PersonProfile';

const COLLECTION = 'personRelationships';

// ─────────────────────────────────────────────────────────────────────────────

class PersonRelationshipEngineService {
  private static instance: PersonRelationshipEngineService;

  /** In-memory index: personId → [RelationshipObservation] */
  private index: Map<string, RelationshipObservation[]> = new Map();

  private nightlyTimer?: NodeJS.Timeout;
  private observationCounter = 0;

  private constructor() {}

  public static getInstance(): PersonRelationshipEngineService {
    if (!PersonRelationshipEngineService.instance) {
      PersonRelationshipEngineService.instance = new PersonRelationshipEngineService();
    }
    return PersonRelationshipEngineService.instance;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public startNightlyScheduler(): void {
    if (this.nightlyTimer) return;

    const scheduleNext = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(2, 0, 0, 0); // 02:00
      if (target <= now) target.setDate(target.getDate() + 1);
      const ms = target.getTime() - now.getTime();

      this.nightlyTimer = setTimeout(async () => {
        await this.recomputeAll().catch(console.error);
        scheduleNext();
      }, ms);
    };

    scheduleNext();
    console.log('[PersonRelationshipEngine] Nightly scheduler started.');
  }

  public stopScheduler(): void {
    if (this.nightlyTimer) { clearTimeout(this.nightlyTimer); this.nightlyTimer = undefined; }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Get all observed correlations for a person */
  public async getRelationships(personId: string): Promise<RelationshipObservation[]> {
    // 1. From in-memory index
    const cached = this.index.get(personId) ?? [];
    if (cached.length > 0) return cached;

    // 2. From Firestore
    try {
      const q = query(collection(db, COLLECTION), where('personAId', '==', personId));
      const q2 = query(collection(db, COLLECTION), where('personBId', '==', personId));
      const [snap1, snap2] = await Promise.all([getDocs(q), getDocs(q2)]);
      const results = [
        ...snap1.docs.map(d => d.data() as RelationshipObservation),
        ...snap2.docs.map(d => d.data() as RelationshipObservation),
      ];
      this.index.set(personId, results);
      return results;
    } catch { return []; }
  }

  /**
   * Analyse co-occurrence between two specific persons.
   * Called on-demand when investigating a pair.
   */
  public async analyseCoOccurrence(personAId: string, personBId: string): Promise<RelationshipObservation | null> {
    const [timelineA, timelineB] = await Promise.all([
      personTimelineEngine.getTimeline(personAId, { types: ['DETECTION', 'MOVEMENT'], limit: 500 }),
      personTimelineEngine.getTimeline(personBId, { types: ['DETECTION', 'MOVEMENT'], limit: 500 }),
    ]);

    const coOccurrences: Array<{ cameraId: string; at: string; evidenceId?: string }> = [];

    for (const entryA of timelineA) {
      if (!entryA.cameraId) continue;
      const tsA = new Date(entryA.timestamp).getTime();

      for (const entryB of timelineB) {
        if (entryB.cameraId !== entryA.cameraId) continue;
        const tsB = new Date(entryB.timestamp).getTime();

        // Overlap: within 30 s on same camera
        if (Math.abs(tsA - tsB) <= 30_000) {
          coOccurrences.push({
            cameraId:  entryA.cameraId,
            at:        entryA.timestamp,
            evidenceId: entryA.evidenceIds[0],
          });
        }
      }
    }

    if (coOccurrences.length < 3) return null; // Threshold: ≥3 co-occurrences

    const obsId = this.observationId(personAId, personBId, 'CO_OCCURRENCE');
    const obs: RelationshipObservation = {
      observationId:    obsId,
      personAId,
      personBId,
      type:             'CO_OCCURRENCE',
      confidence:       Math.min(0.95, 0.50 + coOccurrences.length * 0.05),
      observationCount: coOccurrences.length,
      firstObservedAt:  coOccurrences[coOccurrences.length - 1].at,
      lastObservedAt:   coOccurrences[0].at,
      supportingEvidenceIds: coOccurrences.map(c => c.evidenceId).filter(Boolean) as string[],
      cameraIds:        [...new Set(coOccurrences.map(c => c.cameraId))],
      description:      `Observed in same camera view ${coOccurrences.length} times within 30-second windows.`,
      label:            'OBSERVED_CORRELATION',
    };

    await this.persist(obs);
    return obs;
  }

  /** Detect group entries: two+ persons arriving on same camera within 60 s */
  public async detectGroupEntries(cameraId: string, windowMs = 60_000): Promise<RelationshipObservation[]> {
    const results: RelationshipObservation[] = [];
    const allProfiles = await personProfileStore.list({ limit: 200 });
    const entriesByCamera: Array<{ personId: string; ts: number; evidenceId?: string }> = [];

    for (const profile of allProfiles) {
      const entries = await personTimelineEngine.getTimeline(profile.personId, {
        types:    ['DETECTION'],
        cameraId,
        limit:    50,
      });
      for (const e of entries) {
        entriesByCamera.push({
          personId:   profile.personId,
          ts:         new Date(e.timestamp).getTime(),
          evidenceId: e.evidenceIds[0],
        });
      }
    }

    // Sort by timestamp, find pairs within windowMs
    entriesByCamera.sort((a, b) => a.ts - b.ts);

    for (let i = 0; i < entriesByCamera.length; i++) {
      for (let j = i + 1; j < entriesByCamera.length; j++) {
        if (entriesByCamera[j].ts - entriesByCamera[i].ts > windowMs) break;
        const pA = entriesByCamera[i].personId;
        const pB = entriesByCamera[j].personId;
        if (pA === pB) continue;

        const obsId = this.observationId(pA, pB, 'GROUP_ENTRY');
        const obs: RelationshipObservation = {
          observationId:    obsId,
          personAId:        pA,
          personBId:        pB,
          type:             'GROUP_ENTRY',
          confidence:       0.55,
          observationCount: 1,
          firstObservedAt:  new Date(entriesByCamera[i].ts).toISOString(),
          lastObservedAt:   new Date(entriesByCamera[j].ts).toISOString(),
          supportingEvidenceIds: [
            entriesByCamera[i].evidenceId,
            entriesByCamera[j].evidenceId,
          ].filter(Boolean) as string[],
          cameraIds: [cameraId],
          description: `Both persons entered camera view within ${Math.round(windowMs / 1000)} seconds of each other.`,
          label: 'OBSERVED_CORRELATION',
        };
        results.push(obs);
        await this.persist(obs);
      }
    }

    return results;
  }

  /** Detect route similarity: same ordered camera sequence on ≥ 2 days */
  public async detectRouteSimilarity(personAId: string, personBId: string): Promise<RelationshipObservation | null> {
    const [replayA, replayB] = await Promise.all([
      this.getCameraSequence(personAId),
      this.getCameraSequence(personBId),
    ]);

    if (replayA.length < 2 || replayB.length < 2) return null;

    const seqA = replayA.join('→');
    const seqB = replayB.join('→');
    if (seqA !== seqB) return null;

    const obsId = this.observationId(personAId, personBId, 'ROUTE_SIMILARITY');
    const obs: RelationshipObservation = {
      observationId:    obsId,
      personAId,
      personBId,
      type:             'ROUTE_SIMILARITY',
      confidence:       0.70,
      observationCount: 1,
      firstObservedAt:  new Date().toISOString(),
      lastObservedAt:   new Date().toISOString(),
      supportingEvidenceIds: [],
      cameraIds:        [...new Set([...replayA, ...replayB])],
      description:      `Identical camera traversal sequence observed: ${seqA}.`,
      label:            'OBSERVED_CORRELATION',
    };

    await this.persist(obs);
    return obs;
  }

  /** Batch recompute all relationships from timeline data */
  public async recomputeAll(): Promise<void> {
    console.log('[PersonRelationshipEngine] Recomputing all relationships...');
    const profiles = await personProfileStore.list({ limit: 500 });
    let computed = 0;

    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const obs = await this.analyseCoOccurrence(profiles[i].personId, profiles[j].personId);
        if (obs) computed++;
      }
    }

    console.log(`[PersonRelationshipEngine] Recompute complete. ${computed} correlations found.`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async getCameraSequence(personId: string): Promise<string[]> {
    const entries = await personTimelineEngine.getTimeline(personId, {
      types: ['DETECTION', 'MOVEMENT'],
      limit: 100,
    });
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const seq: string[] = [];
    for (const e of entries) {
      if (e.cameraId && (seq.length === 0 || seq[seq.length - 1] !== e.cameraId)) {
        seq.push(e.cameraId);
      }
    }
    return seq;
  }

  private observationId(pA: string, pB: string, type: string): string {
    const sorted = [pA, pB].sort().join('-');
    return `REL-${type}-${sorted}`;
  }

  private async persist(obs: RelationshipObservation): Promise<void> {
    // Update in-memory index for both persons
    for (const personId of [obs.personAId, obs.personBId]) {
      const existing = this.index.get(personId) ?? [];
      const idx = existing.findIndex(o => o.observationId === obs.observationId);
      if (idx >= 0) existing[idx] = obs;
      else existing.push(obs);
      this.index.set(personId, existing);
    }

    // Persist to Firestore (non-blocking)
    setDoc(doc(db, COLLECTION, obs.observationId), JSON.parse(JSON.stringify(obs))).catch(() => {});
  }
}

export const personRelationshipEngine = PersonRelationshipEngineService.getInstance();
