// @ts-nocheck
/**
 * PersonIntelApiRouter — 22-route REST API for the Person Intelligence Platform
 *
 * Mount in server.ts with:
 *   app.use('/api/persons', authenticateToken, personIntelApiRouter);
 *
 * All read routes: OPERATOR+, SUPERVISOR+, ADMIN
 * Destructive routes (archive, merge, watchlist): SUPERVISOR+, ADMIN
 * Report generation: OPERATOR+
 */

import { Router, Request, Response } from 'express';
import { personProfileStore }       from './PersonProfileStore';
import { personTimelineEngine }     from './PersonTimelineEngine';
import { personInvestigationEngine } from './PersonInvestigationEngine';
import { personRelationshipEngine } from './PersonRelationshipEngine';
import { personSearchEngine }       from './PersonSearchEngine';
import { personReportEngine }       from './PersonReportEngine';
import { vmsAuditService }          from '../vmsAuditService';
import type { PersonSearchQuery, ReportType, ReportPeriod } from './types/PersonProfile';

export const personIntelApiRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown): void {
  res.json({ success: true, data });
}
function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}
function operator(req: Request): string {
  return (req as any).user?.id ?? (req as any).user?.email ?? 'unknown';
}
function isSupervisorOrAdmin(req: Request): boolean {
  const role = (req as any).user?.role;
  return role === 'ADMIN' || role === 'SUPERVISOR';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/persons — list / search profiles
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/', async (req: Request, res: Response) => {
  const { status, limit, offset, cameraId } = req.query as Record<string, string>;
  const profiles = await personProfileStore.list({
    status: status as any,
    cameraId,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  ok(res, { profiles, count: profiles.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/persons — manually enroll a person
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/', async (req: Request, res: Response) => {
  if (!isSupervisorOrAdmin(req)) return fail(res, 403, 'Supervisor or Admin required');
  const { personId, fullName, employeeId, department, organization, position, userId, notes } = req.body ?? {};
  if (!personId || !fullName) return fail(res, 400, 'personId and fullName are required');

  const now = new Date().toISOString();
  const profile = await personProfileStore.upsert({
    personId,
    fullName,
    employeeId,
    department,
    organization,
    position,
    userId,
    notes:             notes ?? '',
    status:            'KNOWN',
    role:              'EMPLOYEE',
    faceGallery:       [],
    appearanceGallery: [],
    firstSeen:         now,
    lastSeen:          now,
    lastCameraId:      '',
    currentlyPresent:  false,
    totalDetections:   0,
    totalRecognitions: 0,
    cameraHistory:     [],
    visitedZones:      [],
    visitedBuildings:  [],
    totalMovementRecords: 0,
    customAttributes:  {},
    registrationHistory: [{
      eventId:   `RE-${Date.now()}`,
      timestamp: now,
      operator:  operator(req),
      action:    'MANUALLY_ENROLLED',
      details:   `Manually enrolled by ${operator(req)}.`,
    }],
    profileVersion:    0,
    createdAt:         now,
    updatedAt:         now,
  });

  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_MANUALLY_ENROLLED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Person ${personId} (${fullName}) manually enrolled.`,
  });

  ok(res, { profile });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/persons/statistics/system — system-wide person stats
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/statistics/system', async (req: Request, res: Response) => {
  const profiles = await personProfileStore.list({ limit: 2000 });
  const byStatus: Record<string, number> = {};
  let present = 0;
  for (const p of profiles) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    if (p.currentlyPresent) present++;
  }
  ok(res, {
    totalProfiles:      profiles.length,
    currentlyPresent:   present,
    byStatus,
    cacheSize:          personProfileStore.cacheSize(),
    searchIndexSize:    personSearchEngine.indexSize(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/persons/search — unified search
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/search', async (req: Request, res: Response) => {
  const searchQuery: PersonSearchQuery = req.body ?? {};
  if (!searchQuery.mode) searchQuery.mode = 'PERSON_SEARCH';
  const results = await personSearchEngine.search(searchQuery);
  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_SEARCH',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Search (${searchQuery.mode}): "${searchQuery.text ?? ''}" → ${results.length} results.`,
  });
  ok(res, { results, count: results.length, mode: searchQuery.mode });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/persons/search/face
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/search/face', async (req: Request, res: Response) => {
  const { descriptor, threshold } = req.body ?? {};
  if (!Array.isArray(descriptor)) return fail(res, 400, 'descriptor array required');
  const results = await personInvestigationEngine.findByFace(descriptor, threshold ?? 0.65);
  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'FACE_SEARCH',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Face search → ${results.length} results.`,
  });
  ok(res, { results, count: results.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/persons/search/appearance
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/search/appearance', async (req: Request, res: Response) => {
  const { attrs, threshold } = req.body ?? {};
  const results = await personInvestigationEngine.findByAppearance(attrs ?? {}, threshold ?? 0.5);
  ok(res, { results, count: results.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/persons/search/similarity
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/search/similarity', async (req: Request, res: Response) => {
  const { personId, threshold } = req.body ?? {};
  if (!personId) return fail(res, 400, 'personId required');
  const results = await personInvestigationEngine.findBySimilarity(String(personId), threshold ?? 0.70);
  ok(res, { results, count: results.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/persons/search/nlq — natural language query
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/search/nlq', async (req: Request, res: Response) => {
  const { query } = req.body ?? {};
  if (!query || typeof query !== 'string') return fail(res, 400, 'query string required');
  const result = await personInvestigationEngine.searchNaturalLanguage(query);
  ok(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/persons/merge
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/merge', async (req: Request, res: Response) => {
  if (!isSupervisorOrAdmin(req)) return fail(res, 403, 'Supervisor or Admin required');
  const { primaryId, secondaryId } = req.body ?? {};
  if (!primaryId || !secondaryId) return fail(res, 400, 'primaryId and secondaryId required');
  await personProfileStore.merge(String(primaryId), String(secondaryId), operator(req));
  ok(res, { merged: true, primaryId, secondaryId });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/persons/find-or-create
// Resolves or auto-creates a profile from live detection data.
// Tries: trackId → fusionId → userId → creates new.
// Used by PersonInfoModal "View Profile" button.
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/find-or-create', async (req: Request, res: Response) => {
  const { trackId, fusionId, userId, name, role, department, cameraId, location } = req.body ?? {};

  // 1. Try fusionId (F-XXXXX) directly
  if (fusionId) {
    const p = await personProfileStore.getByFusionId(String(fusionId));
    if (p) return ok(res, { personId: p.personId, profile: p, created: false });
  }

  // 2. Try trackId resolution
  if (trackId) {
    const p = await personProfileStore.getByTrackId(String(trackId));
    if (p) return ok(res, { personId: p.personId, profile: p, created: false });
  }

  // 3. Try userId match (scan recent profiles)
  if (userId) {
    const all = await personProfileStore.list({ limit: 500 });
    const matched = all.find(p => p.userId === String(userId));
    if (matched) return ok(res, { personId: matched.personId, profile: matched, created: false });
  }

  // 4. Auto-create a new profile for this live detection
  const isKnown = !!(name && name !== 'UNKNOWN' && userId);
  const now = new Date().toISOString();
  // Use userId as base if known, otherwise generate from trackId
  const personId = isKnown
    ? `USR-${String(userId).slice(0, 8)}`
    : `TRK-${String(trackId || Date.now()).slice(-8)}`;

  // Check if personId already exists (race condition guard)
  const existing = await personProfileStore.get(personId);
  if (existing) return ok(res, { personId: existing.personId, profile: existing, created: false });

  const profile = await personProfileStore.upsert({
    personId,
    fusionId:     fusionId ?? undefined,
    userId:       userId   ?? undefined,
    fullName:     (name && name !== 'UNKNOWN') ? String(name) : `Anonymous-${personId.slice(-5)}`,
    employeeId:   undefined,
    department:   department ?? undefined,
    organization: undefined,
    position:     undefined,
    status:       isKnown ? 'KNOWN' : 'ANONYMOUS',
    role:         role ?? 'UNKNOWN',
    faceGallery:       [],
    appearanceGallery: [],
    firstSeen:    now,
    lastSeen:     now,
    lastCameraId: cameraId ?? '',
    currentlyPresent: true,
    totalDetections:   1,
    totalRecognitions: isKnown ? 1 : 0,
    cameraHistory:     cameraId ? [{
      cameraId:        String(cameraId),
      cameraName:      String(cameraId),
      location:        location ?? 'Live Camera Feed',
      firstSeenAt:     now,
      lastSeenAt:      now,
      visitCount:      1,
      totalDurationMs: 0,
      recognitionCount: isKnown ? 1 : 0,
    }] : [],
    visitedZones:     location ? [String(location)] : [],
    visitedBuildings: [],
    totalMovementRecords: 0,
    notes:            '',
    customAttributes: {},
    registrationHistory: [{
      eventId:   `RE-${Date.now()}`,
      timestamp: now,
      operator:  operator(req),
      action:    'AUTO_CREATED',
      details:   `Auto-created from live camera detection. TrackId: ${trackId}, Camera: ${cameraId}.`,
    }],
    profileVersion: 0,
    createdAt:     now,
    updatedAt:     now,
  });

  // Register trackId → personId for future lookups
  if (trackId) personProfileStore.registerTrackMapping(String(trackId), personId);

  ok(res, { personId, profile, created: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/persons/by-fusion/:fusionId — look up profile by F-XXXXX fusion ID
// Used by PersonProfilePanel when a bounding-box click supplies a fusionId.
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/by-fusion/:fusionId', async (req: Request, res: Response) => {
  const fusionId = String(req.params.fusionId);
  const profile  = await personProfileStore.getByFusionId(fusionId);
  if (!profile) return fail(res, 404, 'Person not found');
  ok(res, profile);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/persons/by-track/:trackId — look up profile by raw track ID
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/by-track/:trackId', async (req: Request, res: Response) => {
  const trackId = String(req.params.trackId);
  const profile  = await personProfileStore.getByTrackId(trackId);
  if (!profile) return fail(res, 404, 'Person not found');
  ok(res, profile);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /api/persons/:id — full profile
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const profile  = await personProfileStore.get(personId);
  if (!profile) return fail(res, 404, 'Person not found');

  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_PROFILE_ACCESSED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Profile ${personId} (${profile.fullName}) accessed.`,
  });

  ok(res, { profile });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. PATCH /api/persons/:id — update notes / custom attributes
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.patch('/:id', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { notes, customAttributes, fullName, department, position } = req.body ?? {};
  const fields: Record<string, unknown> = {};
  if (notes !== undefined)            fields.notes = notes;
  if (customAttributes !== undefined) fields.customAttributes = customAttributes;
  if (fullName !== undefined)         fields.fullName = fullName;
  if (department !== undefined)       fields.department = department;
  if (position !== undefined)         fields.position = position;

  await personProfileStore.updateField(personId, fields as any);
  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_PROFILE_UPDATED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Profile ${personId} updated. Fields: ${Object.keys(fields).join(', ')}.`,
  });
  ok(res, { updated: true, personId, fields: Object.keys(fields) });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. DELETE /api/persons/:id — archive (GDPR)
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.delete('/:id', async (req: Request, res: Response) => {
  if (!isSupervisorOrAdmin(req)) return fail(res, 403, 'Supervisor or Admin required');
  const personId = String(req.params.id);
  await personProfileStore.archive(personId, operator(req));
  ok(res, { archived: true, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. GET /api/persons/:id/timeline
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/timeline', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { types, cameraId, since, until, limit, offset } = req.query as Record<string, string>;
  const entries = await personInvestigationEngine.getTimeline(personId, {
    types:    types ? (types.split(',') as any) : undefined,
    cameraId,
    since,
    until,
    limit:    limit  ? parseInt(limit,  10) : 100,
    offset:   offset ? parseInt(offset, 10) : 0,
  });
  ok(res, { entries, count: entries.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. GET /api/persons/:id/movement — camera journey
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/movement', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { since, until, limit } = req.query as Record<string, string>;
  const [replay, journey] = await Promise.all([
    personInvestigationEngine.getMovementReplay(personId, { since, until, limit: limit ? parseInt(limit, 10) : 200 }),
    personInvestigationEngine.getCrossCameraJourney(personId, { since, until }),
  ]);
  ok(res, { replay, journey, totalSteps: replay.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. GET /api/persons/:id/replay — movement replay (alias with more options)
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/replay', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { since, until } = req.query as Record<string, string>;
  const replay  = await personInvestigationEngine.getMovementReplay(personId, { since, until });
  ok(res, { replay, count: replay.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. GET /api/persons/:id/evidence
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/evidence', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { since, eventType, limit } = req.query as Record<string, string>;
  const evidence = personInvestigationEngine.getEvidence(personId, {
    since,
    eventType,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_EVIDENCE_ACCESSED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'INFO',
    details: `Evidence accessed for person ${personId}. ${evidence.length} records.`,
  });
  ok(res, { evidence, count: evidence.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. GET /api/persons/:id/incidents
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/incidents', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { since, until, limit } = req.query as Record<string, string>;
  const incidents = await personInvestigationEngine.getIncidents(personId, {
    since,
    until,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  ok(res, { incidents, count: incidents.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. GET /api/persons/:id/relationships
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/relationships', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const relationships = await personRelationshipEngine.getRelationships(personId);
  ok(res, { relationships, count: relationships.length, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. GET /api/persons/:id/statistics
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/statistics', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { days } = req.query as Record<string, string>;
  const stats = await personReportEngine.computeStatistics(personId, days ? parseInt(days, 10) : 30);
  ok(res, { statistics: stats, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. GET /api/persons/:id/report/:type — generate a report
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id/report/:type', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const type     = String(req.params.type).toUpperCase() as ReportType;
  const period   = String((req.query as any).period ?? 'DAILY').toUpperCase() as ReportPeriod;

  const validTypes: ReportType[] = ['MOVEMENT','ATTENDANCE','VISIT','INCIDENT','INVESTIGATION','EVIDENCE','RECOGNITION','BEHAVIOR_SUMMARY'];
  if (!validTypes.includes(type)) return fail(res, 400, `Invalid report type. Must be one of: ${validTypes.join(', ')}`);

  const report = await personReportEngine.generateReport(personId, type, period, operator(req));
  ok(res, { report });
});

// ─────────────────────────────────────────────────────────────────────────────
// 21. POST /api/persons/:id/notes — add operator note
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/:id/notes', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const { note } = req.body ?? {};
  if (!note || typeof note !== 'string') return fail(res, 400, 'note string required');

  await personProfileStore.addNote(personId, note, operator(req));

  // Add to timeline
  await personTimelineEngine.addEntry({
    personId,
    type:        'OPERATOR_ACTION',
    timestamp:   new Date().toISOString(),
    title:       'Operator Note Added',
    description: note,
    evidenceIds: [],
    operator:    operator(req),
    metadata:    { note },
  });

  ok(res, { added: true, personId });
});

// ─────────────────────────────────────────────────────────────────────────────
// 23. POST /api/persons/:id/ai-analysis — Gemini-powered behavioral analysis
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/:id/ai-analysis', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const profile = await personProfileStore.get(personId);
  if (!profile) return fail(res, 404, 'Person not found');

  // Build a compact profile summary to send to Gemini
  const snap = profile.currentAppearance ?? profile.appearanceGallery?.[0];
  const summary = {
    personId: profile.personId,
    status: profile.status,
    firstSeen: profile.firstSeen,
    lastSeen: profile.lastSeen,
    totalDetections: profile.totalDetections,
    totalRecognitions: profile.totalRecognitions,
    camerasVisited: profile.cameraHistory?.length ?? 0,
    zonesVisited: profile.visitedZones ?? [],
    currentlyPresent: profile.currentlyPresent,
    department: profile.department ?? null,
    position: profile.position ?? null,
    recentAppearance: snap ? {
      bodyShape: snap.bodyShape,
      estimatedHeightCm: snap.estimatedHeightCm,
      upperClothingColor: snap.upperClothingColor,
      lowerClothingColor: snap.lowerClothingColor,
      helmet: snap.helmet,
      vest: snap.vest,
      mask: snap.mask,
      carriedObjects: snap.carriedObjects ?? [],
      confidence: snap.confidence,
    } : null,
    cameraHistory: profile.cameraHistory?.slice(0, 8).map(cv => ({
      cameraId: cv.cameraId,
      location: cv.location,
      visitCount: cv.visitCount,
      totalDurationMs: cv.totalDurationMs,
      lastSeenAt: cv.lastSeenAt,
    })) ?? [],
    notes: profile.notes ?? '',
  };

  // Try Gemini; fall back to rule-based if key is missing
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const isValidKey = (k?: string) => !!k && k.length > 10 && !k.startsWith('your-');

    if (isValidKey(apiKey)) {
      const { GoogleGenAI } = await import('@google/genai');
      const genai = new GoogleGenAI({ apiKey: apiKey! });

      const prompt = `You are an enterprise security AI analyst. Analyze this person's surveillance profile and provide a structured behavioral assessment.

Person Profile (JSON):
${JSON.stringify(summary, null, 2)}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence behavioral summary in Uzbek language",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskScore": 0.0-1.0,
  "patterns": ["pattern 1 in Uzbek", "pattern 2", ...],
  "recommendations": ["recommendation 1 in Uzbek", "recommendation 2", ...],
  "monitoringFlags": ["flag 1 in Uzbek", ...]
}

Rules:
- summary must be in Uzbek
- patterns: up to 5 behavioral patterns you observe
- recommendations: up to 4 security recommendations  
- monitoringFlags: specific flags if risk is MEDIUM+, empty array if LOW
- Base risk purely on the data; do not invent facts`;

      const result = await genai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.3, maxOutputTokens: 1024 },
      });

      const text = result.text?.trim() ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return ok(res, parsed);
      }
    }
  } catch (err) {
    // Fall through to rule-based
  }

  // Rule-based fallback
  const detections = profile.totalDetections ?? 0;
  const cameras = profile.cameraHistory?.length ?? 0;
  const isWatchlist = profile.status === 'WATCHLIST' || profile.status === 'BLOCKED';
  const hasPPE = snap?.helmet || snap?.vest;
  const riskScore = Math.min(1, (isWatchlist ? 0.6 : 0) + (detections > 100 ? 0.15 : detections > 20 ? 0.05 : 0) + (cameras > 5 ? 0.1 : 0));
  const riskLevel = riskScore >= 0.7 ? 'HIGH' : riskScore >= 0.4 ? 'MEDIUM' : 'LOW';

  ok(res, {
    summary: `Shaxs jami ${detections} marta aniqlangan va ${cameras} ta kamerada ko'rilgan. Holat: ${profile.status}. ${hasPPE ? 'Himoya kiyimi aniqlangan.' : ''} Tizim qoidaga asoslangan tahlil amalga oshirdi (Gemini API ulangan emas).`,
    riskLevel,
    riskScore,
    patterns: [
      `${detections} marta aniqlangan, ${cameras} ta kamerada faollik`,
      cameras > 3 ? 'Ko\'p kameralarda harakatlanish' : 'Mahalliy harakatlanish naqshi',
      profile.visitedZones?.length ? `${profile.visitedZones.length} ta zonada tashrif` : 'Zona ma\'lumotlari cheklangan',
    ].filter(Boolean),
    recommendations: [
      isWatchlist ? 'Ushbu shaxs kuzatuv ro\'yxatida — barcha harakatlarni kuzatib boring' : 'Standart kuzatuv davom etsin',
      detections > 50 ? 'Yuqori faollik — harakat naqshini chuqur tahlil qiling' : 'Oddiy faollik darajasi',
      'GEMINI_API_KEY ni ulang — to\'liq AI tahlil uchun',
    ],
    monitoringFlags: isWatchlist ? ['WATCHLIST — kengaytirilgan kuzatuv'] : [],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 22. POST /api/persons/:id/watchlist
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.post('/:id/watchlist', async (req: Request, res: Response) => {
  if (!isSupervisorOrAdmin(req)) return fail(res, 403, 'Supervisor or Admin required');
  const personId = String(req.params.id);

  await personProfileStore.addToWatchlist(personId, operator(req));

  await personTimelineEngine.addEntry({
    personId,
    type:        'WATCHLIST_ADDED',
    timestamp:   new Date().toISOString(),
    severity:    'WARNING',
    title:       'Added to Watchlist',
    description: `Person added to watchlist by ${operator(req)}.`,
    evidenceIds: [],
    operator:    operator(req),
    metadata:    {},
  });

  ok(res, { watchlisted: true, personId });
});
