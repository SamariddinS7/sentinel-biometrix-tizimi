/**
 * Sentinel VMS — Structured Logger
 *
 * Provides uniform log formatting across server and services.
 * In production (NODE_ENV=production) debug/info messages are suppressed.
 * Always logs WARN and ERROR regardless of environment.
 *
 * Usage:
 *   import { logger } from './logger';
 *   logger.info('[Auth]', 'User logged in', { userId });
 *   logger.warn('[WS]', 'Reconnecting…');
 *   logger.error('[DB]', 'Write failed', err);
 */

const isProd = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, module: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const meta_str = meta !== undefined
    ? ' ' + (typeof meta === 'string' ? meta : JSON.stringify(meta))
    : '';
  return `[${ts}] [${level.toUpperCase()}] ${module} ${message}${meta_str}`;
}

export const logger = {
  debug(module: string, message: string, meta?: unknown): void {
    if (!isProd) {
      console.debug(formatMessage('debug', module, message, meta));
    }
  },
  info(module: string, message: string, meta?: unknown): void {
    if (!isProd) {
      console.info(formatMessage('info', module, message, meta));
    }
  },
  warn(module: string, message: string, meta?: unknown): void {
    console.warn(formatMessage('warn', module, message, meta));
  },
  error(module: string, message: string, meta?: unknown): void {
    console.error(formatMessage('error', module, message, meta));
  },
};
