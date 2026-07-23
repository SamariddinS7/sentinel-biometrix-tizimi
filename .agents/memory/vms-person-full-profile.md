---
name: VMS Person Full Profile
description: PersonFullProfile component — 5-tab full-screen modal for per-person surveillance profiles; AI analysis route added to PersonIntelApiRouter.
---

# VMS Person Full Profile

## What was built
- `components/PersonFullProfile.tsx` — full-screen modal (replaces the side-panel `PersonAttributeProfile`) with 5 tabs
- `context/PersonProfileContext.tsx` — updated to import and render `PersonFullProfile` instead of `PersonAttributeProfile`
- `services/personIntel/PersonIntelApiRouter.ts` — added route 23: `POST /api/persons/:id/ai-analysis`

## Tabs
1. **Umumiy** (Overview) — identity card, presence stats, advanced stats from `/statistics`, quick actions (watchlist/archive), registration history
2. **Ko'rinish** (Appearance) — biometric body attributes, clothing detail, accessories, carried-objects aggregate, collapsible snapshot gallery
3. **Faoliyat** (Activity) — camera visit table, visited zones, relationship observations, full `PersonTimeline` component
4. **Ma'lumotlar** (Personal Data) — editable fields (name, employeeId, department, org, position, notes), custom key-value attributes, operator note input; saves via `PATCH /api/persons/:id`
5. **AI Tahlil** (AI Analysis) — Gemini-powered behavioral analysis (riskLevel, riskScore, patterns, recommendations, monitoringFlags), save-to-note action, AI monitoring toggle

## AI analysis route
- Builds compact profile summary JSON, sends to `gemini-2.0-flash` with Uzbek-language instructions
- Falls back to rule-based scoring if GEMINI_API_KEY is absent
- Returns: `{ summary, riskLevel, riskScore, patterns, recommendations, monitoringFlags }`

**Why:** Side panel was too narrow for the volume of data; full-screen modal gives room for all tabs without scrolling the entire page.
