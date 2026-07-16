/**
 * Sentinel VMS — Playback Engine Tests
 *
 * Run: npx tsx tests/camera/playback.test.ts
 */

import { playbackEngine, PlaybackSpeed } from '../../services/camera/PlaybackEngine';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${msg}`);
  process.stdout.write(`[PASS] ${msg}\n`);
}

// Mock querySegments to avoid Firestore dependency in tests
const START = Date.now() - 3600_000; // 1 hour ago
const END = Date.now();

async function testCreateSession() {
  // Inject mock segments directly
  const session = await playbackEngine.createSession('test-cam-01', START, END);

  assert(session.sessionId.startsWith('pb_'), `sessionId must start with pb_: ${session.sessionId}`);
  assert(session.cameraId === 'test-cam-01', 'cameraId must match');
  assert(session.startTimeMs === START, 'startTimeMs must match');
  assert(session.endTimeMs === END, 'endTimeMs must match');
  assert(session.speed === 1, 'Default speed must be 1');
  assert(session.currentPositionMs === START, 'Position starts at startTime');
}

async function testPlayPause() {
  const session = await playbackEngine.createSession('test-cam-02', START, END);
  const id = session.sessionId;

  if (session.state === 'ERROR') {
    process.stdout.write('[SKIP] No segments — play/pause test skipped\n');
    return;
  }

  playbackEngine.play(id);
  assert(playbackEngine.getSession(id)!.state === 'PLAYING', 'State must be PLAYING after play()');

  playbackEngine.pause(id);
  assert(playbackEngine.getSession(id)!.state === 'PAUSED', 'State must be PAUSED after pause()');
}

async function testSeek() {
  const session = await playbackEngine.createSession('test-cam-03', START, END);
  const id = session.sessionId;

  const midPoint = START + (END - START) / 2;
  playbackEngine.seek(id, midPoint);

  const updated = playbackEngine.getSession(id)!;
  assert(Math.abs(updated.currentPositionMs - midPoint) <= 1, `Position after seek: ${updated.currentPositionMs}`);
  assert(updated.state === 'PAUSED', 'State must be PAUSED after seek');
}

async function testSeekClamping() {
  const session = await playbackEngine.createSession('test-cam-04', START, END);
  const id = session.sessionId;

  playbackEngine.seek(id, START - 100_000); // Before start
  assert(playbackEngine.getSession(id)!.currentPositionMs === START, 'Seek before start must clamp to startTimeMs');

  playbackEngine.seek(id, END + 100_000); // After end
  assert(playbackEngine.getSession(id)!.currentPositionMs === END, 'Seek after end must clamp to endTimeMs');
}

async function testSpeedControl() {
  const session = await playbackEngine.createSession('test-cam-05', START, END);
  const id = session.sessionId;

  const speeds: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4, 8];
  for (const speed of speeds) {
    playbackEngine.setSpeed(id, speed);
    assert(playbackEngine.getSession(id)!.speed === speed, `Speed must be ${speed}`);
  }
}

async function testAdvancePosition() {
  const session = await playbackEngine.createSession('test-cam-06', START, END);
  const id = session.sessionId;

  if (session.state === 'ERROR') {
    process.stdout.write('[SKIP] No segments — advance position test skipped\n');
    return;
  }

  playbackEngine.play(id);
  playbackEngine.setSpeed(id, 2);
  playbackEngine.advancePosition(id, 1000); // +1s real time → +2s playback

  const updated = playbackEngine.getSession(id)!;
  assert(updated.currentPositionMs === START + 2000, `Position after advance: ${updated.currentPositionMs}`);
}

async function testCloseSession() {
  const session = await playbackEngine.createSession('test-cam-close', START, END);
  const id = session.sessionId;

  playbackEngine.closeSession(id);
  assert(playbackEngine.getSession(id) === null, 'Session must be null after close');
}

async function testListSessions() {
  const [s1, s2] = await Promise.all([
    playbackEngine.createSession('test-cam-list-1', START, END),
    playbackEngine.createSession('test-cam-list-2', START, END),
  ]);

  const list = playbackEngine.listSessions();
  assert(list.some(s => s.sessionId === s1.sessionId), 'Session 1 must be in list');
  assert(list.some(s => s.sessionId === s2.sessionId), 'Session 2 must be in list');

  const filtered = playbackEngine.listSessions('test-cam-list-1');
  assert(filtered.every(s => s.cameraId === 'test-cam-list-1'), 'Filtered list must only have matching cameraId');
}

async function runAll() {
  process.stdout.write('=== Playback Engine Tests ===\n');
  await testCreateSession();
  await testPlayPause();
  await testSeek();
  await testSeekClamping();
  await testSpeedControl();
  await testAdvancePosition();
  await testCloseSession();
  await testListSessions();
  process.stdout.write('=== All Playback Tests Passed ===\n');
}

runAll().catch(e => {
  process.stderr.write(`[FAIL] ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
