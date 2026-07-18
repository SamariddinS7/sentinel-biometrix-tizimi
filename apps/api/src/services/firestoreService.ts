
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, setLogLevel, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence Firebase's internal logging to prevent offline warning logs from triggering error flags
try {
  setLogLevel('silent');
} catch (e) {
  console.warn('Failed to set Firestore log level to silent:', e);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

let resolveAuthReady: () => void;
export const authReadyPromise = new Promise<void>((resolve) => {
  resolveAuthReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    resolveAuthReady();
  }
  // No logging of auth state to avoid leaking UID info to the browser console
});

// Sign in anonymously on boot to establish a secure authenticated session for the security rules
signInAnonymously(auth)
  .then(() => {
    testConnection();
  })
  .catch((err) => {
    // Only warn if not already signed in or if it's a genuine error
    if (err.code !== 'auth/admin-restricted-operation' && !auth.currentUser) {
      console.warn("Failed to sign in anonymously with Firebase Auth on boot:", err);
    }
  });

// Validate connection to Firestore as per critical skill constraints
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Validate connection to Firestore as per critical skill constraints
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}


const inMemoryCache: Record<string, string> = {};

// LocalStorage caching helpers for offline fallback
export function getLocalCache<T>(key: string, defaultValue: T[]): T[] {
  try {
    if (typeof localStorage === 'undefined') {
      const cached = inMemoryCache[key];
      if (cached) return JSON.parse(cached) as T[];
      return defaultValue;
    }
    const cached = localStorage.getItem(key);
    if (cached && cached !== "undefined") {
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
    if (typeof localStorage === 'undefined') {
      inMemoryCache[key] = JSON.stringify(data);
      return;
    }
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
