import { AttendanceRecord } from '../types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache, handleFirestoreError, OperationType, ensureAuthenticated } from './firestoreService';
import { mockLogs } from './mockData';

const CACHE_KEY = 'sentinel_logs_cache';

export const logService = {
  getAttendanceLogs: async (): Promise<AttendanceRecord[]> => {
    try {
      const q = query(collection(db, 'attendanceLogs'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => doc.data() as AttendanceRecord);
      if (logs.length > 0) {
        setLocalCache(CACHE_KEY, logs);
      }
      return logs.length > 0 ? logs : getLocalCache(CACHE_KEY, mockLogs);
    } catch (e) {
      console.warn('Firestore getAttendanceLogs failed, falling back to local cache:', e);
      try {
        handleFirestoreError(e, OperationType.GET, 'attendanceLogs');
      } catch (err) {
        // Logged successfully to console, ignore exception for clean fallback
      }
      return getLocalCache(CACHE_KEY, mockLogs);
    }
  }
};

