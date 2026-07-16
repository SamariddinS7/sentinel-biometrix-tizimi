---
name: VMS Architecture Stabilization 2026-07-16
description: What was removed/fixed in the architecture stabilization pass — fake data, dead scripts, security issues, TypeScript fixes.
---

## What was done

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

**Why:** Pre-production stabilization to remove all mock/fake data, dead code, and security issues before new feature work.

## Key remaining debt (see STABILIZATION_REPORT.md)
- `server.ts` is monolithic (82KB) — needs to be split into route modules
- `App.tsx` is monolithic (31KB) — needs to be decomposed
- `@firebase/rules-unit-testing` is in `dependencies` (should be `devDependencies`)
- Tailwind loaded from CDN in `index.html` — must switch to PostCSS for production
- `/api/health` and `/api/telemetry` have no auth middleware
- `backend/` Python modules have no Node.js integration bridge
