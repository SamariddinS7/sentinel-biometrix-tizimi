# Enterprise Analytics & Safety Intelligence Platform
## Architecture Design Document — Pending Approval

---

## 1. AI Model Evaluation & Selection

The guiding principle: **maximize reuse of `yolov8n.onnx` already in production, add new models only where the task genuinely requires domain-specific training data.**

### 1.1 Model Comparison Table

| Analytics Domain | Candidates Evaluated | Selected | Rationale |
|---|---|---|---|
| **Vehicle Detection / Classification** | YOLOv8n (COCO), YOLOv8m, RT-DETR | **YOLOv8n (existing)** | Already loaded. COCO-80 includes car, truck, bus, motorcycle, bicycle. Zero new model. |
| **License Plate Detection** | OpenALPR (C++, GPL), YOLOv8n-plate, PaddleOCR | **YOLOv8n (LP weights) + Tesseract.js** | LP detector reuses ONNX runtime. Tesseract.js (Apache 2.0) handles character recognition in Node.js natively — no Python bridge. |
| **OCR (General)** | Tesseract.js, PaddleOCR-ONNX, TrOCR | **Tesseract.js v4 (LSTM)** | Production-stable, Apache 2.0, runs synchronously in Node.js, no ONNX overhead for text-region tasks. |
| **Fire / Smoke Detection** | FireNet, YOLOv8n-fire, existing HazardDetectorPlugin | **Enhanced HazardDetectorPlugin + optional ONNX swap** | HazardDetectorPlugin already uses real spectral analysis. Architecture is model-swappable via plugin interface. |
| **Explosion / Spark / Flood** | Rule-based fusion, YOLOv8n-hazard | **HazardDetectorPlugin extensions (visual cues only)** | Explosion = rapid luminance flash; spark = high-saturation point clusters; flood = low-region color homogeneity. All real signal processing. |
| **PPE Detection** | YOLOv8n-PPE (keremberke, Apache 2.0), custom-trained | **YOLOv8n-PPE ONNX** | 8 PPE classes: helmet, no-helmet, safety-vest, no-vest, gloves, no-gloves, safety-glasses, mask. Fits existing `onnxruntime-node`. PpeDetectorPlugin already scaffolded. |
| **Crowd / Occupancy / People Counting** | CSRNet, MCNN, YOLOv8n-person | **YOLOv8n person class (existing)** | Person detections from the existing pipeline are counted, spatially binned, and time-averaged. No new model. |
| **Behavior Analysis** (Loitering, Intrusion, Line Crossing, Wrong Direction, Zone) | ByteTrack trajectories + geometry, DeepSORT | **ByteTrack output + spatial geometry engine** | 100% computation on existing tracking output. The `backend/area_map` zone engine and `backend/security` already define zone policies. |
| **Abandoned / Removed Object** | Background subtraction + YOLOv8n, MOG2+YOLO | **Frame-differencing + YOLOv8n (existing)** | Compare object detections across N frames; stationary detections flagged as abandoned; disappeared detections flagged as removed. |
| **Heatmap** | Kernel density estimation, grid accumulation | **Weighted grid accumulation** | Track positions from ByteTrack → 2D grid → Gaussian smoothing. Pure math, no model. |
| **Queue Detection** | Skeleton-based, YOLOv8n-pose, density+direction | **Person density + velocity clustering** | Queue = high-density cluster with low mean velocity. Derived from existing tracking vectors. |

**Gas Leak / Chemical Spill**: Marked as `SENSOR_INTEGRATION_READY` — not implemented for RGB cameras. Receives external sensor alerts via the existing `receiveSensorAlert` interface.

---

## 2. Analytics Engine Architecture

### 2.1 Directory Structure

