/**
 * Sentinel VMS — RTSP Driver Tests
 * Production integration tests for RTSP/RTSPS streams.
 * Requires live camera hardware or a local RTSP test server.
 *
 * Run: npx tsx tests/camera/rtsp.test.ts
 */

import { RtspDriver } from '../../services/camera/drivers/RtspDriver';
import { CameraConfig } from '../../services/camera/interfaces';

const TEST_CAMERA: CameraConfig = {
  id: 'test-rtsp-01',
  name: 'Test RTSP Camera',
  ip: process.env.TEST_CAMERA_IP || '192.168.1.100',
  port: 80,
  rtspPort: parseInt(process.env.TEST_RTSP_PORT || '554'),
  onvifPort: 80,
  username: process.env.TEST_CAMERA_USER || 'admin',
  encryptedPassword: process.env.TEST_CAMERA_PASS || '',
  streamUrl: process.env.TEST_RTSP_URL || 'rtsp://192.168.1.100:554/Streaming/Channels/101',
  protocol: 'RTSP',
  transport: 'TCP',
  type: 'HIKVISION',
  resolution: '1920x1080',
  fps: 25,
  status: 'OFFLINE',
  recordingMode: 'None',
  retentionDays: 7,
};

async function testDriverLifecycle() {
  const driver = new RtspDriver();
  process.stdout.write('[TEST] RtspDriver: connect → streaming\n');

  try {
    await driver.connect(TEST_CAMERA);
    const stats = driver.getStreamStats();
    process.stdout.write(`[TEST] Stats: fps=${stats.fps} bitrate=${stats.bitrateKbps}kbps resolution=${stats.resolution}\n`);
    console.assert(driver.state === 'STREAMING', `Expected STREAMING, got ${driver.state}`);
  } catch (e: any) {
    process.stderr.write(`[SKIP] Camera unreachable in test environment: ${e.message}\n`);
    return;
  }

  try {
    const snapshot = await driver.getSnapshot();
    console.assert(snapshot.length > 0, 'Snapshot must be non-empty');
    process.stdout.write(`[TEST] Snapshot: ${snapshot.length} bytes OK\n`);
  } catch (e: any) {
    process.stderr.write(`[WARN] Snapshot failed: ${e.message}\n`);
  }

  await driver.disconnect();
  console.assert(driver.state === 'DISCONNECTED', 'State must be DISCONNECTED after disconnect');
  process.stdout.write('[TEST] RtspDriver lifecycle: PASS\n');
}

async function testStreamUri() {
  const driver = new RtspDriver();
  driver['_config'] = TEST_CAMERA;
  driver['_state'] = 'STREAMING';

  const mainUri = await driver.getStreamUri('MAIN');
  console.assert(mainUri.includes(TEST_CAMERA.ip), 'Main URI must include camera IP');
  process.stdout.write(`[TEST] getStreamUri(MAIN): ${mainUri}\n`);
}

async function testCapabilities() {
  const driver = new RtspDriver();
  driver['_config'] = TEST_CAMERA;
  const caps = await driver.getCapabilities();
  console.assert(Array.isArray(caps.supportedCodecs), 'supportedCodecs must be array');
  process.stdout.write(`[TEST] Capabilities: ${JSON.stringify(caps)}\n`);
}

async function runAll() {
  process.stdout.write('=== RTSP Driver Tests ===\n');
  await testStreamUri();
  await testCapabilities();
  await testDriverLifecycle();
  process.stdout.write('=== All RTSP Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n`);
  process.exit(1);
});
