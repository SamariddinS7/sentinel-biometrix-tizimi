# Sentinel AI VMS — Disaster Recovery Plan

**RTO Target:** 4 hours  
**RPO Target:** 1 hour (daily backup) / 15 minutes (WAL streaming)

---

## 1. Backup Schedule

| Component | Method | Frequency | Retention | Location |
|-----------|--------|-----------|-----------|----------|
| PostgreSQL | pg_dump (custom format) | Daily 02:00 UTC | 90 days | `vms-backups` bucket |
| PostgreSQL WAL | Continuous streaming | Continuous | 7 days | Replica + WAL archive |
| Configuration | tar.gz | Daily | 30 days | `vms-backups` bucket |
| Evidence bucket | MinIO replication | Real-time | Indefinite | Secondary site |
| NATS JetStream | Built-in persistence | Continuous | 7 days | NFS/PV |

### Automated Backup (Kubernetes CronJob)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sentinel-vms-backup
  namespace: sentinel-vms
spec:
  schedule: "0 2 * * *"       # 02:00 UTC daily
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: ghcr.io/org/sentinel-vms:latest
              command: ["/bin/bash", "scripts/backup.sh"]
              envFrom:
                - secretRef:
                    name: sentinel-vms-secrets
          restartPolicy: OnFailure
```

---

## 2. Failure Scenarios & Procedures

### Scenario A: Application Pod Failure

**Detection:** Kubernetes liveness probe failure → pod restart  
**Auto-recovery:** Kubernetes restarts the pod within 30 seconds  
**Manual action:** None required unless crash-looping

```bash
# Check pod status
kubectl get pods -n sentinel-vms
kubectl describe pod <pod-name> -n sentinel-vms
kubectl logs <pod-name> -n sentinel-vms --previous
```

### Scenario B: PostgreSQL Primary Failure

**Detection:** `pg_isready` health check fails; Prometheus alert fires  
**Auto-recovery:** Promote standby replica (requires operator action in base PostgreSQL)

```bash
# 1. Identify replica
kubectl get pods -n sentinel-vms -l role=replica

# 2. Promote replica to primary
kubectl exec -it postgres-replica-0 -n sentinel-vms -- \
  pg_ctl promote -D /home/postgres/pgdata/data

# 3. Update POSTGRES_URL secret to point to replica
kubectl patch secret sentinel-vms-secrets -n sentinel-vms \
  --type='json' -p='[{"op":"replace","path":"/data/POSTGRES_URL","value":"'$(echo -n "postgres://sentinel:...@postgres-replica:5432/sentinel_vms?sslmode=require" | base64)'"}]'

# 4. Restart application pods
kubectl rollout restart deployment/sentinel-vms -n sentinel-vms
```

### Scenario C: Complete Site Failure

**Prerequisite:** Evidence bucket replication to secondary site must be active

```bash
# 1. Provision new infrastructure (use Terraform/Helm)
helm install sentinel-vms ./helm/sentinel-vms \
  --namespace sentinel-vms \
  --set image.tag=latest \
  --values helm/sentinel-vms/values.prod.yaml

# 2. Restore PostgreSQL from latest backup
./scripts/restore.sh --backup-date 2026-07-18 --target new-postgres:5432

# 3. Update DNS to point to new site
# (Automated via Route53/Cloudflare API in production)

# 4. Verify health
curl https://vms-dr.example.com/health/status
```

### Scenario D: Data Corruption

```bash
# Point-in-time recovery (requires WAL archiving)
pg_restore --clean -d "postgres://sentinel:...@new-db:5432/sentinel_vms" \
  --target-time "2026-07-18 14:30:00 UTC" \
  /backup/postgres_2026-07-18.dump
```

---

## 3. Evidence Integrity Verification

Evidence items are immutable once sealed. To verify integrity:

```bash
# Query sealed evidence with stored SHA-256 hashes
psql "${POSTGRES_URL}" -c \
  "SELECT id, filename, sha256_hash FROM evidence WHERE is_sealed = TRUE ORDER BY created_at DESC LIMIT 100;"

# Re-compute hash from stored object and compare
for row in $(psql ...); do
  OBJECT_HASH=$(mc stat "backup/vms-evidence/${row.storage_url}" | grep ETag)
  [ "${OBJECT_HASH}" == "${row.sha256_hash}" ] || echo "INTEGRITY FAILURE: ${row.id}"
done
```

---

## 4. Recovery Testing Schedule

| Test | Frequency | Owner |
|------|-----------|-------|
| Backup restore drill | Monthly | Platform Team |
| Replica failover test | Quarterly | DBA |
| Full DR site test | Semi-annually | All teams |
| Chaos engineering (pod kill) | Weekly (automated) | SRE |