```
services/analytics/                         ← NEW top-level module
  AnalyticsPlatform.ts                      — Core engine; owns plugin registry
  AnalyticsPluginRegistry.ts               — Runtime install / remove / upgrade
  AnalyticsEventBus.ts                     — Typed event emitter (wraps vmsEventService)
  AnalyticsAlarmBroker.ts                  — Maps analytics events → SecurityAlerts
  AnalyticsEvidenceManager.ts             — Auto-generates evidence on critical events
  AnalyticsReportEngine.ts               — Scheduled daily/weekly/monthly reports
  AnalyticsSearchIndex.ts               — In-memory + Firestore search index
  types/
    AnalyticsEvent.ts                    — AnalyticsEvent<T> base type
    AnalyticsPlugin.ts                   — IAnalyticsPlugin interface
    AnalyticsResult.ts                   — DynamicAnalyticsPayload union type
  plugins/
    VehicleAnalyticsPlugin.ts            — Detection + classification + counting + LPR
    OcrPlugin.ts                         — General OCR on configured ROIs
    FireSafetyPlugin.ts                  — Fire, smoke, explosion, spark, flood, water
    PpeCompliancePlugin.ts               — Helmet, vest, gloves, glasses, shoes, mask
    CrowdAnalyticsPlugin.ts              — Density, occupancy, queue, people counting
    BehaviorPlugin.ts                    — Loitering, intrusion, line crossing, zone, direction
    ObjectStatePlugin.ts                 — Abandoned object, removed object
    HeatmapPlugin.ts                     — Spatial heatmap accumulation
```

### 2.2 Core Engine Contract

The `AnalyticsPlatform` is independent of all AI models:

```typescript
interface IAnalyticsPlugin {
  readonly id: string;           // 'analytics.vehicle', 'analytics.ppe', etc.
  readonly version: string;
  readonly metadata: PluginMetadata;

  initialize(config: PluginConfig): Promise<void>;
  processFrame(frame: VideoFrame, context: AnalyticsContext): Promise<AnalyticsResult[]>;
  onTrackUpdate(track: ActiveTrack): Promise<AnalyticsResult[]>;   // for behavior plugins
  healthCheck(): Promise<PluginHealth>;
  dispose(): Promise<void>;
}
```

`AnalyticsContext` carries the pipeline output (detections, tracks, camera config, zone map) so plugins never re-run inference already done upstream.

### 2.3 Frame Flow

```
[Camera Layer]
     ↓
[Frame Queue / FrameScheduler]
     ↓
[InferencePipeline] ← existing (person detection, tracking, ReID, face)
     ↓ emits: VideoFrame + TrackedObjects + ActiveTracks
[AnalyticsPlatform.processFrame()]   ← NEW parallel stage
     ├── VehicleAnalyticsPlugin
     ├── OcrPlugin
     ├── FireSafetyPlugin
     ├── PpeCompliancePlugin
     ├── CrowdAnalyticsPlugin
     ├── BehaviorPlugin (consumes ActiveTracks)
     ├── ObjectStatePlugin
     └── HeatmapPlugin
     ↓
[AnalyticsEventBus] → vmsEventService
     ↓
[AnalyticsAlarmBroker] → SecurityAlert (Firestore)
[AnalyticsEvidenceManager] → evidence collection (Firestore)
[AnalyticsSearchIndex] → search index update
```

Plugins run **concurrently** (`Promise.all`) within each frame cycle. Priority frames (fire, intrusion) are promoted by `FrameScheduler` exactly as today.

---

## 3. Plugin Interface & Event Design

### 3.1 Typed Analytics Events

Every event extends a single base:

```typescript
interface AnalyticsEvent<TData = unknown> {
  id: string;                  // UUID
  type: AnalyticsEventType;    // enum below
  timestamp: string;           // ISO 8601
  cameraId: string;
  cameraName: string;
  location: string;            // zone / floor label
  confidence: number;          // 0–1, from real inference
  modelVersion: string;        // plugin.id + plugin.version
  evidenceRef?: string;        // links to evidence collection
  boundingBoxes: BoundingBox[];
  trackId?: string;
  data: TData;                 // plugin-specific payload
}
```

### 3.2 New AnalyticsEventType Enum

Extends existing `VmsAiEventType` without modifying it (separate enum, re-exported as union):

