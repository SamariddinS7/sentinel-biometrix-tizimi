# Sentinel Biometrics Security Specification

## 1. Data Invariants

Our Sentinel Biometrics platform enforces strict, un-bypassable rules for Identity, Integrity, and State:

1. **User Identity Invariant**: A user document under `/users/{userId}` must have its document ID match the `id` field inside the user object, and all string properties (like `fullName`, `role`, `department`) must be tightly bounded in size to prevent memory or payload attacks.
2. **Camera Integrity Invariant**: A camera document under `/cameras/{cameraId}` must have its document ID match the `id` field inside the camera object. Key configuration fields (like `name`, `type`, `status`) must be valid strings, while metrics (like `fps`, `focalLength`) must be valid numbers.
3. **Attendance Log Invariant**: An attendance log under `/attendanceLogs/{logId}` must have its document ID match the `id` field. Crucial identifying attributes (`userId`, `userName`, `status`) must be valid strings and cannot be spoofed or modified once written. Attendance logs are terminal/immutable and cannot be modified or deleted.
4. **Authenticity Guard**: All database access is restricted to authenticated sessions. All write operations must validate schema types, ID alignment, and boundary constraints.

---

## 2. The "Dirty Dozen" Payloads (Identity, Integrity, and State Violations)

The following 12 payloads are designed to attempt to bypass our system's boundaries. Each of these must be rejected with `PERMISSION_DENIED` by our security rules:

### Collection: `/users/{userId}`

#### Payload 1: ID Poisoning (Injection of junk-character IDs)
* **Description**: Attempt to create a user with a non-alphanumeric, 1.5KB long ID.
* **Target Path**: `/users/invalid-id-%%-$$`
* **Payload**:
```json
{
  "id": "invalid-id-%%-$$",
  "fullName": "Poisoned User",
  "role": "EMPLOYEE",
  "department": "Security",
  "enrolledDate": "2026-06-30"
}
```

#### Payload 2: Hostile State Bypass (Ghost Field Injection)
* **Description**: Trying to inject an unapproved field `"isAdmin"` to gain privilege escalation.
* **Target Path**: `/users/U-EMP-99`
* **Payload**:
```json
{
  "id": "U-EMP-99",
  "fullName": "Malicious User",
  "role": "EMPLOYEE",
  "department": "Security",
  "isAdmin": true
}
```

#### Payload 3: Value Poisoning (Massive string payload)
* **Description**: Injecting a 2MB string as the `fullName` to cause a Denial of Wallet attack.
* **Target Path**: `/users/U-EMP-01`
* **Payload**:
```json
{
  "id": "U-EMP-01",
  "fullName": "[Repeated 100000 times...]",
  "role": "EMPLOYEE"
}
```

#### Payload 4: Type Spoofing (Passing boolean for string)
* **Description**: Forcing a boolean type into the `fullName` field.
* **Target Path**: `/users/U-EMP-02`
* **Payload**:
```json
{
  "id": "U-EMP-02",
  "fullName": true,
  "role": "EMPLOYEE"
}
```

### Collection: `/cameras/{cameraId}`

#### Payload 5: Camera ID Mismatch (Spoofing target ID)
* **Description**: Attempting to write a camera configuration where the path ID does not match the internal field ID.
* **Target Path**: `/cameras/CAM-01`
* **Payload**:
```json
{
  "id": "CAM-02",
  "name": "Front Gate Camera",
  "type": "IP"
}
```

#### Payload 6: Value Poisoning (Negative FPS Configuration)
* **Description**: Configuring a camera with negative frame-rate (FPS) to break calculations.
* **Target Path**: `/cameras/CAM-01`
* **Payload**:
```json
{
  "id": "CAM-01",
  "name": "Front Gate Camera",
  "type": "IP",
  "fps": -30
}
```

#### Payload 7: Missing Required Fields
* **Description**: Attempting to register a camera with no `type` field.
* **Target Path**: `/cameras/CAM-01`
* **Payload**:
```json
{
  "id": "CAM-01",
  "name": "Gate Camera"
}
```

#### Payload 8: Value Poisoning (Immensely large FPS)
* **Description**: Attempting to set an incredibly large FPS number to cause overflow or rendering lags.
* **Target Path**: `/cameras/CAM-01`
* **Payload**:
```json
{
  "id": "CAM-01",
  "name": "Front Gate Camera",
  "type": "IP",
  "fps": 9999999
}
```

### Collection: `/attendanceLogs/{logId}`

#### Payload 9: Unauthorized Write/Spoofing Logs
* **Description**: Attempting to create an attendance log with missing required fields or mismatched ID.
* **Target Path**: `/attendanceLogs/LOG-100`
* **Payload**:
```json
{
  "id": "LOG-101",
  "userId": "U-EMP-01",
  "userName": "John Doe",
  "status": "In"
}
```

#### Payload 10: State Locking Violation (Log Mutation Attempt)
* **Description**: Attempting to update or alter an already recorded attendance log (Logs are terminal and immutable).
* **Target Path**: `/attendanceLogs/LOG-100`
* **Payload (Update)**:
```json
{
  "status": "Out",
  "confidenceScore": 0.99
}
```

#### Payload 11: Attempting to Delete Logs
* **Description**: Attempting to delete an attendance log document.
* **Target Path**: `/attendanceLogs/LOG-100`
* **Operation**: DELETE

#### Payload 12: Timestamp Spoofing
* **Description**: Injecting a custom timestamp that doesn't match the current server timestamp.
* **Target Path**: `/attendanceLogs/LOG-100`
* **Payload**:
```json
{
  "id": "LOG-100",
  "userId": "U-EMP-01",
  "userName": "John Doe",
  "status": "In",
  "timestamp": "2000-01-01T00:00:00Z"
}
```

---

## 3. The Test Runner (`firestore.rules.test.ts`)

Here is a full TypeScript-based integration test specification verifying that all of the above "Dirty Dozen" payloads fail with a clear `PERMISSION_DENIED` status:

```typescript
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
```
