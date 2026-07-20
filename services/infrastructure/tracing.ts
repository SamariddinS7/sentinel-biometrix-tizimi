// @ts-nocheck
/**
 * OpenTelemetry Tracing Setup — Sentinel VMS
 *
 * Must be imported BEFORE any other application code in server.ts.
 * Exports a `setupTracing()` function that must be called at startup.
 */

import fs from 'fs';
import path from 'path';

const _pkgPath = path.resolve(process.cwd(), 'package.json');
let _version = '3.0.4';
try {
  const _pkg = JSON.parse(fs.readFileSync(_pkgPath, 'utf-8')) as { version: string };
  _version = _pkg.version;
} catch {}

let sdk: any = null;

export function setupTracing(): void {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const isDevConsole = process.env.NODE_ENV === 'development' && process.env.OTEL_CONSOLE_TRACES === '1';

  if (!otlpEndpoint && !isDevConsole) {
    console.info('[tracing] No OTEL_EXPORTER_OTLP_ENDPOINT set — traces disabled');
    return;
  }

  try {
    // Dynamically load OTEL dependencies to prevent startup crash if they are not installed
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { resourceFromAttributes } = require('@opentelemetry/resources');
    const {
      SEMRESATTRS_SERVICE_NAME,
      SEMRESATTRS_SERVICE_VERSION,
      SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
    } = require('@opentelemetry/semantic-conventions');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { BatchSpanProcessor, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
    const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
    const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');

    const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sentinel-vms';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION ?? _version;
    const environment = process.env.OTEL_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';

    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    });

    let spanProcessor: any;
    if (otlpEndpoint) {
      const exporter = new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` });
      spanProcessor = new BatchSpanProcessor(exporter, {
        maxQueueSize: 1000,
        scheduledDelayMillis: 5000,
        maxExportBatchSize: 200,
      });
      console.info(`[tracing] OTLP exporter → ${otlpEndpoint}`);
    } else {
      spanProcessor = new BatchSpanProcessor(new ConsoleSpanExporter());
      console.info('[tracing] Console exporter (dev)');
    }

    sdk = new NodeSDK({
      resource,
      spanProcessor,
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req: any) => {
            const url = req.url ?? '';
            return (
              url === '/health/live' ||
              url === '/health/ready' ||
              url === '/metrics'
            );
          },
          requestHook: (span: any, req: any) => {
            const reqId = req.headers?.['x-request-id'];
            if (reqId) span.setAttribute('http.request_id', reqId);
          },
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({ enhancedDatabaseReporting: false }),
        new RedisInstrumentation(),
      ],
    });

    sdk.start();
    console.info(`[tracing] SDK started — service=${serviceName} v${serviceVersion} env=${environment}`);

    process.on('SIGTERM', async () => {
      try {
        await sdk?.shutdown();
        console.info('[tracing] SDK shut down cleanly');
      } catch (err) {
        console.error('[tracing] SDK shutdown error', err);
      }
    });
  } catch (err: any) {
    console.warn(`[tracing] OpenTelemetry initialization failed or packages not installed: ${err.message}. Tracing is disabled.`);
  }
}

export function getVmsMeter() {
  try {
    const { metrics } = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
    return metrics.getMeter('sentinel-vms', _version);
  } catch {
    // Return no-op stub metrics meter
    return {
      getMeter: () => ({}),
      createCounter: (name: string, opts: any) => ({
        add: () => {},
      }),
      createUpDownCounter: (name: string, opts: any) => ({
        add: () => {},
      }),
      createValueRecorder: (name: string, opts: any) => ({
        record: () => {},
      }),
      createHistogram: (name: string, opts: any) => ({
        record: () => {},
      }),
      createObservableCounter: () => {},
      createObservableGauge: () => {},
      createObservableUpDownCounter: () => {},
    };
  }
}
