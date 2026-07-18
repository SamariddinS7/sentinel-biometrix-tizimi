---
name: VMS Monorepo Structure
description: npm workspaces layout, Vite alias bridge pattern, and known gotchas after the Prompt 2 restructure.
---

# VMS Monorepo Structure

## Layout (post-Prompt-2)
```
apps/web/          — React UI only (index.html → src/index.tsx, components/, theme/)
apps/api/          — Express server + ALL services (src/server.ts, src/services/, models/)
packages/shared-types/  — types.ts content, re-exported via apps/api/src/types.ts bridge
packages/config/   — tsconfig base
```

## How dev runs
`npm run dev` (root) → `npm run dev --workspace=apps/api` → `tsx src/server.ts` from `apps/api/`.
- `process.cwd()` = `/workspace/apps/api` → models load from `apps/api/models/` ✓
- Vite root: `path.resolve(process.cwd(), '../web')` (uses process.cwd(), NOT __dirname — ESM has no __dirname)
- Production dist: `path.resolve(process.cwd(), '../web/dist')`

## Vite alias bridge (apps/web/vite.config.ts)
Frontend components import services with relative paths that cross workspace boundaries.
Instead of changing imports, aliases redirect them:
- `'../../services'` → `apps/api/src/services` (for components/soc/ — 2 levels deep)
- `'../services'` → `apps/api/src/services` (for components/ — 1 level deep)
- `'./services'` → `apps/api/src/services` (for src/App.tsx)
- `'../lib'` → `apps/api/src/lib`
- `'../types'` / `'./types'` → packages/shared-types/src/index.ts
- `'@sentinel/shared-types'` → packages/shared-types/src/index.ts

## types.ts bridge (apps/api/src/types.ts)
Services use `../types` or `../../types` (relative). This file re-exports from:
`../../../packages/shared-types/src/index.ts`
So no service import needed changing.

## firebase-applet-config.json
Lives at `apps/api/firebase-applet-config.json`.
firestoreService.ts import: `../../firebase-applet-config.json` (from src/services/).

## Critical gotcha: __dirname in ESM
`"type": "module"` in package.json means `__dirname` is undefined at runtime.
Use `process.cwd()` for paths that need the workspace root. Never add `__dirname` to server.ts.

## Why: no per-file import changes
Services are imported by BOTH frontend components AND server.ts (tightly coupled singleton pattern).
Splitting services between web/api would require changing hundreds of imports.
The alias bridge is the zero-import-change solution.
