/**
 * OpenTelemetry Tracing Setup — Sentinel VMS
 *
 * Must be imported BEFORE any other application code in server.ts.
 * Exports a `setupTracing()` function that must be called at startup.
 *
 * Environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — OTLP gRPC/HTTP endpoint (default: off)
 *   OTEL_SERVICE_NAME            — Service name (default: sentinel-vms)
 *   OTEL_SERVICE_VERSION         — Version tag (default: package.json version)
 *   OTEL_ENVIRONMENT             — Deployment environment tag
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, ConsoleSpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';

// ── Package version (read synchronously at import time) ──────────────────────
import fs from 'fs';
import path from 'path';
const _pkgPath = path.resolve(process.cwd(), 'package.json');
const _pkg = JSON.parse(fs.readFileSync(_pkgPath, 'utf-8')) as { version: string };

let sdk: NodeSDK | null = null;

export function setupTracing(): void {
  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sentinel-vms';
  const serviceVersion = process.env.OTEL_SERVICE_VERSION ?? _pkg.version;
  const environment = process.env.OTEL_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  // Choose span processor based on environment
  let spanProcessor: SpanProcessor;
  if (otlpEndpoint) {
    const exporter = new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` });
    spanProcessor = new BatchSpanProcessor(exporter, {
      maxQueueSize: 1000,
      scheduledDelayMillis: 5000,
      maxExportBatchSize: 200,
    });
    console.info(`[tracing] OTLP exporter → ${otlpEndpoint}`);
  } else if (process.env.NODE_ENV === 'development' && process.env.OTEL_CONSOLE_TRACES === '1') {
    spanProcessor = new BatchSpanProcessor(new ConsoleSpanExporter());
    console.info('[tracing] Console exporter (dev)');
  } else {
    console.info('[tracing] No OTEL_EXPORTER_OTLP_ENDPOINT set — traces disabled');
    return;
  }

  sdk = new NodeSDK({
    resource,
    spanProcessor,
    instrumentations: [
      new HttpInstrumentation({
        // Suppress internal health-check and metrics endpoints from traces
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return (
            url === '/health/live' ||
            url === '/health/ready' ||
            url === '/metrics'
          );
        },
        requestHook: (span, req) => {
          // Attach request ID to spans when present
          const reqId = (req as { headers?: Record<string, string> }).headers?.['x-request-id'];
          if (reqId) span.setAttribute('http.request_id', reqId);
        },
      }),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }), // false = skip query params (PII risk)
      new RedisInstrumentation(),
    ],
  });

  sdk.start();
  console.info(`[tracing] SDK started — service=${serviceName} v${serviceVersion} env=${environment}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    try {
      await sdk?.shutdown();
      console.info('[tracing] SDK shut down cleanly');
    } catch (err) {
      console.error('[tracing] SDK shutdown error', err);
    }
  });
}

/**
 * Obtain the global meter for custom VMS metrics.
 * Returns a no-op meter if the SDK is not initialised.
 */
export function getVmsMeter() {
  // Import lazily to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { metrics } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
  return metrics.getMeter('sentinel-vms', _pkg.version);
}
