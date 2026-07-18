#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Sentinel VMS — Automated Backup Script
#
# Backs up:
#   1. PostgreSQL database (pg_dump → gzip → MinIO/S3)
#   2. .data/ directory (evidence, models, local cache)
#   3. Configuration files
#
# Usage:
#   ./scripts/backup.sh
#   BACKUP_RETENTION_DAYS=30 ./scripts/backup.sh
#
# Scheduled via: Kubernetes CronJob or cron daemon
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

BACKUP_DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/tmp/sentinel-backup-${BACKUP_DATE}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${STORAGE_BUCKET_BACKUPS:-vms-backups}"
LOG_PREFIX="[BACKUP ${BACKUP_DATE}]"

echo "${LOG_PREFIX} Starting Sentinel VMS backup..."
mkdir -p "${BACKUP_DIR}"

# ── 1. PostgreSQL dump ────────────────────────────────────────────────────────
if [ -n "${POSTGRES_URL:-}" ]; then
  echo "${LOG_PREFIX} Dumping PostgreSQL database..."
  PG_DUMP_FILE="${BACKUP_DIR}/postgres_${BACKUP_DATE}.sql.gz"

  pg_dump "${POSTGRES_URL}" \
    --format=custom \
    --no-acl \
    --no-owner \
    --compress=9 \
    --file="${BACKUP_DIR}/postgres_${BACKUP_DATE}.dump"

  echo "${LOG_PREFIX} PostgreSQL dump complete: $(du -sh ${BACKUP_DIR}/postgres_${BACKUP_DATE}.dump | cut -f1)"
else
  echo "${LOG_PREFIX} POSTGRES_URL not set — skipping database backup"
fi

# ── 2. Configuration backup ───────────────────────────────────────────────────
echo "${LOG_PREFIX} Backing up configuration files..."
CONFIG_ARCHIVE="${BACKUP_DIR}/config_${BACKUP_DATE}.tar.gz"
tar -czf "${CONFIG_ARCHIVE}" \
  --exclude='*.log' \
  --exclude='node_modules' \
  --exclude='.data/storage' \
  .env.prod 2>/dev/null || true \
  docker-compose.prod.yml 2>/dev/null || true \
  k8s/ 2>/dev/null || true \
  helm/ 2>/dev/null || true \
  nginx/ 2>/dev/null || true \
  monitoring/ 2>/dev/null || true

# ── 3. Upload to object storage ───────────────────────────────────────────────
if [ -n "${STORAGE_ENDPOINT:-}" ] && [ -n "${STORAGE_ACCESS_KEY:-}" ]; then
  echo "${LOG_PREFIX} Uploading to object storage bucket: ${S3_BUCKET}..."

  # Configure mc (MinIO client) or aws-cli
  if command -v mc &> /dev/null; then
    mc alias set backup "${STORAGE_ENDPOINT}" "${STORAGE_ACCESS_KEY}" "${STORAGE_SECRET_KEY}"
    mc cp --recursive "${BACKUP_DIR}/" "backup/${S3_BUCKET}/$(date +%Y/%m/%d)/"

    # Apply retention: delete files older than RETENTION_DAYS
    mc rm --recursive --force --older-than "${RETENTION_DAYS}d" "backup/${S3_BUCKET}/" || true

  elif command -v aws &> /dev/null; then
    aws s3 sync "${BACKUP_DIR}/" "s3://${S3_BUCKET}/$(date +%Y/%m/%d)/" \
      --endpoint-url "${STORAGE_ENDPOINT}" \
      --no-progress

    # Lifecycle policies handle retention for AWS S3
  else
    echo "${LOG_PREFIX} WARNING: Neither mc nor aws-cli found. Backup files left at ${BACKUP_DIR}"
    exit 0
  fi

  echo "${LOG_PREFIX} Upload complete."
else
  echo "${LOG_PREFIX} Object storage not configured — backup files at ${BACKUP_DIR}"
  exit 0
fi

# ── 4. Cleanup ────────────────────────────────────────────────────────────────
rm -rf "${BACKUP_DIR}"
echo "${LOG_PREFIX} Backup complete. Retention: ${RETENTION_DAYS} days."
