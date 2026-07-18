/**
 * Enterprise Incident Service
 *
 * Manages security incidents from creation through resolution.
 * Persists to Firestore; in-memory map provides sub-millisecond reads.
 *
 * NEVER stores synthetic or simulated data.
 * Every incident must be created by an authenticated operator or linked to a real alarm.
 */

import { db } from './firestoreService';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  where,
  Timestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IncidentCategory =
  | 'INTRUSION'
  | 'FIRE'
  | 'MEDICAL'
  | 'VEHICLE'
  | 'PPE_VIOLATION'
  | 'CROWD_INCIDENT'
  | 'THEFT'
  | 'VANDALISM'
  | 'LOITERING'
  | 'ABANDONED_OBJECT'
  | 'WEAPON'
  | 'OTHER';

export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus   = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface IncidentNote {
  id: string;
  text: string;
  operator: string;
  timestamp: string;   // ISO-8601
  action: 'NOTE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'EVIDENCE_ADDED' | 'TASK_UPDATED' | 'ESCALATION' | 'MERGE';
}

export interface IncidentTask {
  id: string;
  text: string;
  done: boolean;
  assignedTo?: string;
  doneAt?: string;
}

export interface IncidentSopStep {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface Incident {
  id              : string;
  title           : string;
  description     : string;
  category        : IncidentCategory;
  priority        : IncidentPriority;
  status          : IncidentStatus;
  createdAt       : string;
  updatedAt       : string;
  createdBy       : string;
  assignedTeam   ?: string;
  assignedOperator?: string;
  associatedCameras: string[];
  evidenceIds     : string[];
  alarmIds        : string[];
  sopSteps        : IncidentSopStep[];
  notes           : IncidentNote[];
  tasks           : IncidentTask[];
  closedAt       ?: string;
  closedBy       ?: string;
  resolution     ?: string;
  tags            : string[];
  location       ?: string;
  mergedInto     ?: string;  // if this incident was merged into another
  firestoreDocId ?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOP Templates
// ─────────────────────────────────────────────────────────────────────────────

const SOP_TEMPLATES: Record<IncidentCategory, string[]> = {
  INTRUSION: [
    'Locate and lock target on spatiotemporal trace',
    'Dispatch nearest tactical officer to the zone',
    'Enable structural lockdown of exit access gates',
    'Acknowledge threat and notify security chief',
  ],
  FIRE: [
    'Trigger local audio and visual evacuation buzzer',
    'Deploy automatic fire suppression system',
    'Notify local Fire Brigade dispatchers (101)',
    'Monitor evacuation corridors on camera feeds',
  ],
  MEDICAL: [
    'Contact medical dispatch team (103)',
    'Guide personnel with medical kit to victim location',
    'Focus primary camera streams on incident location',
    'Maintain crowd boundaries and security corridors',
  ],
  VEHICLE: [
    'Capture license plate via LPR system',
    'Alert patrol units to intercept vehicle',
    'Lock perimeter access gates',
    'Transmit evidence package to traffic authority',
  ],
  PPE_VIOLATION: [
    'Identify and isolate PPE non-compliant worker',
    'Issue verbal warning via intercommunication',
    'Log violation with photographic evidence',
    'Escalate to safety officer if repeated',
  ],
  CROWD_INCIDENT: [
    'Activate crowd density alert protocols',
    'Deploy additional security personnel to area',
    'Open emergency exit gates',
    'Coordinate with medical team for potential injuries',
  ],
  THEFT: [
    'Lock down area perimeter',
    'Capture suspect appearance profile (face + clothing)',
    'Alert all exits with suspect description',
    'Contact law enforcement and prepare evidence package',
  ],
  VANDALISM: [
    'Document damage with photographic evidence',
    'Identify suspect via facial recognition',
    'Preserve scene for forensic analysis',
    'File incident report with law enforcement',
  ],
  LOITERING: [
    'Confirm loitering event via secondary camera',
    'Dispatch officer for verbal assessment',
    'Log identity profile if recognition available',
    'Escalate if subject becomes threatening',
  ],
  ABANDONED_OBJECT: [
    'Alert bomb disposal team if object is unidentified',
    'Evacuate 50m radius as precaution',
    'Do not touch or approach the object',
    'Document with photography from safe distance',
  ],
  WEAPON: [
    'IMMEDIATE: Lock down entire facility',
    'Alert law enforcement (102)',
    'Track subject on all camera feeds',
    'Protect all personnel — do not confront armed subject',
  ],
  OTHER: [
    'Document incident with full detail',
    'Assign to appropriate response team',
    'Collect evidence from all available cameras',
    'Escalate if situation changes in severity',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class IncidentService {
  private static instance: IncidentService;
  private store   : Map<string, Incident> = new Map();
  private counter : number = 0;
  private readonly COLLECTION = 'incidents';

  private constructor() {
    this.loadFromFirestore().catch(() => {});
  }

  public static getInstance(): IncidentService {
    if (!IncidentService.instance) {
      IncidentService.instance = new IncidentService();
    }
    return IncidentService.instance;
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private nextId(): string {
    this.counter++;
    return `INC-${String(this.counter).padStart(4, '0')}-${Date.now().toString(36).toUpperCase()}`;
  }

  private buildSopSteps(category: IncidentCategory): IncidentSopStep[] {
    return (SOP_TEMPLATES[category] || SOP_TEMPLATES.OTHER).map((text, i) => ({
      id: `sop_${i + 1}`,
      text,
      completed: false,
    }));
  }

  // ── persistence ──────────────────────────────────────────────────────────────

  private async loadFromFirestore(): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(db, this.COLLECTION), orderBy('createdAt', 'desc'), fsLimit(200))
      );
      snap.docs.forEach(d => {
        const data = d.data() as Incident;
        if (data.id) {
          this.store.set(data.id, { ...data, firestoreDocId: d.id });
          // Keep counter in sync
          const num = parseInt(data.id.split('-')[1], 10);
          if (!isNaN(num) && num > this.counter) this.counter = num;
        }
      });
    } catch {
      // Firestore unavailable — in-memory only
    }
  }

