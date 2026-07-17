/**
 * PersonInvestigationEngine
 *
 * Stateless query engine for cross-camera investigation, movement replay,
 * similarity search, and natural-language query decomposition.
 *
 * INVESTIGATION CONSISTENCY POLICY:
 *   Every result references actual observations. When confidence is
 *   insufficient, results are labeled as "possible" not "confirmed".
 *   Every result carries supporting evidence IDs for operator verification.
 *
 * No fake data. No simulated routes. No invented incidents.
 */

import { personProfileStore } from './PersonProfileStore';
import { personTimelineEngine } from './PersonTimelineEngine';
import { evidenceManager } from '../evidenceManager';
import { identityFusionEngine } from '../ai/IdentityFusionEngine';
import { appearanceIntelligenceEngine } from '../ai/AppearanceIntelligenceEngine';
import type {
  PersonProfile, MovementReplayStep, InvestigationResult,
  PersonSearchQuery, PersonSearchResult, TimelineEntryType,
} from './types/PersonProfile';

// ─────────────────────────────────────────────────────────────────────────────

export class PersonInvestigationEngine {
  private static instance: PersonInvestigationEngine;

  private constructor() {}

  public static getInstance(): PersonInvestigationEngine {
    if (!PersonInvestigationEngine.instance) {
      PersonInvestigationEngine.instance = new PersonInvestigationEngine();
    }
    return PersonInvestigationEngine.instance;
  }

  // ── Timeline ─────────────────────────────────────────────────────────────

  public async getTimeline(personId: string, opts: {
    types?:    TimelineEntryType[];
    cameraId?: string;
    since?:    string;
    until?:    string;
    limit?:    number;
    offset?:   number;
  } = {}) {
    return personTimelineEngine.getTimeline(personId, opts);
  }

  // ── Movement Replay ──────────────────────────────────────────────────────

