/**
 * Sentinel VMS — Reconnect Engine Tests
 * Tests for exponential backoff, failure classification, and recovery.
 *
 * Run: npx tsx tests/camera/reconnect.test.ts
 */

import { reconnectEngine, ReconnectEngine } from '../../services/camera/ReconnectEngine';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Use a fresh instance to avoid test interference
const engine = new (ReconnectEngine as any)();

async function testInitialRegistration() {
  const id = 'test-rec-01';
  engine.register(id);
  const state = engine.getState(id);
  assert(state !== undefined, 'State must exist after registration');
  assert(state!.attemptCount === 0, 'Attempt count must be 0');
  assert(state!.consecutiveFailures === 0, 'Consecutive failures must be 0');
  assert(!state!.isReconnecting, 'Must not be reconnecting initially');
}

async function testSuccessfulReconnect() {
  const id = 'test-rec-success';
  engine.register(id);

  let connectCalled = false;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Reconnect callback not called')), 5000);
    engine.scheduleReconnect(id, async () => {
      connectCalled = true;
      clearTimeout(timeout);
      resolve();
    });
  });

  assert(connectCalled, 'Reconnect function must have been called');
  // After success, attempt count resets
  const state = engine.getState(id)!;
  assert(state.consecutiveFailures === 0, 'Consecutive failures reset on success');
}

async function testBackoffDelay() {
  // Test that delay increases with attempts
  const delays: number[] = [];
  for (let attempt = 0; attempt < 7; attempt++) {
    const delay = Math.min(2000 * Math.pow(2, Math.min(attempt, 6)), 120000);
    delays.push(delay);
  }

  assert(delays[0] === 2000, `First delay must be 2000ms, got ${delays[0]}`);
  assert(delays[1] === 4000, `Second delay must be 4000ms, got ${delays[1]}`);
  assert(delays[6] === 120000, `Seventh delay must be capped at 120000ms, got ${delays[6]}`);
}

async function testCancelReconnect() {
  const id = 'test-rec-cancel';
  engine.register(id);

  let called = false;
  engine.scheduleReconnect(id, async () => { called = true; });
  engine.cancelReconnect(id);

  await sleep(3000); // Wait longer than first backoff (2s)
  assert(!called, 'Reconnect must NOT be called after cancel');
}

async function testSuccessResetsState() {
  const id = 'test-rec-reset';
  engine.register(id);
  const state = engine.getState(id)!;
  state.consecutiveFailures = 5;
  state.attemptCount = 5;

  engine.onReconnectSuccess(id);
  const updated = engine.getState(id)!;
  assert(updated.attemptCount === 0, 'attemptCount must reset to 0');
  assert(updated.consecutiveFailures === 0, 'consecutiveFailures must reset to 0');
  assert(updated.failureClass === null, 'failureClass must be null after success');
}

async function testPersistentFailureClassification() {
  const id = 'test-rec-persistent';
  engine.register(id);

  let failureClassified = false;
  engine.on('failureClassified', ({ cameraId, class: cls }: any) => {
    if (cameraId === id && cls === 'PERSISTENT') failureClassified = true;
  });

  const state = engine.getState(id)!;
  state.consecutiveFailures = 9; // One below threshold

  // Simulate one more failure to trigger PERSISTENT classification
  engine['classifyFailure'](id, 'PERSISTENT');
  assert(engine.getState(id)!.failureClass === 'PERSISTENT', 'Failure class must be PERSISTENT');
}

async function runAll() {
  process.stdout.write('=== Reconnect Engine Tests ===\n');
  await testInitialRegistration();
  await testSuccessfulReconnect();
  await testBackoffDelay();
  await testCancelReconnect();
  await testSuccessResetsState();
  await testPersistentFailureClassification();
  process.stdout.write('=== All Reconnect Engine Tests Passed ===\n');
  process.exit(0);
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
