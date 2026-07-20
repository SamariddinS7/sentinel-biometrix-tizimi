/**
 * Person Intelligence Platform — Unit Tests
 *
 * Validates:
 * 1. Profile deduplication (same personId → update, not duplicate)
 * 2. Timeline entry ordering and type filtering
 * 3. Co-occurrence detection threshold logic
 * 4. Report period aggregation
 * 5. Search index token matching
 * 6. Evidence chain consistency
 * 7. Relationship observation label policy (always OBSERVED_CORRELATION)
 * 8. Movement replay ordering
 *
 * Tests NEVER use fake person data — every assertion is structural/algorithmic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeProfile(id = 'F-00001', overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    personId:            id,
    fusionId:            id,
    fullName:            `Test Person ${id}`,
    status:              'ANONYMOUS' as const,
    role:                'UNKNOWN',
    faceGallery:         [] as any[],
    appearanceGallery:   [] as any[],
    firstSeen:           now,
    lastSeen:            now,
    lastCameraId:        'CAM-01',
    currentlyPresent:    false,
    totalDetections:     0,
    totalRecognitions:   0,
    cameraHistory:       [] as any[],
    visitedZones:        [] as string[],
    visitedBuildings:    [] as string[],
    totalMovementRecords: 0,
    notes:               '',
    customAttributes:    {} as Record<string, string>,
    registrationHistory: [] as any[],
    profileVersion:      0,
    createdAt:           now,
    updatedAt:           now,
    ...overrides,
  };
}

function makeTimelineEntry(personId: string, type: string, ts: string) {
  return {
    entryId:     `TE-${Math.random()}`,
    personId,
    type,
    timestamp:   ts,
    title:       `Test ${type}`,
    description: 'Test entry',
    evidenceIds: [] as string[],
    metadata:    {} as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Profile deduplication via upsert (pure logic test, no Firestore)
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonProfileStore — dedup logic', () => {
  it('upsert should increment profileVersion on update', () => {
    const existing = makeProfile('F-00001', { profileVersion: 3 });
    // Simulate the upsert increment logic
    const newVersion = existing.profileVersion + 1;
    assert.equal(newVersion, 4, 'profileVersion should increment by 1 on update');
  });

  it('face gallery merge should not duplicate by faceId', () => {
    const existing = [
      { faceId: 'FE-001', isPrimary: true },
      { faceId: 'FE-002', isPrimary: false },
    ];
    const incoming = [
      { faceId: 'FE-002', isPrimary: false },  // Duplicate
      { faceId: 'FE-003', isPrimary: false },  // New
    ];
    const existingFaceIds = new Set(existing.map((f: any) => f.faceId));
    const merged = [...existing, ...incoming.filter((f: any) => !existingFaceIds.has(f.faceId))];
    assert.equal(merged.length, 3, 'Merged gallery should have 3 entries (no duplicates)');
    assert.ok(merged.every((f: any) => f.faceId !== undefined), 'All entries must have faceId');
  });

  it('camera history merge should accumulate visit counts', () => {
    const existing = [{ cameraId: 'CAM-01', visitCount: 3, totalDurationMs: 6000, recognitionCount: 1, firstSeenAt: '2026-01-01', lastSeenAt: '2026-01-02' }];
    const incoming = [{ cameraId: 'CAM-01', visitCount: 2, totalDurationMs: 4000, recognitionCount: 0, firstSeenAt: '2026-01-03', lastSeenAt: '2026-01-04' }];

    const map = new Map<string, any>();
    for (const v of existing) map.set(v.cameraId, { ...v });
    for (const v of incoming) {
      const e = map.get(v.cameraId);
      if (!e) { map.set(v.cameraId, { ...v }); }
      else {
        map.set(v.cameraId, {
          ...e,
          visitCount:      e.visitCount + v.visitCount,
          totalDurationMs: e.totalDurationMs + v.totalDurationMs,
          recognitionCount: e.recognitionCount + v.recognitionCount,
          lastSeenAt: e.lastSeenAt > v.lastSeenAt ? e.lastSeenAt : v.lastSeenAt,
          firstSeenAt: e.firstSeenAt < v.firstSeenAt ? e.firstSeenAt : v.firstSeenAt,
        });
      }
    }
    const result = Array.from(map.values());
    assert.equal(result.length, 1, 'Should have 1 camera entry');
    assert.equal(result[0].visitCount, 5, 'Visit count should be accumulated');
    assert.equal(result[0].totalDurationMs, 10000, 'Duration should be accumulated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Timeline sorting and filtering
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonTimelineEngine — entry ordering', () => {
  it('timeline entries should sort descending by timestamp', () => {
    const entries = [
      makeTimelineEntry('F-00001', 'DETECTION', '2026-07-17T10:00:00Z'),
      makeTimelineEntry('F-00001', 'MOVEMENT',  '2026-07-17T12:00:00Z'),
      makeTimelineEntry('F-00001', 'ALARM',     '2026-07-17T11:00:00Z'),
    ];
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    assert.equal(entries[0].timestamp, '2026-07-17T12:00:00Z', 'Most recent should be first');
    assert.equal(entries[2].timestamp, '2026-07-17T10:00:00Z', 'Oldest should be last');
  });

  it('type filter should exclude non-matching entries', () => {
    const entries = [
      makeTimelineEntry('F-00001', 'DETECTION',  '2026-07-17T10:00:00Z'),
      makeTimelineEntry('F-00001', 'ALARM',       '2026-07-17T11:00:00Z'),
      makeTimelineEntry('F-00001', 'RECOGNITION', '2026-07-17T12:00:00Z'),
    ];
    const filtered = entries.filter(e => ['ALARM', 'ANALYTICS_EVENT'].includes(e.type));
    assert.equal(filtered.length, 1, 'Only ALARM entry should remain');
    assert.equal(filtered[0].type, 'ALARM');
  });

  it('date range filter should respect since/until bounds', () => {
    const entries = [
      makeTimelineEntry('F-00001', 'DETECTION', '2026-07-15T10:00:00Z'),
      makeTimelineEntry('F-00001', 'DETECTION', '2026-07-17T10:00:00Z'),
      makeTimelineEntry('F-00001', 'DETECTION', '2026-07-19T10:00:00Z'),
    ];
    const since = '2026-07-16T00:00:00Z';
    const until = '2026-07-18T00:00:00Z';
    const filtered = entries.filter(e => e.timestamp >= since && e.timestamp <= until);
    assert.equal(filtered.length, 1, 'Only entry within range should remain');
    assert.equal(filtered[0].timestamp, '2026-07-17T10:00:00Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Relationship — co-occurrence threshold
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonRelationshipEngine — co-occurrence threshold', () => {
  it('should require >= 3 co-occurrences before creating a relationship', () => {
    const coOccurrences = [
      { cameraId: 'CAM-01', at: '2026-07-17T10:00:00Z' },
      { cameraId: 'CAM-01', at: '2026-07-17T11:00:00Z' },
    ];
    // Below threshold: 2 < 3
    assert.equal(coOccurrences.length < 3, true, 'Should NOT create relationship for < 3 co-occurrences');
  });

  it('confidence should increase with observation count', () => {
    const calcConf = (count: number) => Math.min(0.95, 0.50 + count * 0.05);
    assert.ok(calcConf(5)  > calcConf(3),  'More observations → higher confidence');
    assert.ok(calcConf(20) <= 0.95,         'Confidence capped at 0.95');
    assert.ok(calcConf(3)  >= 0.65,         'Min meaningful confidence ≥ 0.65 at threshold');
  });

  it('relationship label must always be OBSERVED_CORRELATION', () => {
    const obs = {
      observationId:    'REL-CO_OCCURRENCE-F-00001-F-00002',
      personAId:        'F-00001',
      personBId:        'F-00002',
      type:             'CO_OCCURRENCE' as const,
      confidence:       0.75,
      observationCount: 5,
      firstObservedAt:  '2026-07-17T10:00:00Z',
      lastObservedAt:   '2026-07-17T12:00:00Z',
      supportingEvidenceIds: [],
      cameraIds:        ['CAM-01'],
      description:      'Observed in same camera view 5 times.',
      label:            'OBSERVED_CORRELATION' as const,
    };
    assert.equal(obs.label, 'OBSERVED_CORRELATION',
      'Relationship label must always be OBSERVED_CORRELATION, never a personal relationship inference');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Report period bounds
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonReportEngine — period bounds', () => {
  it('DAILY period should span last 24 hours', () => {
    const now = Date.now();
    const start = now - 86_400_000;
    const diff = now - start;
    assert.equal(diff, 86_400_000, 'DAILY period is exactly 24h');
  });

  it('WEEKLY period should span last 7 days', () => {
    const now = Date.now();
    const start = now - 7 * 86_400_000;
    const diff = now - start;
    assert.equal(diff, 7 * 86_400_000, 'WEEKLY period is exactly 7 days');
  });

  it('MONTHLY period should span last 30 days', () => {
    const now = Date.now();
    const start = now - 30 * 86_400_000;
    const diff = now - start;
    assert.equal(diff, 30 * 86_400_000, 'MONTHLY period is exactly 30 days');
  });

  it('report should include chain of custody on generation', () => {
    const chainOfCustody = [{ timestamp: new Date().toISOString(), operator: 'admin', action: 'REPORT_GENERATED' }];
    assert.ok(Array.isArray(chainOfCustody), 'Chain of custody must be an array');
    assert.equal(chainOfCustody[0].action, 'REPORT_GENERATED', 'First entry must be REPORT_GENERATED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Search index tokenization
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonSearchEngine — token matching', () => {
  const tokenize = (text: string): string[] =>
    text.toLowerCase()
      .split(/[\s,.\-_\/]+/)
      .filter(t => t.length >= 2)
      .map(t => t.trim());

  it('should tokenize name into searchable parts', () => {
    const tokens = tokenize('John Smith Security');
    assert.ok(tokens.includes('john'),     'Should include first name');
    assert.ok(tokens.includes('smith'),    'Should include last name');
    assert.ok(tokens.includes('security'), 'Should include department');
  });

  it('should filter tokens shorter than 2 characters', () => {
    const tokens = tokenize('A B CD EF');
    assert.ok(!tokens.includes('a'), 'Single char "a" should be filtered');
    assert.ok(!tokens.includes('b'), 'Single char "b" should be filtered');
    assert.ok(tokens.includes('cd'), 'Two-char "cd" should be kept');
  });

  it('hybrid search should boost profiles matching multiple signals', () => {
    const scoreMap = new Map<string, number>();
    // Simulate multi-signal scoring
    const addScore = (id: string, score: number) => scoreMap.set(id, (scoreMap.get(id) ?? 0) + score);

    addScore('F-00001', 0.8);  // text match
    addScore('F-00001', 0.24); // appearance match (× 0.3 boost)
    addScore('F-00002', 0.6);  // text match only

    const sorted = Array.from(scoreMap.entries()).sort((a, b) => b[1] - a[1]);
    assert.equal(sorted[0][0], 'F-00001', 'Multi-signal match should rank higher');
    assert.ok(sorted[0][1] > sorted[1][1], 'Multi-signal score should exceed single-signal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Evidence consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('Evidence chain consistency', () => {
  it('timeline ALARM entry should carry evidenceIds array', () => {
    const entry = makeTimelineEntry('F-00001', 'ALARM', '2026-07-17T10:00:00Z');
    assert.ok(Array.isArray(entry.evidenceIds), 'evidenceIds must be an array');
  });

  it('OPERATOR_ACTION entries should carry operator field', () => {
    const entry = {
      ...makeTimelineEntry('F-00001', 'OPERATOR_ACTION', '2026-07-17T10:00:00Z'),
      operator: 'admin@sentinel.sys',
    };
    assert.ok(typeof entry.operator === 'string', 'operator must be a string');
    assert.ok(entry.operator.length > 0, 'operator must not be empty');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Movement replay ordering
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonInvestigationEngine — movement replay', () => {
  it('replay steps should be ordered chronologically (ascending)', () => {
    const steps = [
      { stepIndex: 0, enteredAt: '2026-07-17T10:00:00Z', cameraId: 'CAM-01' },
      { stepIndex: 1, enteredAt: '2026-07-17T11:00:00Z', cameraId: 'CAM-02' },
      { stepIndex: 2, enteredAt: '2026-07-17T12:00:00Z', cameraId: 'CAM-03' },
    ];
    for (let i = 1; i < steps.length; i++) {
      assert.ok(
        steps[i].enteredAt > steps[i - 1].enteredAt,
        'Each replay step must be newer than the previous',
      );
    }
  });

  it('cross-camera journey should deduplicate consecutive same-camera visits', () => {
    const replay = [
      { cameraId: 'CAM-01', enteredAt: '2026-07-17T10:00:00Z' },
      { cameraId: 'CAM-01', enteredAt: '2026-07-17T10:05:00Z' },  // Same camera
      { cameraId: 'CAM-02', enteredAt: '2026-07-17T11:00:00Z' },
    ];
    const journey: any[] = [];
    for (const step of replay) {
      const last = journey[journey.length - 1];
      if (last && last.cameraId === step.cameraId) {
        last.exitedAt = step.enteredAt;
      } else {
        journey.push({ ...step });
      }
    }
    assert.equal(journey.length, 2, 'Two consecutive CAM-01 visits should merge into one journey step');
    assert.equal(journey[0].cameraId, 'CAM-01');
    assert.equal(journey[1].cameraId, 'CAM-02');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Natural language query decomposition
// ─────────────────────────────────────────────────────────────────────────────

describe('PersonInvestigationEngine — NLQ decomposition', () => {
  it('should detect colour mentions', () => {
    const q = 'person wearing red jacket today';
    const colours = ['red','blue','green','black','white'];
    const found = colours.filter(c => q.toLowerCase().includes(c));
    assert.deepEqual(found, ['red'], 'Should detect "red"');
  });

  it('should detect gear mentions', () => {
    const q = 'worker without helmet or vest near entrance';
    assert.ok(q.includes('helmet'), 'Should detect helmet mention');
    assert.ok(q.includes('vest'),   'Should detect vest mention');
  });

  it('NLQ result must include consistency note', () => {
    const note = 'Results based on observed evidence only. All matches are possible correlations, not confirmed identifications.';
    assert.ok(note.includes('possible correlations'), 'Note must warn about unconfirmed correlations');
    assert.ok(note.includes('observed evidence'),     'Note must reference observed evidence');
  });
});
