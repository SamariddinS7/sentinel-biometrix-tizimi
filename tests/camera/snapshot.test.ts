/**
 * Sentinel VMS — Snapshot Manager Tests
 *
 * Run: npx tsx tests/camera/snapshot.test.ts
 */

import { snapshotManager, SnapshotMetadata } from '../../services/camera/SnapshotManager';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

// Minimal JPEG (1×1 white pixel)
const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDB' +
  'kSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR' +
  'CAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAAD/8QAFBABAAAAA' +
  'AAAAAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAA' +
  'AAAAAAAP/9oADAMBAAIRAxEAPwCwABmX/9k=',
  'base64',
);

async function testManualSnapshot() {
  const cameraId = 'test-snap-01';
  snapshotManager.register(cameraId, 'Test Camera', async () => MINIMAL_JPEG);

  const meta = await snapshotManager.takeManualSnapshot(cameraId);

  assert(meta.id.startsWith('snap_'), `ID must start with snap_: ${meta.id}`);
  assert(meta.cameraId === cameraId, 'cameraId must match');
  assert(meta.trigger === 'MANUAL', `trigger must be MANUAL: ${meta.trigger}`);
  assert(meta.fileSizeBytes === MINIMAL_JPEG.length, `fileSizeBytes must match: ${meta.fileSizeBytes}`);
  assert(typeof meta.timestamp === 'string', 'timestamp must be string');
  assert(meta.thumbnailBase64 !== undefined, 'thumbnailBase64 must be set for small images');
}

async function testEventSnapshot() {
  const cameraId = 'test-snap-event';
  snapshotManager.register(cameraId, 'Event Camera', async () => MINIMAL_JPEG);

  const meta = await snapshotManager.takeEventSnapshot(cameraId, 'MOTION_ALERT_TEST');

  assert(meta.trigger === 'EVENT', `trigger must be EVENT: ${meta.trigger}`);
  assert(meta.triggerDetail === 'MOTION_ALERT_TEST', 'triggerDetail must match');
}

async function testScheduledSnapshot() {
  const cameraId = 'test-snap-sched';
  let snapCount = 0;
  snapshotManager.register(cameraId, 'Sched Camera', async () => {
    snapCount++;
    return MINIMAL_JPEG;
  });

  snapshotManager.on('snapshot', (meta: SnapshotMetadata) => {
    if (meta.cameraId === cameraId) {
      assert(meta.trigger === 'SCHEDULED', `Trigger must be SCHEDULED: ${meta.trigger}`);
    }
  });

  snapshotManager.scheduleSnapshots(cameraId, 100); // Every 100ms

  await new Promise(r => setTimeout(r, 350));
  snapshotManager.cancelSchedule(cameraId);

  assert(snapCount >= 2, `Expected >= 2 scheduled snapshots, got ${snapCount}`);
}

async function testNoProviderThrows() {
  const cameraId = 'test-snap-noprovider';
  try {
    await snapshotManager.takeManualSnapshot(cameraId);
    throw new Error('Should have thrown');
  } catch (e: any) {
    assert(e.message.includes('No snapshot provider'), `Wrong error: ${e.message}`);
    process.stdout.write('[PASS] No provider throws correct error\n');
  }
}

async function testEmptyBufferThrows() {
  const cameraId = 'test-snap-empty';
  snapshotManager.register(cameraId, 'Empty Cam', async () => Buffer.alloc(0));

  try {
    await snapshotManager.takeManualSnapshot(cameraId);
    throw new Error('Should have thrown');
  } catch (e: any) {
    assert(e.message.includes('empty frame'), `Wrong error: ${e.message}`);
    process.stdout.write('[PASS] Empty buffer throws correct error\n');
  }
}

async function runAll() {
  process.stdout.write('=== Snapshot Manager Tests ===\n');
  await testManualSnapshot();
  await testEventSnapshot();
  await testScheduledSnapshot();
  await testNoProviderThrows();
  await testEmptyBufferThrows();
  process.stdout.write('=== All Snapshot Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
