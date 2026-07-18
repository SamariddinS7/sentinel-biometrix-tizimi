# Sentinel Biometrik Tizimi

An enterprise AI Video Management System (VMS) with biometrics, face recognition, digital twin 3D views, and Gemini AI-powered anomaly detection. The UI is in Uzbek.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 (TypeScript, `tsx` runtime)
- **Database:** Firebase Firestore (config in `apps/api/firebase-applet-config.json`)
- **AI:** Google Gemini (`@google/genai`), YOLOv8n ONNX local inference, custom AI pipeline
- **3D:** Three.js + React Three Fiber (digital twin views)
- **Auth:** Firebase Auth + JWT for API routes

## Monorepo structure

```
apps/
  web/          ← React frontend source (index.html, src/)
  api/          ← Express backend (src/server.ts, src/services/, models/)
packages/
  shared-types/ ← Shared TypeScript types (re-exported from apps/api/src/types.ts)
  config/       ← Shared tsconfig base
archive/
  python-backend/ ← Archived Python face recognition / digital twin code
```

## How to run on Replit

The workflow `Start application` is already configured and runs `npm run dev`.

```
npm install
npm run dev          # → npm run dev --workspace=apps/api → tsx src/server.ts
```

The server starts on port **5000** from `apps/api/`. Express serves both the REST/WebSocket API and Vite dev middleware (root: `apps/web/`) from a single process.

## Environment variables / Secrets

Set these as Replit Secrets (never commit values to the repo):

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Recommended | Strong random string (64+ chars). Without it, a per-session random secret is generated — all sessions expire on restart. |
| `GEMINI_API_KEY` | Optional | From Google AI Studio. Enables Gemini-powered threat analysis. Must start with `AIzaSy`. Without it, rule-based fallbacks are used. |
| `VMS_ENCRYPTION_KEY` | Optional | AES key for stored VMS credentials. |
| `BOOTSTRAP_ADMIN_EMAIL` | Optional | Admin account email for email+password login. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Optional | Admin account password. |

Firebase config is at `apps/api/firebase-applet-config.json` and requires no additional setup.

## Login

The login screen is at `/`. Two options:
- **"Admin tizimga kirish (Bootstrap)"** button — direct admin bypass, always available.
- Email + password — requires `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` to be set, or valid Firebase credentials.

## Key directories

- `apps/web/src/components/` — React UI components (camera grid, dashboard, alerts, digital twin, etc.)
- `apps/api/src/services/` — All services (auth, camera, AI pipeline, Firestore, alarm broker, etc.)
- `apps/api/src/services/ai/` — AI inference pipeline, face/biometric engines, YOLOv8n + ByteTrack, plugins
- `apps/api/src/services/analytics/` — Enterprise analytics platform (8 plugins)
- `apps/api/src/services/personIntel/` — Person Intelligence Platform
- `apps/api/src/services/infrastructure/` — Cache, DB, metrics, health, tracing
- `apps/api/models/` — ONNX model files (`yolov8n.onnx`)
- `apps/api/src/server.ts` — Express API gateway + Vite dev middleware (single entry point)
- `packages/shared-types/src/index.ts` — Shared TypeScript types

## Architecture notes

- `apps/api/src/server.ts` is the single backend entry point — starts Express, Vite dev middleware (root: `apps/web/`), WebSocket broker, and all AI services.
- Frontend components import services from `apps/api/src/services/` via Vite path aliases (no import changes needed).
- AI services initialize at startup: YOLOv8n loads from `apps/api/models/`; Gemini is optional.
- Firebase Firestore is used for alerts, identities, and audit logs.

## Stabilization status

Architecture stabilization completed 2026-07-16. Monorepo restructure completed 2026-07-18. See `STABILIZATION_REPORT.md` and `docs/CONSOLIDATION_AUDIT.md` for details.

## User preferences

<!-- Add user preferences here -->