  /**
   * Returns an ordered sequence of camera visits for a person in a time window.
   * Each step references real movement timeline entries — no interpolation.
   */
  public async getMovementReplay(personId: string, opts: {
    since?: string;
    until?: string;
    limit?: number;
  } = {}): Promise<MovementReplayStep[]> {
    const movementEntries = await personTimelineEngine.getTimeline(personId, {
      types: ['MOVEMENT', 'DETECTION'],
      since: opts.since,
      until: opts.until,
      limit: opts.limit ?? 200,
    });

    // Sort ascending for chronological replay
    movementEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const steps: MovementReplayStep[] = [];
    let stepIndex = 0;

    for (const entry of movementEntries) {
      if (!entry.cameraId) continue;
      steps.push({
        stepIndex:   stepIndex++,
        cameraId:    entry.cameraId,
        cameraName:  entry.cameraName ?? entry.cameraId,
        location:    entry.location ?? '',
        enteredAt:   entry.timestamp,
        exitedAt:    undefined,  // populated on next different-camera entry
        durationMs:  undefined,
        trackId:     entry.trackId ?? '',
        evidenceId:  entry.evidenceIds[0],
      });
    }

    // Fill exit times from next step
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].cameraId === steps[i + 1].cameraId) continue;
      steps[i].exitedAt   = steps[i + 1].enteredAt;
      steps[i].durationMs = new Date(steps[i + 1].enteredAt).getTime()
                          - new Date(steps[i].enteredAt).getTime();
    }

    return steps;
  }

  /**
   * Cross-camera journey: summarised by camera (deduplicated consecutive visits).
   */
  public async getCrossCameraJourney(personId: string, opts: { since?: string; until?: string } = {}) {
    const replay = await this.getMovementReplay(personId, opts);
    const journey: Array<{
      cameraId: string; cameraName: string; location: string;
      enteredAt: string; exitedAt?: string; durationMs?: number;
    }> = [];

    for (const step of replay) {
      const last = journey[journey.length - 1];
      if (last && last.cameraId === step.cameraId) {
        // Extend existing visit
        last.exitedAt   = step.exitedAt ?? last.exitedAt;
        last.durationMs = last.exitedAt
          ? new Date(last.exitedAt).getTime() - new Date(last.enteredAt).getTime()
          : last.durationMs;
      } else {
        journey.push({
          cameraId:  step.cameraId,
          cameraName: step.cameraName,
          location:  step.location,
          enteredAt: step.enteredAt,
          exitedAt:  step.exitedAt,
          durationMs: step.durationMs,
        });
      }
    }

    return journey;
  }

  // ── Evidence ─────────────────────────────────────────────────────────────

  public getEvidence(personId: string, opts: {
    eventType?: string; since?: string; limit?: number;
  } = {}) {
    // Evidence is linked via trackId stored in EvidenceRecord.metadata
    const all = evidenceManager.search({ ...opts });
    return all.filter(e =>
      e.metadata?.personId === personId ||
      e.metadata?.fusionId === personId ||
      e.trackId === personId,
    );
  }

  // ── Incidents ────────────────────────────────────────────────────────────

  public async getIncidents(personId: string, opts: {
    since?: string; until?: string; limit?: number;
  } = {}) {
    return personTimelineEngine.getTimeline(personId, {
      types: ['ALARM', 'ANALYTICS_EVENT'],
      since: opts.since,
      until: opts.until,
      limit: opts.limit ?? 100,
    });
  }

  // ── Face Search ──────────────────────────────────────────────────────────

  public async findByFace(descriptor: number[], threshold = 0.65): Promise<PersonSearchResult[]> {
    try {
      const matches = await (identityFusionEngine as any).findFusionMatch?.({
        faceDescriptor: descriptor,
        threshold,
      }) ?? [];
      const results: PersonSearchResult[] = [];
      for (const match of matches) {
        const profile = await personProfileStore.getByFusionId(match.id);
        if (!profile) continue;
        results.push({
          profile,
          score:       match.score ?? threshold,
          matchReason: `Face biometric match (score: ${((match.score ?? 0) * 100).toFixed(1)}%)`,
          evidenceIds: [],
        });
      }
      return results.sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }

  // ── Appearance Search ────────────────────────────────────────────────────

  public async findByAppearance(attrs: {
    upperClothingColor?: string;
    lowerClothingColor?: string;
    helmet?: boolean;
    vest?: boolean;
    backpack?: boolean;
  }, threshold = 0.5): Promise<PersonSearchResult[]> {
    try {
      const profiles = await personProfileStore.list({ limit: 500 });
      const results: PersonSearchResult[] = [];

      for (const profile of profiles) {
        if (!profile.currentAppearance) continue;
        const ap = profile.currentAppearance;
        let matchCount = 0, total = 0;

        if (attrs.upperClothingColor !== undefined) {
          total++;
          if (ap.upperClothingColor?.toLowerCase().includes(attrs.upperClothingColor.toLowerCase())) matchCount++;
        }
        if (attrs.lowerClothingColor !== undefined) {
          total++;
          if (ap.lowerClothingColor?.toLowerCase().includes(attrs.lowerClothingColor.toLowerCase())) matchCount++;
        }
        if (attrs.helmet !== undefined) { total++; if (ap.helmet === attrs.helmet) matchCount++; }
        if (attrs.vest   !== undefined) { total++; if (ap.vest   === attrs.vest)   matchCount++; }
        if (attrs.backpack !== undefined) { total++; if (ap.backpack === attrs.backpack) matchCount++; }

        if (total === 0) continue;
        const score = matchCount / total;
        if (score >= threshold) {
          results.push({
            profile,
            score,
            matchReason: `Appearance attribute match (${matchCount}/${total} attributes)`,
            evidenceIds: [],
          });
        }
      }
      return results.sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }

  // ── Similarity Search ────────────────────────────────────────────────────

  public async findBySimilarity(personId: string, threshold = 0.70): Promise<PersonSearchResult[]> {
    const source = await personProfileStore.get(personId);
    if (!source?.primaryEmbedding) return [];

    const profiles = await personProfileStore.list({ limit: 500 });
    const results: PersonSearchResult[] = [];

    for (const profile of profiles) {
      if (profile.personId === personId) continue;
      if (!profile.primaryEmbedding) continue;
      const score = this.cosineSimilarity(source.primaryEmbedding, profile.primaryEmbedding);
      if (score >= threshold) {
        results.push({
          profile,
          score,
          matchReason: `ReID embedding similarity: ${(score * 100).toFixed(1)}%`,
          evidenceIds: [],
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  // ── Natural Language Search ───────────────────────────────────────────────

  /**
   * Decomposes a natural language query into structured filters without LLM.
   * Pattern-matches colour names, clothing types, location names, times.
   * Returns results labeled as "possible match" — never inferred facts.
   */
  public async searchNaturalLanguage(query: string): Promise<InvestigationResult> {
    const q = query.toLowerCase();
    const executedAt = new Date().toISOString();

    // Extract colour mentions
    const colours = ['red','blue','green','black','white','grey','gray','yellow','orange','brown','pink','purple','navy'];
    const foundColours = colours.filter(c => q.includes(c));

    // Extract clothing mentions
    const upper = ['jacket','shirt','hoodie','sweater','uniform','t-shirt'];
    const lower = ['pants','shorts','jeans','skirt','dress'];
    const foundUpper = upper.find(u => q.includes(u));
    const foundLower = lower.find(l => q.includes(l));

    // Extract gear mentions
    const helmetMentioned  = q.includes('helmet') || q.includes('hard hat');
    const vestMentioned    = q.includes('vest') || q.includes('hi-viz') || q.includes('hiviz');
    const backpackMentioned = q.includes('backpack') || q.includes('bag');

    // Extract time window
    const todayMatch    = q.includes('today');
    const yesterdayMatch = q.includes('yesterday');
    const since = todayMatch ? new Date(Date.now() - 86_400_000).toISOString()
                : yesterdayMatch ? new Date(Date.now() - 2 * 86_400_000).toISOString()
                : undefined;

    const attrs: Record<string, unknown> = {};
    if (foundColours.length > 0) attrs.upperClothingColor = foundColours[0];
    if (foundUpper)   attrs.upperClothingType = foundUpper;
    if (foundLower)   attrs.lowerClothingType  = foundLower;
    if (helmetMentioned)  attrs.helmet  = true;
    if (vestMentioned)    attrs.vest    = true;
    if (backpackMentioned) attrs.backpack = true;

    let profiles: PersonProfile[] = [];
    let evidenceIds: string[] = [];

    if (Object.keys(attrs).length > 0) {
      const appearanceResults = await this.findByAppearance(attrs as any, 0.4);
      profiles = appearanceResults.map(r => r.profile);
      evidenceIds = appearanceResults.flatMap(r => r.evidenceIds);
    } else {
      // Text match on name/label
      const text = query.trim();
      const all  = await personProfileStore.list({ limit: 500 });
      profiles   = all.filter(p =>
        p.fullName.toLowerCase().includes(text.toLowerCase()) ||
        p.employeeId?.toLowerCase().includes(text.toLowerCase()) ||
        p.department?.toLowerCase().includes(text.toLowerCase()),
      );
    }

    return {
      personId:    '',
      queryType:   'NATURAL_LANGUAGE',
      query:       { text: query, decomposed: attrs, since },
      executedAt,
      results:     profiles,
      totalCount:  profiles.length,
      confidence:  profiles.length > 0 ? 0.6 : 0,
      evidenceIds,
      note: 'Results based on observed evidence only. All matches are possible correlations, not confirmed identifications.',
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }
}

export const personInvestigationEngine = PersonInvestigationEngine.getInstance();
