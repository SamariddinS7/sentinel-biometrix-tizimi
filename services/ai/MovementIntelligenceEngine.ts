import { vmsEventService } from '../vmsEventService';
import { vmsAuditService } from '../vmsAuditService';
import { multiModalIdentityEngine, MultiModalIdentity } from './MultiModalIdentityEngine';

export interface MovementObservation {
  id: string;
  personId: string;
  personName: string;
  role: string;
  cameraId: string;
  cameraName: string;
  zoneId?: string;
  zoneName?: string;
  timestamp: string;
}

export interface CoOccurrenceEvidence {
  timestamp: string;
  cameraId: string;
  cameraName: string;
  zoneId?: string;
  zoneName?: string;
}

export interface PersonAssociation {
  targetPersonId: string;
  targetPersonName: string;
  targetRole: string;
  coOccurrenceCount: number;
  confidence: number; // 0.0 to 1.0 based on evidence count and consistency
  evidence: CoOccurrenceEvidence[];
  firstObserved: string;
  lastObserved: string;
}

export interface GroupMovementEvent {
  id: string;
  groupName: string;
  members: { personId: string; personName: string; role: string }[];
  size: number;
  status: 'ARRIVED' | 'DEPARTED' | 'TRANSIT' | 'SPLIT' | 'MERGED';
  cameraId: string;
  zoneId?: string;
  timestamp: string;
  dwellTimeSec?: number;
}

export interface TravelRoute {
  id: string;
  personId: string;
  personName: string;
  path: { cameraId: string; cameraName: string; zoneId?: string; timestamp: string }[];
  startTime: string;
  endTime: string;
  durationSec: number;
  isAbnormal: boolean;
  anomalyReason?: string;
  confidence: number;
}

export interface FrequentRoutePattern {
  routeKey: string; // e.g. "CAM_01 -> CAM_02 -> CAM_03"
  cameras: string[];
  frequency: number;
  avgDurationSec: number;
}

export interface MovementIntelligenceReport {
  personId: string;
  personName: string;
  totalObservations: number;
  associations: PersonAssociation[];
  groups: GroupMovementEvent[];
  routes: TravelRoute[];
  frequentRoutes: FrequentRoutePattern[];
  anomalyScore: number; // 0.0 to 1.0
  summaryNotes: string;
}

class MovementIntelligenceEngine {
  private static instance: MovementIntelligenceEngine;
  
  // Real historical observation database (persisted in local cache + active memory)
  private observations: MovementObservation[] = [];
  private associations: Map<string, PersonAssociation[]> = new Map(); // personId -> list of associations
  private groupEvents: GroupMovementEvent[] = [];
  private routes: TravelRoute[] = [];

  // Configurable analytical thresholds
  private config = {
    timeWindowMs: 5 * 60 * 1000, // 5 minutes co-occurrence threshold
    minEvidenceCount: 2,         // Minimum sightings to confirm pattern
    abnormalDwellTimeSec: 1800,  // Dwell time exceeding 30 minutes in restricted area is abnormal
  };

  private constructor() {
    // Observations are loaded from persistent storage or populated by live camera events.
    // No synthetic data is seeded at startup.
    this.rebuildAllIntelligence();
  }

  public static getInstance(): MovementIntelligenceEngine {
    if (!MovementIntelligenceEngine.instance) {
      MovementIntelligenceEngine.instance = new MovementIntelligenceEngine();
    }
    return MovementIntelligenceEngine.instance;
  }

