
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence Firebase's internal logging to prevent offline warning logs from triggering error flags
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('Failed to set Firestore log level to silent:', e);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// LocalStorage caching helpers for offline fallback
export function getLocalCache<T>(key: string, defaultValue: T[]): T[] {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached) as T[];
    }
    // Initialize if empty
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  } catch (e) {
    console.warn(`Failed to read/write localStorage for key ${key}:`, e);
    return defaultValue;
  }
}

export function setLocalCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to write localStorage for key ${key}:`, e);
  }
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
