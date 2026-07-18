/**
 * Enterprise Database Service
 *
 * Primary:  PostgreSQL (+ TimescaleDB extension for time-series events)
 *           + pgvector extension for face/identity embeddings
 * Fallback: Firebase Firestore / local JSON (existing implementation)
 *
 * Features:
 *   • Connection pooling (pg Pool)
 *   • Automatic migration runner (sequential SQL files in migrations/)
 *   • Read replica support via POSTGRES_REPLICA_URL
 *   • Transaction helpers
 *   • Prepared statement support
 *
 * Environment variables:
 *   POSTGRES_URL         — primary DSN (postgres://user:pass@host:5432/db)
 *   POSTGRES_REPLICA_URL — read-replica DSN (optional)
 *   POSTGRES_POOL_MAX    — max pool size (default: 20)
 *   POSTGRES_SSL         — 'true' to require TLS
 */

import { getLogger } from './logger';
import { dbQueryDuration } from './metrics';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const log = getLogger('database');

// ── Pool ──────────────────────────────────────────────────────────────────────

let pool: any = null;         // pg.Pool (primary)
let replicaPool: any = null;  // pg.Pool (read replica)
let pgAvailable = false;

async function initPostgres(): Promise<void> {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    log.info('POSTGRES_URL not set — database layer using Firebase/Firestore fallback');
    return;
  }

  try {
    const { Pool } = await import('pg');

    const ssl = process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: true } : undefined;
    const maxPool = parseInt(process.env.POSTGRES_POOL_MAX ?? '20', 10);

    pool = new Pool({
      connectionString: url,
      max: maxPool,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl,
    });

    pool.on('error', (err: Error) => {
      log.error('PostgreSQL pool error', { error: err.message });
    });

    // Verify connectivity
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    pgAvailable = true;
    log.info('PostgreSQL connected', { url: url.replace(/:[^:@]+@/, ':***@'), maxPool });

    // Read replica
    const replicaUrl = process.env.POSTGRES_REPLICA_URL;
    if (replicaUrl) {
      replicaPool = new Pool({ connectionString: replicaUrl, max: maxPool, ssl });
      const rc = await replicaPool.connect();
      await rc.query('SELECT 1');
      rc.release();
      log.info('PostgreSQL read replica connected');
    }

    // Run migrations
    await runMigrations();

  } catch (err: any) {
    log.warn('PostgreSQL init failed — using Firestore fallback', { error: err.message });
  }
}

// ── Migration runner ──────────────────────────────────────────────────────────

async function runMigrations(): Promise<void> {
  if (!pool) return;

  try {
    // Ensure schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum    TEXT NOT NULL
      )
    `);

    const migrationsDir = join(process.cwd(), 'migrations');
    let files: string[];
    try {
      files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
    } catch {
      log.debug('No migrations directory found — skipping migration runner');
      return;
    }

    for (const file of files) {
      const version = file.replace('.sql', '');

      // Check if already applied
      const { rows } = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1', [version]
      );
      if (rows.length > 0) {
        log.debug(`Migration already applied: ${version}`);
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf-8');
      const { createHash } = await import('crypto');
      const checksum = createHash('sha256').update(sql).digest('hex');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, checksum]
        );
        await client.query('COMMIT');
        log.info(`Applied migration: ${version}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${version} failed: ${err.message}`);
      } finally {
        client.release();
      }
    }

    log.info('All migrations complete');
  } catch (err: any) {
    log.error('Migration runner error', { error: err.message });
    throw err;
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export type QueryResult<T = any> = { rows: T[]; rowCount: number };

export const db = {
  /**
   * Execute a query on the primary pool.
   * Returns an empty result if PostgreSQL is not configured.
   */
  async query<T = any>(
    sql: string,
    params: any[] = [],
    opts: { replica?: boolean; label?: string } = {}
  ): Promise<QueryResult<T>> {
    if (!pgAvailable) return { rows: [], rowCount: 0 };

    const target = (opts.replica && replicaPool) ? replicaPool : pool;
    const table  = sql.match(/(?:FROM|INTO|UPDATE)\s+["']?(\w+)/i)?.[1] ?? 'unknown';
    const op     = sql.trimStart().split(' ')[0].toLowerCase();
    const end    = dbQueryDuration.startTimer({ operation: op, table, db: 'postgres' });

    try {
      const result = await target.query(sql, params);
      end();
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    } catch (err: any) {
      end();
      log.error('Database query error', { sql: sql.slice(0, 100), error: err.message, label: opts.label });
      throw err;
    }
  },

  /** Execute within a transaction. Rolls back automatically on error. */
  async transaction<T>(fn: (query: typeof db.query) => Promise<T>): Promise<T | null> {
    if (!pgAvailable) return null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(async (sql, params) => {
        const r = await client.query(sql, params);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      });
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      await client.query('ROLLBACK');
      log.error('Transaction rolled back', { error: err.message });
      throw err;
    } finally {
      client.release();
    }
  },

  /** Insert a row and return the inserted record. */
  async insertOne<T = any>(table: string, record: Record<string, any>): Promise<T | null> {
    const keys   = Object.keys(record);
    const values = Object.values(record);
    const cols   = keys.map(k => `"${k}"`).join(', ');
    const phs    = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query<T>(
      `INSERT INTO "${table}" (${cols}) VALUES (${phs}) RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  },

  /** Upsert a row (INSERT … ON CONFLICT DO UPDATE). */
  async upsert<T = any>(
    table: string,
    record: Record<string, any>,
    conflictColumns: string[]
  ): Promise<T | null> {
    const keys   = Object.keys(record);
    const values = Object.values(record);
    const cols   = keys.map(k => `"${k}"`).join(', ');
    const phs    = keys.map((_, i) => `$${i + 1}`).join(', ');
    const update = keys
      .filter(k => !conflictColumns.includes(k))
      .map(k => `"${k}" = EXCLUDED."${k}"`)
      .join(', ');
    const conflict = conflictColumns.map(c => `"${c}"`).join(', ');
    const result = await db.query<T>(
      `INSERT INTO "${table}" (${cols}) VALUES (${phs})
       ON CONFLICT (${conflict}) DO UPDATE SET ${update}
       RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  },

  isAvailable(): boolean { return pgAvailable; },

  health(): { status: 'ok' | 'degraded'; backend: 'postgres' | 'firestore' | 'local-json' } {
    return {
      status: pgAvailable ? 'ok' : 'degraded',
      backend: pgAvailable ? 'postgres' : (process.env.FIREBASE_PROJECT_ID ? 'firestore' : 'local-json'),
    };
  },

  async close(): Promise<void> {
    if (pool) await pool.end();
    if (replicaPool) await replicaPool.end();
  },
};

// Initialise on module load (non-blocking)
initPostgres().catch(() => {});
