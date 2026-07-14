import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache } from './firestoreService';
import { vmsEventService } from './vmsEventService';

export interface AuditLogPayload {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  timestamp: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: string;
}

class VmsAuditService {
  private static instance: VmsAuditService;
  private readonly CACHE_KEY = 'vms_audit_logs';
  private localLogs: AuditLogPayload[] = [];

  private constructor() {
    this.localLogs = getLocalCache<AuditLogPayload>(this.CACHE_KEY, []);
  }

  public static getInstance(): VmsAuditService {
    if (!VmsAuditService.instance) {
      VmsAuditService.instance = new VmsAuditService();
    }
    return VmsAuditService.instance;
  }

  /**
   * Log an audit trail entry for compliance and security
   */
  public async log(payload: Omit<AuditLogPayload, 'timestamp'>): Promise<void> {
    const entry: AuditLogPayload = {
      ...payload,
      timestamp: new Date().toISOString()
    };

    // 1. Add to local memory cache (capped to avoid memory bloat)
    this.localLogs.unshift(entry);
    if (this.localLogs.length > 500) {
      this.localLogs.pop();
    }
    setLocalCache(this.CACHE_KEY, this.localLogs);

    // 2. Publish system event via event broker
    vmsEventService.emit(
      entry.status === 'FAILURE' ? 'SYSTEM_ERROR' : 'USER_LOGIN', 
      'AuditLogger', 
      { action: entry.action, module: entry.module, user: entry.userName },
      entry.status === 'FAILURE' ? 'WARNING' : 'INFO'
    );

    // 3. Persist to Firestore as persistent compliance records
    try {
      const logsCollection = collection(db, 'complianceAuditLogs');
      await addDoc(logsCollection, entry);
    } catch (e) {
      console.warn('VMS Audit Service: Failed to write to Firestore, cached locally.', e);
    }
  }

  /**
   * Fetch audit logs, prioritizing active Firestore logs with local cache fallback
   */
  public async getLogs(): Promise<AuditLogPayload[]> {
    try {
      const logsCollection = collection(db, 'complianceAuditLogs');
      const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const remoteLogs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLogPayload[];

      if (remoteLogs.length > 0) {
        setLocalCache(this.CACHE_KEY, remoteLogs);
        this.localLogs = remoteLogs;
      }
      return remoteLogs;
    } catch (error) {
      console.warn('VMS Audit Service: Firestore fetch error, returning local cache.', error);
      return this.localLogs;
    }
  }
}

export const vmsAuditService = VmsAuditService.getInstance();
