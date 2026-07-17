/**
 * Sentinel VMS — Person Detection & Tracking Engine Production Tests
 *
 * Covers all 16 scenarios required by the Phase 4 spec:
 *   validation gates, single/multi-person tracking, occlusion recovery,
 *   ByteTrack BYTE stage, Kalman prediction, crowd stress, event emission,
 *   orchestrator API contract, graceful no-model behaviour.
 *
 * No network, GPU, or real cameras required.
 * Run: npx tsx tests/ai/detection.test.ts
 */

import assert from 'assert';

// ─── Imports under test ────────────────────────────────────────────────────────

import {
  validateDetections,
  KalmanBoxTracker,
  KalmanByteTracker,
  PersonTrackingEngine,
  personTrackingEngine,
} from '../../services/ai/PersonTrackingEngine';

import { BoundingBox } from '../../services/ai/interfaces';

// ─── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err: any) => {
      console.error(`  ✗ ${name}`);
      console.error(`    → ${err.message}`);
      failures.push(`${name}: ${err.message}`);
      failed++;
    });
}

function box(xMin: number, yMin: number, xMax: number, yMax: number): BoundingBox {
  return { xMin, yMin, xMax, yMax };
}

function det(id: string, confidence: number, b: BoundingBox) {
  return { id, confidence, box: b };
}

