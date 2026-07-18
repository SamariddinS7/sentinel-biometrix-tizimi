/**
 * Enterprise Analytics Alarm Service
 *
 * Manages the full lifecycle of analytics-generated alarms:
 * creation → acknowledgement → assignment → escalation → resolution.
 * Persists every state change to Firestore and publishes to vmsEventService.
 *
 * Supports CRITICAL / HIGH / MEDIUM / LOW severity levels.
 * NEVER generates fake alarms — every alarm originates from a real AI or sensor detection.
 */

import { db } from './firestoreService';
import {
  collection, addDoc, updateDoc, getDocs,
  doc, query, where
} from 'firebase/firestore';
import { vmsEventService } from './vmsEventService';
import type { BoundingBox } from './ai/interfaces';

export type AlarmSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlarmStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED';

export interface AlarmTimelineEntry {
  timestamp : string;
  action    : 'CREATED' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'ESCALATED' | 'RESOLVED' | 'COMMENT';
  operator ?: string;
  note     ?: string;
}

export interface AnalyticsAlarm {
  id            : string;
  type          : string;         // e.g. 'FIRE_DETECTED', 'PPE_VIOLATION'
  severity      : AlarmSeverity;
  status        : AlarmStatus;
  cameraId      : string;
  location     ?: string;
  confidence    : number;
  aiModelVersion: string;
  evidenceRefs  : string[];       // Links to EvidenceRecord IDs
  boundingBoxes?: BoundingBox[];
  trackId      ?: string;
  createdAt     : string;
  updatedAt     : string;
  assignedTo   ?: string;
  resolvedBy   ?: string;
  resolvedAt   ?: string;
  timeline      : AlarmTimelineEntry[];
  description   : string;
  payload       : Record<string, any>;
}

/** Severity → alarm delay threshold (seconds of sustained detection before alarm fires) */
const SEVERITY_DELAY_MAP: Record<string, number> = {
  FIRE_DETECTED             : 2,
  SMOKE_DETECTED            : 3,
  EXPLOSION_DETECTED        : 0,   // Instant
  GAS_LEAK_DETECTED         : 2,
  SPARK_DETECTED            : 1,
  FLOOD_DETECTED            : 5,
  WATER_LEAK_DETECTED       : 10,
  CHEMICAL_SPILL_DETECTED   : 4,
  HAZARD_DETECTED           : 2,
  PPE_VIOLATION             : 0,
  INTRUSION_DETECTED        : 0,
  LOITERING_DETECTED        : 30,
  ABANDONED_OBJECT_DETECTED : 60,
  CROWD_DETECTED            : 5,
  VEHICLE_DETECTED          : 0,
  PLATE_RECOGNIZED          : 0,
};

class AnalyticsAlarmService {
  private static instance: AnalyticsAlarmService;
  private alarms: Map<string, AnalyticsAlarm> = new Map();
  private counter = 0;

