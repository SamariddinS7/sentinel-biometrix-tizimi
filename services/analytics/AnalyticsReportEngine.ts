/**
 * AnalyticsReportEngine
 *
 * Compiles daily / weekly / monthly analytics reports from the event stream.
 * Persists reports to Firestore `analyticsReports` collection.
 * Schedules automatic daily report generation at midnight.
 *
 * No mock data — every statistic is derived from real AnalyticsEvent records.
 */

import { db } from '../firestoreService';
import { collection, addDoc, getDocs, query, where, orderBy, limit as fsLimit } from 'firebase/firestore';
import { analyticsPlatform } from './AnalyticsPlatform';
import { AnalyticsEventType } from './types/AnalyticsEvent';
import type { AnalyticsEvent } from './types/AnalyticsEvent';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface AnalyticsReportSummary {
  reportId:   string;
  period:     ReportPeriod;
  cameraId:   string;     // 'all' for system-wide
  startTime:  string;     // ISO-8601
  endTime:    string;     // ISO-8601
  generatedAt: string;
  statistics: {
    totalEvents:          number;
    vehiclesDetected:     number;
    platesRecognized:     number;
    ocrResults:           number;
    fireEvents:           number;
    smokeEvents:          number;
    ppeViolations:        number;
    crowdEvents:          number;
    queueEvents:          number;
    loiteringEvents:      number;
    intrusionEvents:      number;
    lineCrossings:        number;
    abandonedObjects:     number;
    removedObjects:       number;
    peakOccupancy:        number;
    averagePeopleCount:   number;
    ppeComplianceRate:    number;   // 0–100 %
  };
  trends: {
    eventsPerHour:        Array<{ hour: string; count: number }>;
    vehiclesPerHour:      Array<{ hour: string; count: number }>;
    occupancyTimeSeries:  Array<{ timestamp: string; count: number }>;
    topEventTypes:        Array<{ type: string; count: number }>;
  };
}

class AnalyticsReportEngineService {
  private static instance: AnalyticsReportEngineService;
  private reportCache: Map<string, AnalyticsReportSummary> = new Map();
  private schedulerTimer?: NodeJS.Timeout;

  private constructor() {}

  public static getInstance(): AnalyticsReportEngineService {
    if (!AnalyticsReportEngineService.instance) {
      AnalyticsReportEngineService.instance = new AnalyticsReportEngineService();
    }
    return AnalyticsReportEngineService.instance;
  }

  /** Start automatic daily report generation */
  public startScheduler(): void {
    if (this.schedulerTimer) return;

    const scheduleNext = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 5, 0); // 00:00:05 next day
      const msUntil = midnight.getTime() - now.getTime();

