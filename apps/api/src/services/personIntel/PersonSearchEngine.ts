/**
 * PersonSearchEngine
 *
 * Unified search across all person intelligence data.
 *
 * Maintains in-memory indices (rebuilt on start + updated on profile changes):
 *  - Text index:   name / label / employeeId / department → personId
 *  - Camera index: cameraId → Set<personId>
 *  - Zone index:   zoneId   → Set<personId>
 *
 * Delegates to specialist engines for face/appearance/similarity/evidence.
 *
 * All results carry a `matchReason` and supporting evidence IDs.
 * Results that are not confirmed identifications are labeled accordingly.
 */

import { personProfileStore } from './PersonProfileStore';
import { personTimelineEngine } from './PersonTimelineEngine';
import { personInvestigationEngine } from './PersonInvestigationEngine';
import { evidenceManager } from '../evidenceManager';
import type {
  PersonSearchQuery, PersonSearchResult,
  PersonProfile, TimelineEntryType,
} from './types/PersonProfile';

// ─────────────────────────────────────────────────────────────────────────────

class PersonSearchEngineService {
  private static instance: PersonSearchEngineService;

  /** Text tokens → Set<personId> */
  private textIndex: Map<string, Set<string>> = new Map();
  /** cameraId → Set<personId> */
  private cameraIndex: Map<string, Set<string>> = new Map();
  /** zoneId → Set<personId> */
  private zoneIndex: Map<string, Set<string>> = new Map();

  private ready = false;
  private indexCounter = 0;

  private constructor() {}

  public static getInstance(): PersonSearchEngineService {
    if (!PersonSearchEngineService.instance) {
      PersonSearchEngineService.instance = new PersonSearchEngineService();
    }
    return PersonSearchEngineService.instance;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    await this.rebuildIndices();
    this.ready = true;
    console.log(`[PersonSearchEngine] Indices built. ${this.textIndex.size} text tokens, ${this.cameraIndex.size} cameras.`);
  }

  public async rebuildIndices(): Promise<void> {
    this.textIndex.clear();
    this.cameraIndex.clear();
    this.zoneIndex.clear();

    const profiles = await personProfileStore.list({ limit: 2_000 });
    for (const profile of profiles) {
      this.indexProfile(profile);
    }
  }

  public indexProfile(profile: PersonProfile): void {
    // Text index
    const tokens = this.tokenize([
      profile.fullName,
      profile.employeeId ?? '',
      profile.department ?? '',
      profile.organization ?? '',
      profile.position ?? '',
      profile.personId,
    ].join(' '));

    for (const token of tokens) {
      if (!this.textIndex.has(token)) this.textIndex.set(token, new Set());
      this.textIndex.get(token)!.add(profile.personId);
    }

    // Camera index
    for (const visit of profile.cameraHistory ?? []) {
      if (!this.cameraIndex.has(visit.cameraId)) this.cameraIndex.set(visit.cameraId, new Set());
      this.cameraIndex.get(visit.cameraId)!.add(profile.personId);
    }

    // Zone index
    for (const zoneId of profile.visitedZones ?? []) {
      if (!this.zoneIndex.has(zoneId)) this.zoneIndex.set(zoneId, new Set());
      this.zoneIndex.get(zoneId)!.add(profile.personId);
    }

    this.indexCounter++;
  }

  // ── Unified Search ────────────────────────────────────────────────────────

  public async search(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    const { mode } = query;

    switch (mode) {
      case 'FACE_SEARCH':
        if (!query.faceDescriptor) return [];
        return personInvestigationEngine.findByFace(query.faceDescriptor, query.similarityThreshold);

      case 'APPEARANCE_SEARCH':
        return personInvestigationEngine.findByAppearance(
          query.appearanceAttrs as any ?? {},
          query.similarityThreshold ?? 0.5,
        );

      case 'PERSON_SEARCH':
        return this.textSearch(query);

      case 'TIMELINE_SEARCH':
        return this.timelineSearch(query);

      case 'EVIDENCE_SEARCH':
        return this.evidenceSearch(query);

      case 'MOVEMENT_SEARCH':
        return this.movementSearch(query);

      case 'SIMILARITY_SEARCH':
        if (!query.similarToPersonId) return [];
        return personInvestigationEngine.findBySimilarity(
          query.similarToPersonId,
          query.similarityThreshold ?? 0.70,
        );

      case 'NATURAL_LANGUAGE':
        if (!query.text) return [];
        const nlResult = await personInvestigationEngine.searchNaturalLanguage(query.text);
        return nlResult.results.map(p => ({
          profile:     p,
          score:       0.6,
          matchReason: 'Natural language query match (possible correlation)',
          evidenceIds: nlResult.evidenceIds,
        }));

      case 'HYBRID_SEARCH':
        return this.hybridSearch(query);

      default:
        return this.textSearch(query);
    }
  }

  // ── Search Implementations ────────────────────────────────────────────────

  private async textSearch(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    if (!query.text) {
      // No text → return recent profiles
      const profiles = await personProfileStore.list({
        status: query.status,
        limit: query.limit ?? 50,
      });
      return profiles.map(p => ({ profile: p, score: 1.0, matchReason: 'Listed by recency', evidenceIds: [] }));
    }

    const tokens = this.tokenize(query.text);
    const scoreMap = new Map<string, number>();

    for (const token of tokens) {
      const matched = this.textIndex.get(token) ?? new Set();
      for (const personId of matched) {
        scoreMap.set(personId, (scoreMap.get(personId) ?? 0) + 1);
      }
    }

    // Also check for camera/zone text match
    if (query.cameraId) {
      const cameraMatches = this.cameraIndex.get(query.cameraId) ?? new Set();
      for (const personId of cameraMatches) {
        scoreMap.set(personId, (scoreMap.get(personId) ?? 0) + 0.5);
      }
    }

    const ranked = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, query.limit ?? 50);

