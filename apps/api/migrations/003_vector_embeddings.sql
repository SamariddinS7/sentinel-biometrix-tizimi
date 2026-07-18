-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003 — Vector Embeddings (pgvector)
-- Stores face embeddings, appearance embeddings for identity search.
-- Requires pgvector extension (included in timescale/timescaledb-ha image)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Persistent identities ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label           TEXT,
    role            TEXT DEFAULT 'UNKNOWN',
    status          TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'FLAGGED', 'ARCHIVED')),
    first_seen_at   TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,
    appearance_count INTEGER DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_identities_status    ON identities (status);
CREATE INDEX IF NOT EXISTS idx_identities_last_seen ON identities (last_seen_at DESC);

-- ── Face embeddings ──────────────────────────────────────────────────────────
-- dim=512 matches FaceNet/ArcFace standard output dimension.
-- Adjust if using a different face recognition model.
CREATE TABLE IF NOT EXISTS face_embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identity_id     UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
    embedding       vector(512) NOT NULL,
    source_camera   UUID REFERENCES cameras(id) ON DELETE SET NULL,
    confidence      FLOAT NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat index for approximate nearest-neighbour search
-- lists = sqrt(total_rows) at index creation; rebuild periodically.
CREATE INDEX IF NOT EXISTS idx_face_embeddings_ivfflat
    ON face_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_identity ON face_embeddings (identity_id);

-- ── Appearance embeddings (colour/texture vectors) ────────────────────────────
-- dim=128 matches the HSV spectral analysis output in AppearanceIntelligenceEngine
CREATE TABLE IF NOT EXISTS appearance_embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identity_id     UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
    embedding       vector(128) NOT NULL,
    upper_colour    TEXT,
    lower_colour    TEXT,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appearance_embeddings_ivfflat
    ON appearance_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── Helper function: find nearest N identities by face embedding ──────────────
CREATE OR REPLACE FUNCTION find_similar_identities(
    query_embedding vector(512),
    max_distance    FLOAT   DEFAULT 0.4,
    result_limit    INTEGER DEFAULT 10
)
RETURNS TABLE (
    identity_id     UUID,
    label           TEXT,
    distance        FLOAT,
    confidence      FLOAT
) AS $$
    SELECT
        i.id,
        i.label,
        fe.embedding <=> query_embedding AS distance,
        fe.confidence
    FROM face_embeddings fe
    JOIN identities i ON fe.identity_id = i.id
    WHERE i.status = 'ACTIVE'
      AND fe.embedding <=> query_embedding < max_distance
    ORDER BY distance ASC
    LIMIT result_limit;
$$ LANGUAGE sql STABLE;

-- ── updated_at trigger for identities ────────────────────────────────────────
CREATE TRIGGER identities_updated_at
    BEFORE UPDATE ON identities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
