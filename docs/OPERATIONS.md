# Sentinel AI VMS — Operations Runbook

## Table of Contents

1. [Service Overview](#service-overview)
2. [Health Checks](#health-checks)
3. [Starting & Stopping](#starting--stopping)
4. [Log Access](#log-access)
5. [Database Operations](#database-operations)
6. [Backups & Restore](#backups--restore)
7. [Incident Response](#incident-response)
8. [Scaling](#scaling)
9. [Alertmanager Maintenance Windows](#alertmanager-maintenance-windows)
10. [Key Metrics & SLOs](#key-metrics--slos)
11. [Runbooks by Alert](#runbooks-by-alert)

---

## Service Overview

| Component | Role | Port |
|-----------|------|------|
| sentinel-vms | Main application (API + AI engine) | 5000 (HTTP), 9090 (metrics) |
| PostgreSQL 16 + TimescaleDB | Primary datastore + time-series | 5432 |
| Redis 7 | Session cache + pub/sub | 6379 |
| NATS JetStream | Async event bus | 4222 |
| MinIO | Object/evidence storage | 9000 |
| Prometheus | Metrics scraper | 9090 |
| Grafana | Dashboards | 3000 |
| Alertmanager | Alert routing | 9093 |

---

## Health Checks

```bash
# Liveness (is the process alive?)
curl -sf http://localhost:5000/health/live

# Readiness (is all infra connected?)
curl -sf http://localhost:5000/health/ready

# Full health detail (JSON)
curl http://localhost:5000/health/ready | jq .
```

Expected response:

```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok",
    "messagebus": "ok"
  }
}
```

---

## Starting & Stopping

### Development (docker-compose)

```bash
# Start all services
docker compose up -d

# Follow app logs
docker compose logs -f app

# Stop all services (preserve data volumes)
docker compose down

# Wipe all data
docker compose down -v
```

### Production (Kubernetes / Helm)

```bash
# View deployment status
kubectl -n sentinel-production get deploy sentinel-vms -w

# Restart all pods (rolling)
kubectl -n sentinel-production rollout restart deploy/sentinel-vms

# Check rollout progress
kubectl -n sentinel-production rollout status deploy/sentinel-vms

# Roll back to previous release
helm -n sentinel-production rollback sentinel-vms 0
```

---

## Log Access

### Docker Compose

```bash
docker compose logs app --since=1h --tail=200 -f
```

### Kubernetes

```bash
# Stream logs from all replicas
kubectl -n sentinel-production logs -l app=sentinel-vms -f --max-log-requests=10

# Specific pod
kubectl -n sentinel-production logs sentinel-vms-<pod-id> -c sentinel-vms

# Previous container (crash loop)
kubectl -n sentinel-production logs sentinel-vms-<pod-id> -c sentinel-vms --previous
```

### Log Format

All logs are structured JSON (`pino`). Key fields:

| Field | Meaning |
|-------|---------|
| `level` | debug / info / warn / error |
| `rid` | Request ID (trace across logs) |
| `module` | Subsystem (http, ai, camera, security) |
| `durationMs` | Request duration |
| `status` | HTTP status code |

---

## Database Operations

### Apply Migrations

```bash
# Development
POSTGRES_URL="postgres://sentinel:sentinel_dev@localhost:5432/sentinel_vms" \
  ./scripts/migrate.sh

# Dry run (see what would be applied)
./scripts/migrate.sh --dry-run

# Production (Kubernetes)
kubectl -n sentinel-production run migrate --image=ghcr.io/org/sentinel-vms:latest \
  --env="POSTGRES_URL=$(kubectl get secret db-credentials -o jsonpath='{.data.url}' | base64 -d)" \
  --command -- ./scripts/migrate.sh
```

### Connect to Database

```bash
# Via docker-compose
docker compose exec postgres psql -U sentinel sentinel_vms

# Via Kubernetes port-forward
kubectl -n sentinel-production port-forward svc/sentinel-vms-postgresql 5432:5432 &
psql postgres://sentinel:$PASSWORD@localhost:5432/sentinel_vms
```

### Useful Queries

```sql
-- Recent alarms
SELECT id, type, severity, status, created_at FROM alarms
ORDER BY created_at DESC LIMIT 20;

-- Camera status summary
SELECT status, count(*) FROM cameras GROUP BY status;

-- Audit log (last hour)
SELECT * FROM audit_log WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;

-- TimescaleDB: check hypertables
SELECT hypertable_name, num_chunks, total_bytes
FROM timescaledb_information.hypertables;

-- TimescaleDB: continuous agg refresh
CALL refresh_continuous_aggregate('camera_events_hourly', now()-interval '2h', now());
```

---

## Backups & Restore

### Manual Backup

```bash
# Run the backup script directly
POSTGRES_URL="postgres://..." \
S3_BUCKET="sentinel-vms-backups" \
STORAGE_ENDPOINT="http://minio:9000" \
RETENTION_DAYS=30 \
  ./scripts/backup.sh
```

### Kubernetes CronJob

The CronJob `sentinel-vms-backup` runs nightly at 02:00 UTC (configurable via `backup.schedule` in values).

```bash
# Trigger a manual run
kubectl -n sentinel-production create job --from=cronjob/sentinel-vms-backup manual-backup-$(date +%s)

# Watch the job
kubectl -n sentinel-production logs -f job/manual-backup-*
```

### Restore from Backup

```bash
# List available backups
aws s3 ls s3://sentinel-vms-backups/postgres/ --endpoint-url http://minio:9000

# Download and restore
aws s3 cp s3://sentinel-vms-backups/postgres/sentinel_vms_20260718_020000.dump /tmp/ \
  --endpoint-url http://minio:9000

pg_restore --host=localhost --port=5432 --username=sentinel \
  --dbname=sentinel_vms --clean --if-exists \
  /tmp/sentinel_vms_20260718_020000.dump
```

---

## Incident Response

### P1 — All instances down

1. Check pods: `kubectl -n sentinel-production get pods`
2. Check events: `kubectl -n sentinel-production get events --sort-by=.lastTimestamp | tail -20`
3. Check logs of crashed pod: `kubectl -n sentinel-production logs <pod> --previous`
4. Restart: `kubectl -n sentinel-production rollout restart deploy/sentinel-vms`
5. If still failing, rollback: `helm -n sentinel-production rollback sentinel-vms 0`

### P2 — High error rate (> 5%)

1. Check Grafana dashboard: **Sentinel VMS — Overview** → HTTP Error Rate panel
2. Check recent logs: `kubectl logs -l app=sentinel-vms --since=10m | grep '"level":"error"'`
3. Check database connectivity: `curl http://localhost:5000/health/ready`
4. If DB issue: check PostgreSQL pod `kubectl -n sentinel-production get pods -l app.kubernetes.io/name=postgresql`

### P3 — AI inference degraded

1. Check Grafana: **AI Inference** dashboard → Inference Latency / Queue Depth
2. Check for OOM: `kubectl top pods -n sentinel-production`
3. If memory pressure: scale up `kubectl -n sentinel-production scale deploy/sentinel-vms --replicas=5`
4. Check ONNX model file: `ls -lh .data/models/yolov8n.onnx`

### P4 — Camera offline

1. Check camera status in UI or via API: `GET /api/cameras`
2. Run diagnostics: `POST /api/cameras/:id/diagnose`
3. Check network path from app pod to camera IP
4. Check camera management UI for stream URL validity

---

## Scaling

### Horizontal (Kubernetes)

HPA is pre-configured (`minReplicas: 3`, `maxReplicas: 20`). Manual override:

```bash
kubectl -n sentinel-production scale deploy/sentinel-vms --replicas=8
```

### Resource Adjustment

```bash
helm -n sentinel-production upgrade sentinel-vms ./helm/sentinel-vms \
  -f values.yaml -f values.prod.yaml \
  --set resources.requests.memory=2Gi \
  --set resources.limits.memory=12Gi
```

---

## Alertmanager Maintenance Windows

Create a silence for planned maintenance:

```bash
# Create 2-hour silence for all alerts on instance X
curl -X POST http://alertmanager:9093/api/v2/silences \
  -H 'Content-Type: application/json' \
  -d '{
    "matchers": [{"name":"instance","value":"sentinel-vms","isRegex":false}],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "endsAt": "'$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "createdBy": "ops-team",
    "comment": "Planned maintenance window"
  }'
```

---

## Key Metrics & SLOs

| Metric | SLO | Alert threshold |
|--------|-----|----------------|
| Availability | 99.9% | < 99% over 5m |
| HTTP p95 latency | < 500ms | > 2s for 5m |
| AI inference p99 | < 200ms | > 500ms for 5m |
| Camera online rate | > 95% | < 80% |
| Error rate (5xx) | < 1% | > 5% for 2m |
| DB connection pool | < 80% | > 90% |

---

## Runbooks by Alert

| Alert | Runbook |
|-------|---------|
| `VMSInstanceDown` | See P1 above |
| `VMSHighErrorRate` | See P2 above |
| `VMSAIInferenceLatencyHigh` | See P3 above |
| `VMSCamerasOfflineHigh` | See P4 above |
| `VMSPostgresDown` | Check PG pods → check storage PVC → restore from backup |
| `VMSRedisDown` | Check Redis pods → `redis-cli ping` → check memory |
| `VMSDiskUsageHigh` | Rotate recordings: `POST /api/system/storage/rotate` |
| `VMSSecurityAlarmSpike` | Check SOC Command Center → review camera feeds |