```typescript
enum AnalyticsEventType {
  // Vehicle
  VEHICLE_DETECTED = 'VEHICLE_DETECTED',
  VEHICLE_ENTERED  = 'VEHICLE_ENTERED',
  VEHICLE_EXITED   = 'VEHICLE_EXITED',
  PLATE_RECOGNIZED = 'PLATE_RECOGNIZED',
  OCR_COMPLETED    = 'OCR_COMPLETED',
  // Fire & Safety
  FIRE_DETECTED           = 'FIRE_DETECTED',
  SMOKE_DETECTED          = 'SMOKE_DETECTED',
  EXPLOSION_DETECTED      = 'EXPLOSION_DETECTED',
  SPARK_DETECTED          = 'SPARK_DETECTED',
  FLOOD_DETECTED          = 'FLOOD_DETECTED',
  WATER_LEAK_DETECTED     = 'WATER_LEAK_DETECTED',
  // PPE
  PPE_VIOLATION           = 'PPE_VIOLATION',
  HELMET_MISSING          = 'HELMET_MISSING',
  VEST_MISSING            = 'VEST_MISSING',
  MASK_MISSING            = 'MASK_MISSING',
  GLOVES_MISSING          = 'GLOVES_MISSING',
  GLASSES_MISSING         = 'GLASSES_MISSING',
  SHOES_MISSING           = 'SHOES_MISSING',
  // Crowd
  CROWD_DETECTED          = 'CROWD_DETECTED',
  OCCUPANCY_UPDATED       = 'OCCUPANCY_UPDATED',
  QUEUE_DETECTED          = 'QUEUE_DETECTED',
  PEOPLE_COUNT_UPDATED    = 'PEOPLE_COUNT_UPDATED',
  // Behavior
  LOITERING_DETECTED         = 'LOITERING_DETECTED',
  INTRUSION_DETECTED         = 'INTRUSION_DETECTED',
  LINE_CROSSED               = 'LINE_CROSSED',
  ZONE_VIOLATION             = 'ZONE_VIOLATION',
  WRONG_DIRECTION_DETECTED   = 'WRONG_DIRECTION_DETECTED',
  HAZARD_ZONE_VIOLATION      = 'HAZARD_ZONE_VIOLATION',
  // Object state
  ABANDONED_OBJECT_DETECTED  = 'ABANDONED_OBJECT_DETECTED',
  REMOVED_OBJECT_DETECTED    = 'REMOVED_OBJECT_DETECTED',
  // Meta
  ANALYTICS_COMPLETED        = 'ANALYTICS_COMPLETED',
  // Sensor-only (no RGB camera inference)
  GAS_LEAK_SENSOR_ALERT      = 'GAS_LEAK_SENSOR_ALERT',
  CHEMICAL_SPILL_SENSOR_ALERT = 'CHEMICAL_SPILL_SENSOR_ALERT',
}
```

---

## 4. Alarm Center Integration

`AnalyticsAlarmBroker` maps event types to alarm severity:

| Event Type | Severity |
|---|---|
| `FIRE_DETECTED`, `EXPLOSION_DETECTED` | **Critical** |
| `SMOKE_DETECTED`, `INTRUSION_DETECTED`, `GAS_LEAK_SENSOR_ALERT` | **High** |
| `PPE_VIOLATION`, `HAZARD_ZONE_VIOLATION`, `ABANDONED_OBJECT_DETECTED`, `LOITERING_DETECTED` | **Medium** |
| `CROWD_DETECTED`, `QUEUE_DETECTED`, `WRONG_DIRECTION_DETECTED`, `REMOVED_OBJECT_DETECTED` | **Low** |

Existing `SecurityAlert` lifecycle (assign → escalate → resolve → history) is reused unchanged.

---

## 5. Evidence Manager

On every event with severity Medium or higher:

1. Capture JPEG snapshot of the frame (with bounding boxes rendered)
2. Store to Firestore `evidence` collection with:
   - `eventId`, `eventType`, `cameraId`, `timestamp`
   - `snapshotBase64` (or Storage URL)
   - `boundingBoxes`, `confidence`, `modelVersion`, `trackId`, `location`
3. Set `evidenceRef` on the parent `AnalyticsEvent`

---

## 6. Firestore Collections (New)

