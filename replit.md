# Sentinel Biometrics (VMS)

## Overview
An enterprise video management / biometric security system: React 18 (Vite) frontend + Express backend in a single Node process, Firebase/Firestore for data storage and auth, and Google Gemini for AI-based analysis (face recognition, hazard detection, digital twin, area maps, movement intelligence, etc.). Originally built with Google AI Studio and imported from GitHub.

## Running on Replit
- Workflow "Start application" runs `npm run dev` (`tsx server.ts`), which starts a single Express server on port 5000 that also mounts Vite in middleware mode (serves the frontend and API together).
- No secrets are required to run: `JWT_SECRET` and `VMS_ENCRYPTION_KEY` fall back to built-in defaults, and `GEMINI_API_KEY` is optional — AI features gracefully no-op/fallback when it's unset.
- Firebase config (`firebase-applet-config.json`) is a public client config already committed to the repo (project `coherent-backup-w2cdj`); it's pre-existing and points at the original author's Firebase project.
- Demo login: `admin@sentinel.sys` / `SentinelAdmin2026!` (also `supervisor@sentinel.sys` with the same password for a Supervisor role).

## Temporary: direct login button
Per user request, the login screen (`App.tsx` `LoginScreen`) has a "To'g'ridan-to'g'ri kirish (Admin)" button that logs straight in as the bootstrap admin (`admin@sentinel.sys`) without typing credentials — for development convenience only. Remove it before shipping to real users; it should not exist in a production build.

## Optional secrets
- `GEMINI_API_KEY` — enables real Gemini-powered AI analysis instead of the software fallback.
- `JWT_SECRET`, `VMS_ENCRYPTION_KEY` — override the built-in defaults for production use.

## Project structure
- `server.ts` — Express app, API routes, Vite middleware integration, WebSocket server.
- `App.tsx`, `index.tsx`, `components/` — React frontend.
- `services/` — business logic (AI pipeline, camera, security, Firestore, VMS enterprise services).
- `backend/` — supporting modules (area map, digital twin, face recognition, security).
- `docs/`, `VMS_ARCHITECTURE.md`, `security_spec.md` — architecture and design docs.

## User preferences
None recorded yet.