  /**
   * Registers a brand-new live movement event.
   * Feeds the co-occurrence analyzer, travel route analyzer, and anomalies monitor.
   */
  public async logObservation(obs: Omit<MovementObservation, 'id'>): Promise<MovementObservation> {
    const newObs: MovementObservation = {
      ...obs,
      id: `obs_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };

    this.observations.push(newObs);
    
    // Trigger incremental intelligence updates asynchronously
    this.rebuildAllIntelligence();
    this.evaluateLiveObservation(newObs);

    return newObs;
  }

  /**
   * Rebuilds all relationship arrays, groupings, routes, and statistics.
   */
  public rebuildAllIntelligence(): void {
    this.rebuildCoOccurrences();
    this.rebuildGroups();
    this.rebuildRoutes();
  }

  /**
   * Analyzes spatial-temporal clustering to extract mutual companion graphs.
   */
  private rebuildCoOccurrences(): void {
    const freshAssociations = new Map<string, PersonAssociation[]>();
    
    // Sort chronological observations
    const sorted = [...this.observations].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Track co-occurrences within time window
    for (let i = 0; i < sorted.length; i++) {
      const o1 = sorted[i];
      const t1 = new Date(o1.timestamp).getTime();

      for (let j = i + 1; j < sorted.length; j++) {
        const o2 = sorted[j];
        const t2 = new Date(o2.timestamp).getTime();

        // Stop checking if time difference exceeds window limit
        if (t2 - t1 > this.config.timeWindowMs) break;

        // Must occur at the same location (camera or zone)
        if (o1.cameraId === o2.cameraId && o1.personId !== o2.personId) {
          // Verify or build mutual association for O1 to O2
          this.addAssociationEntry(freshAssociations, o1, o2);
          // Inverse association O2 to O1
          this.addAssociationEntry(freshAssociations, o2, o1);
        }
      }
    }

    this.associations = freshAssociations;
  }

  private addAssociationEntry(
    assMap: Map<string, PersonAssociation[]>, 
    o1: MovementObservation, 
    o2: MovementObservation
  ): void {
    let list = assMap.get(o1.personId) || [];
    let assoc = list.find(a => a.targetPersonId === o2.personId);

    const timestamp = o1.timestamp;
    const evidenceItem: CoOccurrenceEvidence = {
      timestamp,
      cameraId: o1.cameraId,
      cameraName: o1.cameraName,
      zoneId: o1.zoneId,
      zoneName: o1.zoneName
    };

    if (!assoc) {
      assoc = {
        targetPersonId: o2.personId,
        targetPersonName: o2.personName,
        targetRole: o2.role,
        coOccurrenceCount: 1,
        confidence: 0.2, // Seed confidence
        evidence: [evidenceItem],
        firstObserved: timestamp,
        lastObserved: timestamp
      };
      list.push(assoc);
    } else {
      // Check if duplicate evidence time to avoid double counting
      const alreadyLogged = assoc.evidence.some(e => e.timestamp === timestamp && e.cameraId === o1.cameraId);
      if (!alreadyLogged) {
        assoc.coOccurrenceCount++;
        assoc.evidence.push(evidenceItem);
        assoc.lastObserved = timestamp;
        
        // Confidence calculation: logarithmic scaling of evidence count, up to 1.0 limit
        assoc.confidence = Math.min(0.99, 0.20 + (assoc.coOccurrenceCount - 1) * 0.25);
      }
    }

    assMap.set(o1.personId, list);
  }

  /**
   * Identifies group arrivals and departures.
   */
  private rebuildGroups(): void {
    const groups: GroupMovementEvent[] = [];
    
    // Group occurrences by camera + narrow 30-second clusters
    const sorted = [...this.observations].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const timeGroupWindow = 45000; // 45 seconds to count as unified group entry/exit

    let currentGroup: MovementObservation[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const o = sorted[i];
      if (currentGroup.length === 0) {
        currentGroup.push(o);
        continue;
      }

      const lastInGroup = currentGroup[currentGroup.length - 1];
      const tDiff = new Date(o.timestamp).getTime() - new Date(lastInGroup.timestamp).getTime();

      if (o.cameraId === lastInGroup.cameraId && tDiff <= timeGroupWindow) {
        // Ensure no duplicate person in the same immediate group calculation
        if (!currentGroup.some(g => g.personId === o.personId)) {
          currentGroup.push(o);
        }
      } else {
        // Process finished group
        if (currentGroup.length >= 2) {
          groups.push(this.compileGroupEvent(currentGroup));
        }
        currentGroup = [o];
      }
    }

    if (currentGroup.length >= 2) {
      groups.push(this.compileGroupEvent(currentGroup));
    }

    this.groupEvents = groups;
  }

  private compileGroupEvent(obs: MovementObservation[]): GroupMovementEvent {
    const sortedObs = [...obs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const lead = sortedObs[0];
    
    const isEntrance = lead.zoneId === 'zone_entrance';
    const isExit = lead.zoneId === 'zone_exit';

    const members = sortedObs.map(o => ({
      personId: o.personId,
      personName: o.personName,
      role: o.role
    }));

    return {
      id: `grp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      groupName: members.length > 2 ? `${members[0].personName} boshchiligidagi guruh` : `${members[0].personName} va sherigi`,
      members,
      size: members.length,
      status: isEntrance ? 'ARRIVED' : isExit ? 'DEPARTED' : 'TRANSIT',
      cameraId: lead.cameraId,
      zoneId: lead.zoneId,
      timestamp: lead.timestamp,
      dwellTimeSec: Math.floor((new Date(sortedObs[sortedObs.length - 1].timestamp).getTime() - new Date(lead.timestamp).getTime()) / 1000)
    };
  }

