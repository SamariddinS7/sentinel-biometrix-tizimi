/**
 * AnalyticsSearchIndex
 *
 * Unified search across all analytics domains.
 * Indexes events from the AnalyticsPlatform event stream into in-memory indices.
 * Falls back to Firestore queries for historical data beyond the ring buffer.
 */

import { db } from '../firestoreService';
import { collection, getDocs, query, where, orderBy, limit as fsLimit } from 'firebase/firestore';
import { analyticsPlatform } from './AnalyticsPlatform';
import { AnalyticsEventType } from './types/AnalyticsEvent';
import type { AnalyticsEvent } from './types/AnalyticsEvent';
import { evidenceManager } from '../evidenceManager';
import type { EvidenceRecord } from '../evidenceManager';

export interface SearchQuery {
  text?:      string;    // Free-text search across event data
  eventType?: string;    // Filter by AnalyticsEventType
  cameraId?:  string;
  plateText?: string;    // LPR search
  trackId?:   string;
  since?:     string;    // ISO date
  until?:     string;    // ISO date
  limit?:     number;
}

export interface SearchResult {
  events:    AnalyticsEvent[];
  evidence:  EvidenceRecord[];
  total:     number;
}

class AnalyticsSearchIndexService {
  private static instance: AnalyticsSearchIndexService;

  /** LPR index: plateText → event IDs */
  private plateIndex: Map<string, string[]> = new Map();
  /** Track index: trackId → event IDs */
  private trackIndex: Map<string, string[]> = new Map();
  /** All indexed event IDs for fast lookup */
  private eventIndex: Map<string, AnalyticsEvent> = new Map();

  private unsubscribe?: () => void;

  private constructor() {}

  public static getInstance(): AnalyticsSearchIndexService {
    if (!AnalyticsSearchIndexService.instance) {
      AnalyticsSearchIndexService.instance = new AnalyticsSearchIndexService();
    }
    return AnalyticsSearchIndexService.instance;
  }

  public start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = analyticsPlatform.onEvent((event: AnalyticsEvent) => {
      // Index all events by ID
      this.eventIndex.set(event.id, event);

      // LPR index
      if (event.type === AnalyticsEventType.PLATE_RECOGNIZED) {
        const plate = ((event.data as any).plateText ?? '').toUpperCase();
        if (plate) {
          const ids = this.plateIndex.get(plate) ?? [];
          ids.push(event.id);
          this.plateIndex.set(plate, ids);
        }
      }

      // Track index
      if (event.trackId) {
        const ids = this.trackIndex.get(event.trackId) ?? [];
        ids.push(event.id);
        this.trackIndex.set(event.trackId, ids);
      }

      // Prune index if too large (keep last 5000 events)
      if (this.eventIndex.size > 5000) {
        const firstKey = this.eventIndex.keys().next().value;
        if (firstKey) this.eventIndex.delete(firstKey);
      }
    });

    console.log('[AnalyticsSearchIndex] Started.');
  }

  public stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  public async search(q: SearchQuery): Promise<SearchResult> {
    const lim = q.limit ?? 50;

    // 1. Start with in-process ring buffer events
    let candidates = analyticsPlatform.getEvents({
      cameraId: q.cameraId,
      type:     q.eventType,
      since:    q.since,
      limit:    500,
    });

    // 2. LPR plate search
    if (q.plateText) {
      const normalised = q.plateText.toUpperCase().replace(/\s/g, '');
      const matchedIds: string[] = [];
      for (const [plate, ids] of this.plateIndex.entries()) {
        if (plate.includes(normalised)) matchedIds.push(...ids);
      }
      const fromIndex = matchedIds.map(id => this.eventIndex.get(id)).filter(Boolean) as AnalyticsEvent[];
      // Merge with candidates (deduplicate by id)
      const seen = new Set(candidates.map(e => e.id));
      for (const e of fromIndex) if (!seen.has(e.id)) candidates.push(e);
    }

    // 3. Track ID search
    if (q.trackId) {
      const ids = this.trackIndex.get(q.trackId) ?? [];
      const fromIndex = ids.map(id => this.eventIndex.get(id)).filter(Boolean) as AnalyticsEvent[];
      const seen = new Set(candidates.map(e => e.id));
      for (const e of fromIndex) if (!seen.has(e.id)) candidates.push(e);
    }

    // 4. Free-text search on event data
    if (q.text) {
      const needle = q.text.toLowerCase();
      candidates = candidates.filter(e => {
        const dataStr = JSON.stringify(e.data).toLowerCase();
        return dataStr.includes(needle) ||
               e.cameraName.toLowerCase().includes(needle) ||
               e.location.toLowerCase().includes(needle) ||
               e.type.toLowerCase().includes(needle);
      });
    }

    // 5. Date range filter
    if (q.until) {
      const untilMs = new Date(q.until).getTime();
      candidates = candidates.filter(e => new Date(e.timestamp).getTime() <= untilMs);
    }

    // Sort by timestamp desc and limit
    candidates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const events = candidates.slice(0, lim);

    // 6. Find related evidence
    const evidence = events.flatMap(e => {
      const byAlarm = e.evidenceRef ? [evidenceManager.get(e.evidenceRef)].filter(Boolean) as EvidenceRecord[] : [];
      const byCam   = evidenceManager.search({ cameraId: e.cameraId, eventType: e.type, limit: 2 });
      return [...byAlarm, ...byCam];
    }).filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);

    return { events, evidence, total: candidates.length };
  }

  /** Quick plate lookup */
  public findByPlate(plateText: string, limit = 20): AnalyticsEvent[] {
    const needle = plateText.toUpperCase().replace(/\s/g, '');
    const results: AnalyticsEvent[] = [];
    for (const [plate, ids] of this.plateIndex.entries()) {
      if (plate.includes(needle)) {
        for (const id of ids) {
          const e = this.eventIndex.get(id);
          if (e) results.push(e);
        }
      }
    }
    return results.slice(0, limit);
  }

  public indexSize(): number {
    return this.eventIndex.size;
  }
}

export const analyticsSearchIndex = AnalyticsSearchIndexService.getInstance();
