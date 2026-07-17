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

import { Router, Request, Response, NextFunction } from 'express';
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
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
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
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
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
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
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
// 10. GET /api/persons/:id — full profile
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.get('/:id', async (req: Request, res: Response) => {
  const personId = String(req.params.id);
  const profile  = await personProfileStore.get(personId);
  if (!profile) return fail(res, 404, 'Person not found');

  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_PROFILE_ACCESSED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
    details: `Profile ${personId} (${profile.fullName}) accessed.`,
  });

  ok(res, { profile });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. PATCH /api/persons/:id — update notes / custom attributes (Supervisor+)
// ─────────────────────────────────────────────────────────────────────────────
personIntelApiRouter.patch('/:id', async (req: Request, res: Response) => {
  if (!isSupervisorOrAdmin(req)) return fail(res, 403, 'Supervisor or Admin required');
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
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
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
  const evidence = await personInvestigationEngine.getEvidence(personId, {
    since,
    eventType,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  await vmsAuditService.log({
    userId: operator(req), userName: operator(req), action: 'PERSON_EVIDENCE_ACCESSED',
    module: 'PersonIntelApiRouter', ipAddress: String(req.ip), status: 'SUCCESS',
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

// ─────────────────────────────────────────────────────────────────────────────
// Router-level error handler (Express 5 forwards async rejections here)
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
personIntelApiRouter.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
  console.error('[PersonIntelApiRouter] Unhandled error:', err?.message ?? err);
  res.status(500).json({ success: false, error: 'Internal server error', detail: err?.message });
});