  /** Deduplication: suppress repeated alarms of same type+camera within cooldown window (ms) */
  private readonly COOLDOWN_MS = 30_000;
  private lastFiredAt: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): AnalyticsAlarmService {
    if (!AnalyticsAlarmService.instance) {
      AnalyticsAlarmService.instance = new AnalyticsAlarmService();
    }
    return AnalyticsAlarmService.instance;
  }

  /**
   * Create a new alarm. Returns null if the same alarm type was recently
   * created for the same camera (cooldown deduplication).
   */
  public createAlarm(params: {
    type          : string;
    severity      : AlarmSeverity;
    cameraId      : string;
    confidence    : number;
    aiModelVersion?: string;
    location      ?: string;
    boundingBoxes ?: BoundingBox[];
    trackId       ?: string;
    description    : string;
    payload       ?: Record<string, any>;
    evidenceRefs  ?: string[];
    skipCooldown  ?: boolean;
  }): AnalyticsAlarm | null {
    const dedupKey = `${params.cameraId}:${params.type}`;
    const now      = Date.now();

    if (!params.skipCooldown) {
      const last = this.lastFiredAt.get(dedupKey);
      if (last && now - last < this.COOLDOWN_MS) return null;
    }
    this.lastFiredAt.set(dedupKey, now);

    this.counter++;
    const id      = `ALM-${String(this.counter).padStart(6, '0')}`;
    const nowIso  = new Date(now).toISOString();

    const alarm: AnalyticsAlarm = {
      id,
      type          : params.type,
      severity      : params.severity,
      status        : 'ACTIVE',
      cameraId      : params.cameraId,
      location      : params.location,
      confidence    : params.confidence,
      aiModelVersion: params.aiModelVersion ?? 'sentinel-analytics-1.0',
      evidenceRefs  : params.evidenceRefs ?? [],
      boundingBoxes : params.boundingBoxes,
      trackId       : params.trackId,
      createdAt     : nowIso,
      updatedAt     : nowIso,
      timeline      : [{ timestamp: nowIso, action: 'CREATED', note: params.description }],
      description   : params.description,
      payload       : params.payload ?? {},
    };

    this.alarms.set(id, alarm);
    this.persistToFirestore(alarm).catch(() => {});

    vmsEventService.emit(
      'ANALYTICS_ALARM_CREATED',
      'AnalyticsAlarmService',
      { alarmId: id, type: params.type, severity: params.severity, cameraId: params.cameraId },
      params.severity === 'CRITICAL' ? 'CRITICAL' : params.severity === 'HIGH' ? 'WARNING' : 'INFO',
    );

    return alarm;
  }

  public acknowledgeAlarm(alarmId: string, operator: string, note?: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status === 'RESOLVED') return false;
    alarm.status    = 'ACKNOWLEDGED';
    alarm.updatedAt = new Date().toISOString();
    alarm.timeline.push({ timestamp: alarm.updatedAt, action: 'ACKNOWLEDGED', operator, note });
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public assignAlarm(alarmId: string, operator: string, assignTo: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status === 'RESOLVED') return false;
    alarm.status     = 'ASSIGNED';
    alarm.assignedTo = assignTo;
    alarm.updatedAt  = new Date().toISOString();
    alarm.timeline.push({ timestamp: alarm.updatedAt, action: 'ASSIGNED', operator, note: `Assigned to ${assignTo}` });
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public escalateAlarm(alarmId: string, operator: string, note?: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status === 'RESOLVED') return false;
    alarm.status = 'ESCALATED';
    // Bump severity one level up
    if      (alarm.severity === 'LOW')    alarm.severity = 'MEDIUM';
    else if (alarm.severity === 'MEDIUM') alarm.severity = 'HIGH';
    else if (alarm.severity === 'HIGH')   alarm.severity = 'CRITICAL';
    alarm.updatedAt = new Date().toISOString();
    alarm.timeline.push({ timestamp: alarm.updatedAt, action: 'ESCALATED', operator, note });
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public resolveAlarm(alarmId: string, operator: string, note?: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm || alarm.status === 'RESOLVED') return false;
    alarm.status     = 'RESOLVED';
    alarm.resolvedBy = operator;
    alarm.resolvedAt = new Date().toISOString();
    alarm.updatedAt  = alarm.resolvedAt;
    alarm.timeline.push({ timestamp: alarm.updatedAt, action: 'RESOLVED', operator, note });
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public addComment(alarmId: string, operator: string, note: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm) return false;
    alarm.updatedAt = new Date().toISOString();
    alarm.timeline.push({ timestamp: alarm.updatedAt, action: 'COMMENT', operator, note });
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public attachEvidence(alarmId: string, evidenceId: string): boolean {
    const alarm = this.alarms.get(alarmId);
    if (!alarm) return false;
    if (!alarm.evidenceRefs.includes(evidenceId)) alarm.evidenceRefs.push(evidenceId);
    alarm.updatedAt = new Date().toISOString();
    this.persistToFirestore(alarm).catch(() => {});
    return true;
  }

  public getAlarm(id: string): AnalyticsAlarm | undefined {
    return this.alarms.get(id);
  }

  public getAlarms(filters?: {
    status   ?: AlarmStatus;
    severity ?: AlarmSeverity;
    cameraId ?: string;
    type     ?: string;
    limit    ?: number;
  }): AnalyticsAlarm[] {
    let results = Array.from(this.alarms.values());
    if (filters?.status)   results = results.filter(a => a.status   === filters.status);
    if (filters?.severity) results = results.filter(a => a.severity === filters.severity);
    if (filters?.cameraId) results = results.filter(a => a.cameraId === filters.cameraId);
    if (filters?.type)     results = results.filter(a => a.type     === filters.type);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filters?.limit)    results = results.slice(0, filters.limit);
    return results;
  }

  public getStatistics(): {
    total      : number;
    active     : number;
    acknowledged: number;
    assigned   : number;
    escalated  : number;
    resolved   : number;
    bySeverity : Record<AlarmSeverity, number>;
    byType     : Record<string, number>;
  } {
    const list = Array.from(this.alarms.values());
    const bySeverity: Record<AlarmSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byType    : Record<string, number> = {};
    let active = 0, acknowledged = 0, assigned = 0, escalated = 0, resolved = 0;

    for (const a of list) {
      bySeverity[a.severity]++;
      byType[a.type] = (byType[a.type] || 0) + 1;
      switch (a.status) {
        case 'ACTIVE':        active++;        break;
        case 'ACKNOWLEDGED':  acknowledged++;  break;
        case 'ASSIGNED':      assigned++;      break;
        case 'ESCALATED':     escalated++;     break;
        case 'RESOLVED':      resolved++;      break;
      }
    }
    return { total: list.length, active, acknowledged, assigned, escalated, resolved, bySeverity, byType };
  }

  /** Delay map accessor for alarm throttling in analytics plugins */
  public getAlarmDelay(alarmType: string): number {
    return SEVERITY_DELAY_MAP[alarmType] ?? 0;
  }

  private async persistToFirestore(alarm: AnalyticsAlarm): Promise<void> {
    try {
      const col  = collection(db, 'analyticsAlarms');
      const snap = await getDocs(query(col, where('id', '==', alarm.id)));
      const data = JSON.parse(JSON.stringify(alarm));
      if (snap.empty) {
        await addDoc(col, data);
      } else {
        await updateDoc(doc(db, 'analyticsAlarms', snap.docs[0].id), data);
      }
    } catch {
      // Non-blocking — Firestore outage must not disrupt real-time alarm pipeline
    }
  }
}

export const analyticsAlarmService = AnalyticsAlarmService.getInstance();