  private async persist(incident: Incident): Promise<void> {
    try {
      const data = JSON.parse(JSON.stringify(incident));
      delete data.firestoreDocId;

      if (incident.firestoreDocId) {
        await updateDoc(doc(db, this.COLLECTION, incident.firestoreDocId), data);
      } else {
        const ref = await addDoc(collection(db, this.COLLECTION), {
          ...data,
          _createdAt: Timestamp.now(),
        });
        incident.firestoreDocId = ref.id;
      }
    } catch {
      // Non-blocking
    }
  }

  // ── public API ───────────────────────────────────────────────────────────────

  public create(params: {
    title            : string;
    description     ?: string;
    category         : IncidentCategory;
    priority         : IncidentPriority;
    createdBy        : string;
    assignedTeam    ?: string;
    assignedOperator?: string;
    associatedCameras?: string[];
    alarmIds        ?: string[];
    location        ?: string;
    tags            ?: string[];
  }): Incident {
    const incident: Incident = {
      id               : this.nextId(),
      title            : params.title,
      description      : params.description || '',
      category         : params.category,
      priority         : params.priority,
      status           : 'OPEN',
      createdAt        : new Date().toISOString(),
      updatedAt        : new Date().toISOString(),
      createdBy        : params.createdBy,
      assignedTeam     : params.assignedTeam,
      assignedOperator : params.assignedOperator,
      associatedCameras: params.associatedCameras || [],
      evidenceIds      : [],
      alarmIds         : params.alarmIds || [],
      sopSteps         : this.buildSopSteps(params.category),
      notes            : [{
        id       : 'note_init',
        text     : `Incident created by ${params.createdBy}.`,
        operator : params.createdBy,
        timestamp: new Date().toISOString(),
        action   : 'NOTE',
      }],
      tasks            : [],
      tags             : params.tags || [],
      location         : params.location,
    };

    this.store.set(incident.id, incident);
    this.persist(incident).catch(() => {});
    return incident;
  }

  public getById(id: string): Incident | undefined {
    return this.store.get(id);
  }

