---
name: VMS SOC Unified Command Center
description: Architecture and wiring details for the rebuilt SOCCommandCenter and its sub-modules
---

# VMS SOC Unified Command Center

## What was built
- `components/SOCCommandCenter.tsx` — fully rebuilt as a unified shell with 17 module tabs, left collapsible nav, top command bar with emergency controls (Lockdown, Buzzer), site selector, and ⌘K global search.
- `components/soc/SOCEventTimeline.tsx` — real-time AI event feed via `vmsEventService.subscribeToAll()` + `getHistory()`. Filter groups, pause/resume, export JSON.
- `components/soc/SOCOverview.tsx` — aggregate SOC dashboard: stat cards for cameras/alarms/incidents/personnel, system gauges, event chart (Recharts), quick-access module grid.

## Module routing (SOCCommandCenter)
17 modules keyed by `ModuleId`. Each module renders its own sub-component at full height. Modules that manage their own scrolling (video_wall, digital_twin, area_map) get `overflow-hidden`; all others get `p-5` padding.

## NotificationCenter wrapper
`NotificationCenter` requires `isOpen` and `onClose` props. The SOC wraps it in `InlineNotificationCenter` (local component inside SOCCommandCenter.tsx) to satisfy those props.

## Physical Visibility Engine
`components/DigitalTwinView.tsx` already had `intersectRayBox` + `computeFrustumGeometry` with full wall-occlusion ray casting. No new code was needed for this.

## TypeScript constraint
All icon props must be typed as `React.ComponentType<{ size?: number; className?: string }>`, NOT `React.ElementType`. The latter causes "type 'number' is not assignable to type 'ElementType'" errors in JSX.

**Why:** TypeScript's JSX transform requires a callable type; `React.ElementType` is a union that includes `number` (string tags are fine but the generic type admits numbers). `React.ComponentType<P>` is a properly constrained callable.

## Event bus integration
SOCCommandCenter subscribes to `vmsEventService.subscribeToAll()` for live event badge counting on the "AI Event Timeline" tab. Badge resets to 0 when the user navigates to that module.

## API endpoints used by new components
- `/api/cameras` — camera list + status
- `/api/security/alerts` — alarm list for badge counts
- `/api/incidents` — incident list for badge counts + SOCOverview
- `/api/telemetry` — CPU/RAM/GPU for SOCOverview gauges
- `/api/resources/staff` — staff list for SOCOverview personnel card
- `/api/soc/search?q=&limit=` — global search results (cameras, incidents, alerts, persons)
