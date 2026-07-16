---
name: VMS Architecture Stabilization + Phase 3 Camera Layer
description: What was removed/fixed in stabilization and what was built in Phase 3 Enterprise Camera Layer.
---

## Phase 2 — Stabilization (2026-07-16)

- Deleted: `patch.js`, `patch2.js`, `patch_engine.js`, `update_server.cjs`, `update_server.js`
- Fixed `/api/cameras/reconnect`: removed `Math.random()` fake status simulation
- Fixed `/api/cameras/:id/diagnose`: removed `password === "123"` fake credential bypass
- Fixed `ActivityHeatmap.tsx`: removed `basePattern` hardcoded seed data
- Fixed `CamerasView.tsx` `runPingTest`: replaced fake ICMP output with unavailability message
- Fixed `CamerasView.tsx` `runAutoImport`: removed hardcoded CAM-01/02/03 fake camera saves to Firestore
- Fixed `App.tsx` login: email default changed from `"admin@sentinel.sys"` to `""`
- Fixed `App.tsx` sidebar: CPU/RAM now live from `/api/telemetry` (polls every 8s)
- Fixed `FaceDetectorView.tsx`: removed 3 debug `console.log` statements
- Fixed `tests/camera/rtsp.test.ts`: removed non-interface fields, added required `transport: 'TCP'`
- Added `"overrides": { "websocket-driver": "0.7.5" }` to package.json for CVE fix

## Phase 3 — Enterprise Camera Layer (2026-07-16)

**Deleted (duplicates, no importers):**
- `services/camera/rtsp.ts` — RTSP session logic duplicated in driver
- `services/camera/onvif.ts` — ONVIF client duplicated in driver

**Created (canonical replacements):**
- `services/camera/RtspConnectionPool.ts` — RTSP session + TCP pool (Digest Auth, RTSP/1.0 handshake, RTP telemetry)
- `services/camera/OnvifService.ts` — ONVIF SOAP client (Profile S/T: device info, stream URI, PTZ, time sync, IR filter)

**Import paths updated:**
- `services/camera/drivers/RtspDriver.ts` → `../RtspConnectionPool`
- `services/camera/drivers/OnvifDriver.ts` → `../OnvifService`, `../RtspConnectionPool`
- `services/camera/vendors/base.ts` → `../OnvifService`, `../RtspConnectionPool`

**server.ts changes:**
- Added `app.use("/api/cameras", authenticateToken)` — all camera routes now require JWT
- Fixed `/api/cameras/:id/snapshot` — real `snapshotManager.takeManualSnapshot()`, 503 if not streaming
- Fixed `/api/cameras/:id/stream` — real MJPEG via `frameDistributor` LIVE_VIEW channel (no SVG mock)
- Fixed `/api/system/storage` — real OS memory stats (no hardcoded 4TB/71%)
- Fixed `/api/system/storage/rotate` — 501 Not Implemented (no fake response)
- Fixed `POST /api/recordings` — camera name from Firestore (no hardcoded names, no Math.random())
- Added `frameDistributor` + `frameQueueManager` + `VmsFrame` imports

**New camera pipeline API routes:**
- `GET /api/cameras/pipeline/stats` — FrameQueue + FrameDistributor aggregate stats
- `GET /api/cameras/:id/status` — live CameraRegistry health report
- `GET /api/cameras/:id/capabilities` — driver-discovered hardware capabilities
- `GET /api/cameras/:id/stream/stats` — StreamManager session metrics
- `POST /api/cameras/:id/connect` / `disconnect` — lifecycle control (ADMIN/SUPERVISOR)
- `GET|POST /api/cameras/:id/snapshots` — list + take manual snapshots
- `POST /api/cameras/:id/ptz` — PTZ control (ADMIN/SUPERVISOR/OPERATOR)
- `POST /api/cameras/:id/diagnostics` — structured diagnostic report
- `GET /api/cameras/:id/playback/timeline` — query recording segments by time window
- `GET /api/cameras/:id/playback/sessions` — list active sessions
- `POST /api/cameras/:id/playback` — create playback session
- `PATCH /api/cameras/playback/:sessionId` — play/pause/seek/speed
- `GET|DELETE /api/cameras/playback/:sessionId` — get info / close session

**Tests added:**
- `tests/camera/pipeline.test.ts` — 16 production unit tests, all passing
  - FrameQueue: enqueue/dequeue/FIFO, DROP_OLDEST, stats, auto-create
  - FrameDistributor: registration, wildcard, multi-consumer fan-out, deregisterCamera
  - SnapshotManager: capture, no-provider throw, empty-frame rejection
  - PlaybackEngine: full lifecycle, empty timeline, seek clamping
  - StreamManager: driver factory, stats for unknown camera

**Why:** Phase 3 spec required enterprise camera infrastructure — no AI, just camera → driver → stream → queue → distributor pipeline with real APIs and tests.

## Key remaining debt (see STABILIZATION_REPORT.md)
- `server.ts` is monolithic (now ~2330 lines) — needs to be split into route modules
- `App.tsx` is monolithic — needs to be decomposed
- `@firebase/rules-unit-testing` is in `dependencies` (should be `devDependencies`)
- Tailwind loaded from CDN in `index.html` — must switch to PostCSS for production
- `backend/` Python modules have no Node.js integration bridge
- Phase 4: Detection & Tracking Engine (next phase)
