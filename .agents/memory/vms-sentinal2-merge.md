---
name: VMS SENTINAL2 Merge
description: Documents all UI/UX and backend changes applied from the SENTINAL2 GitHub repo into the flat workspace structure.
---

# VMS SENTINAL2 Merge

## What changed
All files from `apps/web/src/` and `apps/api/src/` of the SENTINAL2 monorepo were merged into the existing flat workspace structure.

## Key additions
- **AuthPage.tsx** — Complete redesign: two-panel layout (hero left, form right), animated radar rings/orbs, Register tab, password show/hide, Uzbek copy.
- **AICopilot.tsx + AIPanel.tsx** — Global AI Copilot right-side drawer (Sparkles button in topbar). Three modes: Operational Copilot, Gemini Chat, Multimodal Tools (audio transcription, maps grounding, media analysis).
- **context/PersonProfileContext.tsx** — Global person profile panel; any component can call `openProfile(id)`.
- **components/soc/** — 10 SOC sub-components: EventTimeline, EvidenceManager, HealthMonitor, IncidentCenter, InvestigationCenter, MultiSite, Overview, Reports, ResourceManager, VideoWall.
- **services/copilot/** — CopilotApiRouter + CopilotOrchestrator + 4 agent files. Mounted at `/api/copilot`.
- **services/vision/** — VisionIntelligencePlatform + 8 sub-services. Mounted at `/api/vision`.
- **theme/tokens.ts** — DARK_THEME / LIGHT_THEME using Slate-950 + Cyan/Indigo palette; CSS vars injected at `:root`.
- **components/Skeleton.tsx, SupportModal.tsx, IdentityCard.tsx, PersonTimeline.tsx, PersonSearchModal.tsx, PersonAttributeProfile.tsx, VisionIntelligencePlatform.tsx, AIChatView.tsx** — all new.

## Import path rule
All components use `@sentinel/shared-types` in the source repo. After merge, these are rewritten to:
- `../types` for components in `components/`
- `../../types` for components in `components/soc/`

**Why:** The workspace uses a flat structure with `types.ts` at root, not a monorepo package. The sed rewrite runs on copy.

## Server.ts additions
```ts
import { copilotApiRouter } from "./services/copilot/CopilotApiRouter";
import { visionRouter } from "./routes/visionRouter";
app.use("/api/copilot", authenticateToken, copilotApiRouter);
app.use("/api/vision",  authenticateToken, visionRouter);
```

## Port fix
server.ts was hardcoded to port 3000. Changed to `parseInt(process.env.PORT || "5000", 10)` so Replit workflow detects it.
