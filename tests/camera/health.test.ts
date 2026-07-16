/**
 * Sentinel VMS — Health Monitor Tests
 *
 * Run: npx tsx tests/camera/health.test.ts
 */

import { healthMonitor, CameraHealthRecord } from '../../services/camera/HealthMonitor';
import { CameraHealth } from '../../services/camera/interfaces';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function testRegisterAndPoll() {
  const cameraId = 'test-health-01';
  let callCount = 0;

  const healthProvider = async (_id: string): Promise<CameraHealth> => {
    callCount++;
    return {
      state: 'STREAMING',
      latencyMs: 45,
      packetLossPct: 0.5,
      bandwidthBps: 2_048_000,
      fps: 25,
      resolution: '1920x1080',
      codec: 'H264',
      recordingStatus: 'ACTIVE',
      lastActive: new Date().toISOString(),
    };
  };

  healthMonitor.register(cameraId, healthProvider);

  // Wait for first poll to fire
  await sleep(200);
  healthMonitor.unregister(cameraId);

  const record = healthMonitor.getHealth(cameraId);
  assert(record !== null, 'Health record must exist after first poll');
  assert(record!.score > 80, `Health score must be > 80 for healthy camera: ${record!.score}`);
  assert(record!.fps === 25, `FPS must be 25: ${record!.fps}`);
  assert(record!.state === 'STREAMING', `State must be STREAMING: ${record!.state}`);
}

async function testOfflineCameraScoreZero() {
  const cameraId = 'test-health-offline';

  healthMonitor.register(cameraId, async (_id): Promise<CameraHealth> => ({
    state: 'OFFLINE',
    latencyMs: 9999,
    packetLossPct: 100,
    bandwidthBps: 0,
    fps: 0,
    resolution: '0x0',
    codec: 'H264',
    recordingStatus: 'ERROR',
    lastActive: new Date().toISOString(),
  }));

  await sleep(200);
  healthMonitor.unregister(cameraId);

  const record = healthMonitor.getHealth(cameraId);
  assert(record !== null, 'Health record must exist');
  assert(record!.score === 0, `Score must be 0 for OFFLINE camera: ${record!.score}`);
}

async function testHighLatencyDegrades() {
  const cameraId = 'test-health-latency';

  healthMonitor.register(cameraId, async (_id): Promise<CameraHealth> => ({
    state: 'STREAMING',
    latencyMs: 800, // Above threshold
    packetLossPct: 0,
    bandwidthBps: 2_000_000,
    fps: 25,
    resolution: '1920x1080',
    codec: 'H264',
    recordingStatus: 'ACTIVE',
    lastActive: new Date().toISOString(),
  }));

  await sleep(200);
  healthMonitor.unregister(cameraId);

  const record = healthMonitor.getHealth(cameraId);
  assert(record !== null, 'Health record must exist');
  assert(record!.score < 100, `Score must be < 100 for high latency: ${record!.score}`);
}

async function testStateChangeEvent() {
  return new Promise<void>((resolve, reject) => {
    const cameraId = 'test-health-event';
    const timeout = setTimeout(() => reject(new Error('stateChange event not fired')), 3000);

    // First poll → OFFLINE
    let firstPoll = true;
    healthMonitor.once('stateChange', ({ cameraId: id, next }: any) => {
      if (id === cameraId) {
        clearTimeout(timeout);
        assert(typeof next === 'string', 'state change next must be string');
        healthMonitor.unregister(cameraId);
        resolve();
      }
    });

    // Start with CONNECTING, then change to STREAMING after first poll
    healthMonitor.register(cameraId, async (_id): Promise<CameraHealth> => {
      if (firstPoll) {
        firstPoll = false;
        return { state: 'CONNECTING', latencyMs: 100, packetLossPct: 0, bandwidthBps: 0, fps: 0, resolution: '0x0', codec: 'H264', recordingStatus: 'IDLE', lastActive: new Date().toISOString() };
      }
      return { state: 'STREAMING', latencyMs: 50, packetLossPct: 0, bandwidthBps: 1_000_000, fps: 25, resolution: '1920x1080', codec: 'H264', recordingStatus: 'ACTIVE', lastActive: new Date().toISOString() };
    });
  });
}

async function testHistoryBuffer() {
  const cameraId = 'test-health-history';
  let pollCount = 0;

  healthMonitor.register(cameraId, async (_id): Promise<CameraHealth> => {
    pollCount++;
    return { state: 'STREAMING', latencyMs: 30 + pollCount, packetLossPct: 0, bandwidthBps: 1_000_000, fps: 25, resolution: '1920x1080', codec: 'H264', recordingStatus: 'ACTIVE', lastActive: new Date().toISOString() };
  });

  // Allow several polls by waiting; with POLL_INTERVAL_MS=10_000 in prod, this may not fire multiple times
  await sleep(200);
  healthMonitor.unregister(cameraId);

  const history = healthMonitor.getHistory(cameraId);
  assert(Array.isArray(history), 'History must be an array');
  assert(history.length >= 1, `History must have >= 1 entry: ${history.length}`);
}

async function runAll() {
  process.stdout.write('=== Health Monitor Tests ===\n');
  await testRegisterAndPoll();
  await testOfflineCameraScoreZero();
  await testHighLatencyDegrades();
  await testStateChangeEvent();
  await testHistoryBuffer();
  process.stdout.write('=== All Health Monitor Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
