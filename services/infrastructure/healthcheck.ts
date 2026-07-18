/**
 * Enterprise Health Check Service
 *
 * Provides three health endpoints (Kubernetes-compatible):
 *
 *   GET /health/live    — liveness:  is the process alive? (never blocks I/O)
 *   GET /health/ready   — readiness: can the process serve traffic?
 *   GET /health/status  — full deep status (authenticated, operators only)
 *
 * Also used by Docker HEALTHCHECK and load-balancer probes.
 */

import type { Request, Response } from 'express';
import { getLogger } from './logger';
import { cacheService } from './cache';
import { messageBusService } from './messagebus';
import { storageService } from './storage';
import { db } from './database';

const log = getLogger('healthcheck');

// ── Health check registry ─────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  detail?: Record<string, unknown>;
  error?: string;
}

export interface HealthReport {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  components: Record<string, ComponentHealth>;
}

type HealthChecker = () => Promise<ComponentHealth>;
const checkers = new Map<string, HealthChecker>();

/** Register a component health checker. */
export function registerHealthChecker(name: string, fn: HealthChecker): void {
  checkers.set(name, fn);
}

// ── Built-in checkers ─────────────────────────────────────────────────────────

registerHealthChecker('cache', async () => {
  const h = cacheService.health();
  return { status: h.status, detail: { layer: h.layer, size: h.size } };
});

registerHealthChecker('messagebus', async () => {
  const h = messageBusService.health();
  return { status: h.status, detail: { mode: h.mode } };
});

registerHealthChecker('storage', async () => {
  const h = storageService.health();
  return { status: h.status, detail: { backend: h.backend } };
});

registerHealthChecker('database', async () => {
  const h = db.health();
  return { status: h.status, detail: { backend: h.backend } };
});

registerHealthChecker('process', async () => {
  const mem = process.memoryUsage();
  const heapUsedMb  = Math.round(mem.heapUsed  / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMemMb    = Math.round(mem.rss       / 1024 / 1024);
  const heapPct     = Math.round(heapUsedMb / heapTotalMb * 100);

  return {
    status: heapPct > 95 ? 'down' : heapPct > 85 ? 'degraded' : 'ok',
    detail: {
      heapUsedMb,
      heapTotalMb,
      rssMemMb,
      heapPct,
      pid: process.pid,
      nodeVersion: process.version,
    },
  };
});

// ── Deep health report ────────────────────────────────────────────────────────

const startTime = Date.now();

async function buildHealthReport(): Promise<HealthReport> {
  const results = await Promise.all(
    Array.from(checkers.entries()).map(async ([name, fn]) => {
      const start = Date.now();
      try {
        const result = await fn();
        return [name, { ...result, latencyMs: Date.now() - start }] as const;
      } catch (err: any) {
        return [name, { status: 'down' as HealthStatus, error: err.message, latencyMs: Date.now() - start }] as const;
      }
    })
  );

  const components: Record<string, ComponentHealth> = Object.fromEntries(results);

  const hasDown     = results.some(([, c]) => c.status === 'down');
  const hasDegraded = results.some(([, c]) => c.status === 'degraded');

  return {
    status: hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok',
    version: process.env.npm_package_version ?? '3.0.4',
    uptime: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    components,
  };
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

/**
 * GET /health/live
 * Liveness probe: returns 200 if the process is running.
 * Never checks external dependencies.
 */
export function livenessHandler(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}

/**
 * GET /health/ready
 * Readiness probe: returns 200 if all critical dependencies are reachable.
 * Returns 503 if any critical component is down.
 */
export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const mem = process.memoryUsage();
  const heapPct = Math.round(mem.heapUsed / mem.heapTotal * 100);

  const status = heapPct > 95 ? 'down' : 'ok';
  const httpStatus = status === 'ok' ? 200 : 503;

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
  });
}

/**
 * GET /health/status
 * Deep health report: includes all component statuses and latencies.
 * Suitable for health dashboards and alerting.
 */
export async function statusHandler(_req: Request, res: Response): Promise<void> {
  try {
    const report = await buildHealthReport();
    const httpStatus = report.status === 'down' ? 503 : 200;
    res.status(httpStatus).json(report);
  } catch (err: any) {
    log.error('Health status check failed', { error: err.message });
    res.status(503).json({
      status: 'down',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
}

export { buildHealthReport };
