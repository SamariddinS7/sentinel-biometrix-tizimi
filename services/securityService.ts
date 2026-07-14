import { db, handleFirestoreError, OperationType } from './firestoreService';
import { doc, setDoc, collection, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { SecurityAlert } from '../types';
import { vmsEventService, VmsEvent } from './vmsEventService';
import { vmsAuditService } from './vmsAuditService';

/**
 * Helper to wrap a promise with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage = "Operation timed out"): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Creates or updates a security alert/alarm document inside Firestore
 */
export const saveAnomalyToFirestore = async (alert: SecurityAlert): Promise<void> => {
  try {
    const docRef = doc(collection(db, 'securityAlerts'), alert.id);
    await withTimeout(setDoc(docRef, alert), 1500, "Firestore setDoc timed out");
  } catch (error) {
    console.warn("saveAnomalyToFirestore non-blocking error/timeout:", error);
  }
};

/**
 * Retrieves all security alerts and alarms from Firestore
 */
export const getSecurityAlerts = async (): Promise<SecurityAlert[]> => {
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, 'securityAlerts')), 2000, "Firestore getDocs timed out");
    const alerts = querySnapshot.docs.map(doc => doc.data() as SecurityAlert);
    // Sort in reverse chronological order
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn("getSecurityAlerts non-blocking error/timeout:", error);
    return [];
  }
};

/**
 * Operator Action: Acknowledge an active alarm, updating its lifecycle state
 */
export const acknowledgeAlarm = async (alarmId: string, operatorName: string): Promise<SecurityAlert | null> => {
  try {
    const docRef = doc(collection(db, 'securityAlerts'), alarmId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Alarm ${alarmId} not found in database.`);

    const alarm = snap.data() as SecurityAlert;
    const now = Date.now();
    
    alarm.status = 'ACKNOWLEDGED';
    alarm.notesHistory = alarm.notesHistory || [];
    alarm.notesHistory.push({
      timestamp: now,
      operator: operatorName,
      text: 'Alarm acknowledged by operator.',
      action: 'ACKNOWLEDGE'
    });

    await setDoc(docRef, alarm);

    // Write to audit log for compliance
    await vmsAuditService.log({
      userId: 'operator',
      userName: operatorName,
      action: 'ALARM_ACKNOWLEDGE',
      module: 'AlarmCenter',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      details: `Alarm acknowledged - ID: ${alarmId}, Type: ${alarm.type || 'Anomaly'}`
    });

    // Notify other components via event stream
    vmsEventService.emit('SYSTEM_ERROR', 'AlarmCenter', {
      msg: `Alarm ${alarmId} acknowledged by ${operatorName}.`,
      alarmId
    }, 'INFO');

    return alarm;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `securityAlerts/${alarmId}`);
    return null;
  }
};

/**
 * Operator Action: Assign an alarm to a specific operator or field technician
 */
export const assignAlarm = async (alarmId: string, assigneeName: string, operatorName: string): Promise<SecurityAlert | null> => {
  try {
    const docRef = doc(collection(db, 'securityAlerts'), alarmId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Alarm ${alarmId} not found.`);

    const alarm = snap.data() as SecurityAlert;
    const now = Date.now();

    alarm.assignedTo = assigneeName;
    alarm.notesHistory = alarm.notesHistory || [];
    alarm.notesHistory.push({
      timestamp: now,
      operator: operatorName,
      text: `Alarm assigned to technician: ${assigneeName}`,
      action: 'ASSIGN'
    });

    await setDoc(docRef, alarm);

    await vmsAuditService.log({
      userId: 'operator',
      userName: operatorName,
      action: 'ALARM_ASSIGN',
      module: 'AlarmCenter',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      details: `Alarm assigned to ${assigneeName} - ID: ${alarmId}`
    });

    return alarm;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `securityAlerts/${alarmId}`);
    return null;
  }
};

/**
 * Operator Action: Escalate a critical, unresponsive alarm to higher command or emergency services
 */