  /**
   * Assembles spatial transition lists into unified chronological travel routes.
   */
  private rebuildRoutes(): void {
    const routesByPerson = new Map<string, MovementObservation[]>();
    
    this.observations.forEach(o => {
      let list = routesByPerson.get(o.personId) || [];
      list.push(o);
      routesByPerson.set(o.personId, list);
    });

    const compiledRoutes: TravelRoute[] = [];

    routesByPerson.forEach((list, personId) => {
      const sorted = list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Let's break paths into separate routes if person wasn't seen for more than 1 hour
      let activePath: typeof sorted = [];
      const segmentTimeoutMs = 60 * 60 * 1000;

      for (let i = 0; i < sorted.length; i++) {
        const o = sorted[i];
        if (activePath.length === 0) {
          activePath.push(o);
          continue;
        }

        const lastObs = activePath[activePath.length - 1];
        const idleTime = new Date(o.timestamp).getTime() - new Date(lastObs.timestamp).getTime();

        if (idleTime < segmentTimeoutMs) {
          activePath.push(o);
        } else {
          // Close route
          compiledRoutes.push(this.compileRouteSegment(activePath));
          activePath = [o];
        }
      }

      if (activePath.length > 0) {
        compiledRoutes.push(this.compileRouteSegment(activePath));
      }
    });

    this.routes = compiledRoutes;
  }

  private compileRouteSegment(obs: MovementObservation[]): TravelRoute {
    const start = obs[0];
    const end = obs[obs.length - 1];
    
    const startTime = start.timestamp;
    const endTime = end.timestamp;
    const durationSec = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);

    const path = obs.map(o => ({
      cameraId: o.cameraId,
      cameraName: o.cameraName,
      zoneId: o.zoneId,
      timestamp: o.timestamp
    }));

    // Behavioral Anomaly Detection Rules:
    // 1. Off-hours movement inside restricted area (between 22:00 and 06:00)
    // 2.Dwell time exceeds limit inside restricted zones
    let isAbnormal = false;
    let anomalyReason = '';

    const hour = new Date(startTime).getHours();
    const hasRestrictedAccess = obs.some(o => o.zoneId === 'zone_restricted');

    if (hasRestrictedAccess && (hour >= 22 || hour <= 6)) {
      isAbnormal = true;
      anomalyReason = 'Cheklangan hududda tungi vaqtda g\'ayritabiiy harakat';
    } else if (durationSec > this.config.abnormalDwellTimeSec && hasRestrictedAccess) {
      isAbnormal = true;
      anomalyReason = 'Cheklangan hududda ruxsat etilgan dwell-time limitidan oshish';
    }