```
analytics_events/          ← all typed events (indexed by cameraId, type, timestamp)
vehicle_records/           ← vehicle detections + LPR text
ocr_results/               ← extracted text + region-of-interest
fire_events/               ← fire/smoke/explosion/spark/flood per camera
ppe_events/                ← PPE violations per person track
crowd_statistics/          ← occupancy time series per camera (1-min buckets)
heatmaps/                  ← spatial density grids per camera (hourly snapshots)
analytics_reports/         ← generated report documents (daily/weekly/monthly)
evidence/                  ← auto-generated evidence items (snapshot + metadata)
```

---

## 7. API Routes

All routes under `/api/analytics/` — authenticated (JWT), RBAC-gated (ADMIN / OPERATOR):

```
GET  /api/analytics/events              — list events (filter: type, camera, from, to)
GET  /api/analytics/events/:id          — single event + evidence
GET  /api/analytics/statistics          — aggregated counts by type/camera/period
GET  /api/analytics/heatmap/:cameraId   — latest heatmap grid
GET  /api/analytics/vehicles            — vehicle records (filter: plate, type, camera)
GET  /api/analytics/ocr                 — OCR results (filter: camera, text query)
GET  /api/analytics/fire                — fire/hazard events
GET  /api/analytics/ppe                 — PPE violations (filter: type, zone, camera)
GET  /api/analytics/crowd               — crowd/occupancy stats
GET  /api/analytics/reports/:type       — type: daily | weekly | monthly
POST /api/analytics/reports/generate    — trigger manual report generation
GET  /api/evidence                      — evidence list
GET  /api/evidence/:id                  — single evidence item
GET  /api/analytics/search              — unified search (plate, text, vehicle, fire, incident)
GET  /api/analytics/plugins             — list registered plugins + health
POST /api/analytics/plugins/:id/enable  — enable plugin (ADMIN)
POST /api/analytics/plugins/:id/disable — disable plugin (ADMIN)
```

---

## 8. Testing Strategy

### Unit Tests (`tests/analytics/`)
- Plugin `processFrame()` with real JPEG fixtures → verify correct event type and confidence range
- `AnalyticsAlarmBroker` severity mapping
- `AnalyticsEvidenceManager` evidence structure
- `AnalyticsReportEngine` aggregation math

### Integration Tests
- Full pipeline: frame → plugin → event → Firestore → alarm
- API authentication and RBAC enforcement on all new routes
- Plugin install / remove / upgrade at runtime

### Performance Tests
- 50 concurrent frame submissions → measure p95 latency
- Memory stability over 1000 frames (no leak)
- Worker pool saturation test

### Regression Tests
- Verify existing `InferencePipeline` stages unaffected after `AnalyticsPlatform` is added
- Existing alarm center still receives HazardDetectorPlugin events

---

## 9. What Stays Unchanged

- `InferencePipeline` — not modified; `AnalyticsPlatform` runs as a post-stage listener
- `HazardDetectorPlugin` — kept; `FireSafetyPlugin` is a new analytics plugin, not a replacement
- `PpeDetectorPlugin` — `PpeCompliancePlugin` supersedes it; old plugin disabled once new one is verified
- `AlarmBroker` in `securityService.ts` — kept for biometric/hazard events; analytics alarms are routed through new `AnalyticsAlarmBroker` which writes to the same `SecurityAlert` collection
- All existing API routes — no modification

---

## Implementation Plan (after approval)

**Phase 1**: Core platform + types + event bus + registry (`AnalyticsPlatform`, `IAnalyticsPlugin`, `AnalyticsEvent`, `AnalyticsEventType`)  
**Phase 2**: Behavior plugins (no new model: `BehaviorPlugin`, `ObjectStatePlugin`, `HeatmapPlugin`, `CrowdAnalyticsPlugin`)  
**Phase 3**: Vision plugins (`FireSafetyPlugin`, `PpeCompliancePlugin`, `VehicleAnalyticsPlugin`, `OcrPlugin`)  
**Phase 4**: `AnalyticsAlarmBroker`, `AnalyticsEvidenceManager`  
**Phase 5**: API routes in `server.ts`  
**Phase 6**: `AnalyticsReportEngine` + `AnalyticsSearchIndex`  
**Phase 7**: Frontend — Analytics Dashboard UI component  
**Phase 8**: Tests  

---

*Awaiting architecture approval before implementation begins.*