    const results: PersonSearchResult[] = [];
    for (const [personId, rawScore] of ranked) {
      const profile = await personProfileStore.get(personId);
      if (!profile) continue;
      if (query.status && profile.status !== query.status) continue;
      results.push({
        profile,
        score:       Math.min(1.0, rawScore / tokens.length),
        matchReason: `Text match on name/ID/department`,
        evidenceIds: [],
      });
    }
    return results;
  }

  private async timelineSearch(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    const profiles = await personProfileStore.list({ status: query.status, limit: 200 });
    const results: PersonSearchResult[] = [];

    for (const profile of profiles) {
      const entries = await personTimelineEngine.getTimeline(profile.personId, {
        since: query.since,
        until: query.until,
        cameraId: query.cameraId,
        limit: 1,
      });
      if (entries.length > 0) {
        results.push({
          profile,
          score:       0.8,
          matchReason: `Has ${entries.length}+ timeline entries in search window`,
          evidenceIds: entries.flatMap(e => e.evidenceIds),
        });
      }
    }

    return results.slice(0, query.limit ?? 50);
  }

  private async evidenceSearch(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    const evidence = evidenceManager.search({
      cameraId: query.cameraId,
      since:    query.since,
      limit:    200,
    });

    const personIdSet = new Set<string>();
    const evidenceByPerson = new Map<string, string[]>();

    for (const ev of evidence) {
      const trackId  = ev.trackId ?? '';
      const personId = personProfileStore.resolveTrackId(trackId) ?? ev.metadata?.personId as string;
      if (!personId) continue;
      personIdSet.add(personId);
      const evIds = evidenceByPerson.get(personId) ?? [];
      evIds.push(ev.id);
      evidenceByPerson.set(personId, evIds);
    }

    const results: PersonSearchResult[] = [];
    for (const personId of personIdSet) {
      const profile = await personProfileStore.get(personId);
      if (!profile) continue;
      results.push({
        profile,
        score:       0.85,
        matchReason: `Linked to ${evidenceByPerson.get(personId)?.length ?? 0} evidence records`,
        evidenceIds: evidenceByPerson.get(personId) ?? [],
      });
    }
    return results.slice(0, query.limit ?? 50);
  }

  private async movementSearch(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    const results: PersonSearchResult[] = [];
    let personIds: string[] = [];

    if (query.cameraId) {
      personIds = Array.from(this.cameraIndex.get(query.cameraId) ?? new Set());
    } else if (query.zoneId) {
      personIds = Array.from(this.zoneIndex.get(query.zoneId) ?? new Set());
    } else {
      const all = await personProfileStore.list({ limit: 200 });
      personIds = all.map(p => p.personId);
    }

    for (const personId of personIds.slice(0, query.limit ?? 50)) {
      const profile = await personProfileStore.get(personId);
      if (!profile) continue;
      if (query.status && profile.status !== query.status) continue;

      const visitedCamera = !query.cameraId || profile.cameraHistory.some(v => v.cameraId === query.cameraId);
      const visitedZone   = !query.zoneId   || profile.visitedZones.includes(query.zoneId);

      if (visitedCamera && visitedZone) {
        results.push({
          profile,
          score:       0.9,
          matchReason: [
            query.cameraId ? `Visited camera ${query.cameraId}` : '',
            query.zoneId   ? `Visited zone ${query.zoneId}`     : '',
          ].filter(Boolean).join('; '),
          evidenceIds: [],
        });
      }
    }
    return results;
  }

  private async hybridSearch(query: PersonSearchQuery): Promise<PersonSearchResult[]> {
    const searchModes: Array<Promise<PersonSearchResult[]>> = [];

    if (query.text)          searchModes.push(this.textSearch({ ...query, mode: 'PERSON_SEARCH' }));
    if (query.cameraId || query.zoneId) searchModes.push(this.movementSearch({ ...query, mode: 'MOVEMENT_SEARCH' }));
    if (query.faceDescriptor) searchModes.push(personInvestigationEngine.findByFace(query.faceDescriptor, query.similarityThreshold));
    if (query.appearanceAttrs) searchModes.push(personInvestigationEngine.findByAppearance(query.appearanceAttrs as any));

    if (searchModes.length === 0) return this.textSearch(query);

    const allResults = await Promise.all(searchModes);
    const mergedScores = new Map<string, PersonSearchResult>();

    for (const resultSet of allResults) {
      for (const r of resultSet) {
        const existing = mergedScores.get(r.profile.personId);
        if (!existing) {
          mergedScores.set(r.profile.personId, { ...r });
        } else {
          // Boost score for multi-signal matches
          existing.score = Math.min(1.0, existing.score + r.score * 0.3);
          existing.matchReason = [existing.matchReason, r.matchReason].join(' + ');
          existing.evidenceIds = [...new Set([...existing.evidenceIds, ...r.evidenceIds])];
        }
      }
    }

    return Array.from(mergedScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit ?? 50);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .split(/[\s,.\-_\/]+/)
      .filter(t => t.length >= 2)
      .map(t => t.trim());
  }

  public indexSize(): { text: number; cameras: number; zones: number } {
    return {
      text:    this.textIndex.size,
      cameras: this.cameraIndex.size,
      zones:   this.zoneIndex.size,
    };
  }
}

export const personSearchEngine = PersonSearchEngineService.getInstance();
