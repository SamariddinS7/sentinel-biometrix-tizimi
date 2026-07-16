---
name: VMS Stabilization
description: Phase 2 production stabilization — what was done, what env vars are still needed, and key architectural decisions.
---

## What was done (Phase 2)

All code-level changes are complete and verified (tsc 0 errors, server boots clean):

**Security:**
- `firestore.rules` isSignedIn() fixed to `request.auth != null`
- WebSocket upgrade now requires JWT via `?token=` query param (401/403 if absent/invalid)
- `pickle` replaced with `json+numpy` in `embedding_store.py` (RCE removal)
- `BIOMETRIC_SECRET_SEED` hardcoded fallback removed; throws if env var missing
- `ENCRYPTION_KEY` default="test_key_placeholder" removed from pydantic config
- `helmet()` + `express-rate-limit` added to server.ts
- `app.set('trust proxy', 1)` required for rate-limiter behind Replit proxy
- `/api/system` → requireRole ADMIN/SUPERVISOR; `/api/ai` → authenticateToken + aiLimiter

**Simulation removal:**
- 109-line simulation block (SimulatedTrackState, simTrackStates, setInterval) deleted from server.ts
- `MovementIntelligenceEngine.seedObservations()` (71 lines of fake history) deleted
- `SOCCommandCenter` seeded alarms/personnel replaced with real API calls
- Global `JSON.parse` monkey-patch removed from index.tsx
- Hardcoded names "Kamron Aliyev"/"Madina Solihova" removed from bootstrap fallback

**Dead code:**
- `backend/face_recognition/identity_manager.py` deleted
- `backend/face_recognition/detector.py` deleted

**Logging:**
- `services/logger.ts` created (structured, suppresses info/debug in production)
- firestoreService.ts no longer logs UID to browser console
- WS connection/disconnection logs removed from server.ts
- InferencePipeline startup console.log removed

## Required secrets (not yet set in Replit)

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Token signing (currently random per-process — sessions lost on restart) |
| `BIOMETRIC_SECRET_SEED` | Biometric embedding encryption key derivation |
| `BIOMETRIC_ENCRYPTION_KEY` | Python backend Fernet encryption key |
| `BOOTSTRAP_ADMIN_PASSWORD` | Emergency admin login fallback |
| `GEMINI_API_KEY` | AI-powered endpoints (rule-based fallback active without it) |

## Key architecture decisions

**Why trust proxy = 1:** Replit runs behind a reverse proxy; without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request.

**Why WS token via query param:** Browser WebSocket API does not support custom headers. Query param is the standard pattern; token is short-lived (12h JWT) so exposure window is minimal.

**Why json+numpy instead of pickle:** pickle.loads() with attacker-controlled data = arbitrary code execution. json+numpy.array() is safe and preserves float32 precision for embeddings.

**Why BIOMETRIC_SECRET_SEED throws instead of fallback:** A hardcoded fallback means all deployments share the same encryption key, defeating the purpose of encryption. Fail-fast forces operators to set the env var.

## Remaining infra items (for DevOps)

- Deploy firestore.rules to Firebase Console (local file only)
- Configure Docker + GPU for Python biometric backend
- Set all secrets listed above in production environment
- Replace CDN Tailwind with PostCSS build
- Wire /proc/net/dev for real network throughput in telemetry

## Report location

`docs/STABILIZATION_REPORT.md` — full change table with file-level detail.
