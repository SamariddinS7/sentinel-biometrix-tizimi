# Sentinel Biometrik Tizimi

An enterprise AI Video Management System (VMS) with biometrics, face recognition, digital twin 3D views, and Gemini AI-powered anomaly detection. The UI is in Uzbek.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express 5 (TypeScript, `tsx` runtime)
- **Database:** Firebase Firestore (config in `firebase-applet-config.json`)
- **AI:** Google Gemini (`@google/genai`), custom inference pipeline
- **3D:** Three.js + React Three Fiber (digital twin views)
- **Auth:** Firebase Auth (anonymous) + JWT for API routes

## How to run

```
npm install
npm run dev
```

The server starts on port **5000** (Express serves both the API and Vite dev middleware).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Enables AI features. Must start with `AIzaSy`. |
| `JWT_SECRET` | Optional | Defaults to a built-in fallback value if not set. |
| `VMS_ENCRYPTION_KEY` | Optional | Used for VMS credential encryption. |

Firebase config is stored in `firebase-applet-config.json` (already included).

## Login

The app has a login screen at `/`. Use the **"To'g'ridan-to'g'ri kirish (Admin)"** button for direct admin access, or sign in with Firebase credentials.

## Key directories

- `components/` — 32 React UI components
- `services/` — Application services (auth, camera, AI pipeline, Firestore, etc.)
- `services/ai/` — AI inference pipeline, face/biometric engines, plugins
- `backend/` — Pure computation modules (area maps, digital twin math, face recognition, security)
- `server.ts` — Express API gateway + Vite dev server integration

## User preferences

<!-- Add user preferences here -->
