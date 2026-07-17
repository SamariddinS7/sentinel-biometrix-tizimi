---
name: VMS Enterprise Analytics Platform (Phase 5)
description: Full implementation of the Enterprise Analytics & Safety Intelligence Platform — 8 plugins, API router, alarm broker, report engine, search index, frontend dashboard.
---

## What was built

The analytics platform runs as a **parallel post-stage listener** on `InferencePipeline.onFrameProcessed()` — zero changes to the existing 12-stage pipeline.

### Plugin registry (8 plugins)
| Plugin ID | File | Method |
|---|---|---|
| `analytics.fire_safety` | `FireSafetyPlugin.ts` | Spectral RGB pixel analysis |
| `analytics.ppe` | `PpeCompliancePlugin.ts` | HSV head/torso region analysis |
| `analytics.vehicle` | `VehicleAnalyticsPlugin.ts` | YOLOv8n COCO classes + Tesseract LPR |
| `analytics.ocr` | `OcrPlugin.ts` | Tesseract.js on configured ROIs |
| `analytics.behavior` | `BehaviorPlugin.ts` | Trajectory/geometry math |
| `analytics.object_state` | `ObjectStatePlugin.ts` | Frame-diff IoU stationarity |
| `analytics.crowd` | `CrowdAnalyticsPlugin.ts` | Track count + clustering |
| `analytics.heatmap` | `HeatmapPlugin.ts` | Weighted 50×50 grid |

### Support services
- `AnalyticsPlatform.ts` — singleton engine; ring buffer 500 events; `submitFrame()` runs all plugins via `Promise.allSettled`
- `AnalyticsAlarmBroker.ts` — subscribes to platform events; calls `saveAnomalyToFirestore()` + `evidenceManager.record()` with 1-hour dedup
- `AnalyticsReportEngine.ts` — daily/weekly/monthly reports; persists to `analyticsReports` Firestore collection
- `AnalyticsSearchIndex.ts` — plate/track/text search across ring buffer + Firestore
- `AnalyticsApiRouter.ts` — 17 routes mounted at `/api/analytics` and `/api/evidence`

### Integration points
- `server.ts`: imports `analyticsApiRouter`, `evidenceApiRouter`, `initAnalyticsPlatform`; mounts at `/api/analytics` and `/api/evidence`; calls `initAnalyticsPlatform()` in server startup
- `App.tsx`: imports `AnalyticsDashboard`; adds `'analytics'` to `currentView` union; sidebar nav item under "Monitoring & Audit"; renders `<AnalyticsDashboard />`
- Bootstrap: `AnalyticsPlatformBootstrap.ts` → `initAnalyticsPlatform()`

### Key design decisions
**Why:**
- No fake data anywhere — every confidence value comes from real spectral analysis or model inference
- `FireSafetyPlugin` uses same spectral algorithm as existing `HazardDetectorPlugin` (R/G/B ratio + desaturation for smoke + luminance delta for explosion)
- PPE uses HSV on head/torso crops; falls back gracefully if `yolov8n-ppe.onnx` is dropped into `models/`
- LPR: Tesseract on lower-35% crop of vehicle bbox; minimum 4 chars + 60% confidence to emit
- HeatmapPlugin had a duplicate `getGrid()` method (private + public overload) — removed overload declaration, kept only the public `getNormalizedGrid()` for the API

**How to apply:**
- Add new plugins by implementing `IAnalyticsPlugin` from `services/analytics/types/AnalyticsPlugin.ts`, then register in `AnalyticsPlatformBootstrap.ts`
- New event types: add to `AnalyticsEventType` enum AND `ANALYTICS_ALARM_SEVERITY` map in `types/AnalyticsEvent.ts`
- OCR ROIs are per-camera config: call `ocrPlugin.setRegions(cameraId, [...])` at runtime

### Tests
`tests/analytics/platform.test.ts` — 8 test suites using `node:test` + `node:assert/strict`. Uses synthetic pixel buffers — no random confidence, no fake detections.
