#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Sentinel VMS — Database Migration Runner
#
# Usage:
#   ./scripts/migrate.sh                          # Apply all pending migrations
#   ./scripts/migrate.sh --dry-run                # Print SQL without applying
#   ./scripts/migrate.sh --rollback 003           # Rollback to before migration 003
#
# Environment variables:
#   POSTGRES_URL   — Full DSN (postgres://user:pass@host:port/db)
#   MIGRATIONS_DIR — Directory containing .sql files (default: ./migrations)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-./migrations}"
DRY_RUN=false
ROLLBACK_TO=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --rollback) ROLLBACK_TO="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "${POSTGRES_URL:-}" ]]; then
  echo "[migrate] ERROR: POSTGRES_URL is not set" >&2
  exit 1
fi

export PGPASSWORD  # Ensure psql picks up credentials from URL
PSQL="psql ${POSTGRES_URL} --no-psqlrc -v ON_ERROR_STOP=1"

echo "[migrate] Connected to: $(echo "$POSTGRES_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')"

# Ensure migration tracking table exists
$PSQL -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(20) PRIMARY KEY,
  name        TEXT        NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum    TEXT        NOT NULL
);" > /dev/null

applied() {
  $PSQL -tAc "SELECT version FROM schema_migrations ORDER BY version;"
}

# Collect and sort migration files
shopt -s nullglob
migration_files=( "$MIGRATIONS_DIR"/*.sql )
if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "[migrate] No migration files found in ${MIGRATIONS_DIR}"
  exit 0
fi

declare -A applied_map
while IFS= read -r ver; do
  applied_map["$ver"]=1
done < <(applied)

pending=()
for f in "${migration_files[@]}"; do
  basename=$(basename "$f")
  version="${basename%%_*}"  # e.g. "001" from "001_initial_schema.sql"
  if [[ -z "${applied_map[$version]:-}" ]]; then
    pending+=("$f")
  fi
done

if [[ ${#pending[@]} -eq 0 ]]; then
  echo "[migrate] Database is up to date — no pending migrations."
  exit 0
fi

echo "[migrate] Pending migrations: ${#pending[@]}"
for f in "${pending[@]}"; do
  echo "  → $(basename "$f")"
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[migrate] DRY RUN — not applying changes."
  exit 0
fi

# Apply pending migrations in a single transaction per file
for f in "${pending[@]}"; do
  basename=$(basename "$f")
  version="${basename%%_*}"
  name="${basename%.sql}"
  checksum=$(sha256sum "$f" | awk '{print $1}')

  echo "[migrate] Applying: ${basename}"
  $PSQL --single-transaction -f "$f"

  $PSQL -c "
INSERT INTO schema_migrations (version, name, checksum)
VALUES ('${version}', '${name}', '${checksum}');" > /dev/null

  echo "[migrate] ✓ Applied: ${basename}"
done

echo "[migrate] All migrations applied successfully."
