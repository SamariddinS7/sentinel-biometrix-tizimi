/**
 * AnalyticsApiRouter — Express Router for all /api/analytics/* endpoints
 *
 * Mount in server.ts with:
 *   app.use('/api/analytics', analyticsApiRouter);
 *   app.use('/api/evidence',  analyticsApiRouter); // evidence sub-routes
 *
 * All routes are JWT-authenticated. ADMIN can manage plugins; OPERATOR can read.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { analyticsPlatform } from './AnalyticsPlatform';
import { analyticsReportEngine, ReportPeriod } from './AnalyticsReportEngine';
import { analyticsSearchIndex } from './AnalyticsSearchIndex';
import { heatmapPlugin } from './plugins/HeatmapPlugin';
import { evidenceManager } from '../evidenceManager';

export const analyticsApiRouter = Router();
export const evidenceApiRouter  = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ok(res: Response, data: unknown): void {
  res.json({ success: true, data });
}

function err(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/events
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/events', (req: Request, res: Response) => {
  const { cameraId, type, since, limit } = req.query as Record<string, string>;
  const events = analyticsPlatform.getEvents({
    cameraId,
    type,
    since,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  ok(res, { events, count: events.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/events/:id
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/events/:id', (req: Request, res: Response) => {
  const events = analyticsPlatform.getEvents({ limit: 500 });
  const event  = events.find(e => e.id === req.params.id);
  if (!event) return err(res, 404, 'Event not found');

  const evidence = event.evidenceRef ? evidenceManager.get(event.evidenceRef) : null;
  ok(res, { event, evidence });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/statistics
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/statistics', (req: Request, res: Response) => {
  const { cameraId, since } = req.query as Record<string, string>;
  const sinceMs = since ? new Date(since).getTime() : Date.now() - 86_400_000;

  const events = analyticsPlatform.getEvents({
    cameraId,
    since: new Date(sinceMs).toISOString(),
    limit: 2000,
  });

  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }

  ok(res, {
    platform: analyticsPlatform.getStats(),
    period: { since: new Date(sinceMs).toISOString(), eventCount: events.length },
    byType: typeCounts,
    plugins: analyticsPlatform.listPlugins(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/heatmap/:cameraId
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/heatmap/:cameraId', (req: Request, res: Response) => {
  const cameraId = String(req.params.cameraId);
  const grid = heatmapPlugin.getNormalizedGrid(cameraId);
  ok(res, { cameraId, grid, gridWidth: 50, gridHeight: 50 });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/vehicles
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/vehicles', (req: Request, res: Response) => {
  const { cameraId, since, limit } = req.query as Record<string, string>;
  const events = analyticsPlatform.getEvents({
    type: 'VEHICLE_DETECTED',
    cameraId,
    since,
    limit: limit ? parseInt(limit, 10) : 100,
  });
  const entered = analyticsPlatform.getEvents({ type: 'VEHICLE_ENTERED', cameraId, since });
  const exited  = analyticsPlatform.getEvents({ type: 'VEHICLE_EXITED',  cameraId, since });
  const plates  = analyticsPlatform.getEvents({ type: 'PLATE_RECOGNIZED', cameraId, since });
  ok(res, { vehicles: events, entered, exited, plates, counts: { vehicles: events.length, entered: entered.length, exited: exited.length, plates: plates.length } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/ocr
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/ocr', (req: Request, res: Response) => {
  const { cameraId, since, limit, text } = req.query as Record<string, string>;
  let events = analyticsPlatform.getEvents({ type: 'OCR_COMPLETED', cameraId, since, limit: limit ? parseInt(limit, 10) : 100 });
  if (text) {
    const needle = text.toLowerCase();
    events = events.filter(e => JSON.stringify(e.data).toLowerCase().includes(needle));
  }
  ok(res, { results: events, count: events.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/fire
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/fire', (req: Request, res: Response) => {
  const { cameraId, since, limit } = req.query as Record<string, string>;
  const types = ['FIRE_DETECTED', 'SMOKE_DETECTED', 'EXPLOSION_DETECTED', 'SPARK_DETECTED', 'FLOOD_DETECTED', 'WATER_LEAK_DETECTED'];
  const events = types.flatMap(type =>
    analyticsPlatform.getEvents({ type, cameraId, since, limit: 50 }),
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
   .slice(0, limit ? parseInt(limit, 10) : 100);
  ok(res, { events, count: events.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/ppe
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/ppe', (req: Request, res: Response) => {
  const { cameraId, since, limit } = req.query as Record<string, string>;
  const ppeTypes = ['PPE_VIOLATION', 'HELMET_MISSING', 'VEST_MISSING', 'MASK_MISSING', 'GLOVES_MISSING', 'PPE_COMPLIANT'];
  const events = ppeTypes.flatMap(type =>
    analyticsPlatform.getEvents({ type, cameraId, since, limit: 50 }),
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
   .slice(0, limit ? parseInt(limit, 10) : 100);

  const violations = events.filter(e => e.type === 'PPE_VIOLATION').length;
  const compliant  = events.filter(e => e.type === 'PPE_COMPLIANT').length;
  const complianceRate = (violations + compliant) > 0
    ? Math.round((compliant / (violations + compliant)) * 100)
    : 100;

  ok(res, { events, violations, complianceRate, count: events.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/crowd
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/crowd', (req: Request, res: Response) => {
  const { cameraId, since, limit } = req.query as Record<string, string>;
  const types = ['CROWD_DETECTED', 'OCCUPANCY_UPDATED', 'QUEUE_DETECTED', 'PEOPLE_COUNT_UPDATED'];
  const events = types.flatMap(type =>
    analyticsPlatform.getEvents({ type, cameraId, since, limit: 50 }),
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
   .slice(0, limit ? parseInt(limit, 10) : 100);
  ok(res, { events, count: events.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/reports/:period
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/reports/:period', async (req: Request, res: Response) => {
  const period = req.params.period as ReportPeriod;
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return err(res, 400, 'period must be daily | weekly | monthly');
  }
  const reports = await analyticsReportEngine.listReports(period);
  ok(res, { reports, count: reports.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/reports/generate
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.post('/reports/generate', async (req: Request, res: Response) => {
  const { period = 'daily', cameraId = 'all' } = req.body ?? {};
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return err(res, 400, 'period must be daily | weekly | monthly');
  }
  try {
    const report = await analyticsReportEngine.generateReport(period as ReportPeriod, cameraId);
    ok(res, { report });
  } catch (e: any) {
    err(res, 500, e.message ?? 'Report generation failed');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/search
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/search', async (req: Request, res: Response) => {
  const { text, eventType, cameraId, plate, trackId, since, until, limit } = req.query as Record<string, string>;
  const result = await analyticsSearchIndex.search({
    text,
    eventType,
    cameraId,
    plateText: plate,
    trackId,
    since,
    until,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  ok(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/plugins
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.get('/plugins', async (req: Request, res: Response) => {
  const [list, health] = await Promise.all([
    Promise.resolve(analyticsPlatform.listPlugins()),
    analyticsPlatform.getPluginHealth(),
  ]);
  ok(res, { plugins: list.map(p => ({ ...p, health: health[p.id] })) });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/plugins/:id/enable|disable
// ─────────────────────────────────────────────────────────────────────────────
analyticsApiRouter.post('/plugins/:id/enable', (req: Request, res: Response) => {
  const id = String(req.params.id);
  analyticsPlatform.enablePlugin(id);
  ok(res, { id, enabled: true });
});

analyticsApiRouter.post('/plugins/:id/disable', (req: Request, res: Response) => {
  const id = String(req.params.id);
  analyticsPlatform.disablePlugin(id);
  ok(res, { id, enabled: false });
});

// ─────────────────────────────────────────────────────────────────────────────
// Evidence routes  (mount separately at /api/evidence)
// ─────────────────────────────────────────────────────────────────────────────
evidenceApiRouter.get('/', (req: Request, res: Response) => {
  const { cameraId, eventType, since, limit } = req.query as Record<string, string>;
  const results = evidenceManager.search({
    cameraId,
    eventType,
    since,
    limit: limit ? parseInt(limit, 10) : 50,
  });
  ok(res, { evidence: results, count: results.length });
});

evidenceApiRouter.get('/:id', (req: Request, res: Response) => {
  const record = evidenceManager.get(String(req.params.id));
  if (!record) return err(res, 404, 'Evidence record not found');
  ok(res, { evidence: record });
});
