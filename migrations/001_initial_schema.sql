-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 001 — Initial Schema
-- Creates core tables: users, cameras, incidents, alarms, evidence, audit_log
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Trigram indexes for text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- Required for exclusion constraints

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    department      TEXT,
    role            TEXT NOT NULL DEFAULT 'OPERATOR'
                    CHECK (role IN ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role) WHERE is_active = TRUE;

-- ── Cameras ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cameras (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    location        TEXT,
    rtsp_url        TEXT,
    type            TEXT NOT NULL DEFAULT 'IP',
    status          TEXT NOT NULL DEFAULT 'OFFLINE'
                    CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE')),
    resolution      TEXT,
    fps             INTEGER DEFAULT 25,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    floor_id        TEXT,
    zone_id         TEXT,
    ai_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    config          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cameras_status  ON cameras (status);
CREATE INDEX IF NOT EXISTS idx_cameras_zone    ON cameras (zone_id);
CREATE INDEX IF NOT EXISTS idx_cameras_floor   ON cameras (floor_id);

-- ── Security incidents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED')),
    priority        TEXT NOT NULL DEFAULT 'MEDIUM'
                    CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    severity        TEXT NOT NULL DEFAULT 'WARNING',
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    camera_id       UUID REFERENCES cameras(id) ON DELETE SET NULL,
    location        TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_status    ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_priority  ON incidents (priority);
CREATE INDEX IF NOT EXISTS idx_incidents_camera    ON incidents (camera_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created   ON incidents (created_at DESC);

-- ── Security alarms ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alarms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id     UUID REFERENCES incidents(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,
    category        TEXT,
    severity        TEXT NOT NULL DEFAULT 'WARNING'
                    CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY')),
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED')),
    camera_id       UUID REFERENCES cameras(id) ON DELETE SET NULL,
    source          TEXT,
    description     TEXT,
    confidence      FLOAT,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarms_status   ON alarms (status);
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms (severity);
CREATE INDEX IF NOT EXISTS idx_alarms_camera   ON alarms (camera_id);
CREATE INDEX IF NOT EXISTS idx_alarms_created  ON alarms (created_at DESC);

-- ── Evidence ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id     UUID REFERENCES incidents(id) ON DELETE RESTRICT,
    type            TEXT NOT NULL
                    CHECK (type IN ('VIDEO_CLIP', 'SCREENSHOT', 'REPORT', 'AUDIO', 'DOCUMENT', 'OTHER')),
    filename        TEXT NOT NULL,
    storage_url     TEXT NOT NULL,
    storage_bucket  TEXT NOT NULL DEFAULT 'vms-evidence',
    file_size       BIGINT,
    mime_type       TEXT,
    sha256_hash     TEXT,
    description     TEXT,
    captured_at     TIMESTAMPTZ,
    captured_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    chain_of_custody JSONB NOT NULL DEFAULT '[]',
    is_sealed       BOOLEAN NOT NULL DEFAULT FALSE,   -- immutable once sealed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence (incident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type     ON evidence (type);

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID,
    user_name       TEXT,
    action          TEXT NOT NULL,
    module          TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       TEXT,
    status          TEXT NOT NULL DEFAULT 'SUCCESS',
    ip_address      TEXT,
    user_agent      TEXT,
    details         TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (12 months ahead)
DO $$
DECLARE
  i INTEGER;
  start_date DATE;
  end_date DATE;
BEGIN
  FOR i IN 0..11 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
    end_date   := start_date + INTERVAL '1 month';
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS audit_log_%s PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
      TO_CHAR(start_date, 'YYYY_MM'), start_date, end_date
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module  ON audit_log (module, created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cameras_updated_at  BEFORE UPDATE ON cameras  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
