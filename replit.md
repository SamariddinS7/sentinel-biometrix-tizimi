# Sentinel Biometrik Tizimi

An enterprise AI Video Management System (VMS) with biometrics, face recognition, digital twin 3D views, and Gemini AI-powered anomaly detection. The UI is in Uzbek.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 (TypeScript, `tsx` runtime)
- **Database:** Firebase Firestore (config in `firebase-applet-config.json`)
- **AI:** Google Gemini (`@google/genai`), YOLOv8n ONNX local inference, custom AI pipeline
- **3D:** Three.js + React Three Fiber (digital twin views)
- **Auth:** Firebase Auth + JWT for API routes

## How to run on Replit

The workflow `Start application` is already configured and runs `npm run dev`.

To start it manually:

```
npm install
npm run dev
```

The server starts on port **5000**. Express serves both the REST/WebSocket API and the Vite dev middleware from a single process (`server.ts`).

## Environment variables / Secrets

Set these as Replit Secrets (never commit values to the repo):

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Recommended | Strong random string (64+ chars). Without it, a per-session random secret is generated — all sessions expire on restart. |
| `GEMINI_API_KEY` | Optional | From Google AI Studio. Enables Gemini-powered threat analysis. Must start with `AIzaSy`. Without it, rule-based fallbacks are used. |
| `VMS_ENCRYPTION_KEY` | Optional | AES key for stored VMS credentials. |
| `BOOTSTRAP_ADMIN_EMAIL` | Optional | Admin account email for email+password login. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Optional | Admin account password. |

Firebase config is already present in `firebase-applet-config.json` and requires no additional setup for the bundled Firebase project.

## Login

The login screen is at `/`. Two options:
- **"To'g'ridan-to'g'ri kirish (Admin)"** button — direct admin bypass, always available.
- Email + password — requires `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` to be set, or valid Firebase credentials.

## Key directories

- `components/` — React UI components (camera grid, dashboard, alerts, digital twin, etc.)
- `services/` — Application services (auth, camera, AI pipeline, Firestore, alarm broker, etc.)
- `services/ai/` — AI inference pipeline, face/biometric engines, YOLOv8n + ByteTrack, plugins
- `backend/` — Pure computation modules (area maps, digital twin math, face recognition, security)
- `models/` — ONNX model files (`yolov8n.onnx`)
- `server.ts` — Express API gateway + Vite dev server integration (single entry point)
- `types.ts` — Shared TypeScript types across frontend and backend

## Architecture notes

- `server.ts` is the single backend entry point — it starts Express, Vite dev middleware, WebSocket broker, and all AI services together.
- AI services initialize at startup: YOLOv8n loads from `yolov8n.onnx`; Gemini is optional.
- Firebase Firestore is used for alerts, identities, and audit logs.
- The WebSocket server handles real-time camera frame relay and AI event streaming.

## Stabilization status

Architecture stabilization completed 2026-07-16. See `STABILIZATION_REPORT.md` for full details.

## User preferences

<!-- Add user preferences here -->
