/**
 * PersonTimelineEngine
 *
 * Maintains a chronological audit trail of every observed event per person.
 * All entries originate from real AI events — no synthetic records.
 *
 * Sources (subscribed, not polled):
 *  - vmsEventService.subscribeToAll()  → DETECTION, MOVEMENT, RECOGNITION, ALARM
 *  - analyticsPlatform.onEvent()       → ANALYTICS_EVENT (PPE, fire, crowd, vehicle, etc.)
 *  - personProfileStore events         → OPERATOR_ACTION entries (added externally)
 *
 * Storage: Firestore `personTimeline/{personId}/entries` subcollection.
 * Performance: Per-person in-process ring buffer (last 200 entries).
 */

import {
  collection, addDoc, getDocs, query, where,
  orderBy, limit as fsLimit,
} from 'firebase/firestore';
import { db } from '../firestoreService';
import { vmsEventService } from '../vmsEventService';
import { analyticsPlatform } from '../analytics/AnalyticsPlatform';
import { personProfileStore } from './PersonProfileStore';
import type { TimelineEntry, TimelineEntryType } from './types/PersonProfile';

const RING_BUFFER_MAX = 200;

// ─────────────────────────────────────────────────────────────────────────────

class PersonTimelineEngineService {
  private static instance: PersonTimelineEngineService;

  /** personId → ring buffer of recent timeline entries */
  private ringBuffers: Map<string, TimelineEntry[]> = new Map();

  private unsubscribeVms?: () => void;
  private unsubscribeAnalytics?: () => void;
  private entryCounter = 0;

  private constructor() {}

