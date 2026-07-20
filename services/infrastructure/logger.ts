/**
 * Enterprise Structured Logger
 * 
 * Wraps Winston with JSON structured output, request-correlation IDs,
 * log-level routing and environment-aware transport configuration.
 * 
 * Gracefully falls back to a pure-TS console-based structured logger
 * if Winston is not installed.
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// ── Correlation context ──────────────────────────────────────────────────────

interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  module?: string;
}

const contextStorage = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

export function setContext(ctx: Partial<LogContext>): void {
  const current = contextStorage.getStore();
  if (current) Object.assign(current, ctx);
}

let logger: any;

try {
  const winston = require('winston');
  const injectContext = winston.format((info: any) => {
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

  const baseFormat = winston.format.combine(
    injectContext(),
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
  );

  const productionFormat = winston.format.combine(baseFormat, winston.format.json());

  const developmentFormat = winston.format.combine(
    baseFormat,
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, requestId, ...rest }: any) => {
      const svc  = service  ? `[${service}]`    : '';
      const rid  = requestId ? ` rid=${requestId}` : '';
      const meta = Object.keys(rest).length
        ? '\n' + JSON.stringify(rest, null, 2)
        : '';
      return `${timestamp} ${level} ${svc}${rid}: ${message}${meta}`;
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

  logger = winston.createLogger({
    level: logLevel,
    defaultMeta: {
      service: 'sentinel-vms',
      version: '3.0.4',
      env: process.env.NODE_ENV ?? 'development',
    },
    format: isProd ? productionFormat : developmentFormat,
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
    exitOnError: false,
  });

} catch (e) {
  // Graceful fallback to pure-TS lightweight structured logger
  const isProd = process.env.NODE_ENV === 'production';
  const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevelNum = levels[process.env.LOG_LEVEL ?? 'debug'] ?? 0;

  const makeFallbackLogger = (defaultMeta: any = { service: 'sentinel-vms' }) => {
    const logFn = (level: string) => {
      const levelNum = levels[level] ?? 1;
      return (message: any, ...meta: any[]) => {
        if (levelNum < currentLevelNum) return;
        const ctx = contextStorage.getStore() || {};
        const timestamp = new Date().toISOString();
        const mergedMeta = { ...defaultMeta, ...ctx, ...(meta[0] || {}) };
        
        if (isProd) {
          console.log(JSON.stringify({ timestamp, level, message, ...mergedMeta }));
        } else {
          const svc = mergedMeta.service ? `[${mergedMeta.service}]` : '';
          const rid = mergedMeta.requestId ? ` rid=${mergedMeta.requestId}` : '';
          const rest = { ...mergedMeta };
          delete rest.service;
          delete rest.requestId;
          const metaStr = Object.keys(rest).length ? '\n' + JSON.stringify(rest, null, 2) : '' ;
          console.log(`${timestamp} [${level.toUpperCase()}] ${svc}${rid}: ${message}${metaStr}`);
        }
      };
    };

    return {
      debug: logFn('debug'),
      info: logFn('info'),
      warn: logFn('warn'),
      error: logFn('error'),
      child: (extraMeta: any) => makeFallbackLogger({ ...defaultMeta, ...extraMeta }),
    };
  };

  logger = makeFallbackLogger();
  console.info('[logger] Winston package not installed. Gracefully fell back to pure-TS structured console logger.');
}

export function getLogger(module: string) {
  return logger.child({ module });
}

export { logger };

// ── Express request-logging middleware ────────────────────────────────────────

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
