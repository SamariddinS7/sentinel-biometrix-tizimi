# Sentinel AI VMS — Enterprise Architecture

**Version:** 3.0.4-Enterprise  
**Classification:** Internal — Infrastructure Architecture

---

## 1. System Overview

Sentinel AI VMS is an enterprise-grade, AI-powered Video Management System providing real-time biometric intelligence, multi-camera surveillance, incident management, and security operations capabilities.

The system is designed for:
- **Scale:** 10,000+ cameras, millions of events/day, millions of persistent identities
- **Availability:** 99.9%+ uptime with zero-downtime deployments
- **Security:** Zero-trust, mTLS everywhere, RBAC, encryption at rest and in transit
- **Resilience:** Multi-zone, active-passive failover, automatic recovery

---

## 2. Architecture Decisions

### 2.1 Message Bus: NATS JetStream

**Decision:** NATS JetStream over Apache Kafka or RabbitMQ.

**Rationale:**
- Single 8 MB binary — trivial to operate at the edge
- JetStream provides persistent streams, at-least-once delivery, and DLQ
- Ideal for IoT/camera event volumes (millions of small messages/second)
- Kubernetes NATS Operator available; 3-node HA cluster in under 5 minutes
- Simpler operational model than Kafka for hybrid/edge deployments
- Native subject routing replaces exchange/topic overhead

**Streams:**
| Stream | Subjects | Retention |
|--------|----------|-----------|
| VMS_EVENTS | `vms.events.>` | 7 days |
| VMS_ALARMS | `vms.alarms.>` | 30 days |
| VMS_AUDIT | `vms.audit.>` | 365 days |
| VMS_TELEMETRY | `vms.telemetry.>` | 24 hours |
| VMS_DLQ | `vms.dlq.>` | 7 days |

### 2.2 Database: PostgreSQL + TimescaleDB + pgvector

**Primary:** PostgreSQL 16 with TimescaleDB and pgvector extensions.

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Relational | PostgreSQL 16 | Users, cameras, incidents, alarms, evidence |
| Time-series | TimescaleDB hypertables | VMS events, telemetry, tracking data |
| Vector | pgvector | Face embeddings (dim=512), appearance embeddings (dim=128) |
| Migration | SQL migration files | Versioned sequential migrations |

**Replication:** Streaming replication with 1 hot-standby read replica.  
**Backup:** Daily pg_dump to MinIO, point-in-time recovery via WAL archiving.

### 2.3 Cache: Redis 7

**Architecture:** Redis Sentinel (3 nodes) for high availability in production.  
**Fallback:** In-process LRU cache (10,000 entries) when Redis is unavailable.

| Use Case | TTL | Key Pattern |
|----------|-----|-------------|
| API response cache | 30s | `api:route:params` |
| Inference result cache | 5s | `ai:frame:<hash>` |
| Session tokens | 24h | `session:<token>` |
| Rate limiting counters | 60s | `ratelimit:<ip>` |
| Identity lookup cache | 5m | `identity:<id>` |

### 2.4 Object Storage: MinIO (S3-Compatible)

Self-hosted MinIO for on-premise deployments; AWS S3 / Azure Blob for cloud.

| Bucket | Purpose | Retention |
|--------|---------|-----------|
| `vms-evidence` | Digital evidence (immutable, versioned) | Indefinite |
| `vms-recordings` | Video recordings | 90 days |
| `vms-thumbnails` | Frame snapshots | 30 days |
| `vms-reports` | Generated reports | 365 days |
| `vms-models` | AI model weights | Indefinite |
| `vms-backups` | Database backups | 90 days |

### 2.5 Observability Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Structured Logs | Winston (JSON) | Stdout → log aggregator (Loki/ELK) |
| Metrics | Prometheus + prom-client | 30+ custom VMS metrics |
| Dashboards | Grafana | Business + infrastructure dashboards |
| Tracing | OpenTelemetry | Distributed request tracing |
| Alerting | Prometheus Alertmanager | PagerDuty/Slack/email alerts |

---

## 3. Deployment Topology

### 3.1 Single-Site (Development / Small Deployment)

```
┌──────────────────────────────────┐
│  Docker Compose Stack            │
│                                  │
│  nginx:443 ──► app:5000 (×1)     │
│               PostgreSQL:5432    │
│               Redis:6379         │
│               NATS:4222          │
│               MinIO:9000         │
│               Prometheus:9091    │
│               Grafana:3001       │
└──────────────────────────────────┘
```

### 3.2 Production (Multi-Zone Kubernetes)

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  Cloud Load Balancer (L4/L7)            │
└────────────────────┬────────────────────┘
                     │  HTTPS/WSS :443
                     ▼