  public static getInstance(): PersonTimelineEngineService {
    if (!PersonTimelineEngineService.instance) {
      PersonTimelineEngineService.instance = new PersonTimelineEngineService();
    }
    return PersonTimelineEngineService.instance;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  public start(): void {
    // ── VMS event bus subscription ──────────────────────────────────────────
    this.unsubscribeVms = vmsEventService.subscribeToAll((event) => {
      this.handleVmsEvent(event.type, event.source, event.payload as Record<string, unknown>).catch(() => {});
    });

    // ── Analytics platform subscription ─────────────────────────────────────
    this.unsubscribeAnalytics = analyticsPlatform.onEvent((event) => {
      this.handleAnalyticsEvent(event).catch(() => {});
    });

    console.log('[PersonTimelineEngine] Started. Subscribed to VMS event bus and Analytics platform.');
  }

  public stop(): void {
    this.unsubscribeVms?.();
    this.unsubscribeAnalytics?.();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Get timeline entries for a person (from ring buffer + Firestore) */
  public async getTimeline(personId: string, opts: {
    types?:     TimelineEntryType[];
    cameraId?:  string;
    since?:     string;
    until?:     string;
    limit?:     number;
    offset?:    number;
  } = {}): Promise<TimelineEntry[]> {
    const { types, cameraId, since, until, limit: lim = 100 } = opts;

    // 1. From ring buffer (recent, fast)
    const ring = this.ringBuffers.get(personId) ?? [];
    let combined: TimelineEntry[] = [...ring];

    // 2. From Firestore (historical)
    const firestoreEntries = await this.fetchFromFirestore(personId, { since, until, lim: 500 });
    const ringIds = new Set(ring.map(e => e.entryId));
    combined = [...combined, ...firestoreEntries.filter(e => !ringIds.has(e.entryId))];

    // 3. Apply filters
    if (types?.length)  combined = combined.filter(e => types.includes(e.type));
    if (cameraId)       combined = combined.filter(e => e.cameraId === cameraId);
    if (since)          combined = combined.filter(e => e.timestamp >= since);
    if (until)          combined = combined.filter(e => e.timestamp <= until);

    // 4. Sort desc and paginate
    combined.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return combined.slice(opts.offset ?? 0, (opts.offset ?? 0) + lim);
  }

  /** Manually add an operator-created entry (note, watchlist action, etc.) */
  public async addEntry(entry: Omit<TimelineEntry, 'entryId'>): Promise<TimelineEntry> {
    const full: TimelineEntry = {
      ...entry,
      entryId: `TE-${Date.now()}-${++this.entryCounter}`,
    };
    await this.persist(full);
    return full;
  }

  /** Get the count of incidents (alarms + analytics events) for a person */
  public async getIncidentCount(personId: string): Promise<number> {
    const ring = this.ringBuffers.get(personId) ?? [];
    const incidentTypes: TimelineEntryType[] = ['ALARM', 'ANALYTICS_EVENT'];
    return ring.filter(e => incidentTypes.includes(e.type)).length;
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private async handleVmsEvent(eventType: string, source: string, payload: Record<string, unknown>): Promise<void> {
    const trackId = String(payload?.trackId ?? payload?.track_id ?? '');
    if (!trackId) return;

    const personId = personProfileStore.resolveTrackId(trackId);
    if (!personId) return; // Unknown track — ignore

    const cameraId = String(payload?.cameraId ?? '');
    const timestamp = typeof payload?.timestamp === 'number'
      ? new Date(payload.timestamp).toISOString()
      : (String(payload?.timestamp ?? new Date().toISOString()));

    let type: TimelineEntryType;
    let title: string;
    let description: string;
    let severity: TimelineEntry['severity'];

    switch (eventType) {
      case 'PERSON_DETECTED':
        type = 'DETECTION';
        title = 'Person Detected';
        description = `Detected on camera ${cameraId}. Confidence: ${((Number(payload?.confidence ?? 0)) * 100).toFixed(1)}%.`;
        break;
      case 'FACE_RECOGNIZED':
        type = 'RECOGNITION';
        title = 'Face Recognized';
        description = `Identity confirmed by biometric engine. Confidence: ${((Number(payload?.confidence ?? 0)) * 100).toFixed(1)}%.`;
        break;
      case 'ZONE_ENTERED':
      case 'ZONE_EXITED':
        type = 'MOVEMENT';
        title = eventType === 'ZONE_ENTERED' ? 'Zone Entered' : 'Zone Exited';
        description = `${eventType === 'ZONE_ENTERED' ? 'Entered' : 'Exited'} zone "${payload?.zoneName ?? payload?.zoneId}" on camera ${cameraId}.`;
        break;
      default:
        return; // Unhandled event type — skip
    }

    await this.persist({
      entryId:     `TE-${Date.now()}-${++this.entryCounter}`,
      personId,
      type,
      timestamp,
      cameraId,
      trackId,
      confidence:  Number(payload?.confidence ?? 0),
      severity,
      title,
      description,
      evidenceIds: [],
      metadata:    { eventType, source, payload },
    });
  }

  private async handleAnalyticsEvent(event: {
    id: string; type: string; timestamp: string; cameraId: string; cameraName: string;
    location: string; confidence: number; trackId?: string; data: unknown;
  }): Promise<void> {
    if (!event.trackId) return;

    const personId = personProfileStore.resolveTrackId(event.trackId);
    if (!personId) return;

    // Map analytics severity
    const criticalTypes = ['FIRE_DETECTED', 'SMOKE_DETECTED', 'EXPLOSION_DETECTED', 'INTRUSION_DETECTED'];
    const warningTypes  = ['PPE_VIOLATION', 'HELMET_MISSING', 'VEST_MISSING', 'LOITERING_DETECTED', 'ABANDONED_OBJECT_DETECTED'];
    const severity: TimelineEntry['severity'] = criticalTypes.includes(event.type) ? 'CRITICAL'
      : warningTypes.includes(event.type) ? 'WARNING' : 'INFO';

    const eventLabel = event.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    await this.persist({
      entryId:           `TE-${Date.now()}-${++this.entryCounter}`,
      personId,
      type:              'ANALYTICS_EVENT',
      timestamp:         event.timestamp,
      cameraId:          event.cameraId,
      cameraName:        event.cameraName,
      location:          event.location,
      trackId:           event.trackId,
      confidence:        event.confidence,
      severity,
      title:             eventLabel,
      description:       `Analytics event: ${eventLabel} on ${event.cameraName}. Confidence: ${(event.confidence * 100).toFixed(1)}%.`,
      evidenceIds:       [],
      analyticsEventId:  event.id,
      metadata:          { analyticsEvent: event.data },
    });
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private async persist(entry: TimelineEntry): Promise<void> {
    // 1. Add to ring buffer
    const ring = this.ringBuffers.get(entry.personId) ?? [];
    ring.unshift(entry);
    if (ring.length > RING_BUFFER_MAX) ring.pop();
    this.ringBuffers.set(entry.personId, ring);

    // 2. Persist to Firestore subcollection (non-blocking)
    this.persistToFirestore(entry).catch(() => {});
  }

  private async persistToFirestore(entry: TimelineEntry): Promise<void> {
    try {
      await addDoc(
        collection(db, 'personTimeline', entry.personId, 'entries'),
        JSON.parse(JSON.stringify(entry)),
      );
    } catch { /* Non-fatal */ }
  }

  private async fetchFromFirestore(personId: string, opts: { since?: string; until?: string; lim: number }): Promise<TimelineEntry[]> {
    try {
      let q = query(
        collection(db, 'personTimeline', personId, 'entries'),
        orderBy('timestamp', 'desc'),
        fsLimit(opts.lim),
      );
      if (opts.since) q = query(q, where('timestamp', '>=', opts.since));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as TimelineEntry);
    } catch { return []; }
  }
}

export const personTimelineEngine = PersonTimelineEngineService.getInstance();