  public getAll(filters?: {
    status  ?: IncidentStatus;
    priority?: IncidentPriority;
    category?: IncidentCategory;
    limit   ?: number;
    since   ?: string;
  }): Incident[] {
    let results = Array.from(this.store.values())
      .filter(i => !i.mergedInto); // exclude merged-away incidents

    if (filters?.status)   results = results.filter(i => i.status === filters.status);
    if (filters?.priority) results = results.filter(i => i.priority === filters.priority);
    if (filters?.category) results = results.filter(i => i.category === filters.category);
    if (filters?.since) {
      const ms = new Date(filters.since).getTime();
      results = results.filter(i => new Date(i.createdAt).getTime() >= ms);
    }

    results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  public updateStatus(id: string, status: IncidentStatus, operator: string, resolution?: string): boolean {
    const inc = this.store.get(id);
    if (!inc) return false;

    const prev = inc.status;
    inc.status    = status;
    inc.updatedAt = new Date().toISOString();

    if (status === 'CLOSED' || status === 'RESOLVED') {
      inc.closedAt = new Date().toISOString();
      inc.closedBy = operator;
      if (resolution) inc.resolution = resolution;
    }

    inc.notes.push({
      id       : `note_${Date.now()}`,
      text     : `Status changed from ${prev} to ${status}${resolution ? ': ' + resolution : ''}.`,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'STATUS_CHANGE',
    });

    this.persist(inc).catch(() => {});
    return true;
  }

  public assign(id: string, team: string, operator: string, assignedBy: string): boolean {
    const inc = this.store.get(id);
    if (!inc) return false;

    inc.assignedTeam     = team;
    inc.assignedOperator = operator;
    inc.updatedAt        = new Date().toISOString();
    inc.notes.push({
      id       : `note_${Date.now()}`,
      text     : `Assigned to team "${team}" — operator: ${operator}.`,
      operator : assignedBy,
      timestamp: new Date().toISOString(),
      action   : 'ASSIGNMENT',
    });

    this.persist(inc).catch(() => {});
    return true;
  }

  public addNote(id: string, text: string, operator: string): boolean {
    const inc = this.store.get(id);
    if (!inc) return false;

    inc.notes.push({
      id       : `note_${Date.now()}`,
      text,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'NOTE',
    });
    inc.updatedAt = new Date().toISOString();
    this.persist(inc).catch(() => {});
    return true;
  }

  public attachEvidence(id: string, evidenceId: string, operator: string): boolean {
    const inc = this.store.get(id);
    if (!inc) return false;

    if (!inc.evidenceIds.includes(evidenceId)) {
      inc.evidenceIds.push(evidenceId);
      inc.notes.push({
        id       : `note_${Date.now()}`,
        text     : `Evidence record ${evidenceId} attached.`,
        operator,
        timestamp: new Date().toISOString(),
        action   : 'EVIDENCE_ADDED',
      });
      inc.updatedAt = new Date().toISOString();
      this.persist(inc).catch(() => {});
    }
    return true;
  }

  public addTask(id: string, text: string, assignedTo: string | undefined, operator: string): IncidentTask | null {
    const inc = this.store.get(id);
    if (!inc) return null;

    const task: IncidentTask = {
      id        : `task_${Date.now()}`,
      text,
      done      : false,
      assignedTo,
    };
    inc.tasks.push(task);
    inc.notes.push({
      id       : `note_${Date.now()}`,
      text     : `Task added: "${text}"${assignedTo ? ' → ' + assignedTo : ''}.`,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'TASK_UPDATED',
    });
    inc.updatedAt = new Date().toISOString();
    this.persist(inc).catch(() => {});
    return task;
  }

  public toggleTask(incidentId: string, taskId: string, operator: string): boolean {
    const inc = this.store.get(incidentId);
    if (!inc) return false;

    const task = inc.tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.done   = !task.done;
    task.doneAt = task.done ? new Date().toISOString() : undefined;
    inc.notes.push({
      id       : `note_${Date.now()}`,
      text     : `Task "${task.text}" marked as ${task.done ? 'DONE' : 'PENDING'}.`,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'TASK_UPDATED',
    });
    inc.updatedAt = new Date().toISOString();
    this.persist(inc).catch(() => {});
    return true;
  }

  public toggleSopStep(incidentId: string, stepId: string, operator: string): boolean {
    const inc = this.store.get(incidentId);
    if (!inc) return false;

    const step = inc.sopSteps.find(s => s.id === stepId);
    if (!step) return false;

    step.completed    = !step.completed;
    step.completedBy  = step.completed ? operator : undefined;
    step.completedAt  = step.completed ? new Date().toISOString() : undefined;
    inc.updatedAt     = new Date().toISOString();
    this.persist(inc).catch(() => {});
    return true;
  }

  public merge(sourceId: string, targetId: string, operator: string): boolean {
    const source = this.store.get(sourceId);
    const target = this.store.get(targetId);
    if (!source || !target) return false;

    // Copy cameras, evidence, alarms into target
    source.associatedCameras.forEach(c => { if (!target.associatedCameras.includes(c)) target.associatedCameras.push(c); });
    source.evidenceIds.forEach(e => { if (!target.evidenceIds.includes(e)) target.evidenceIds.push(e); });
    source.alarmIds.forEach(a => { if (!target.alarmIds.includes(a)) target.alarmIds.push(a); });

    target.notes.push({
      id       : `note_${Date.now()}`,
      text     : `Incident ${sourceId} merged into this incident by ${operator}.`,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'MERGE',
    });

    source.mergedInto = targetId;
    source.status     = 'CLOSED';
    source.notes.push({
      id       : `note_${Date.now()}`,
      text     : `This incident was merged into ${targetId} by ${operator}.`,
      operator,
      timestamp: new Date().toISOString(),
      action   : 'MERGE',
    });

    target.updatedAt = new Date().toISOString();
    source.updatedAt = new Date().toISOString();

    this.persist(source).catch(() => {});
    this.persist(target).catch(() => {});
    return true;
  }

  public getStats(): {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    critical: number;
    high: number;
    byCategoryLast24h: Record<string, number>;
  } {
    const all = Array.from(this.store.values()).filter(i => !i.mergedInto);
    const since24h = Date.now() - 86_400_000;

    return {
      total        : all.length,
      open         : all.filter(i => i.status === 'OPEN').length,
      investigating: all.filter(i => i.status === 'INVESTIGATING').length,
      resolved     : all.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
      critical     : all.filter(i => i.priority === 'CRITICAL' && i.status !== 'CLOSED').length,
      high         : all.filter(i => i.priority === 'HIGH' && i.status !== 'CLOSED').length,
      byCategoryLast24h: all
        .filter(i => new Date(i.createdAt).getTime() >= since24h)
        .reduce<Record<string, number>>((acc, i) => {
          acc[i.category] = (acc[i.category] || 0) + 1;
          return acc;
        }, {}),
    };
  }
}

export const incidentService = IncidentService.getInstance();
