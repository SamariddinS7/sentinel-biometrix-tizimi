import { AttendanceRecord } from '../types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache, handleFirestoreError, OperationType } from './firestoreService';

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
      return logs;
    } catch (e) {
      console.error('Firestore getAttendanceLogs failed:', e);
      try {
        handleFirestoreError(e, OperationType.GET, 'attendanceLogs');
      } catch (err) {
        // Logged
      }
      return getLocalCache(CACHE_KEY, []);
    }
  }
};