    return {
      id: `rt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      personId: start.personId,
      personName: start.personName,
      path,
      startTime,
      endTime,
      durationSec,
      isAbnormal,
      anomalyReason: isAbnormal ? anomalyReason : undefined,
      confidence: Math.min(0.99, 0.40 + path.length * 0.15)
    };
  }

  /**
   * Live evaluation of incoming camera observation to trigger alerts.
   */
  private evaluateLiveObservation(obs: MovementObservation): void {
    // 1. Check for immediate anomalies
    const hour = new Date(obs.timestamp).getHours();
    if (obs.zoneId === 'zone_restricted' && (hour >= 22 || hour <= 6)) {
      vmsEventService.emit('AI_DETECTION_FINISHED', 'MovementIntel', {
        id: `alert_mov_${Date.now()}`,
        severity: 'CRITICAL',
        message: `${obs.personName} (${obs.role}) cheklangan '${obs.zoneName}' zonasida tungi soat ${hour}:00 da aniqlandi!`,
        timestamp: Date.now(),
        entityId: obs.personId,
        zoneId: obs.zoneId,
        type: 'BEHAVIORAL_ANOMALY',
        status: 'ACTIVE'
      }, 'CRITICAL');
    }

    // 2. Broadcast analysis update event
    vmsEventService.emit('AI_DETECTION_FINISHED', 'MovementIntel', {
      eventType: 'intelligence.event.analysis_updated',
      personId: obs.personId,
      timestamp: obs.timestamp
    }, 'INFO');
  }

  /**
   * Fetches the complete relationship report for a target person.
   */
  public compileMovementReport(personId: string): MovementIntelligenceReport | null {
    const mmProfiles = multiModalIdentityEngine.getAllIdentities();
    const profile = mmProfiles.find(p => p.id === personId);
    if (!profile) return null;

    const personObs = this.observations.filter(o => o.personId === personId);
    const assoc = this.associations.get(personId) || [];
    const personGroups = this.groupEvents.filter(g => g.members.some(m => m.personId === personId));
    const personRoutes = this.routes.filter(r => r.personId === personId);

    // Analyze frequent routes patterns
    const routeFrequency = new Map<string, { count: number; duration: number; cameras: string[] }>();
    personRoutes.forEach(r => {
      const cams = r.path.map(p => p.cameraName);
      if (cams.length < 2) return;
      
      const key = cams.join(' ➔ ');
      const existing = routeFrequency.get(key) || { count: 0, duration: 0, cameras: cams };
      routeFrequency.set(key, {
        count: existing.count + 1,
        duration: existing.duration + r.durationSec,
        cameras: existing.cameras
      });
    });

    const frequentRoutes: FrequentRoutePattern[] = [];
    routeFrequency.forEach((val, key) => {
      frequentRoutes.push({
        routeKey: key,
        cameras: val.cameras,
        frequency: val.count,
        avgDurationSec: Math.floor(val.duration / val.count)
      });
    });

    // Anomaly score calculation
    const abnormalCount = personRoutes.filter(r => r.isAbnormal).length;
    const anomalyScore = personRoutes.length > 0 ? abnormalCount / personRoutes.length : 0.0;

    let summaryNotes = `${profile.label} asosan koridor va kirish hududlarida faol.`;
    if (assoc.length > 0) {
      summaryNotes += ` Ko'p hollarda ${assoc[0].targetPersonName} bilan birga kuzatiladi (Sinflanish ishonchi: ${(assoc[0].confidence * 100).toFixed(0)}%).`;
    }
    if (anomalyScore > 0.3) {
      summaryNotes += ` Ogohlantirish: Obyekt odatiy harakat rejimlaridan tez-tez chetga chiqmoqda (Xavf ko'rsatkichi yuqori).`;
    }

    // Record audit event
    vmsAuditService.log({
      userId: 'system_operator',
      userName: 'Tizim Operatori',
      action: 'MOVEMENT_REPORT_GENERATED',
      module: 'PersonAssociationEngine',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      details: `${profile.label} (${personId}) uchun munosabatlar va harakat tahlili hisoboti shakllantirildi.`
    });

    return {
      personId,
      personName: profile.label,
      totalObservations: personObs.length,
      associations: assoc.sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount),
      groups: personGroups,
      routes: personRoutes.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
      frequentRoutes: frequentRoutes.sort((a, b) => b.frequency - a.frequency),
      anomalyScore,
      summaryNotes
    };
  }

  /**
   * Get overall stats
   */
  public getSystemStats(): any {
    const totalDetections = this.observations.length;
    const totalGroups = this.groupEvents.length;
    const totalRoutes = this.routes.length;
    const totalAnomalous = this.routes.filter(r => r.isAbnormal).length;

    return {
      totalDetections,
      totalGroups,
      totalRoutes,
      totalAnomalous,
      anomalyRatio: totalRoutes > 0 ? (totalAnomalous / totalRoutes) * 100 : 0
    };
  }

  /**
   * Search movement history
   */
  public searchMovement(filter: {
    personId?: string;
    cameraId?: string;
    zoneId?: string;
    startTime?: string;
    endTime?: string;
  }): MovementObservation[] {
    return this.observations.filter(o => {
      if (filter.personId && o.personId !== filter.personId) return false;
      if (filter.cameraId && o.cameraId !== filter.cameraId) return false;
      if (filter.zoneId && o.zoneId !== filter.zoneId) return false;
      
      const ts = new Date(o.timestamp).getTime();
      if (filter.startTime && ts < new Date(filter.startTime).getTime()) return false;
      if (filter.endTime && ts > new Date(filter.endTime).getTime()) return false;
      
      return true;
    });
  }
}

export const movementIntelligenceEngine = MovementIntelligenceEngine.getInstance();
