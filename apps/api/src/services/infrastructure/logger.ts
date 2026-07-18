/**
 * Enterprise Structured Logger
 * 
 * Wraps Winston with JSON structured output, request-correlation IDs,
 * log-level routing and environment-aware transport configuration.
 * 
 * Production: JSON to stdout (parsed by log aggregators like Loki/ELK).
 * Development: Colourised pretty-print to console.
 */

import { createLogger, format, transports, Logger } from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// ── Correlation context ──────────────────────────────────────────────────────

interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
}

const contextStorage = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

export function setContext(ctx: Partial<LogContext>): void {
  const current = contextStorage.getStore();
  if (current) Object.assign(current, ctx);
}

// ── Custom format ─────────────────────────────────────────────────────────────

const injectContext = format((info) => {
  const ctx = contextStorage.getStore();
  if (ctx) {
    if (ctx.requestId) info['requestId'] = ctx.requestId;
    if (ctx.userId)    info['userId']    = ctx.userId;
    if (ctx.traceId)   info['traceId']   = ctx.traceId;
    if (ctx.spanId)    info['spanId']    = ctx.spanId;
    if (ctx.service)   info['service']   = ctx.service;
  }
  return info;
});

const baseFormat = format.combine(
  injectContext(),
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.errors({ stack: true }),
  format.splat(),
);

const productionFormat = format.combine(baseFormat, format.json());

const developmentFormat = format.combine(
  baseFormat,
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, service, requestId, ...rest }) => {
    const svc  = service  ? `[${service}]`    : '';
    const rid  = requestId ? ` rid=${requestId}` : '';
    const meta = Object.keys(rest).length
      ? '\n' + JSON.stringify(rest, null, 2)
      : '';
    return `${timestamp} ${level} ${svc}${rid}: ${message}${meta}`;
  }),
);

// ── Logger factory ────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

const logger: Logger = createLogger({
  level: logLevel,
  defaultMeta: {
    service: 'sentinel-vms',
    version: process.env.npm_package_version ?? '3.0.4',
    env: process.env.NODE_ENV ?? 'development',
  },
  format: isProd ? productionFormat : developmentFormat,
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// ── Child logger factory (per-module labels) ──────────────────────────────────

export function getLogger(module: string) {
  return logger.child({ module });
}

export { logger };

// ── Express request-logging middleware ────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  const start = Date.now();

  res.setHeader('X-Request-ID', requestId);

  runWithContext({ requestId }, () => {
    const log = logger.child({ module: 'http' });

    log.debug('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error'
                  : res.statusCode >= 400 ? 'warn'
                  : 'info';

      log[level]('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        contentLength: res.get('content-length'),
      });
    });

    next();
  });
}