┌─────────────────────────────────────────┐
│  nginx Ingress Controller               │
│  (TLS termination, rate limiting)       │
└────────────────────┬────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ app pod │ │ app pod │ │ app pod │  ← HPA: 3-20 replicas
    │  :5000  │ │  :5000  │ │  :5000  │
    └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │
    ┌────┴───────────┴───────────┴────┐
    │      Internal Services          │
    │                                 │
    │  PostgreSQL (primary+replica)   │
    │  Redis Sentinel (3 nodes)       │
    │  NATS JetStream (3 nodes)       │
    │  MinIO (object storage)         │
    │  Prometheus + Grafana           │
    └─────────────────────────────────┘
```

### 3.3 Multi-Site / Hybrid

Each site runs an independent stack. Cross-site event replication is handled via NATS cluster routes. Evidence is replicated to a central MinIO instance with cross-replication configured.

---

## 4. Security Architecture

### 4.1 Network Security

- **TLS everywhere:** nginx terminates TLS; internal service-to-service uses mTLS (planned: service mesh)
- **Network policies:** Kubernetes NetworkPolicy restricts ingress to nginx only; egress only to internal services + HTTPS for external APIs
- **Port exposure:** Only 80/443 exposed externally. All metrics, admin, and internal ports are cluster-internal only

### 4.2 Application Security

- **Authentication:** JWT (RS256 in production, HS256 in development)
- **Authorization:** RBAC with roles: ADMIN, SUPERVISOR, OPERATOR, VIEWER
- **Rate limiting:** Per-IP limits at nginx (connection/request) and Express (per route)
- **Secrets management:** Kubernetes Secrets → Sealed Secrets → External Secrets Operator (for Vault/AWS SSM)
- **Security headers:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options (via nginx + helmet)
- **Audit log:** Every auth event, configuration change, and evidence access is logged

### 4.3 Data Security

- **Encryption at rest:** PostgreSQL tablespace encryption (LUKS at host level); MinIO server-side encryption
- **Encryption in transit:** TLS 1.2/1.3 for all external traffic; Redis TLS for HA deployments
- **Evidence immutability:** `vms-evidence` bucket has Object Lock enabled; evidence records are sealed in DB once uploaded
- **Key rotation:** JWT secrets rotatable without downtime via dual-validation grace period

---

## 5. Plugin Platform

Plugins are registered via the `AnalyticsPlugin` interface and loaded by the `AnalyticsPluginManager`. Each plugin:

- Declares its capabilities, supported event types, and required model weights
- Is sandboxed to its own error boundary (plugin crash does not affect other plugins)
- Supports versioned deployment (multiple versions can coexist)
- Can be hot-loaded/unloaded (where the plugin contract supports it)

Current production plugins:
1. `analytics.fire_safety` — Fire & smoke detection (spectral analysis)
2. `analytics.ppe` — PPE compliance (helmet, mask, vest)
3. `analytics.vehicle` — Vehicle detection, classification, LPR
4. `analytics.ocr` — Scene OCR (Tesseract.js)
5. `analytics.behavior` — Loitering, intrusion, line crossing, direction
6. `analytics.object_state` — Abandoned/removed object detection
7. `analytics.crowd` — Crowd density, occupancy counting, queues
8. `analytics.heatmap` — Spatial activity heatmap

---

## 6. AI Inference Pipeline

```
Camera Frame
     │
     ▼
FrameScheduler (priority queue, GPU budget tracking)
     │
     ▼
InferencePipeline
  ├─ YOLOv8n (person detection, ONNX, CPU/GPU)
  ├─ ByteTrack + Kalman (multi-object tracking)
  ├─ FaceNet / ArcFace (face embedding, dim=512)
  ├─ AppearanceEngine (HSV colour features, dim=128)
  └─ AnalyticsPlugins (fire, PPE, vehicle, OCR, ...)
     │
     ▼
VmsEventBroker (in-process) → NATS JetStream (production)
     │
     ├─ PersonIntelligencePlatform (identity fusion, FAISS)
     ├─ AnalyticsAlarmBroker (alarm generation)
     ├─ SOCCommandCenter (real-time UI updates)
     └─ AuditLog (every significant detection)
```

**GPU Support:** ONNX Runtime with CUDA/TensorRT execution providers. CPU fallback is always available. GPU scheduling is managed by the FrameScheduler to prevent resource contention.

---

## 7. Scalability Design

| Bottleneck | Mitigation |
|-----------|-----------|
| CPU inference | GPU offload, horizontal pod scaling, inference caching (Redis) |
| Database writes | TimescaleDB hypertables with compression, async batch writes |
| Database reads | Read replica for analytics queries, Redis response caching |
| WebSocket connections | Sticky sessions (nginx/k8s), Redis pub/sub for cross-pod events |
| Object storage | MinIO distributed mode, S3 multipart uploads |
| Event processing | NATS JetStream consumers with per-partition workers |
| Face search | pgvector IVFFlat index (approximate kNN), FAISS in-process for hot path |