      this.schedulerTimer = setTimeout(async () => {
        await this.generateReport('daily', 'all').catch(console.error);
        scheduleNext();
      }, msUntil);
    };

    scheduleNext();
    console.log('[AnalyticsReportEngine] Daily report scheduler started.');
  }

  public stopScheduler(): void {
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = undefined;
    }
  }

  /** Compile a report from in-process event ring + Firestore history */
  public async generateReport(
    period: ReportPeriod,
    cameraId: string,
  ): Promise<AnalyticsReportSummary> {
    const now = new Date();
    const endTime = now.toISOString();
    const startMs = this.periodStartMs(now, period);
    const startTime = new Date(startMs).toISOString();
    const reportId = `RPT-${period.toUpperCase()}-${cameraId}-${Date.now()}`;

    // Pull events from in-process ring (recent) + Firestore (historical)
    const inProcessEvents = analyticsPlatform.getEvents({
      cameraId: cameraId === 'all' ? undefined : cameraId,
      since:    startTime,
    });

    const firestoreEvents = await this.fetchFirestoreEvents(cameraId, startTime, endTime);
    const allEvents = [...inProcessEvents, ...firestoreEvents];

    const report = this.compile(reportId, period, cameraId, startTime, endTime, allEvents);

    // Persist
    this.reportCache.set(reportId, report);
    this.persistReport(report).catch(() => {});

    console.log(`[AnalyticsReportEngine] ${period} report compiled: ${reportId} (${allEvents.length} events).`);
    return report;
  }

  public async getReport(reportId: string): Promise<AnalyticsReportSummary | null> {
    return this.reportCache.get(reportId) ?? null;
  }

  public async listReports(period?: ReportPeriod, limit = 20): Promise<AnalyticsReportSummary[]> {
    const cached = Array.from(this.reportCache.values())
      .filter(r => !period || r.period === period)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
    return cached;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private compile(
    reportId:   string,
    period:     ReportPeriod,
    cameraId:   string,
    startTime:  string,
    endTime:    string,
    events:     AnalyticsEvent[],
  ): AnalyticsReportSummary {
    const stats = {
      totalEvents:        events.length,
      vehiclesDetected:   0,
      platesRecognized:   0,
      ocrResults:         0,
      fireEvents:         0,
      smokeEvents:        0,
      ppeViolations:      0,
      crowdEvents:        0,
      queueEvents:        0,
      loiteringEvents:    0,
      intrusionEvents:    0,
      lineCrossings:      0,
      abandonedObjects:   0,
      removedObjects:     0,
      peakOccupancy:      0,
      averagePeopleCount: 0,
      ppeComplianceRate:  100,
    };

    const eventsPerHour  = new Map<string, number>();
    const vehiclesPerHour = new Map<string, number>();
    const occupancySeries: Array<{ timestamp: string; count: number }> = [];
    const typeCounts     = new Map<string, number>();
    let   occupancySum   = 0, occupancyReadings = 0;
    let   ppeChecks = 0, ppeViolCount = 0;

    for (const evt of events) {
      const hour = new Date(evt.timestamp).toISOString().slice(0, 13) + ':00';
      eventsPerHour.set(hour, (eventsPerHour.get(hour) ?? 0) + 1);
      typeCounts.set(evt.type, (typeCounts.get(evt.type) ?? 0) + 1);

      switch (evt.type) {
        case AnalyticsEventType.VEHICLE_DETECTED:  stats.vehiclesDetected++; vehiclesPerHour.set(hour, (vehiclesPerHour.get(hour) ?? 0) + 1); break;
        case AnalyticsEventType.PLATE_RECOGNIZED:  stats.platesRecognized++;  break;
        case AnalyticsEventType.OCR_COMPLETED:     stats.ocrResults++;        break;
        case AnalyticsEventType.FIRE_DETECTED:     stats.fireEvents++;        break;
        case AnalyticsEventType.SMOKE_DETECTED:    stats.smokeEvents++;       break;
        case AnalyticsEventType.PPE_VIOLATION:     stats.ppeViolations++; ppeViolCount++; ppeChecks++; break;
        case AnalyticsEventType.PPE_COMPLIANT:     ppeChecks++;               break;
        case AnalyticsEventType.CROWD_DETECTED:    stats.crowdEvents++;       break;
        case AnalyticsEventType.QUEUE_DETECTED:    stats.queueEvents++;       break;
        case AnalyticsEventType.LOITERING_DETECTED: stats.loiteringEvents++; break;
        case AnalyticsEventType.INTRUSION_DETECTED: stats.intrusionEvents++; break;
        case AnalyticsEventType.LINE_CROSSED:      stats.lineCrossings++;    break;
        case AnalyticsEventType.ABANDONED_OBJECT_DETECTED: stats.abandonedObjects++; break;
        case AnalyticsEventType.REMOVED_OBJECT_DETECTED:   stats.removedObjects++;   break;
        case AnalyticsEventType.PEOPLE_COUNT_UPDATED: {
          const count = (evt.data as any).count ?? 0;
          occupancySum += count;
          occupancyReadings++;
          if (count > stats.peakOccupancy) stats.peakOccupancy = count;
          occupancySeries.push({ timestamp: evt.timestamp, count });
          break;
        }
      }
    }

    stats.averagePeopleCount = occupancyReadings > 0 ? Math.round(occupancySum / occupancyReadings) : 0;
    stats.ppeComplianceRate  = ppeChecks > 0 ? Math.round(((ppeChecks - ppeViolCount) / ppeChecks) * 100) : 100;

    const topEventTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      reportId,
      period,
      cameraId,
      startTime,
      endTime,
      generatedAt: new Date().toISOString(),
      statistics: stats,
      trends: {
        eventsPerHour:       [...eventsPerHour.entries()].sort().map(([hour, count]) => ({ hour, count })),
        vehiclesPerHour:     [...vehiclesPerHour.entries()].sort().map(([hour, count]) => ({ hour, count })),
        occupancyTimeSeries: occupancySeries.slice(-200),
        topEventTypes,
      },
    };
  }

  private periodStartMs(now: Date, period: ReportPeriod): number {
    const ms = now.getTime();
    if (period === 'daily')   return ms - 86_400_000;
    if (period === 'weekly')  return ms - 7 * 86_400_000;
    if (period === 'monthly') return ms - 30 * 86_400_000;
    return ms - 86_400_000;
  }

  private async fetchFirestoreEvents(cameraId: string, since: string, until: string): Promise<AnalyticsEvent[]> {
    try {
      let q = query(
        collection(db, 'analyticsEvents'),
        where('timestamp', '>=', since),
        where('timestamp', '<=', until),
        orderBy('timestamp', 'desc'),
        fsLimit(2000),
      );
      if (cameraId !== 'all') {
        q = query(q, where('cameraId', '==', cameraId));
      }
      const snap = await getDocs(q);
      return snap.docs.map((d: any) => d.data() as AnalyticsEvent);
    } catch {
      return [];
    }
  }

  private async persistReport(report: AnalyticsReportSummary): Promise<void> {
    try {
      await addDoc(collection(db, 'analyticsReports'), JSON.parse(JSON.stringify(report)));
    } catch {
      // Non-blocking
    }
  }
}

export const analyticsReportEngine = AnalyticsReportEngineService.getInstance();
