-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002 — TimescaleDB Event Tables
-- Hypertables for high-volume time-series data: VMS events, telemetry, tracks
-- Requires TimescaleDB extension (included in timescale/timescaledb-ha image)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ── VMS Events (hypertable) ──────────────────────────────────────────────────
-- Stores all AI detection events. Expected volume: 10M+ events/day at scale.
CREATE TABLE IF NOT EXISTS vms_events (
    id              TEXT NOT NULL,           -- evt_<timestamp>_<random>
    time            TIMESTAMPTZ NOT NULL,    -- partitioning column
    type            TEXT NOT NULL,
    source          TEXT NOT NULL,           -- camera ID or service name
    severity        TEXT NOT NULL DEFAULT 'INFO',
    camera_id       UUID,
    zone_id         TEXT,
    confidence      FLOAT,
    payload         JSONB NOT NULL DEFAULT '{}',
    processed       BOOLEAN NOT NULL DEFAULT FALSE
);

SELECT create_hypertable('vms_events', 'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Compression policy: compress chunks older than 7 days
SELECT add_compression_policy('vms_events',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Retention policy: drop chunks older than 90 days (configurable)
SELECT add_retention_policy('vms_events',
    INTERVAL '90 days',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_vms_events_type     ON vms_events (type, time DESC);
CREATE INDEX IF NOT EXISTS idx_vms_events_camera   ON vms_events (camera_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_vms_events_severity ON vms_events (severity, time DESC) WHERE severity IN ('WARNING', 'CRITICAL');

-- ── System telemetry (hypertable) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_telemetry (
    time            TIMESTAMPTZ NOT NULL,
    host            TEXT NOT NULL DEFAULT 'local',
    cpu_pct         FLOAT,
    ram_pct         FLOAT,
    gpu_pct         FLOAT,
    disk_pct        FLOAT,
    network_rx_kbps FLOAT,
    network_tx_kbps FLOAT,
    active_cameras  INTEGER,
    ws_connections  INTEGER,
    ai_queue_depth  INTEGER,
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('system_telemetry', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

SELECT add_compression_policy('system_telemetry', INTERVAL '24 hours', if_not_exists => TRUE);
SELECT add_retention_policy('system_telemetry', INTERVAL '30 days', if_not_exists => TRUE);

-- ── Person tracking tracks (hypertable) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS person_tracks (
    time            TIMESTAMPTZ NOT NULL,
    track_id        TEXT NOT NULL,
    camera_id       UUID,
    identity_id     TEXT,
    bbox_x          FLOAT, bbox_y FLOAT, bbox_w FLOAT, bbox_h FLOAT,
    confidence      FLOAT,
    zone_id         TEXT,
    metadata        JSONB DEFAULT '{}'
);

SELECT create_hypertable('person_tracks', 'time',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

SELECT add_compression_policy('person_tracks', INTERVAL '24 hours', if_not_exists => TRUE);
SELECT add_retention_policy('person_tracks', INTERVAL '30 days', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_person_tracks_identity ON person_tracks (identity_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_person_tracks_camera   ON person_tracks (camera_id, time DESC);

-- ── Continuous aggregate: hourly alarm summary ───────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS alarms_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    type,
    severity,
    camera_id,
    COUNT(*) AS event_count,
    AVG(confidence) AS avg_confidence
FROM vms_events
WHERE type LIKE '%DETECTED%' OR type LIKE '%VIOLATION%' OR type LIKE '%ALARM%'
GROUP BY bucket, type, severity, camera_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('alarms_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