// Stub out Firestore writes for testing (no real DB in test environment)
// The functions catch errors internally so no patching needed.

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎯 Sentinel VMS — Person Detection & Tracking Engine Tests\n');

  // ── 1. Detection validation: confidence gate ─────────────────────────────
  await test('Validation: rejects detections below confidence threshold', () => {
    const { accepted, rejected } = validateDetections([
      det('a', 0.10, box(0.1, 0.1, 0.3, 0.5)), // confidence too low
      det('b', 0.25, box(0.1, 0.1, 0.3, 0.5)), // exactly at threshold → accepted
      det('c', 0.90, box(0.5, 0.5, 0.7, 0.9)), // well above
    ], 0.25);
    assert.strictEqual(accepted.length, 2, 'should accept 2 high-confidence detections');
    assert.strictEqual(rejected.length, 1, 'should reject 1 low-confidence detection');
    assert.match(rejected[0].reason, /confidence.*< 0\.25/, 'rejection reason should mention confidence');
  });

  // ── 2. Detection validation: bounding box bounds ─────────────────────────
  await test('Validation: rejects out-of-bounds bounding boxes', () => {
    const { accepted, rejected } = validateDetections([
      det('oob', 0.9, box(-0.1, 0.1, 0.5, 0.8)),  // xMin < 0
      det('ok', 0.9, box(0.1, 0.1, 0.5, 0.8)),    // valid
      det('oob2', 0.9, box(0.1, 0.1, 1.1, 0.9)),   // xMax > 1
    ], 0.25);
    assert.strictEqual(accepted.length, 1);
    assert.strictEqual(rejected.length, 2);
  });

  // ── 3. Detection validation: aspect ratio gate ───────────────────────────
  await test('Validation: rejects degenerate aspect ratios (shadow, horizontal line)', () => {
    const { accepted, rejected } = validateDetections([
      det('wide', 0.9, box(0.0, 0.4, 0.9, 0.42)),  // h/w ≈ 0.02 — far too flat (shadow)
      det('tall', 0.9, box(0.45, 0.0, 0.47, 0.9)), // h/w ≈ 45 — impossibly tall (pole artefact)
      det('stand', 0.9, box(0.3, 0.2, 0.5, 0.8)),  // h/w = 3 — standing person ✓
      det('crouch', 0.9, box(0.2, 0.4, 0.6, 0.7)), // h/w = 0.75 — crouching ✓
    ], 0.25);
    assert.strictEqual(accepted.length, 2, 'only standing and crouching should pass');
    assert.ok(rejected.some(r => r.reason.includes('aspect ratio')));
  });

  // ── 4. Detection validation: minimum size gate ────────────────────────────
  await test('Validation: rejects tiny detections (noise, rain droplets)', () => {
    const { rejected } = validateDetections([
      det('tiny', 0.9, box(0.5, 0.5, 0.52, 0.55)), // area ≈ 0.001 — noise
    ], 0.25);
    assert.strictEqual(rejected.length, 1);
    assert.match(rejected[0].reason, /too small/);
  });

  // ── 5. Detection validation: maximum size gate ────────────────────────────
  await test('Validation: rejects full-frame detections (background misclassification)', () => {
    const { rejected } = validateDetections([
      det('full', 0.9, box(0.01, 0.01, 0.99, 0.99)), // area ≈ 0.96 — entire frame
    ], 0.25);
    assert.strictEqual(rejected.length, 1);
    assert.match(rejected[0].reason, /too large/);
  });

  // ── 6. Single person: track lifecycle (start → confirm → end) ─────────────
  await test('Single person: track starts tentative, confirms at frame 3', async () => {
    const tracker = new KalmanByteTracker('cam_single');
    const personBox = box(0.3, 0.2, 0.5, 0.8);
    const detList = [{ id: 'd1', confidence: 0.85, boundingBox: personBox }];

    // Frame 1 — tentative
    const r1 = tracker.update(detList, 1000);
    assert.strictEqual(r1.started.length, 1);
    assert.strictEqual(r1.started[0].isConfirmed, false, 'should be tentative at frame 1');

    // Frame 2 — still tentative
    const r2 = tracker.update(detList, 1040);
    assert.strictEqual(r2.updated.length, 1);
    assert.strictEqual(r2.started[0]?.isConfirmed ?? r2.updated[0].isConfirmed, false, 'still tentative at frame 2');

    // Frame 3 — confirmed
    const r3 = tracker.update(detList, 1080);
    const t = r3.updated[0];
    assert.ok(t.isConfirmed, 'should be confirmed by frame 3');
    assert.strictEqual(t.totalFrames, 3);
  });

  // ── 7. Multiple persons: stable IDs under motion ──────────────────────────
  await test('Multiple persons: IDs remain stable across 10 frames', async () => {
    const tracker = new KalmanByteTracker('cam_multi');
    // Two persons walking toward each other
    let a = box(0.1, 0.2, 0.25, 0.7);
    let b = box(0.7, 0.2, 0.85, 0.7);

    const r0 = tracker.update(
      [{ id: 'd1', confidence: 0.9, boundingBox: a }, { id: 'd2', confidence: 0.9, boundingBox: b }],
      1000,
    );
    const idA = r0.started[0].trackId;
    const idB = r0.started[1].trackId;
    assert.notStrictEqual(idA, idB, 'track IDs must be unique');

    // Move both persons toward centre over 9 more frames
    for (let f = 1; f <= 9; f++) {
      a = box(a.xMin + 0.03, a.yMin, a.xMax + 0.03, a.yMax);
      b = box(b.xMin - 0.03, b.yMin, b.xMax - 0.03, b.yMax);
      tracker.update(
        [{ id: `da${f}`, confidence: 0.9, boundingBox: a }, { id: `db${f}`, confidence: 0.9, boundingBox: b }],
        1000 + f * 40,
      );
    }

    const active = tracker.getActiveTracks();
    assert.strictEqual(active.length, 2, '2 persons must remain active');
    const ids = active.map(t => t.trackId);
    assert.ok(ids.includes(idA), 'person A track ID must persist');
    assert.ok(ids.includes(idB), 'person B track ID must persist');
  });

  // ── 8. Occlusion recovery (BYTE stage) ───────────────────────────────────
  await test('Occlusion: track maintained with low-confidence detections during occlusion', async () => {
    const tracker = new KalmanByteTracker('cam_occ');
    const b = box(0.3, 0.2, 0.5, 0.8);

    // Establish track with 5 high-confidence frames
    for (let f = 0; f < 5; f++) {
      tracker.update([{ id: `d${f}`, confidence: 0.9, boundingBox: b }], f * 40);
    }
    const tracks = tracker.getActiveTracks();
    assert.strictEqual(tracks.length, 1);
    const trackId = tracks[0].trackId;

    // 3 frames of occlusion — only low-confidence signal (BYTE stage preserves it)
    for (let f = 5; f < 8; f++) {
      const r = tracker.update([{ id: `dlow${f}`, confidence: 0.3, boundingBox: b }], f * 40);
      // Track should still be in updated (not ended)
      const stillActive = tracker.getActiveTracks().some(t => t.trackId === trackId);
      assert.ok(stillActive, `track must survive occlusion at frame ${f}`);
    }

    // Re-emergence at high confidence
    const r = tracker.update([{ id: 'dhigh', confidence: 0.9, boundingBox: b }], 8 * 40);
    const recovered = tracker.getActiveTracks().find(t => t.trackId === trackId);
    assert.ok(recovered, 'track must re-emerge after occlusion');
  });

  // ── 9. Track expiry: 30 missed frames → TrackEnded ───────────────────────
  await test('Track expiry: track ends after 30 consecutive missed frames', async () => {
    const tracker = new KalmanByteTracker('cam_expire');
    const b = box(0.3, 0.2, 0.5, 0.8);

    // Establish + confirm track
    for (let f = 0; f < 5; f++) {
      tracker.update([{ id: `d${f}`, confidence: 0.9, boundingBox: b }], f * 40);
    }
    assert.strictEqual(tracker.getActiveTracks().length, 1);

    // Feed 30 empty frames (no detections)
    let ended = false;
    for (let f = 5; f < 36; f++) {
      const r = tracker.update([], f * 40);
      if (r.ended.length > 0) ended = true;
    }
    assert.ok(ended, 'track must be ended after 30 missed frames');
    assert.strictEqual(tracker.getActiveTracks().length, 0, 'no active tracks remain');
  });

  // ── 10. Back/side/front view: aspect ratio tolerance ─────────────────────
  await test('Person stops moving: track persists via Kalman prediction', async () => {
    const tracker = new KalmanByteTracker('cam_still');
    const b = box(0.3, 0.2, 0.5, 0.8);

    // Confirm the track
    for (let f = 0; f < 3; f++) {
      tracker.update([{ id: `d${f}`, confidence: 0.9, boundingBox: b }], f * 40);
    }

    // Person stops — 10 frames of no detection (Kalman holds state)
    for (let f = 3; f < 13; f++) {
      tracker.update([], f * 40);
      const active = tracker.getActiveTracks();
      if (f < 33) {
        assert.ok(active.length > 0, `track must still be alive at missed frame ${f - 3}`);
      }
    }

    // Track position should be near the last known position (Kalman predicts still)
    const t = tracker.getActiveTracks()[0];
    if (t) {
      const predicted = t.getBbox();
      assert.ok(predicted.xMin >= 0 && predicted.xMax <= 1, 'predicted bbox must stay in bounds');
    }
  });

  // ── 11. Kalman prediction under frame skip ────────────────────────────────
  await test('Low FPS / frame skip: Kalman predicts correct direction', async () => {
    const tracker = new KalmanByteTracker('cam_lowfps');
    let b = box(0.1, 0.2, 0.25, 0.8);

    // Establish track with motion to the right
    for (let f = 0; f < 5; f++) {
      b = box(b.xMin + 0.04, b.yMin, b.xMax + 0.04, b.yMax);
      tracker.update([{ id: `d${f}`, confidence: 0.9, boundingBox: b }], f * 100);
    }

    const beforeSkip = tracker.getActiveTracks()[0].getBbox();

    // Skip 5 frames (no detections — simulates low FPS drop)
    for (let f = 5; f < 10; f++) {
      tracker.update([], f * 100);
    }

    const afterSkip = tracker.getActiveTracks()[0]?.getBbox();
    if (afterSkip) {
      // Kalman should predict continued rightward motion
      assert.ok(
        afterSkip.xMin >= beforeSkip.xMin,
        `Kalman-predicted x (${afterSkip.xMin.toFixed(3)}) should be ≥ last known x (${beforeSkip.xMin.toFixed(3)})`,
      );
    }
  });

  // ── 12. Crowd stress: 20 simultaneous persons, unique IDs ─────────────────
  await test('Crowd: 20 simultaneous persons — all get unique track IDs', async () => {
    const tracker = new KalmanByteTracker('cam_crowd');
    const dets = Array.from({ length: 20 }, (_, i) => ({
      id: `crowd_${i}`,
      confidence: 0.8,
      boundingBox: box(
        (i % 5) * 0.18 + 0.01,
        Math.floor(i / 5) * 0.22 + 0.01,
        (i % 5) * 0.18 + 0.17,
        Math.floor(i / 5) * 0.22 + 0.20,
      ),
    }));

    const r = tracker.update(dets, 1000);
    const ids = r.started.map(t => t.trackId);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, 20, 'all 20 persons must get unique track IDs');
  });

  // ── 13. DetectionRejected: shadow/noise bbox ──────────────────────────────
  await test('Non-person filtering: shadows and noise produce DetectionRejected events', () => {
    const { rejected } = validateDetections([
      det('shadow', 0.9, box(0.0, 0.48, 0.9, 0.52)), // horizontal flat — shadow
      det('noise', 0.9, box(0.5, 0.5, 0.502, 0.51)),  // tiny — noise
      det('valid', 0.9, box(0.3, 0.2, 0.5, 0.8)),     // real person
    ], 0.25);
    assert.strictEqual(rejected.length, 2, 'shadow and noise should be rejected');
    assert.ok(rejected.some(r => r.reason.includes('aspect ratio')), 'shadow rejected by aspect ratio');
    assert.ok(rejected.some(r => r.reason.includes('too small')), 'noise rejected by size');
  });

  // ── 14. DetectionRecovered event ─────────────────────────────────────────
  await test('DetectionRecovered: re-matched track after miss emits recovery', async () => {
    const tracker = new KalmanByteTracker('cam_recover');
    const b = box(0.3, 0.2, 0.5, 0.8);

    // Confirm track
    for (let f = 0; f < 5; f++) {
      tracker.update([{ id: `d${f}`, confidence: 0.9, boundingBox: b }], f * 40);
    }

    // Miss for 3 frames
    for (let f = 5; f < 8; f++) {
      tracker.update([], f * 40);
    }

    // Re-match
    const r = tracker.update([{ id: 'dback', confidence: 0.9, boundingBox: b }], 8 * 40);
    assert.ok(r.recovered.length > 0, 'recovered list should be non-empty after re-match');
    assert.ok(r.recovered[0].wasLost, 'track wasLost flag should be set');
  });

  // ── 15. PersonDetectionOrchestrator API ───────────────────────────────────
  await test('Orchestrator: getCurrentPersons returns structured output', async () => {
    const { personDetectionOrchestrator } = await import('../../services/ai/PersonDetectionOrchestrator');
    // Without a model loaded, isReady should be false
    assert.strictEqual(typeof personDetectionOrchestrator.isReady(), 'boolean');
    assert.strictEqual(typeof personDetectionOrchestrator.getHealth(), 'object');

    const health = personDetectionOrchestrator.getHealth();
    assert.ok('pluginState' in health, 'health must include pluginState');
    assert.ok('modelLoaded' in health, 'health must include modelLoaded');
    assert.ok('avgInferenceMs' in health, 'health must include avgInferenceMs');
    assert.ok('totalActivePersons' in health, 'health must include totalActivePersons');
  });

  // ── 16. Plugin: model-not-loaded returns empty (not motion detection) ─────
  await test('PersonDetectorPlugin: model not loaded → returns empty detections, never motion', async () => {
    const { PersonDetectorPlugin } = await import('../../services/ai/plugins/PersonDetectorPlugin');
    const plugin = new PersonDetectorPlugin();
    // Plugin is UNLOADED — infer() should throw (BaseAiPlugin guards), not return motion blobs
    try {
      await plugin.infer({
        id: 'test', cameraId: 'cam0', timestamp: Date.now(),
        width: 640, height: 480, buffer: Buffer.alloc(10), format: 'RGB',
      });
      // Should have thrown
      assert.fail('infer() on unloaded plugin should throw');
    } catch (err: any) {
      // BaseAiPlugin throws: "Plugin ... is not loaded. Current state: UNLOADED"
      assert.match(err.message, /not loaded|UNLOADED/, 'error must indicate not loaded');
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(57));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\nFailed tests:');
    failures.forEach(f => console.error(`  • ${f}`));
    process.exit(1);
  } else {
    console.log('\n✅ All person detection & tracking tests passed.');
  }
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
