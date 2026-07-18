/**
 * Enterprise Prometheus Metrics
 *
 * Exposes a /metrics endpoint (text/plain Prometheus format).
 * Tracks: HTTP latencies, AI inference, camera connections,
 * WebSocket sessions, alarm/incident counts, process resources.
 *
 * Compatible with Prometheus + Grafana out of the box.
 */

import client from 'prom-client';
import type { Request, Response } from 'express';

// ── Registry ──────────────────────────────────────────────────────────────────

const register = new client.Registry();

// Collect default Node.js metrics (event loop lag, GC, memory, fd count)
client.collectDefaultMetrics({
  register,
  prefix: 'vms_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ── HTTP metrics ──────────────────────────────────────────────────────────────

export const httpRequestDuration = new client.Histogram({
  name: 'vms_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'vms_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestSizeBytes = new client.Histogram({
  name: 'vms_http_request_size_bytes',
  help: 'Size of HTTP request bodies',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// ── AI / Inference metrics ────────────────────────────────────────────────────

export const aiInferenceDuration = new client.Histogram({
  name: 'vms_ai_inference_duration_seconds',
  help: 'Duration of AI inference calls',
  labelNames: ['model', 'plugin', 'device'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

export const aiDetectionsTotal = new client.Counter({
  name: 'vms_ai_detections_total',
  help: 'Total number of AI detections by type',
  labelNames: ['event_type', 'severity', 'camera_id'],
  registers: [register],
});

export const aiModelsLoaded = new client.Gauge({
  name: 'vms_ai_models_loaded',
  help: 'Number of AI models currently loaded',
  labelNames: ['device'],
  registers: [register],
});

export const aiQueueDepth = new client.Gauge({
  name: 'vms_ai_queue_depth',
  help: 'Current depth of the AI inference queue',
  labelNames: ['worker'],
  registers: [register],
});

// ── Camera metrics ────────────────────────────────────────────────────────────

export const cameraConnectionsActive = new client.Gauge({
  name: 'vms_camera_connections_active',
  help: 'Number of currently connected cameras',
  registers: [register],
});

export const cameraFramesProcessed = new client.Counter({
  name: 'vms_camera_frames_processed_total',
  help: 'Total camera frames processed by the pipeline',
  labelNames: ['camera_id', 'status'],
  registers: [register],
});

export const cameraFrameRate = new client.Gauge({
  name: 'vms_camera_frame_rate_fps',
  help: 'Current frame processing rate in FPS',
  labelNames: ['camera_id'],
  registers: [register],
});

export const cameraStreamLatency = new client.Histogram({
  name: 'vms_camera_stream_latency_seconds',
  help: 'Camera stream processing latency',
  labelNames: ['camera_id'],
  buckets: [0.01, 0.033, 0.05, 0.1, 0.2, 0.5, 1],
  registers: [register],
});

// ── Security / Operations metrics ─────────────────────────────────────────────

export const activeAlarmsGauge = new client.Gauge({
  name: 'vms_security_alarms_active',
  help: 'Number of active security alarms',
  labelNames: ['severity', 'type'],
  registers: [register],
});

export const incidentsOpenGauge = new client.Gauge({
  name: 'vms_security_incidents_open',
  help: 'Number of open security incidents',
  labelNames: ['priority', 'category'],
  registers: [register],
});

export const evidenceStoredGauge = new client.Gauge({
  name: 'vms_evidence_items_stored',
  help: 'Total number of evidence items stored',
  registers: [register],
});

// ── Identity / Person intelligence metrics ────────────────────────────────────

export const identitiesTrackedGauge = new client.Gauge({
  name: 'vms_identities_tracked',
  help: 'Number of persistent identities tracked',
  registers: [register],
});

export const faceRecognitionsTotal = new client.Counter({
  name: 'vms_face_recognitions_total',
  help: 'Total face recognition events',
  labelNames: ['result'],
  registers: [register],
});

// ── WebSocket / Streaming metrics ─────────────────────────────────────────────

export const wsConnectionsActive = new client.Gauge({
  name: 'vms_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const wsMessagesTotal = new client.Counter({
  name: 'vms_websocket_messages_total',
  help: 'Total WebSocket messages sent/received',
  labelNames: ['direction', 'type'],
  registers: [register],
});

// ── Infrastructure metrics ────────────────────────────────────────────────────

export const cacheHitsTotal = new client.Counter({
  name: 'vms_cache_hits_total',
  help: 'Total cache operations',
  labelNames: ['result', 'layer'],
  registers: [register],
});

export const dbQueryDuration = new client.Histogram({
  name: 'vms_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table', 'db'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const messageBusPublished = new client.Counter({
  name: 'vms_messagebus_published_total',
  help: 'Total events published to the message bus',
  labelNames: ['subject', 'stream'],
  registers: [register],
});

export const storageOperationsTotal = new client.Counter({
  name: 'vms_storage_operations_total',
  help: 'Total object storage operations',
  labelNames: ['operation', 'bucket', 'result'],
  registers: [register],
});

// ── Metrics HTTP handler ──────────────────────────────────────────────────────

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export { register };
