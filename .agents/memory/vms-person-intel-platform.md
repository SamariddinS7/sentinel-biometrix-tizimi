---
name: VMS Person Intelligence Platform
description: Architecture, implementation decisions, and field names for the Enterprise Person Intelligence Platform (Phases 1–5)
---

# VMS Person Intelligence Platform

## What was built (Phases 1–5)

### Phase 1 — Bootstrap Wiring
Both `PersonIntelBootstrap` and `PersonIntelApiRouter` existed in `services/personIntel/` but were **never imported or called** in `server.ts`. Added:
- `import { personIntelApiRouter }` → mounted at `/api/persons` with `authenticateToken`
- `import { initPersonIntelPlatform }` → called in server listen callback after `initAnalyticsPlatform()`

### Phase 2 — API Audit Fixes
- Missing `await` on `personInvestigationEngine.getEvidence()` in route 16 (method is sync, await is harmless)
- Missing RBAC on `PATCH /:id` — added `isSupervisorOrAdmin` guard
- `status: 'INFO'` → `'SUCCESS'` in 8 places (AuditLogPayload type only allows SUCCESS|FAILURE|WARNING)
- `VmsEventCallback` takes `(event: VmsEvent)` not `(eventType, source, payload)` — fixed PersonTimelineEngine.ts
- Added Express 5 router-level error handler (returns JSON on unhandled errors)
- Added Firestore rules for 4 new collections: `personProfiles`, `personTimeline/{id}/entries`, `personRelationships`, `personReports`

**Important:** Firestore rules in `firestore.rules` are local — must `firebase deploy --only firestore:rules` to take effect. Until deployed, PersonProfileStore syncs from IdentityFusionEngine in-memory (graceful fallback).

### Phase 3 — New UI Components
- `components/IdentityCard.tsx` — compact card with status badge, confidence bar, action buttons
- `components/PersonTimeline.tsx` — standalone timeline, fetches `GET /api/persons/:id/timeline`, 6 filter groups
- `components/PersonSearchModal.tsx` — 3-tab modal (Text/NLQ/Appearance), calls `/api/persons/search` and `/api/persons/search/nlq`

### Phase 4 — PersonIntelligencePlatform Rebuild
Full rebuild of `components/PersonIntelligencePlatform.tsx` (1037 lines old → ~620 lines new):
- All data from REST API (`/api/persons/*`), zero hardcoded stats
- 9 tabs: Overview, Timeline, Movement, Appearance, Associations, Evidence, Investigate, Reports, Compliance
- Investigation tab: movement replay engine (step-by-step camera path)
- Reports tab: trigger report generation, download JSON
- Compliance tab: operator notes, GDPR erasure, dossier export
- Integrates PersonTimeline, IdentityCard, PersonSearchModal components

### Phase 5 — SOC Integration
Added `PERSON_INTEL` tab to `components/SOCCommandCenter.tsx`:
- Tab button: `ScanFace` icon, "Person Intel"
- Content: IdentityCard + quick stats + PersonTimeline for selected subject
- PersonSearchModal for finding subjects
- "Clear subject" to reset investigation

## Key field names on PersonProfile (not guessable from spec)
- `lastSeen` (NOT `lastSeenAt`)
- `firstSeen` (NOT `firstSeenAt`)
- `cameraHistory` (NOT `cameraVisits`)
- `appearanceGallery` (NOT `appearanceHistory`)
- No `confidenceScore` field — compute as `totalRecognitions / (totalDetections + 1)`
- `fullName` is always set (even for anonymous: 'Anonymous-XXXXX')
- `role` is always required on PersonProfile

## API shape patterns
- All 22 routes return `{ success: boolean, data: T }` or `{ success: false, error: string }`
- Profile list: `GET /api/persons?limit=100` → `{ success, data: { profiles: PersonProfile[] } }` (or data as array)
- System stats: `GET /api/persons/statistics/system` → `{ success, data: SystemStats }`
- Timeline: `GET /api/persons/:id/timeline?limit=200` → `{ success, data: { entries, count } }`
- Movement: `GET /api/persons/:id/movement` → `{ success, data: { replay, journey, totalSteps, personId } }`
- NLQ search: `POST /api/persons/search/nlq` body `{ query }` → `{ success, data: { results: PersonProfile[], evidenceIds } }`

## VmsEventCallback (critical pattern)
`vmsEventService.subscribeToAll(cb)` — cb signature is `(event: VmsEvent) => void`, NOT `(type, source, payload)`.
Destructure: `event.type`, `event.source`, `event.payload`.

**Why:** VmsEventBroker emits a single VmsEvent object; multi-arg signature was a bug in the original PersonTimelineEngine.
