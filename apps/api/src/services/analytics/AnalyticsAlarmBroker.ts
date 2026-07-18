/**
 * AnalyticsAlarmBroker
 *
 * Listens to the AnalyticsPlatform event stream and materialises
 * SecurityAlert documents in Firestore for events that have non-null severity.
 *
 * Reuses the existing SecurityAlert schema and saveAnomalyToFirestore utility.
 * Deduplicates alarms within the same hour window per (cameraId, eventType).
 * Writes to vmsAuditService for every alarm creation.
 */

import type { AnalyticsEvent } from './types/AnalyticsEvent';
import { AnalyticsEventType, ANALYTICS_ALARM_SEVERITY } from './types/AnalyticsEvent';
import { analyticsPlatform } from './AnalyticsPlatform';
import { saveAnomalyToFirestore } from '../securityService';
import { evidenceManager } from '../evidenceManager';
import { vmsAuditService } from '../vmsAuditService';
import { vmsEventService } from '../vmsEventService';
import type { SecurityAlert } from '../../types';
import type { BoundingBox } from '../ai/interfaces';

const SEVERITY_MAP: Record<'CRITICAL' | 'WARNING' | 'INFO', SecurityAlert['severity']> = {
  CRITICAL: 'CRITICAL',
  WARNING:  'WARNING',
  INFO:     'INFO',
};

class AnalyticsAlarmBrokerService {
  private static instance: AnalyticsAlarmBrokerService;
  private unsubscribe?: () => void;
  private readonly DEDUP_WINDOW_MS = 3_600_000; // 1 hour

  private constructor() {}

  public static getInstance(): AnalyticsAlarmBrokerService {
    if (!AnalyticsAlarmBrokerService.instance) {
      AnalyticsAlarmBrokerService.instance = new AnalyticsAlarmBrokerService();
    }
    return AnalyticsAlarmBrokerService.instance;
  }

  /** Start listening to the analytics event stream */
  public start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = analyticsPlatform.onEvent(async (event: AnalyticsEvent) => {
      const severity = ANALYTICS_ALARM_SEVERITY[event.type];
      if (!severity) return; // Not alarm-worthy

      // Auto-generate evidence for every alarmable event
      const evidence = evidenceManager.record({
        eventType:     event.type,
        cameraId:      event.cameraId,
        timestamp:     event.timestamp,
        confidence:    event.confidence,
        aiModelVersion: event.modelVersion,
        boundingBoxes: event.boundingBoxes as BoundingBox[],
        trackId:       event.trackId,
        location:      event.location,
        metadata:      { ...(event.data as Record<string, unknown>), analyticsEventId: event.id },
      });

      // Dedup: one alarm per (camera, eventType) per hour
      const hourBlock  = Math.floor(Date.now() / this.DEDUP_WINDOW_MS);
      const alarmId    = `ALM-ANA-${event.cameraId}-${event.type}-${hourBlock}`;

      const alarm: SecurityAlert = {
        id:        alarmId,
        severity:  SEVERITY_MAP[severity],
        message:   this.buildMessage(event),
        timestamp: Date.now(),
        entityId:  event.cameraId,
        zoneId:    (event.data as any)?.zoneId ?? event.cameraId,
        type:      event.type,
        status:    'ACTIVE',
        assignedTo: 'Unassigned',
        resolutionNotes: '',
        notesHistory: [
          {
            timestamp: Date.now(),
            operator:  'Sentinel Analytics Engine',
            text:      `Auto-alarm from analytics: ${event.type}. Confidence: ${(event.confidence * 100).toFixed(1)}%. Evidence: ${evidence.id}.`,
            action:    'CREATE',
          },
        ],
      };

      try {
        await saveAnomalyToFirestore(alarm);

        await vmsAuditService.log({
          userId:    'analytics_engine',
          userName:  'Sentinel Analytics',
          action:    'ANALYTICS_ALARM_CREATED',
          module:    'AnalyticsAlarmBroker',
          ipAddress: '127.0.0.1',
          status:    'WARNING',
          details:   `Analytics alarm created: ${event.type} on ${event.cameraId}. Evidence: ${evidence.id}.`,
        });

        vmsEventService.emit(
          'ANALYTICS_ALARM_CREATED' as any,
          'AnalyticsAlarmBroker',
          { alarmId, eventType: event.type, cameraId: event.cameraId, evidenceId: evidence.id },
          severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        );
      } catch (err) {
        console.error('[AnalyticsAlarmBroker] Failed to persist alarm:', err);
      }
    });

    console.log('[AnalyticsAlarmBroker] Started. Listening for analytics events.');
  }

  public stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private buildMessage(event: AnalyticsEvent): string {
    const d = event.data as Record<string, unknown>;
    const base = `[${event.cameraName}] ${event.type.replace(/_/g, ' ')}`;
    const conf = `Confidence: ${(event.confidence * 100).toFixed(1)}%`;

    switch (event.type) {
      case AnalyticsEventType.FIRE_DETECTED:
        return `${base} — Flame cluster detected. ${conf}.`;
      case AnalyticsEventType.SMOKE_DETECTED:
        return `${base} — Smoke plume detected. ${conf}.`;
      case AnalyticsEventType.EXPLOSION_DETECTED:
        return `${base} — Explosion flash detected. ${conf}.`;
      case AnalyticsEventType.PPE_VIOLATION:
        return `${base} — Missing PPE: ${(d.missingItems as string[] | undefined)?.join(', ') ?? 'unknown'}. ${conf}.`;
      case AnalyticsEventType.INTRUSION_DETECTED:
        return `${base} — Unauthorised intrusion in zone "${d.zoneName ?? event.location}". ${conf}.`;
      case AnalyticsEventType.LOITERING_DETECTED:
        return `${base} — Person loitering for ${d.dwellSeconds ?? '?'}s. ${conf}.`;
      case AnalyticsEventType.CROWD_DETECTED:
        return `${base} — Crowd of ${(d as any).headCount ?? '?'} persons detected (${(d as any).densityLevel}). ${conf}.`;
      case AnalyticsEventType.ABANDONED_OBJECT_DETECTED:
        return `${base} — Abandoned ${d.objectClass ?? 'object'} for ${d.stationarySeconds ?? '?'}s. ${conf}.`;
      default:
        return `${base}. ${conf}.`;
    }
  }
}

export const analyticsAlarmBroker = AnalyticsAlarmBrokerService.getInstance();
