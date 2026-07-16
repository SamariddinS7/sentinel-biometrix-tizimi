/**
 * Sentinel VMS — Frame Queue Tests
 * Tests for bounded queue, DROP_OLDEST policy, and stats.
 *
 * Run: npx tsx tests/camera/framequeue.test.ts
 */

import { frameQueueManager } from '../../services/camera/FrameQueue';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

async function testBasicEnqueueDequeue() {
  const cameraId = 'test-fq-01';
  frameQueueManager.createQueue(cameraId, 10);

  frameQueueManager.enqueue(cameraId, Buffer.from('frame1'), 1920, 1080, 'H264');
  frameQueueManager.enqueue(cameraId, Buffer.from('frame2'), 1920, 1080, 'H264');

  const frame = frameQueueManager.dequeue(cameraId);
  assert(frame !== null, 'Dequeue must return a frame');
  assert(frame!.cameraId === cameraId, `Frame cameraId must match: ${frame!.cameraId}`);
  assert(frame!.width === 1920, 'Frame width must be 1920');
  assert(frame!.height === 1080, 'Frame height must be 1080');
  assert(frame!.codec === 'H264', 'Frame codec must be H264');
  assert(frame!.data.toString() === 'frame1', 'Frame data must match');
}

async function testDropOldestPolicy() {
  const cameraId = 'test-fq-overflow';
  frameQueueManager.createQueue(cameraId, 3);

  // Enqueue 5 frames to overflow queue of size 3
  for (let i = 0; i < 5; i++) {
    frameQueueManager.enqueue(cameraId, Buffer.from(`f${i}`), 1280, 720, 'H264');
  }

  const stats = frameQueueManager.getStats(cameraId)!;
  assert(stats.size <= 3, `Queue size must be <= 3, got ${stats.size}`);
  assert(stats.totalDropped === 2, `Expected 2 dropped frames, got ${stats.totalDropped}`);
  assert(stats.dropRate > 0, 'Drop rate must be > 0');

  // Oldest 2 frames should have been dropped — first dequeue should get frame #2 (index 2)
  const first = frameQueueManager.dequeue(cameraId);
  assert(first?.data.toString() === 'f2', `Expected f2, got ${first?.data.toString()}`);
}

async function testSequenceNumbers() {
  const cameraId = 'test-fq-seq';
  frameQueueManager.createQueue(cameraId, 100);

  for (let i = 0; i < 5; i++) {
    frameQueueManager.enqueue(cameraId, Buffer.alloc(10), 640, 480, 'MJPEG');
  }

  let prevSeq = 0;
  for (let i = 0; i < 5; i++) {
    const frame = frameQueueManager.dequeue(cameraId);
    assert(frame !== null, `Frame ${i} must not be null`);
    assert(frame!.sequenceNumber > prevSeq, `Sequence must be monotonically increasing`);
    prevSeq = frame!.sequenceNumber;
  }
}

async function testEmitEvent() {
  return new Promise<void>((resolve, reject) => {
    const cameraId = 'test-fq-events';
    const timeout = setTimeout(() => reject(new Error('Event not fired')), 2000);

    frameQueueManager.once('frame', (frame) => {
      clearTimeout(timeout);
      try {
        assert(frame.cameraId === cameraId, 'Event frame cameraId must match');
        resolve();
      } catch (e) {
        reject(e);
      }
    });

    frameQueueManager.enqueue(cameraId, Buffer.from('event-test'), 320, 240, 'H264');
  });
}

async function testStats() {
  const cameraId = 'test-fq-stats';
  frameQueueManager.createQueue(cameraId, 50);

  frameQueueManager.enqueue(cameraId, Buffer.alloc(1000), 1920, 1080, 'H265');
  await new Promise(r => setTimeout(r, 50));
  frameQueueManager.enqueue(cameraId, Buffer.alloc(1000), 1920, 1080, 'H265');

  const stats = frameQueueManager.getStats(cameraId)!;
  assert(stats.totalFramesEnqueued === 2, `Expected 2 enqueued, got ${stats.totalFramesEnqueued}`);
  assert(stats.maxSize === 50, 'Max size must be 50');
  assert(stats.lastFrameAt !== null, 'lastFrameAt must be set');
}

async function runAll() {
  process.stdout.write('=== Frame Queue Tests ===\n');
  await testBasicEnqueueDequeue();
  await testDropOldestPolicy();
  await testSequenceNumbers();
  await testEmitEvent();
  await testStats();
  process.stdout.write('=== All Frame Queue Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n`);
  process.exit(1);
});