export const escalateAlarm = async (alarmId: string, operatorName: string): Promise<SecurityAlert | null> => {
  try {
    const docRef = doc(collection(db, 'securityAlerts'), alarmId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Alarm ${alarmId} not found.`);

    const alarm = snap.data() as SecurityAlert;
    const now = Date.now();

    alarm.status = 'ESCALATED';
    alarm.escalatedAt = now;
    alarm.severity = 'CRITICAL';
    
    alarm.notesHistory = alarm.notesHistory || [];
    alarm.notesHistory.push({
      timestamp: now,
      operator: operatorName,
      text: 'CRITICAL ESCALATION: Escalated to Emergency response units.',
      action: 'ESCALATE'
    });

    await setDoc(docRef, alarm);

    await vmsAuditService.log({
      userId: 'operator',
      userName: operatorName,
      action: 'ALARM_ESCALATE',
      module: 'AlarmCenter',
      ipAddress: '127.0.0.1',
      status: 'WARNING',
      details: `Alarm critically escalated to Level-2 Emergency - ID: ${alarmId}`
    });

    vmsEventService.emit('SYSTEM_ERROR', 'AlarmCenter', {
      msg: `CRITICAL ALARM ESCALATED: ID ${alarmId} has been escalated by ${operatorName}!`,
      alarmId
    }, 'CRITICAL');

    return alarm;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `securityAlerts/${alarmId}`);
    return null;
  }
};

/**
 * Operator Action: Resolve an active hazard alarm with specific intervention notes
 */
export const resolveAlarm = async (alarmId: string, resolutionNotes: string, operatorName: string): Promise<SecurityAlert | null> => {
  try {
    const docRef = doc(collection(db, 'securityAlerts'), alarmId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Alarm ${alarmId} not found.`);

    const alarm = snap.data() as SecurityAlert;
    const now = Date.now();

    alarm.status = 'RESOLVED';
    alarm.resolvedAt = now;
    alarm.resolutionNotes = resolutionNotes;

    alarm.notesHistory = alarm.notesHistory || [];
    alarm.notesHistory.push({
      timestamp: now,
      operator: operatorName,
      text: `Alarm resolved. Notes: ${resolutionNotes}`,
      action: 'RESOLVE'
    });

    await setDoc(docRef, alarm);

    await vmsAuditService.log({
      userId: 'operator',
      userName: operatorName,
      action: 'ALARM_RESOLVE',
      module: 'AlarmCenter',
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      details: `Alarm resolved and closed - ID: ${alarmId}`
    });

    vmsEventService.emit('SYSTEM_ERROR', 'AlarmCenter', {
      msg: `Alarm ${alarmId} resolved by ${operatorName}. Incident closed.`,
      alarmId
    }, 'SUCCESS');

    return alarm;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `securityAlerts/${alarmId}`);
    return null;
  }
};

/**
 * Central event-driven alarm initiator. Listens to all raw hazard events from the AI engine
 * and automatically spins up a persistent SecurityAlert document in Firestore.
 */
export const initializeAlarmBroker = () => {
  const hazardEventTypes: Array<any> = [
    'FIRE_DETECTED',
    'SMOKE_DETECTED',
    'GAS_LEAK_DETECTED',
    'EXPLOSION_DETECTED',
    'SPARK_DETECTED',
    'FLOOD_DETECTED',
    'WATER_LEAK_DETECTED',
    'CHEMICAL_SPILL_DETECTED',
    'HAZARD_DETECTED'
  ];

  hazardEventTypes.forEach(type => {
    vmsEventService.subscribe(type, async (event: VmsEvent) => {
      const { cameraId, hazardType, classLabel, confidence, box, msg } = event.payload;

      // Unique alarm ID based on camera and type within the same hour window to prevent notification spamming
      const hourBlock = Math.floor(Date.now() / 3600000);
      const alarmId = `ALM-${cameraId}-${hazardType}-${hourBlock}`;

      try {
        const docRef = doc(collection(db, 'securityAlerts'), alarmId);
        const snap = await getDoc(docRef);

        // If the alarm already exists for this sector, do not duplicate it
        if (snap.exists()) {
          return;
        }

        const alarm: SecurityAlert = {
          id: alarmId,
          severity: 'CRITICAL',
          message: msg || `AI Engine Alarm: Persistent ${classLabel} detected inside sector ${cameraId}.`,
          timestamp: Date.now(),
          entityId: cameraId,
          zoneId: cameraId,
          type: hazardType.toUpperCase(),
          status: 'ACTIVE',
          assignedTo: 'Unassigned',
          resolutionNotes: '',
          notesHistory: [
            {
              timestamp: Date.now(),
              operator: 'Sentinel AI Engine',
              text: `Incident automatically opened. Model confidence: ${(confidence * 100).toFixed(1)}%.`,
              action: 'CREATE'
            }
          ]
        };

        await setDoc(docRef, alarm);

        // Log to official VMS Compliance Audit
        await vmsAuditService.log({
          userId: 'ai_engine',
          userName: 'Sentinel AI Detector',
          action: 'HAZARD_ALARM_CREATED',
          module: 'AlarmCenter',
          ipAddress: '127.0.0.1',
          status: 'WARNING',
          details: `AI Safety Incident automatically created on ${cameraId} for ${classLabel}.`
        });

      } catch (err) {
        console.error('[AlarmBroker] Error materializing alarm from event:', err);
      }
    });
  });
};
