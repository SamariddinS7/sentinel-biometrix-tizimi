import { 
  initializeTestEnvironment, 
  RulesTestEnvironment, 
  assertFails, 
  assertSucceeds 
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'coherent-backup-w2cdj',
    firestore: {
      rules: require('fs').readFileSync('firestore.rules', 'utf8')
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Sentinel Biometrics Rules Verification', () => {
  // Test User
  const getAuthDb = () => testEnv.authenticatedContext('user_123').firestore();
  const getUnauthDb = () => testEnv.unauthenticatedContext().firestore();

  // 1. ID Poisoning
  test('Payload 1: Reject alphanumeric and long ID poisoning', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'users', 'invalid-id-%%-$$');
    await assertFails(setDoc(docRef, {
      id: 'invalid-id-%%-$$',
      fullName: 'Poisoned User',
      role: 'EMPLOYEE',
      department: 'Security',
      enrolledDate: '2026-06-30'
    }));
  });

  // 2. Hostile State Bypass
  test('Payload 2: Reject ghost field isAdmin', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'users', 'U-EMP-99');
    await assertFails(setDoc(docRef, {
      id: 'U-EMP-99',
      fullName: 'Malicious User',
      role: 'EMPLOYEE',
      department: 'Security',
      isAdmin: true
    }));
  });

  // 3. Value Poisoning (Massive string payload)
  test('Payload 3: Reject massive fullName string size', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'users', 'U-EMP-01');
    const massiveName = 'A'.repeat(500); // Exceeds size boundary of 128
    await assertFails(setDoc(docRef, {
      id: 'U-EMP-01',
      fullName: massiveName,
      role: 'EMPLOYEE'
    }));
  });

  // 4. Type Spoofing
  test('Payload 4: Reject invalid field type (boolean for string)', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'users', 'U-EMP-02');
    await assertFails(setDoc(docRef, {
      id: 'U-EMP-02',
      fullName: true,
      role: 'EMPLOYEE'
    }));
  });

  // 5. Camera ID Mismatch
  test('Payload 5: Reject internal ID mismatch with doc path', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'cameras', 'CAM-01');
    await assertFails(setDoc(docRef, {
      id: 'CAM-02',
      name: 'Front Gate Camera',
      type: 'IP'
    }));
  });

  // 6. Negative FPS
  test('Payload 6: Reject negative numbers', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'cameras', 'CAM-01');
    await assertFails(setDoc(docRef, {
      id: 'CAM-01',
      name: 'Front Gate Camera',
      type: 'IP',
      fps: -10
    }));
  });

  // 7. Missing Required Fields
  test('Payload 7: Reject missing required fields', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'cameras', 'CAM-01');
    await assertFails(setDoc(docRef, {
      id: 'CAM-01',
      name: 'Gate Camera'
    }));
  });

  // 8. FPS overflow
  test('Payload 8: Reject too large FPS number', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'cameras', 'CAM-01');
    await assertFails(setDoc(docRef, {
      id: 'CAM-01',
      name: 'Front Gate Camera',
      type: 'IP',
      fps: 240 // Limit is 120
    }));
  });

  // 9. Attendance Log ID Mismatch
  test('Payload 9: Reject mismatched log ID', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'attendanceLogs', 'LOG-100');
    await assertFails(setDoc(docRef, {
      id: 'LOG-101',
      userId: 'U-EMP-01',
      userName: 'John Doe',
      status: 'In'
    }));
  });

  // 10. Mutation Attempt (Immutable logs)
  test('Payload 10: Reject mutations of logs', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'attendanceLogs', 'LOG-100');
    await assertFails(updateDoc(docRef, {
      status: 'Out'
    }));
  });

  // 11. Deletion Attempt
  test('Payload 11: Reject log deletions', async () => {
    const db = getAuthDb();
    const docRef = doc(db, 'attendanceLogs', 'LOG-100');
    await assertFails(deleteDoc(docRef));
  });

  // 12. Unauthenticated access
  test('Payload 12: Reject unauthenticated operations', async () => {
    const db = getUnauthDb();
    const docRef = doc(db, 'users', 'U-EMP-01');
    await assertFails(getDoc(docRef));
  });
});
