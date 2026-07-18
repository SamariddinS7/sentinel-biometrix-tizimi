---
name: VMS DevSecOps Platform Build
description: Infrastructure gaps fixed, fake code removed, animations added — key constraints and patterns for future work.
---

## OpenTelemetry (tracing.ts)

`@opentelemetry/resources` v2.x removed the `Resource` class. Use `resourceFromAttributes` instead:
```typescript
import { resourceFromAttributes } from '@opentelemetry/resources';
const res = resourceFromAttributes({ [SEMRESATTRS_SERVICE_NAME]: 'my-svc' });
```
Redis instrumentation package is `@opentelemetry/instrumentation-redis` (not `redis-4`). OTEL setup is in `services/infrastructure/tracing.ts`, imported at the top of `server.ts`.

**Why:** Breaking change in OTEL resources v2.x that causes startup failure if old import is used.

## Helm Chart Templates

All required templates now exist:
`service.yaml`, `ingress.yaml`, `hpa.yaml`, `pdb.yaml`, `configmap.yaml`, `serviceaccount.yaml`, `servicemonitor.yaml`, `cronjob-backup.yaml`.

`values.yaml` has `backup`, `podDisruptionBudget`, `env`, `autoscaling` sections. `values.staging.yaml` exists for staging deploys.

**Why:** Chart was undeployable without these; CD pipeline referenced staging values that didn't exist.

## Camera Connection Test (CamerasView.tsx)

The fake setTimeout chain was replaced with a real call to `cameraService.diagnoseCamera(id, streamUrl)`. Results are displayed progressively using a timed loop over `result.logs[]`. The camera diagnose API is at `/api/cameras/:id/diagnose` (POST `{streamUrl}`) and requires no auth header (the service layer handles it).

**Why:** The old implementation ran zero real network tests; the backend already had a complete diagnose endpoint.

## Bitrate/FPS Stats (CamerasView.tsx)

Removed `Math.random()` jitter. Now shows nominal values from camera config and polls `/api/cameras/:id/stream/stats` every 5s for real metrics (silently falls back to nominal if endpoint returns 404).

## AnalyticsDashboard Animations

Uses `AnimatePresence mode="wait"` wrapping all tab sections. Each tab section is a `<motion.div key={tabKey}>` with `initial/animate/exit` for fade+slide. Event list rows use per-item stagger delay (capped at first 10 items to avoid 100+ item sluggishness).

## AreaMapView Smooth Track Movement

`renderPositionsRef` stores `Map<trackId, {x,y}>` interpolated positions. Lerp factor: `0.14` per frame (~60fps = ~0.5s glide). The render loop uses lerped position for the track head and direction arrow; raw `track.path` is used for the fade trail. Stale entries are cleaned up when the track is no longer in the `tracks` array.

## Docker Compose Exporters

Added to `docker-compose.yml`: `postgres-exporter` (quay.io), `redis-exporter` (oliver006), `node-exporter` (quay.io), `alertmanager` (prom). Grafana volumes were corrected — dashboards mount to `/etc/grafana/dashboards`, provisioning to `/etc/grafana/provisioning`.

## Migration Runner

`scripts/migrate.sh` — shell-only, uses `psql` + `sha256sum`. Tracks applied versions in `schema_migrations` table. Supports `--dry-run` and `--rollback`. Call it at deploy time before app start.
