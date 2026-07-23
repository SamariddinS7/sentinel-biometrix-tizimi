# Sentinel Biometrik Tizimi — AI Video Management System

## Overview
Enterprise-grade AI Video Management System (VMS) and Security Dashboard. Features real-time camera monitoring, AI-driven anomaly detection, facial recognition, behavioral analytics, and a SOC operations center.

## Stack
- **Frontend**: React 18 + Vite (dev server on port 5000)
- **Backend**: Node.js/Express 5 with TypeScript (tsx)
- **Realtime**: WebSocket (ws)
- **AI/ML**: Google Gemini API, ONNX Runtime (YOLOv8n), Tesseract.js OCR
- **Database**: Firebase/Firestore (primary), PostgreSQL (optional, falls back to Firestore if not set)
- **Analytics**: 8 built-in AI plugins (fire/PPE/vehicle/OCR/behavior/object-state/crowd/heatmap)

## How to run
```
npm run dev
```
Server and Vite dev server both run on **port 5000**. The `Start application` workflow handles this.

## Environment variables / secrets
| Key | Required | Purpose |
|-----|----------|---------|
| `GEMINI_API_KEY` | Recommended | Enables Gemini AI features; falls back to rule-based processing if absent |
| `JWT_SECRET` | Recommended | Persistent JWT signing; auto-generates a random one per session if absent |
| `SESSION_SECRET` | Optional | Express session secret |
| `POSTGRES_URL` | Optional | PostgreSQL primary DSN; falls back to Firestore if not set |
| `REDIS_URL` | Optional | Redis for caching; falls back to in-process LRU cache |
| `NATS_URL` | Optional | NATS for message bus; falls back to in-process mode |

Firebase config is baked into `firebase-applet-config.json` — no additional setup needed.

## Key files
- `server.ts` — Express + WebSocket server entry point
- `index.tsx` / `App.tsx` — React frontend entry
- `services/` — Backend services (AI, camera, analytics, auth, infra)
- `components/` — React UI components
- `firebase-applet-config.json` — Firebase project config (already populated)

## User preferences
- Keep existing project structure and stack
