# Enterprise AI Video Management System (AI VMS) - Production Architecture Specification

This document details the high-level and granular production-grade architecture of the **Sentinel Biometrik Tizimi** AI Video Management System (VMS). This system is designed to support mission-critical enterprise environments such as airports, smart cities, military locations, banking facilities, and government campuses.

---

## 1. Directory Structure Blueprint (Clean Architecture)

The system adheres strictly to the principles of **Clean Architecture** to separate concerns and decouple domain policies from delivery mechanisms (UI, databases, frameworks).

```
/
├── VMS_ARCHITECTURE.md         # Full Architectural & Operational Specification
├── metadata.json              # Platform Capabilities and App Permissions
├── package.json               # Enterprise Dependencies and Build Pipelines
├── server.ts                  # Production API Gateway, Event Routing, and Express Middleware
├── types.ts                   # Domain-Level Interface Definitions and System Schema
├── backend/                   # Analytical Logic & Geometry Modeling Subsystems
│   ├── area_map/              # Zone Polygon & Computational Spatial Calculators
│   ├── digital_twin/          # 3D Physical Geometry & Field of View (FOV) Math
│   ├── face_recognition/      # Embedded Biometric Feature Extractors
│   └── security/              # Real-Time Spatial Policy Enforcers & Detectors
├── services/                  # Application & Infrastructure Services (Enterprise Interfaces)
│   ├── vmsEventService.ts     # Centralized Event Broker / PubSub Engine
│   ├── vmsAuditService.ts     # Highly-Durable Security & Compliance Audit Logger
│   ├── vmsStorageService.ts   # Active Storage Allocation, Quota & Rotation Manager
│   ├── vmsHealthService.ts    # Telemetry and Performance Metrics Aggregator
│   ├── vmsSystemManager.ts    # Bootstrapper, Lifecycle, and Worker Supervisor
│   ├── authService.ts         # Identity Provider & Session Controller
│   ├── cameraService.ts       # CRUD, RTSP Streams, & Diagnostic Interface
│   ├── firestoreService.ts    # Secure Cloud Persistence & Client Cache Core
│   ├── geminiService.ts       # Advanced AI Cognitive Analysis Broker
│   ├── trackerService.ts      # Multi-Object Trajectory Association Engine
│   └── userService.ts         # User Management & Enrollment Repository
├── components/                # Modular Presentation Layer
│   ├── Dashboard.tsx          # Real-time Telemetry & Cognitive Insight Cards
│   ├── CamerasView.tsx        # High-Density Grid Streamer & Diagnostics
│   ├── FaceDetectorView.tsx   # Offline-First Face Detection & Online AI Verification
│   ├── DigitalTwinView.tsx    # Interactive 3D Spatial Coverage Visualizer
│   ├── SettingsView.tsx       # System Configuration & Security Rules Portal
│   ├── AuditLogsView.tsx      # Regulatory Compliance Log Terminal
│   └── SystemHealthView.tsx   # Hardware Performance and Telemetry Panel
```

---

## 2. Granular Module Responsibilities (30 Core Modules)

Each module is designed as an independent unit with strict separation of concerns, single responsibility, and interface-driven dependency.

### 1. Authentication Service
- **Responsibility**: Authenticates corporate user sessions via secure credentials, issues cryptographically signed session signatures, and handles token rotation.
- **Location**: `/services/authService.ts`, `/api/auth/*`

### 2. User Management
- **Responsibility**: Coordinates physical card holder, employee, and student profiles, storing facial embeddings and contact coordinates.
- **Location**: `/services/userService.ts`, `/api/users/*`

### 3. Role & Permission Management (RBAC)
- **Responsibility**: Inspects user claims against granular actions (e.g., `READ_STREAMS`, `EXCLUDE_CAMERA`, `DELETE_RECORDINGS`). Prevents unauthorized privilege escalation.
- **Location**: `/services/authService.ts`, `types.ts`

### 4. Organization / Multi-Tenant Management
- **Responsibility**: Segregates assets (cameras, floorplans, personnel, and records) into distinct logical partition IDs to support safe multi-tenancy.
- **Location**: Managed inside Firestore data schemas under organizational scopes.

### 5. Camera Management
- **Responsibility**: Main registry for optical specifications, stream coordinates, RTSP protocols, FPS caps, resolutions, and optical characteristics (sensor sizes, focal lengths).
- **Location**: `/services/cameraService.ts`, `/api/cameras/*`

### 6. Camera Discovery
- **Responsibility**: Active background scanning of broadcast addresses for compatible streaming devices, polling IP addresses across configured subnets.
- **Location**: Integrated in `/api/cameras/scan` endpoint.

### 7. ONVIF Service
- **Responsibility**: Implements the standardized ONVIF specifications for remote device configuration, network setups, PTZ (Pan-Tilt-Zoom) manipulation, and configuration fetches.
- **Location**: Extensible client layer mapped through `cameraService.ts`.

### 8. RTSP Service
- **Responsibility**: Establishes, maintains, and parses raw Real-Time Streaming Protocol (RTSP) sockets over TCP/UDP transport channels.
- **Location**: `/api/cameras/:id/stream` and `/services/streamService.ts`.

### 9. HTTP Camera Integration Service
- **Responsibility**: Handles fallback ingest pipelines for standard HTTP MJPEG streams, snapshot polling sequences, and legacy non-RTSP IP cameras.
- **Location**: `/api/cameras/:id/snapshot`.

### 10. Video Streaming Service
- **Responsibility**: Serves real-time frame buffers to presentation clients via secure, high-efficiency media pipes or adaptive streaming (HLS/WebSockets) to avoid high browser overhead.
- **Location**: `/services/streamService.ts`.

### 11. Video Recording Service
- **Responsibility**: Performs scheduled, continuous, or event-driven video frame writes into standardized storage containers (H.264/MP4).
- **Location**: Managed through recording states in Express gateway.

### 12. AI Processing Service
- **Responsibility**: Asynchronous pipeline that coordinates frame extraction and queues targets for visual inference pipelines.
- **Location**: `/api/ai/*` server endpoints, `/services/geminiService.ts`.

### 13. Face Recognition Service
- **Responsibility**: Extracts and maps facial landmark metrics to mathematical vectors (128D descriptors) using face-api.js or Deep Face models.
- **Location**: `/backend/face_recognition`, `/components/FaceDetectorView.tsx`.

### 14. Object Detection Service
- **Responsibility**: Performs structural shape analysis to identify objects (e.g., weapons, vehicles, backpacks) utilizing computer vision models (e.g., DETR, MobileNet).
- **Location**: `/api/ai/detr` endpoint.

### 15. Tracking Service
- **Responsibility**: Solves temporal state associations to construct uninterrupted trajectories for moving targets across video frame sequences.
- **Location**: `/services/trackerService.ts`.

### 16. Event Engine
- **Responsibility**: Subscribes to telemetry, analytical, and system operations and propagates standardized event payloads to listeners.
- **Location**: `/services/vmsEventService.ts`.

### 17. Alert Engine
- **Responsibility**: Continually evaluates event feeds against custom security parameters (e.g., a student entering a RESTRICTED zone).
- **Location**: `/backend/security/zone_engine.py`, `/services/trackerService.ts`.

### 18. Notification Service
- **Responsibility**: Dispatches alerts to physical receivers via modern channels (Push API, Email, Webhooks, or Telegram bots).
- **Location**: `/services/notificationService.ts`.

### 19. Evidence Management
- **Responsibility**: Compiles immutable audit records, associated snapshots, and video intervals as protected evidence packages.
- **Location**: `/services/vmsStorageService.ts` (Evidence Locker).

### 20. Storage Management
- **Responsibility**: Monitors storage volumes, calculates disk health, and executes automated FIFO retention cycles when limits are breached.
- **Location**: `/services/vmsStorageService.ts`, `/api/system/storage`.

### 21. Dashboard Service
- **Responsibility**: Consolidates enterprise analytics, performance histories, daily activity counters, and server load charts.
- **Location**: `/components/Dashboard.tsx`, `/services/settingsService.ts`.

### 22. Analytics Service
- **Responsibility**: Computes geometric analytics, including spatial traffic density, heatmap frequencies, and duration statistics.
- **Location**: `/services/digitalTwinService.ts`, `/backend/digital_twin/*`.

### 23. Health Monitoring
- **Responsibility**: Captures hardware operational limits (RAM, CPU cycles, network traffic) and provides real-time health telemetry.
- **Location**: `/services/vmsHealthService.ts`.

### 24. Logging
- **Responsibility**: Captures system runtime telemetry (debugging, info level, exceptions) to trace background tasks and system state changes.
- **Location**: `/services/logService.ts`.

### 25. Audit Logging
- **Responsibility**: Records tamper-proof, regulatory-compliant audits of all actions containing user identity, IP address, timestamps, and target resources.
- **Location**: `/services/vmsAuditService.ts`.

### 26. Configuration Service
- **Responsibility**: Consolidates global, camera-specific, database, and credential variables into dynamic structures, providing clean fallbacks.
- **Location**: `/services/settingsService.ts`.

### 27. Scheduler
- **Responsibility**: Manages time-driven workflows, including database backups, scheduled system reboots, and off-hour alerts.
- **Location**: Cron triggers in system setup.

### 28. Background Workers
- **Responsibility**: Background tasks running in separate threads or sub-processes to isolate heavy I/O and processor loads (e.g., frame analyzers).
- **Location**: Implemented via async service pipelines.

### 29. API Gateway
- **Responsibility**: Unified ingress interface that secures, routes, and handles traffic limits for all backend micro-operations.
- **Location**: `server.ts`.

### 30. System Settings
- **Responsibility**: Governs performance bounds, GDPR anonymization, liveness thresholds, backup frequencies, and notification channels.
- **Location**: `/services/settingsService.ts`, `/components/SettingsView.tsx`.

---

## 3. Communication & Dependency Flow

```
                     +---------------------------------------+
                     |          Presentation Layer           |
                     |  (React Dashboard, Live Grid, WebUI)  |
                     +-------------------+-------------------+
                                         | HTTP / WS
                                         v
                     +---------------------------------------+
                     |              API Gateway              |
                     |         (server.ts Controller)        |
                     +-------------------+-------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
+--------+-----------+         +---------+-----------+         +--------+-----------+
|    Application     |         |    Infrastructure   |         |       Domain       |
|    Services        |         |    & Persistence    |         |     Definitions    |
| (vmsEventService,  |         | (firestoreService,  |         | (types.ts, System  |
|  vmsAuditService,  | <=====> |  vmsStorageService, | <=====> |  Configuration,    |
|  cameraService)    |         |  geminiService)     |         |  Geometry Math)    |
+--------------------+         +---------------------+         +--------------------+
```

- **Strict Dependency Rule**: Components and API Gateway must communicate via abstract services.
- **Event-Driven Coupling**: System services communicate asynchronously by dispatching standard payloads to the `vmsEventService` to prevent direct cross-dependencies.

---

## 4. API & Database Boundaries

### API Layer
- **Unified Contract**: All API endpoints return standardized JSON structures enclosing `{ data }`, `{ success: true }`, or `{ error: string }`.
- **Validation**: Dynamic verification of incoming body fields prevents injection attempts.
- **Filtering**: Query parameter interfaces support pagination (`?limit=50&offset=0`), sorting (`?sortBy=timestamp&order=desc`), and filtering (`?severity=CRITICAL`).

### Database Layer
- **Firestore Partitioning**: Structured collections with robust indexes ensure sub-second query execution times.
  - `/cameras`: Optical config, stream definitions, and physical position.
  - `/users`: Identification details, roles, and 128D descriptors.
  - `/logs`: Security, compliance, and operation audits.
  - `/attendance`: Spatial activity records, check-ins, and biometric verification parameters.
- **Local Fallback Storage**: Client components utilize `localStorage` cache helpers to guarantee continued read and write access during offline/disconnected events.

---

## 5. Event Flow Architecture

The `vmsEventService` utilizes an optimized Publish-Subscribe pattern. For example:
1. **Camera Frame Event**: A camera captures a frame.
2. **Detection Event**: The face-api library identifies a face and triggers the face-detector.
3. **AI Verification Event**: The face is dispatched to the Gemini API, yielding structural metadata.
4. **Audit and Alert Events**: If the identity belongs to an unauthorized group, an event is emitted:
   - **Audit Logger** intercepts the event and persists it to `/logs`.
   - **Alert Engine** generates a `SecurityAlert` payload.
   - **Notification Service** triggers webhooks and push notifications.

---

## 6. Initialization & Shutdown Flow

### Initialization Pipeline (Bootstrap)
1. **System Config Load**: The `vmsSystemManager` reads the local settings block.
2. **Database Verification**: Validates communication with the Firestore cluster.
3. **Event Broker Boot**: Starts the local PubSub listeners.
4. **Audit Engine Boot**: Establishes file/database log pipes.
5. **Worker Subsystems Init**: Boots the RTSP parsers, ONVIF scanners, and AI model engines.
6. **Telemetry Loop Start**: Activates the CPU, memory, and camera latency diagnostic threads.

### Shutdown Pipeline
1. **Inbound Traffic Block**: Safely rejects new client connections.
2. **AI Inference Flush**: Allows active frame queues to drain gracefully.
3. **Active Streams Safe-Close**: Formally closes RTSP sockets, releasing hardware sockets.
4. **Audit Log Save**: Flushes memory-held audit entries to storage.
5. **Process Exit**: Gracefully terminates threads and shuts down cleanly.

---

## 7. Key Architectural Decisions and Rationales

1. **Offline-First Face-Detection + Cloud AI Verification**:
   - *Rationale*: Guarantees high FPS and camera processing speeds locally on edge streams without relying on a persistent network connection. High-value deep identification (age, features, expressions, and liveness verification) is sent to Gemini only when requested, saving network bandwidth and cloud computing costs.
2. **Centralized Event Broker**:
   - *Rationale*: Allows easy addition of future AI and hardware modules (such as fire detectors or automated gates) without modifying existing controllers or database models.
3. **Unified CommonJS Bundle Output for Production**:
   - *Rationale*: Bypasses the strict relative import checks of Node.js ES modules, ensuring fast cold-start performance inside container runtimes (e.g., Cloud Run).

---

## 8. Modular Production-Ready Camera Layer Architecture

The VMS Camera Layer handles industrial and enterprise IP video sources, abstracting device-specific protocols, socket boundaries, and configurations into a unified, high-reliability software engine.

```
       +-------------------------------------------------------+
       |                     CameraManager                     |
       |  (Dynamic Class Instantiation & Subnet Scanner Pool)  |
       +---------------------------+---------------------------+
                                   | Instantiates
                                   v
                      +--------------------------+
                      |   BaseCameraConnector    |
                      |  (Lifecycle & State-M)   |
                      +------------+-------------+
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
         v                         v                         v
+--------+--------+       +--------+--------+       +--------+--------+
|   RtspSession   |       |   OnvifClient   |       |  Vendor Clients |
|  (Socket Pool,  |       |  (SOAP, WS-Sec, |       | (Axis, Hik,     |
| RTP Interleave) |       |  PTZ, Imaging)  |       | Dahua HTTP CGIs)|
+-----------------+       +-----------------+       +-----------------+
```

### 8.1 Extensible Protocol Abstraction Layer
The interface hierarchy is declared under `/services/camera/interfaces.ts`. It establishes the central contract `CameraProvider` and comprehensive schemas for hardware capabilities, PTZ controls, storage layouts, health indexes, and state transitions. Adding a new protocol (e.g., WebRTC, SRT, or NDI) requires zero edits to existing adapters, simply adding the type configuration.

### 8.2 Security & Credential Isolation
- **AES-256-GCM Encryption**: Password strings are never stored or logged in plain text. Credentials stored in Firestore are encrypted at rest using `crypto.createCipheriv` with dynamic IV vector mappings in `/services/camera/security.ts`.
- **WS-Security Cryptography**: The ONVIF Client generates standard SOAP authentication envelopes utilizing a cryptographically secure Base64 nonce, UTC timestamp, and SHA-1 password digests to secure administrative device configurations.

### 8.3 High-Concurrency RTSP Stream Pool
RTSP connections are pooled in interleaved TCP mode inside `/services/camera/rtsp.ts`. The implementation:
- Establishes raw socket connections to parse stream SDP details.
- Runs dynamic packet trackers on sequence counters and timestamps to calculate packet loss, latency jitter, and bandwidth consumption in real-time.
- Implements active heartbeats (`GET_PARAMETER`/`OPTIONS`) and automatic reconnect routines with controlled exponential backoff.
- Completely avoids expensive in-app video decoding, ensuring memory safety and scaling to thousands of cameras.

### 8.4 Multi-Profile ONVIF SOAP Client
The ONVIF core `/services/camera/onvif.ts` supports:
- **Device Management**: Querying firmware identifiers, MAC addresses, serials, and system dates.
- **Media Profiles**: Resolving RTSP stream routes (Profile S/T) and telemetry endpoints.
- **PTZ Continuous Motors**: Delivering immediate continuous pan/tilt/zoom and stop vectors.
- **Imaging Services**: Manipulating brightness, contrast, and physical day/night IR-cut filters.

### 8.5 Vendor API Adapters
Isolated manufacturer controllers inherit the common core inside `/services/camera/vendors/brandConnectors.ts`. Each connector provides standard snapshot and camera parameters (LED lighting, IR state) wrapping specific native CGI frameworks:
- **Axis**: VAPIX HTTP API commands for snapshots and lighting controls.
- **Hikvision**: ISAPI XML commands over HTTP PUT/GET methods.
- **Dahua**: CGI configuration commands.
- **Hanwha Vision / Bosch / Uniview / Reolink / Tapo**: SUNAPI and native vendor API routing.

### 8.6 Active Network Discovery
The manager `/services/camera/manager.ts` handles:
- **WS-Discovery**: Multicast SOAP probe triggers to discover devices on the network.
- **High-Speed Subnet Scan**: Sweeping IPv4 ranges using high-speed concurrent promise loops to probe standard ports (80, 554, 8000, 3702), auto-detecting camera vendors based on active port profiles.
- **Event Bus Integration**: Direct publishing of state changes (`CAMERA_CONNECTED`, `CAMERA_DISCONNECTED`, `RECORDING_STARTED`, `RECORDING_STOPPED`) to the central `vmsEventService`.

---

## 9. Enterprise AI Engine Architecture

The VMS AI Engine is designed for high-concurrency, real-time video analytics running across hundreds of cameras simultaneously. It enforces complete decoupling of AI model code from the video ingestion and storage systems, structuring all capabilities as hot-swappable plugins governed by a strict central runtime container.

```
+-----------------------------------------------------------------------------------------------------------------------------------------+
|                                                           Enterprise AI Engine                                                          |
+-----------------------------------------------------------------------------------------------------------------------------------------+
|                                                                                                                                         |
|   +-----------------------+      Ingest      +------------------------+      Dispatch      +------------------------+                   |
|   |   Camera RTSP Feed    | ---------------> |     FrameScheduler     | -----------------> |       FrameQueue       |                   |
|   +-----------------------+                  |  (Dynamic FPS, Skip)   |                    | (Priority Backpressure) |                  |
|                                              +------------------------+                    +-----------+------------+                   |
|                                                                                                        |                                |
|                                                                                                        v                                |
|   +-----------------------+                  +------------------------+                    +------------------------+                   |
|   |     Event Broker      | <--------------- |     PostProcessing     | <----------------- |     InferencePipeline  |                   |
|   |  (Central Event Bus)  |   Publish Event  | (Tracking/Recognition) |  Execute Plugin   | (TensorRT/ONNX/OpenVIO)|                   |
|   +-----------------------+                  +------------------------+                    +-----------+------------+                   |
|                                                                                                        ^                                |
|                                                                                                        | Binds                          |
|                                                                                    +-------------------+--------------------+           |
|                                                                                    |              ModelManager              |           |
|                                                                                    | (Plugin Loader, CUDA/CPU GPU Scheduler) |           |
|                                                                                    +----------------------------------------+           |
|                                                                                                                                         |
+-----------------------------------------------------------------------------------------------------------------------------------------+
```

### 9.1 Core System Topology
1. **FrameScheduler**: Interfaces with RTSP stream outputs to intercept raw video frames. Controls stream ingestion density by dynamically dropping or skipping frames depending on target pipeline profile (e.g., face recognition triggers high FPS, loitering analysis runs on low FPS).
2. **FrameQueue**: Thread-safe priority buffer with dropped frame protection. High-priority events (such as Fire or Intrusion) bypass the queue, while lower-priority analytic processing is throttled under heavy backpressure.
3. **ModelManager**: Orchestrates model lifecycle states (unloaded, loading, active, degraded). Allocates GPU/CUDA contexts or fallback CPU resources, monitoring physical VRAM bounds to prevent Out-Of-Memory (OOM) crashes.
4. **InferencePipeline**: Standardizes image preprocessing (scaling, normalization, color space conversion) and executes inference payloads over hardware runtime interfaces.
5. **PostProcessor**: Interprets raw floating-point tensors to generate bounding boxes, confidence ratings, and feature descriptors. Performs object tracking association and facial template matching.
6. **Event Generator**: Binds results to highly structured, immutable JSON message payloads, dispatching them to the system-wide Event Bus.

### 9.2 Unified AI Plugin System (Contract Specs)
Every analytical capability is structured as an isolated class implementing the strict `AiPlugin` interface. To preserve absolute decoupling, models do not have access to any external databases, network services, or private host environment variables.
Each plugin exposes:
- **Initialize(config)**: Boots environment parameters and registers network hooks if required.
- **Load(runtimeDevice)**: Binds the compiled model file (.engine, .onnx, .bin) to the target CUDA GPU index, TensorRT execution context, or OpenVINO execution core.
- **Infer(frame)**: Processes an ingested frame buffer to return normalized inference outputs.
- **Unload()**: Deallocates GPU execution contexts and flushes VRAM pointers.
- **HealthCheck()**: Verifies execution latency and model accuracy.
- **Metadata**: Exposes model model parameters, model version, and supported hardware layers.

### 9.3 High-Reliability Frame Lifecycle & Memory Reuse
To prevent memory fragmentation and GC pauses during high-throughput execution, the AI Engine utilizes **zero-copy memory pools**:
1. **Allocation**: Frame buffers are pre-allocated on initialization in a contiguous memory array.
2. **Queue Placement**: The `FrameScheduler` writes directly to the pre-allocated index.
3. **Preprocessing**: Frames are resized directly within GPU/CUDA buffers using hardware-accelerated bilinear filtering whenever possible.
4. **Inference Execution**: Pointers to the preprocessed GPU memory are dispatched to the model's forward propagation thread.
5. **Recycling**: Once inference is complete, the frame buffer index is marked as free, returning immediately to the scheduler pool without trigger-point deallocations.

### 9.4 Multi-Processor Inference Engine
The AI Engine implements a multi-backend bridge capable of binding native high-performance libraries directly to TypeScript safely:
- **TensorRT (CUDA)**: Used for high-throughput NVIDIA GPUs. Leveraging dynamic batching, FP16 half-precision scaling, and concurrent INT8 quantizations.
- **ONNX Runtime (GPU/CPU)**: Universal fallback layer supporting DirectML, OpenCL, and standard CPU backends.
- **OpenVINO**: Dedicated optimization pathway for Intel Xeon CPUs and integrated Iris Xe graphics.
- **Graceful Accel-to-CPU Fallback**: If a GPU device context is lost or runs out of VRAM, the `ModelManager` hot-migrates execution to optimized CPU threads (e.g., using ONNX Runtime's basic CPU Execution Provider) without dropping active camera streams.

### 9.5 Isolated Security Boundaries
AI plugins are running within a **zero-trust boundary**:
- **No Direct Database Access**: Plugins can never query Firestore or write transaction logs.
- **No Credentials Access**: Camera passwords and secret keys are completely invisible to plugins.
- **No Direct Outbound Connections**: Plugins are forbidden from creating external network connections or socket bridges.
- **Approved Communication Interface**: Plugins are exclusively allowed to yield immutable result payloads back to the orchestrating `InferencePipeline`, which formats and publishes them through the system-wide event system.

### 9.6 Complete List of Supported AI Modules
The architecture defines concrete module categories. Each category maps to an isolated model descriptor that registers with the pipeline:
- **Object/Person/Vehicle Detection**: High-performance bounding-box spatial coordinates mapping.
- **Face Detection & Recognition**: Multi-stage pipeline (MTCNN/RetinaFace -> ArcFace) extracting 512-dimension mathematical face vectors.
- **Tracking (ByteTrack/SORT)**: Temporal ID association of object coordinates across frames.
- **OCR & License Plate Recognition**: LPR text extraction from vehicle bounding boxes.
- **Crowd, Behavior & Pose Estimation**: Multi-point skeletal layout mapping for fall detection and loitering analysis.
- **Industrial Safety (PPE, Fire & Smoke)**: Critical anomaly detectors prioritizing hardware resource pools.

---

## 10. Recording and Storage Layer Architecture

The Recording and Storage Layer is a core, high-reliability subsystem designed for parallel ingestion of thousands of high-definition camera streams. It provides reliable recording mechanisms, high-performance playback capabilities, hierarchical archive lifecycles, and direct integration with third-party NVR systems (e.g., Hikvision, Dahua, Synology Surveillance Station, Blue Iris, Frigate, and Agent DVR).

```
         +-------------------------------------------------------------+
         |                       RecordingManager                      |
         |         (Stream Ingest Orchestration & State Machine)       |
         +------------------------------+------------------------------+
                                        |
         +------------------------------+------------------------------+
         |                                                             |
         v                                                             v
+--------+----------------------+                            +--------+----------------------+
|        StorageManager         |                            |          NvrManager           |
|  (Storage Abstraction Layer)  |                            |  (Vendor Connector Registry)  |
+--------+----------------------+                            +--------+----------------------+
         |                                                             |
         | Binds to                                                    | Binds to
         v                                                             v
+--------+----------------------+                            +--------+----------------------+
|       StorageProvider         |                            |          NvrProvider          |
|  (Abstraction Interface)     |                            |  (Abstraction Interface)     |
+--------+----------------------+                            +--------+----------------------+
         |                                                             |
   +-----+-----+-----+-----+                                     +-----+-----+-----+-----+
   |           |     |     |                                     |           |     |     |
   v           v     v     v                                     v           v     v     v
+--+---+ +-----+ +---+ +---+                                   +-+----+ +----+ +---+ +---+
|Local | |NAS/   |SAN| |Obj|                                   |Hik   | |Dahua| |Syn | |Fri|
|Disk  | |NFS    |iSC | |S3 |                                   |ISAPI | |CGI  | |Surv| |gate|
+------+ +-------+ +-+ +---+                                   +------+ +------+ +---+ +---+
```

### 10.1 Storage Abstraction (`StorageProvider`)

To decouple the storage medium from application-level file operations, all backend operations interact with a virtualized file interface. Every storage backend (whether local RAID arrays, NFS/SMB NAS mounts, iSCSI SAN LUNs, S3-compatible Object Storage, or Hybrid Cloud structures) must implement the unified `StorageProvider` interface:

```typescript
export interface StorageProvider {
  id: string;
  name: string;
  type: 'LOCAL' | 'NAS' | 'SAN' | 'OBJECT' | 'CLOUD' | 'HYBRID';
  mountPoint: string;

  // Connection & Lifecycle
  initialize(): Promise<void>;
  getHealth(): Promise<StorageVolumeHealth>;

  // File Operations (Segment-based)
  writeSegment(cameraId: string, timestamp: number, durationSec: number, data: Buffer, metadata: SegmentMetadata): Promise<string>;
  readSegment(segmentId: string): Promise<Buffer>;
  deleteSegment(segmentId: string): Promise<void>;

  // Query Operations
  listSegments(cameraId: string, startTime: number, endTime: number): Promise<VideoSegment[]>;
  getSegmentMetadata(segmentId: string): Promise<SegmentMetadata>;

  // Retention and Locks
  setSegmentLock(segmentId: string, isLocked: boolean): Promise<void>;
  getStorageUsage(): Promise<{ totalBytes: number; usedBytes: number; freeBytes: number }>;
}

export interface StorageVolumeHealth {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'CRITICAL';
  readSpeedBps: number;
  writeSpeedBps: number;
  latencyMs: number;
  iops: number;
  errorCount: number;
  lastChecked: string;
}

export interface VideoSegment {
  id: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  durationSec: number;
  fileSizeBytes: number;
  filePath: string;
  checksum: string;
  isLocked: boolean;
  recordingMode: string;
}

export interface SegmentMetadata {
  codec: string;
  resolution: string;
  fps: number;
  bitrate: number;
  watermarkSignature?: string;
  events?: string[]; // Embedded event tags for smart playback
}
```

### 10.2 Third-Party NVR Systems (`NvrProvider`)

For deployments utilizing pre-existing dedicated Network Video Recorder (NVR) infrastructure, the VMS integrates using NVR adapters. The system favors open standardized protocols (such as ONVIF Profile G for recording retrieval and RTSP for playback streaming) while isolating vendor-specific native API interfaces:

```typescript
export interface NvrProvider {
  id: string;
  name: string;
  type: 'HIKVISION' | 'DAHUA' | 'SYNOLOGY' | 'BLUEIRIS' | 'FRIGATE' | 'AGENT_DVR' | 'GENERIC_ONVIF';
  ipAddress: string;
  port: number;

  // Connectivity
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getHealth(): Promise<NvrHealth>;

  // Camera Management via NVR
  listCameras(): Promise<NvrCameraInfo[]>;
  getCameraStreamUrl(nvrCameraId: string, profile: 'MAIN' | 'SUB'): Promise<string>;

  // Playback Operations (Redirect to NVR Storage)
  getPlaybackStreamUrl(nvrCameraId: string, startTime: number, endTime: number): Promise<string>;
  searchRecordings(nvrCameraId: string, startTime: number, endTime: number): Promise<NvrRecordingRange[]>;

  // Edge / On-board Sync
  triggerManualRecording(nvrCameraId: string, durationSec: number): Promise<boolean>;
  getNvrCapabilities(): Promise<NvrCapabilities>;
}

export interface NvrHealth {
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  cpuUsagePct: number;
  memoryUsagePct: number;
  activeChannels: number;
  maxChannels: number;
  latencyMs: number;
}

export interface NvrCameraInfo {
  nvrCameraId: string;
  channelNumber: number;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  isRecording: boolean;
  ipAddress: string;
}

export interface NvrRecordingRange {
  startTime: number;
  endTime: number;
  durationSec: number;
  recordingType: 'CONTINUOUS' | 'EVENT' | 'MOTION' | 'ALARM' | 'MANUAL';
}

export interface NvrCapabilities {
  ptzControl: boolean;
  smartDetections: boolean;
  edgeSynchronization: boolean;
  subStreams: boolean;
  audioRecording: boolean;
}
```

### 10.3 Core Operational Workflows

#### 10.3.1 Recording Ingestion Workflow
```
+---------------+     RTSP H.264/H.265      +--------------------+
|  IP Camera    | ------------------------> |   FrameScheduler   |
+---------------+                           +---------+----------+
                                                      |
                                                      v
                                            +--------------------+
                                            |     Ring Buffer    |
                                            |   (In-Memory RAM)  |
                                            +---------+----------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
                    v                                 v                                 v
         +--------------------+            +--------------------+            +--------------------+
         |  SegmentWriter     |            |    IndexEngine     |            |   PipelineBroker   |
         | (FLV/MP4, Flush)   |            |  (Frame Indexing)  |            |  (AI Inference)    |
         +----------+---------+            +----------+---------+            +---------+----------+
                    |                                 |                                |
                    v                                 v                                v
         +--------------------+            +--------------------+            +--------------------+
         |  StorageProvider   |            |   Metadata DB      |            |   VmsEventService  |
         |   (Disk Write)     |            |  (Time/Sec Index)  |            |  (AI-Event Index)  |
         +--------------------+            +--------------------+            +--------------------+
```
1. **Stream Ingestion**: The RTSP stream is ingested as H.264 or H.265 frames, maintaining original network timestamps.
2. **In-Memory Ring Buffer**: Incoming frames are written to a volatile FIFO RAM Ring Buffer (typically 10-15 seconds of video). This buffer ensures that "Pre-Event" recordings are captured for Event/Motion triggers (saving the critical seconds *before* an alarm is fired).
3. **SegmentWriter (Segment Packaging)**: Standardizes chunk sizes. Video streams are cut into discrete, playable segments (default 5-minute chunks, configurable) to prevent massive single-file corruption and improve index seek latency.
4. **Asynchronous Parallel Write**: High-throughput file writing is performed off-thread. The system supports multi-channel parallel writing, bypassing synchronous Node bottlenecks.
5. **Metadata Tagging**: Simultaneously, the segment index is written to the database, capturing start-time, end-time, frame-count, resolution, and active AI markers (e.g., license plates detected during this interval).

#### 10.3.2 Timeline & Smart Playback Workflow
1. **Index Search**: When an operator selects a camera and a specific time range, the system queries the Metadata Database for intersecting `VideoSegment` ranges.
2. **Buffered Playback Stream**:
   - For native Web interfaces, the server stitches the segments on-the-fly or delivers a progressive MP4/HLS playlist directly from the mapped `StorageProvider`.
   - If playback is requested from an NVR, the system requests the RTSP playback route or native API token from the `NvrProvider`, routing the stream to the client interface.
3. **Smart Playback Engine**:
   - Operators can skip static video. The server queries AI event databases (faces, vehicles, line crossings) intersecting the timeline.
   - During playback, the player skips forward in "Fast Forward" mode (e.g., 16x) until it approaches a metadata marker (AI detection or alarm), dropping playback speed instantly to 1x to let the operator inspect the scene, then accelerating again when the event ends.
4. **Frame-by-Frame Decoders**: Utilizes client-side WASM H.264/H.265 demuxers to support precise single-frame step-back and step-forward seeking.

#### 10.3.3 Tiered Archive and Retention Workflow
```
[ High-Performance SSDs ] ---> Retention Policy (e.g. 15 Days) ---> Trigger Archive Engine
                                                                            |
                                                                            +---> Calculate Cryptographic Checksum
                                                                            +---> Apply HMAC Digital Watermark
                                                                            |
                                                                            v
[   NFS / SMB NAS Storage  ] <----------------------------------------------+
                                                                            |
                                                                   Retention Policy Expired
                                                                            |
                                                                            +---> If Lock (Legal Hold) = True -> Keep Immutable
                                                                            +---> If Lock (Legal Hold) = False -> Secure Purge
```
1. **Tiered Storage Routing**:
   - **Tier 1 (Hot Storage - NVMe SSDs)**: Raw recordings are written directly to Tier 1 storage for ultra-low latency, multi-channel concurrency, and high-frequency writes.
   - **Tier 2 (Warm Storage - NAS/SAN HDDs)**: Background schedules move segments older than $N$ days (e.g., 14 days) to large SATA-disk arrays, freeing up SSD space.
   - **Tier 3 (Cold Storage - S3 Cloud Object Storage)**: Critically marked archives or historical records are compressed and piped to immutable cloud objects with standard deep-glacier retention rules.
2. **Integrity Preservation**:
   - Prior to migration, the Archive Engine computes a cryptographic SHA-256 hash of the video segment.
   - It appends a secure **Digital Watermark** (embedding the camera ID, UTC timestamps, and recording parameters using an HMAC signature with an internal secure key) to guarantee court-admissible evidence integrity.
3. **FIFO Automated Cleanup**:
   - The retention scheduler runs continuously, calculating volume fullness and segment age against configurable retention policies (e.g., 30-day corporate limits).
   - Segments matching expiration criteria are physically purged from disks.
   - **Evidence Lock / Legal Hold Protection**: Segments marked as locked or currently associated with an active Investigation/Evidence case **strictly bypass** all automated rotation rules. They can never be deleted automatically, regardless of storage capacity or age.

### 10.4 Key Architectural Decisions & Rationales

1. **Protocol and Vendor Isolation through Interfaces**:
   - *Decision*: Separate protocol connectors (`RTSP`, `ONVIF`) and NVR manufacturer adapters (`HikvisionISAPI`, `DahuaCGI`, etc.) into highly isolated classes bound by strict interfaces.
   - *Rationale*: Prevents vendor-specific API breaking changes from affecting core recording or playback state. Ensures the codebase remains clean, testable, and highly extensible without rewriting client application loops.

2. **Decoupled Virtualized Storage Engines**:
   - *Decision*: Expose file reads, writes, and segment listings through a generalized `StorageProvider` interface rather than calling native Node `fs` methods directly.
   - *Rationale*: Allows seamless migration from local storage to cloud environments or high-capacity SAN structures in production without changing a single line of business logic inside the video manager.

3. **In-Memory Ring Buffers for Pre-Event Captures**:
   - *Decision*: Maintain volatile in-memory circular RAM buffers on live ingestion feeds.
   - *Rationale*: Traditional continuous storage on hundreds of HDDs causes intense write wear and excessive power draw. By recording to local RAM loops and only writing to disk when motion or AI detections occur, we save TBs of storage and extend HDD lifespans, while retaining crucial pre-event context.

4. **Digital Watermarking & Cryptographic Auditing**:
   - *Decision*: Embed dynamic metadata within video frames and sign every file with SHA-256 integrity checkers coupled with standard compliance entries in the immutable VMS Audit log.
   - *Rationale*: Guarantees chain of custody and video authenticity, ensuring the VMS fulfills regulatory enterprise standards for legal proof, banking, and physical safety evidence.

---

## 11. Enterprise Security Architecture

This section documents the complete, multi-layered security architecture designed for high-assurance enterprise deployments of the Sentinel AI Video Management System (VMS). This architecture is engineered to protect critical physical assets and high-sensitivity biometric/video data in regulated environments such as airports, financial institutions, and government facilities.

```
+---------------------------------------------------------------------------------------------------------+
|                                           Edge & API Gateway                                            |
|  - TLS 1.3 / mTLS Enforcement        - OWASP Core Rule Set WAF       - Rate Limiting / DDoS Shield       |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                                    Access Control & Identity Layer                                      |
|  - JWT Access/Refresh Rotation     - Federated OAuth2 / OIDC       - Granular RBAC Policy Evaluator     |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                                       Core Application Services                                         |
|  - Hardware Security Module (HSM)  - AES-256 Envelope Encryption   - Immutable Audit Ledger             |
+---------------------------------------------------------------------------------------------------------+
```

---

### 11.1 Authentication Architecture

The Sentinel authentication engine enforces unified identity verification across all clients (Web Dashboards, Video Walls, Mobile Clients, and API Integrators). It is anchored on **JSON Web Tokens (JWT)** with automatic token rotation, federated **OAuth2/OpenID Connect (OIDC)**, and future-proof **Multi-Factor Authentication (MFA)** structures.

#### 11.1.1 Session and Device Lifecycle
To prevent session hijacking and control concurrent usage, user sessions are managed actively on the server. Every successful authentication establishes an active `AuthSession` tracked in an in-memory session store (backed by Redis or firestore cluster for distributed setups).

```typescript
export interface AuthSession {
  id: string;
  userId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isMfaVerified: boolean;
  isCurrent: boolean;
}

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  organizationId: string;
  departmentId?: string;
  mfaEnabled: boolean;
  lastPasswordChange: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'EXPIRED';
}
```

#### 11.1.2 Multi-Factor Authentication (MFA)
MFA is enforced for privileged roles (Administrators, Supervisors, Investigators).
- **Primary Factors**: Standard JWT login (email/password or SSO federation).
- **Secondary Factors**: Time-Based One-Time Password (TOTP) via RFC 6238, or hardware security keys (FIDO2/WebAuthn).
- **MFA Enforcement Flow**: If a user's policy requires MFA, the initial login returns a short-lived "MFA Challenge Token" with limited scope (only authorized to invoke the `/api/v1/auth/mfa/verify` endpoint). The final secure session token is only issued upon successful validation of the secondary factor.

---

### 11.2 Authorization Architecture & Granular RBAC Model

Sentinel utilizes a hybrid authorization model combining **Role-Based Access Control (RBAC)** for operational roles with **Attribute-Based Access Control (ABAC)** and **Hierarchical Scopes** for resource-level confinement.

#### 11.2.1 Unified Role-Based Access Control (RBAC)
Role definitions contain granular, explicit permission assignments. The system strictly prohibits generic wildcard overrides except for root administrative roles.

```typescript
export enum SystemPermission {
  // Camera Permissions
  CAMERA_VIEW = 'camera:view',
  CAMERA_CREATE = 'camera:create',
  CAMERA_UPDATE = 'camera:update',
  CAMERA_DELETE = 'camera:delete',
  CAMERA_PTZ = 'camera:ptz',
  
  // Storage & Recording Playback
  RECORDING_PLAYBACK = 'recording:playback',
  RECORDING_DOWNLOAD = 'recording:download',
  
  // AI & Analytics
  AI_MANAGE_RULES = 'ai:manage_rules',
  AI_VIEW_ANALYTICS = 'ai:view_analytics',
  
  // Evidence & Investigation
  EVIDENCE_EXPORT = 'evidence:export',
  EVIDENCE_LOCK = 'evidence:lock',
  EVIDENCE_VIEW = 'evidence:view',
  
  // User & Role Administration
  USER_MANAGE = 'user:manage',
  ROLE_MANAGE = 'role:manage',
  
  // System Auditing
  AUDIT_READ = 'audit:read',
  SYSTEM_CONFIG = 'system:config'
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: SystemPermission[];
  scope: 'SYSTEM' | 'ORGANIZATION' | 'DEPARTMENT';
  isCustom: boolean;
}
```

#### 11.2.2 Hierarchical Resource Boundary (Multi-Tenancy)
Permissions are bounded by an organization structure. A user assigned a `Department` role can only operate on resources mapped to that department or child groups.

```
       +---------------------------------------------+
       |             Root Organization               |
       |  (Global policies, root tenant settings)   |
       +----------------------+----------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+-------------+-------------+   +-------------+-------------+
|          Site A           |   |          Site B           |
|  (Local cameras, NVRs)    |   |  (Local cameras, NVRs)    |
+-------------+-------------+   +---------------------------+
              |
      +-------+-------+
      |               |
      v               v
+-----+-----+   +-----+-----+
|  Floor 1  |   |  Floor 2  |
+-----------+   +-----------+
```

To validate resource access, the system evaluates policies against a **Resource ARN (Amazon Resource Name) equivalent structure**:
`arn:sentinel:org_id:site_id:building_id:camera_group:camera_id`

```typescript
export interface AuthorizationPolicy {
  id: string;
  roleId: string;
  effect: 'ALLOW' | 'DENY';
  permissions: SystemPermission[];
  resourcePattern: string; // Wildcard patterns supported, e.g., "arn:sentinel:org-123:site-a:*"
}
```

---

### 11.3 JWT Lifecycle & OAuth2 Integration

To guarantee that compromised access tokens have a highly compressed window of viability, Sentinel deploys an aggressive token-rotation lifecycle.

#### 11.3.1 Token Dynamics and Storage
1. **Access Token (JWT)**:
   - **Lifetime**: 15 minutes.
   - **Properties**: Cryptographically signed using RSA-256 (`RS256`), containing claims for standard token fields (sub, exp, iss), organization context, active roles, and scoped permissions.
   - **Client Storage**: In-memory (React State) only. **Strictly forbidden** from being written to local storage or insecure session cookies to prevent Cross-Site Scripting (XSS) extraction.
2. **Refresh Token**:
   - **Lifetime**: 7 days.
   - **Properties**: Secure random UUID stored in the database with hashed representation, bound to a specific user and device fingerprint.
   - **Client Storage**: Transmitted via HTTP-Only, Secure, SameSite=Strict cookies. This isolates the refresh mechanism completely from browser-accessible scripts, neutralizing XSS.

#### 11.3.2 Rotation and Revocation Flow
```
Client (JS Memory)                       API Gateway (Reverse Proxy)               Auth Service / Database
        |                                             |                                       |
        |--- 1. API Request (Bearer JWT Expired) ---->|                                       |
        |<-- 2. 401 Unauthorized Response ------------|                                       |
        |                                             |                                       |
        |--- 3. POST /api/v1/auth/refresh ------------>|                                       |
        |      (HTTP-Only Refresh Cookie)             |--- 4. Verify Cookie & Fingerprint --->|
        |                                             |                                       |
        |                                             |    [ Rotate and Invalidate Old ]      |
        |                                             |<-- 5. Issue New Access & Refresh -----|
        |<-- 6. Returns New Access Token -------------|                                       |
```
- **Reuse Detection**: If an expired or already-used refresh token is presented to the refresh endpoint, the Auth Service flags a potential breach. It immediately revokes **all** active refresh tokens issued to that user/device family, forcing full authentication on all devices.
- **Revocation**: Admins can instantly revoke active sessions via `/api/v1/auth/sessions/revoke/:id`, which adds the session token's unique ID (`jti`) to a Redis cluster-backed distributed blacklist until its natural expiration.

#### 11.3.3 OpenID Connect & OAuth2 Federation
Enterprise directories (such as Active Directory Federation Services, Azure AD, Okta, and Google Workspace) integrate natively:
- **Identity Provider Integration**: Configured via OIDC metadata endpoints.
- **Dynamic Provisioning (Just-In-Time)**: Upon successful authentication against an IDP, users are automatically created in Sentinel with default organization assignments mapping to configured SAML/OIDC groups.

---

### 11.4 API Security Layer & Gateway Controls

Sentinel guards its REST and real-time (WebSockets/RTSP) endpoints via a robust gateway architecture implementing industry-standard protection vectors.

#### 11.4.1 Gateway Defense Matrix
1. **Rate Limiting (Token Bucket Algorithm)**:
   - Standard Users: 100 requests per minute.
   - Stream Ingestion/Metadata APIs: Distinctly optimized high-throughput limits.
   - Authentication Endpoints: 10 requests per minute per IP address, with exponential backoff on consecutive failures to neutralize brute-force attacks.
2. **OWASP Top 10 Protections**:
   - **SQL and NoSQL Injection**: Prevented via Drizzle ORM parameterized queries and strict Firestore type casting.
   - **XML External Entity (XXE)**: Standard parsers are configured to completely disable external entity resolution.
   - **Cross-Site Request Forgery (CSRF)**: Prevented via double-submit cookie validation for mutating state requests.
3. **Secure Header Enforcement**:
   ```http
   Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none';
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   Referrer-Policy: no-referrer
   ```

---

### 11.5 Cryptographic Architecture & Envelope Encryption

To ensure total separation of duties and prevent database administrators or infrastructure compromisers from accessing sensitive system records or camera passwords, Sentinel deploys an advanced **Envelope Encryption** architecture.

```
                  +-----------------------------------+
                  |      Hardware Security Module     |
                  |     - KMS / HSM (Cloud or On-Prem)|
                  |     - Stores Master Key (MK)      |
                  +-----------------+-----------------+
                                    | Encrypt / Decrypt with MK
                                    v
                  +-----------------+-----------------+
                  |      Data Encryption Key (DEK)    |
                  |     - Ephemeral / Rotated Daily   |
                  +-----------------+-----------------+
                                    | Symmetric AES-GCM Encryption
                                    v
+-----------------------------------+-----------------------------------+
|                         Encrypted Target Data                         |
|     - Camera Passwords     - Face Embeddings     - Audit Records      |
+-----------------------------------------------------------------------+
```

#### 11.5.1 Symmetric Data Encryption
- **Algorithm**: AES-256 in **Galois/Counter Mode (GCM)** (`AES-256-GCM`). AES-GCM guarantees both data confidentiality and authenticity (integrity checking via an authentication tag).
- **Initialization Vector (IV)**: A unique, cryptographically secure random 12-byte IV is generated for every single encrypt operation. **IVs are never reused under the same key.**
- **Associated Data (AAD)**: Optional context-binding (e.g., binding organization ID as AAD to the camera credential) is used to prevent ciphertext swapping between tenants.

#### 11.5.2 Key Management Service (KMS) & Key Rotation
1. **Master Key (MK)**: Stored securely in a dedicated Key Management Service (Google Cloud KMS, HashiCorp Vault, or on-premises physical HSMs). It never leaves the HSM boundary.
2. **Data Encryption Key (DEK)**:
   - Generated dynamically on the application server.
   - Encrypted by the KMS using the Master Key to form the **Wrapped DEK**.
   - The database stores the wrapped DEK alongside the ciphertext encrypted with the raw ephemeral DEK.
3. **Rotation Schedule**: Data Keys are rotated automatically every 90 days. Backwards compatibility is maintained by keeping historical wrapped DEKs active for legacy records.

---

### 11.6 Secrets Management & Safe Configurations

Sentinel strictly forbids storing secrets, connection strings, private certificates, or API keys in git-versioned codebases.

#### 11.6.1 Production Secrets Ingestion
- **Local Development**: Managed via `.env` file (listed in `.gitignore`) and documented in `.env.example`.
- **Production Kubernetes / VM Environments**: Ingested directly from cloud secret repositories (e.g., GCP Secret Manager, AWS Secrets Manager) using secure IAM service accounts.
- **Bootstrap Phase**: The server bootstraps by resolving keys at startup. If any critical environment variable is missing or fails integrity validation, the server terminates immediately with a clear logging exit code (e.g., `Exit 1: CRITICAL_SECRET_MISSING`), avoiding running in an insecure degraded state.

---

### 11.7 Immutable Audit Logging Architecture

Compliance standards (such as SOC 2, ISO 27001, and GDPR) mandate that security operations and data-access records must remain complete, unaltered, and protected from deletion by administrative users.

#### 11.7.1 Immutable Ledger Model
- **Log Append-Only Principle**: Once written to the system database, audit records cannot be edited or deleted by any system user, including root administrators.
- **Cryptographic Chaining (Hash Chain)**: Every log entry includes a SHA-256 hash of the previous log entry, forming an immutable cryptographic audit ledger:
  $$H_n = \text{SHA-256}(ID_n \parallel Timestamp_n \parallel Action_n \parallel Actor_n \parallel H_{n-1})$$
- **Verification Scheduler**: A cron task runs every 24 hours, traversing the ledger to verify the hash chain integrity. Any tampering (e.g., missing records or modified payloads) triggers a critical, non-silenceable **System Tampering Alarm**.

```typescript
export interface SecureAuditLog {
  id: string;
  timestamp: string;
  action: string;
  module: string;
  actorEmail: string;
  ipAddress: string;
  details: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  previousEntryHash: string;
  currentEntryHash: string;
}
```

---

### 11.8 Certificate Management & Transport Layer Security (TLS)

Sentinel strictly enforces HTTPS for all client traffic and secure transport layers for all device interfaces.

#### 11.8.1 Transport Specifications
- **Client Web/Mobile Interfaces**: HTTPS and Secure WebSockets (`WSS`) are mandatory.
- **Allowed Protocols**: TLS 1.3 is preferred. TLS 1.2 is the absolute minimum allowed fallback. All older, insecure protocols (SSL v3, TLS 1.0, TLS 1.1) and broken cipher suites (e.g., 3DES, RC4) are blocked at the load balancer.
- **mTLS (Mutual TLS) for Device Connections**: Edge bridges, IP Cameras, and NVRs connecting over WAN authenticate using client certificates validated against Sentinel's private Root Certificate Authority (CA), protecting the stream from Man-in-the-Middle (MITM) hijacking.

#### 11.8.2 Automation & Certificate Rotation
- Public-facing domains use Automated Certificate Management Environment (ACME) via Let's Encrypt for automatic 90-day renewal.
- Internal PKI certificate lifecycles are monitored automatically, generating warnings 30, 14, and 7 days prior to any system certificate expiration.

---

### 11.9 Security Event Response Workflow

Security-sensitive events (failed authentications, permission bypass attempts, storage hardware faults, or encryption failures) are fed directly into a localized state-processing pipeline to trigger protective lockouts and notify security operations teams instantly.

```
                           +--------------------------+
                           |   System Security Event  |
                           |   (e.g. CSRF Tamper/Fail)|
                           +------------+-------------+
                                        |
                                        v
                           +--------------------------+
                           |  SecurityEventPipeline   |
                           +------------+-------------+
                                        |
                                        | Processes Context & IP
                                        v
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
                    v                                 v                                 v
         +--------------------+            +--------------------+            +--------------------+
         |   Audit Logger     |            |  IP/Account Engine |            |   Alarm Service    |
         | (Immutable Ledger) |            |  (Apply Lockout)   |            | (Push Notifications) |
         +--------------------+            +--------------------+            +--------------------+
```

#### 11.9.1 Adaptive Account and IP Lockouts
- **Threshold Limit**: Five consecutive failed login attempts on a single user account triggers an **Account Lockout** for 30 minutes.
- **IP Brute-Force Shield**: Over 20 failed login attempts from a single IP address within 5 minutes results in a temporary firewall block at the gateway level, blocking all requests from that source before they hit application compute resources.

---

### 11.10 Key Architectural Decisions & Rationales

1. **RSA-256 (`RS256`) over Symmetric HS256 for JWT Signing**:
   - *Decision*: Sign access tokens using asymmetric key cryptography (`RS256`).
   - *Rationale*: With `HS256`, every microservice verifying a token must share the exact same secret key. If a single microservice is compromised, the attacker gains the ability to forge valid tokens. Under `RS256`, only the Auth service holds the private key; downstream microservices possess only the public key, enabling cryptographically secure, decentralized token verification.

2. **In-Memory JWT with SameSite=Strict HTTP-Only Refresh Cookies**:
   - *Decision*: Restrict Access Tokens to active JS RAM and store Refresh Tokens in `HTTP-Only` cookies.
   - *Rationale*: Eliminates standard cross-site scripting (XSS) vectors that target `localStorage` to steal authentication sessions, while simultaneously shielding the application from Cross-Site Request Forgery (CSRF) via explicit refresh API configurations.

3. **AES-256-GCM Cryptographic Standard**:
   - *Decision*: Use GCM mode instead of CBC for symmetric data encryption.
   - *Rationale*: CBC mode requires padding and is susceptible to padding oracle attacks. GCM provides built-in authenticated encryption (AEAD), checking ciphertext authenticity alongside decryption in a single, high-performance mathematical operation.

4. **Cryptographic Ledger Chaining for Audit Logs**:
   - *Decision*: Build a linked hash chain on the database Audit Log table.
   - *Rationale*: Enterprise security policies require strict proof of non-repudiation. By linking every record's hash directly to its predecessor, it becomes mathematically impossible to silently delete or alter historic logs without breaking the entire verification chain.

---

## 12. Enterprise Infrastructure & Production Deployment Architecture

This section documents the unified, highly scalable infrastructure topology engineered to host the Sentinel AI VMS in high-assurance settings. It covers our containerization models, GPU abstraction layers, horizontal scaling mechanisms, telemetry frameworks, and robust disaster recovery (DR) protocols.

```
                  +----------------------------------------------+
                  |               Ingress Gateway                |
                  |     (TLS 1.3 Termination, Reverse Proxy)     |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         Internal Application Mesh            |
                  +----+-----------------+-----------------+-----+
                       |                 |                 |
         +-------------+                 |                 +-------------+
         v                               v                               v
+--------+-------------+        +--------+-------------+        +--------+-------------+
|  Frontend Container  |        |  Backend Container   |        |  AI Inference Engine |
|  - Progressive SPA   |        |  - API Controller    |        |  - CUDA / TensorRT   |
|  - HLS Stream Player |        |  - Recording Manager |        |  - OpenVINO Fallback |
+----------------------+        +--------+-------------+        +----------------------+
                                         |
         +-------------------------------+-------------------------------+
         v                               v                               v
+--------+-------------+        +--------+-------------+        +--------+-------------+
|    Message Broker    |        | Distributed Cache    |        | Multi-Tier Storage   |
|    - Kafka / Redis   |        | - Session / Limits   |        | - NVMe Hot SSDs      |
|    - Async Telemetry |        | - Shared Memory      |        | - NAS/SAN Warm HDDs  |
+----------------------+        +----------------------+        +----------------------+
```

---

### 12.1 Deployment Topology Matrix

Sentinel's core microservices operate uniformly across different deployment sizes. Scale transitions are handled via configuration profiles (environment variables, container limits, and resource binds) rather than architecture changes:

1. **Single-Node Edge Appliance (Small Office / Retail)**:
   - Hosted on a rugged industrial PC or Single-Server Windows/Linux setup.
   - All services run on lightweight Docker volumes.
   - **GPU Access**: Single consumer-grade card (e.g., NVIDIA RTX 4060) with CPU fallback via OpenVINO.
   - **Storage**: Local hardware RAID-5 direct-attached SATA array.

2. **Distributed Enterprise Cluster (Data Center / High Density)**:
   - Orchestrated via Kubernetes (K8s) or highly managed multi-node VM clusters.
   - Ingress, application controllers, recorders, and AI inference engines scale independently.
   - **GPU Access**: Multi-GPU server nodes (e.g., NVIDIA A100/H100 pools) running with direct CUDA/TensorRT container mappings.
   - **Storage**: Multi-tier SAN (iSCSI) and cloud-attached object storage (S3 compatible) for archiving.

---

### 12.2 Containerization Model (Docker)

Each microservice runs in an isolated, read-only alpine-based container, adhering to the principle of least privilege. Containers communicate over designated, internal bridge overlays.

```yaml
# docker-compose.prod.yml (Architecture Reference Blueprint)
version: '3.8'

services:
  reverse-proxy:
    image: nginx:alpine-slim
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - web-frontend
      - api-backend
    restart: always

  web-frontend:
    image: sentinel-vms/frontend:latest
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    restart: always

  api-backend:
    image: sentinel-vms/backend:latest
    environment:
      - NODE_ENV=production
      - DB_URL=postgresql://vms_user:${DB_PASSWORD}@db:5432/sentinel
      - REDIS_URL=redis://cache:6379/0
    volumes:
      - /mnt/storage/hot:/var/lib/sentinel/recordings
    security_opt:
      - no-new-privileges:true
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health/liveness"]
      interval: 10s
      timeout: 5s
      retries: 3

  ai-inference:
    image: sentinel-vms/ai-engine:latest-cuda
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - MODEL_PRECISION=FP16
      - BATCH_SIZE=8
    security_opt:
      - no-new-privileges:true
    restart: always
    healthcheck:
      test: ["CMD", "python3", "-c", "import sys; sys.exit(0)"]
      interval: 15s
      retries: 3
```

---

### 12.3 GPU Architecture & Inference Pipeline

The AI inference framework abstracts hardware targets using a multi-runtime fallback engine. If high-performance graphics accelerators are absent, the pipeline falls back gracefully to CPU workloads without halting core stream ingestion.

```
                     +----------------------------------------+
                     |         Frame ingestion Worker         |
                     |         (RTSP Decoding Loop)           |
                     +-------------------+--------------------+
                                         | Raw Tensor Frame
                                         v
                     +-------------------+--------------------+
                     |         Inference Dispatcher           |
                     |     - Dynamic Batching & Queueing      |
                     +-------------------+--------------------+
                                         |
                       Detect Hardware Acceleration Target
                                         |
                    +--------------------+--------------------+
                    |                                         |
            GPU Available                                GPU Unavailable
                    v                                         v
      +-------------+-------------+             +-------------+-------------+
      |  NVIDIA CUDA / TensorRT   |             |    OpenVINO / ONNX-CPU    |
      |  - FP16 & INT8 Quantized  |             |  - Multi-threaded SIMD    |
      |  - Parallel Stream Pools  |             |  - Frame Skipping Active  |
      +---------------------------+             +---------------------------+
```

#### 12.3.1 Dynamic Batching & Memory Management
To maximize GPU throughput and prevent memory exhaustion (OutOfMemory errors), the AI scheduler leverages **Dynamic Batching**:
- Frames from independent cameras are queued into a shared tensor buffer.
- The dispatch loop fires an inference step when the batch hits the optimal size (e.g., $B=8$) or when a time threshold (e.g., $15\text{ ms}$) is reached.
- Model caching prevents cold-start model loads, loading networks (YOLO, Face Recognition) permanently into VRAM during bootstrap phase.

#### 12.3.2 Execution Optimizations
1. **Precision Switching**: Models run in `FP16` mode by default, cutting memory consumption in half while retaining detection accuracy. High-throughput edge pipelines leverage `INT8` quantization using dynamic calibration.
2. **Dynamic Frame Scheduling**: If GPU latency spikes (e.g., beyond $40\text{ ms}$ per step), the ingestion controller triggers adaptive **Frame Skipping** (analyzing only key $I$-frames or dropping processing frequency to $10\text{ FPS}$) to preserve real-time streaming feeds.

---

### 12.4 Distributed Caching & Message Broker Abstraction

Sentinel decouples intra-service communication through standard abstraction contracts, ensuring that underlying transport brokers (Redis, Kafka, or RabbitMQ) can be swapped seamlessly by modifying environment configurations.

#### 12.4.1 Caching Layer (Redis)
Redis functions strictly as a volatile state store:
- **Session Cache**: Holds serialized JSON arrays of user authentication tokens, device fingerprints, and permissions.
- **Rate Limiting Buckets**: Tracks API hits by client IP address using Redis keys with configurable TTLs.
- **Distributed Lock Coordinator**: Coordinates parallel storage purge tasks or schema migration tasks, preventing multiple workers from executing overlapping writes.

#### 12.4.2 Event Pipeline Abstraction
Every microservice publishes state changes to an abstract `EventBroker` interface:

```typescript
export interface EventEnvelope<T = any> {
  id: string;
  topic: string;
  source: string;
  timestamp: string;
  correlationId: string;
  payload: T;
}

export interface EventBroker {
  publish(topic: string, event: EventEnvelope): Promise<void>;
  subscribe(topic: string, handler: (event: EventEnvelope) => void): Promise<void>;
}
```

---

### 12.5 Centralized Telemetry (Monitoring & Logging)

An enterprise deployment of thousands of cameras requires comprehensive visibility across hardware resources and data flows.

#### 12.5.1 Structured Telemetry & Metrics
Sentinel metrics conform to the Prometheus exposition format, exposing core operational counters on a protected `/metrics` endpoint:
- **System Metrics**: Host CPU, Memory, GPU Core Temperature, VRAM Utilized, Disk I/O speeds (read/write Bps), Network TX/RX throughput.
- **VMS Specific Metrics**:
  - `vms_camera_status`: 1 for ONLINE, 0 for OFFLINE.
  - `vms_recording_state`: 1 for active recording, 0 for idle.
  - `vms_ai_inference_duration_seconds`: Histogram of latency across model classes.
  - `vms_storage_bytes_available`: Gauge of free space per volume.

#### 12.5.2 Logging with Correlation IDs
Every incoming client request is stamped with a unique UUID **Correlation ID** in the header (`X-Correlation-ID`). This ID is propagated across all downstream microservices, database queries, and AI pipelines:

```json
{"timestamp":"2026-07-10T00:11:15.123Z","level":"info","module":"api-gateway","correlationId":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","message":"GET /api/v1/cameras/cam-102/playback"}
{"timestamp":"2026-07-10T00:11:15.125Z","level":"info","module":"recording-manager","correlationId":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","message":"Resolving segment indexing range for camera cam-102"}
```

Log rotation is handled at the OS level or Docker logging daemon, preventing single log file overflow by enforcing a 10MB file limit and keeping a maximum of 10 history files.

---

### 12.6 Enterprise Backup & Disaster Recovery (DR)

To ensure maximum resilience against storage controller failures, physical server failures, or facility-wide issues, Sentinel implements a strict multi-tier disaster recovery architecture.

#### 12.6.1 Backup Matrix and Scheduling
Backups are categorized based on change frequency and volume:

| Resource Type | Backup Scope | Backup Frequency | Encryption Algorithm | Target Destination |
| :--- | :--- | :--- | :--- | :--- |
| **System Database** | Postgres relational state, credentials, configurations | Hourly Incremental, Daily Full | AES-256-GCM | Isolated NAS / Remote Cloud Storage |
| **Biometric Metadata** | Face descriptors, user directories, templates | Daily Full | AES-256-GCM | Encrypted Cloud Object Storage |
| **System Configuration**| Network paths, camera definitions, retention policies| On Modification | AES-256-GCM | Vault / Secure NAS |
| **Evidence Archives** | Locked video clips, investigator bookmarks | Real-Time Replication | AES-256-GCM | Immutable Multi-region Cloud Objects |

#### 12.6.2 Disaster Recovery RTO and RPO
- **Recovery Time Objective (RTO)**: Maximum acceptable time to restore operations after a disaster. Under Sentinel clustering, failure of a primary backend triggers an automatic virtual IP migration, recovering system access in **under 30 seconds**.
- **Recovery Point Objective (RPO)**: Maximum acceptable age of data that can be lost. Hourly incremental database synchronization ensures an RPO of **under 60 minutes**.

---

### 12.7 Health Verification & Probes

Each running container exposes standardized liveness and readiness endpoints to ensure automated orchestration layers can manage restarts and routing correctly:

1. **Liveness Probe (`/api/health/liveness`)**:
   - Returns a simple `200 OK` indicating the process is alive and its main event loop is running.
2. **Readiness Probe (`/api/health/readiness`)**:
   - Returns `200 OK` only when all underlying dependency connections are validated.
   - Checks performed: Postgres database ping, Redis cluster ping, local storage directory write validation, and AI worker endpoint heartbeat.
   - If any check fails, the endpoint returns a `503 Service Unavailable`, prompting the load balancer to stop routing incoming user requests to this instance.

---

### 12.8 Key Architectural Decisions & Rationales

1. **Prometheus Exposition Format over Custom Push Logs**:
   - *Decision*: Expose real-time state metrics via a pull-based `/metrics` endpoint using Prometheus standards.
   - *Rationale*: Push-based monitoring can overwhelm logging channels during high-intensity CPU/GPU events. Pull-based telemetry shifts scraping responsibility to dedicated metrics servers, safeguarding VMS resource pools.

2. **Model Caching and Quantization (FP16/INT8)**:
   - *Decision*: Load models permanently into VRAM at startup and run dynamic quantization.
   - *Rationale*: Dynamically loading multi-gigabyte models into GPU memory on-the-fly when a camera detects motion introduces a 3-5 second delay, during which critical event frames would be lost. Quantization ensures high frame throughput without sacrificing high-precision tracking.

3. **Isolated Correlation IDs in Structured JSON**:
   - *Decision*: Enforce a strict correlation ID mapping in structured JSON on every log line.
   - *Rationale*: In multi-tenant environments with thousands of cameras, debugging a playback stream failure or an AI trigger delay is nearly impossible using raw, unlinked text logs. Correlation IDs allow operators to trace a single frame's lifecycle from ingress to inference and archive in seconds.

4. **Dynamic Frame Scheduling under Load**:
   - *Decision*: Implement adaptive frame skipping when system latency spikes.
   - *Rationale*: Physical network buffers on IP cameras are tiny. If the AI pipeline becomes congested and blocks the frame-receive queue, cameras will drop frames, causing visible video gaps. Dropping analytical precision slightly (via frame skipping) guarantees that continuous raw video capture on disk is never interrupted.

---

## 13. Enterprise Testing and Quality Assurance Strategy

This section establishes the comprehensive Quality Assurance (QA) and Automated Verification framework for the Sentinel AI VMS. In high-assurance physical security contexts, software regression, memory leaks, or minor model accuracy degradation can lead to critical security breaches. Our testing framework is designed to verify real-world behavior, prevent regressions, and enforce continuous compliance.

```
       +--------------------------------------------------------------+
       |                  Continuous Integration Gate                 |
       |  (Linter, Static Analysis, OWASP Security Scan, Unit Tests)  |
       +------------------------------+-------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |                 Integration & Pipeline Gate                  |
       |  (Mock Device Simulation, DB Migrations, Stream Reconnection)|
       +------------------------------+-------------------------------+
                                      |
                                      v
       +--------------------------------------------------------------+
       |                HIL & GPU Hardware Verification               |
       | (AI Performance Bounds, Dynamic Frame Skipping, CUDA Bench)  |
       +--------------------------------------------------------------+
```

---

### 13.1 Unified Testing Taxonomy

The Sentinel testing stack is partitioned across multiple distinct environments to isolate logical errors from physical network anomalies and hardware-specific behavior:

1. **Unit Testing (Mocha/Jest + ts-jest)**:
   - **Scope**: Individual business logic functions, config parsers, validation schemas, and cryptographic helper methods.
   - **Policy**: Mock all external network, disk, database, and process-level bindings. Test execution must be completely deterministic and run in under 50ms per test.

2. **Integration Testing**:
   - **Scope**: Database queries, Redis state modification, event broker publishing, and service-to-service communication.
   - **Policy**: Run against real local instances (e.g., SQLite in-memory or ephemeral PostgreSQL containers). Verify schema compatibility and event transaction guarantees.

3. **Hardware-in-the-Loop (HIL) & Physical Mock Testing**:
   - **Scope**: Live RTSP stream ingestion, ONVIF PTZ commands, and camera reconnect hooks.
   - **Policy**: Leverages a highly isolated **VMS Camera Simulator Service** that spins up standard GStreamer RTSP servers delivering deterministic high-definition video loops paired with virtual ONVIF responder endpoints.

4. **AI Validation Pipeline**:
   - **Scope**: Validation of AI inference engines (YOLO object detection, ArcFace recognizers, OCR, and thermal threat detectors).
   - **Policy**: Executes against static high-quality gold standard video datasets (ground truth labeled). Computes accuracy benchmarks across CPU and GPU pools.

---

### 13.2 Camera & Ingestion Layer Testing (RTSP / ONVIF)

Testing live video feeds requires verifying network failure paths, stream drops, and packet corruptions without relying on unpredictable physical cameras.

```typescript
export interface MockCameraProfile {
  id: string;
  rtspUrl: string;
  onvifPort: number;
  resolution: string;
  fps: number;
  corruptionRatePct: number; // Simulated network packet loss
  latencyMs: number;
}

export interface IngestionTestResult {
  streamId: string;
  packetsReceived: number;
  reconnectAttempts: number;
  frameDropRatePct: number;
  stateTransitions: string[];
}
```

#### 13.2.1 Core Ingestion Test Suite
- **Stream Reconnect Verification**: Tests the ingestion engine's exponential backoff reconnect mechanism. The test harness terminates the mock GStreamer process mid-stream, verifying that the `RecordingManager` registers a `RECORDING_FAILED` event, drops into a retrying state, and automatically recovers recording (triggering a new signed segment write) within 2.5 seconds of the mock stream coming back online.
- **ONVIF SOAP Command Verification**: Verifies ONVIF XML payload generation by parsing and asserting SOAP headers for PTZ (Pan-Tilt-Zoom) coordinate offsets, absolute positioning, preset configurations, and auxiliary relay triggers.
- **Dynamic Bandwidth Constriction Test**: Simulates 3G/4G cellular backhaul networks by throttling mock stream bandwidth. Verifies that the VMS detects stream latency hikes and automatically falls back from the `MAIN` profile stream to the highly compressed `SUB` profile stream.

---

### 13.3 AI Model Validation Pipeline

AI performance cannot be judged by binary unit assertions. Every model release and runtime change is validated against our continuous model testing pipeline to calculate statistical precision and memory bounds.

```typescript
export interface AiGroundTruthAnnotation {
  frameId: number;
  timestampOffsetMs: number;
  boundingBoxes: {
    class: 'FACE' | 'VEHICLE' | 'PERSON' | 'FIRE' | 'SMOKE';
    coordinates: [number, number, number, number]; // [x_min, y_min, x_max, y_max]
    identifier?: string; // e.g. license plate string or face id
  }[];
}

export interface ModelValidationMetrics {
  tp: number; // True Positives
  fp: number; // False Positives
  fn: number; // False Negatives
  precision: number; // TP / (TP + FP)
  recall: number;    // TP / (TP + FN)
  f1Score: number;   // 2 * (P * R) / (P + R)
  inferenceLatencyAvgMs: number;
  gpuMemoryPeakMb: number;
}
```

#### 13.3.1 Statistical Integrity Gates
Any change to model weights, quantization parameters (FP16 vs INT8), or the dynamic frame-skipping algorithm must pass through a strict statistical gate:
- **Baseline Integrity**: The F1 score of core detection algorithms (YOLO, License Plate OCR, ArcFace) must not degrade by more than $0.5\%$ against the golden test set.
- **Dynamic FPS Performance Assessment**: Simulates high-intensity situations (such as fire emergencies or crowded environments) where object counts increase by $1000\%$. The test checks that the scheduling engine activates dynamic frame skipping correctly, preventing CPU/GPU memory exhaustion and keeping latency spikes bounded below $50\text{ ms}$ per frame.

---

### 13.4 API Security & Authorization (RBAC) Testing

Securing critical infrastructure means establishing exhaustive testing around permission boundaries, token lifecycle states, and privilege levels.

```typescript
export interface RbacTestCase {
  roleId: string;
  testPermissions: string[];
  targetEndpoint: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  expectedStatusCode: 200 | 401 | 403;
}
```

#### 13.4.1 Security Defense Assertions
1. **Granular Permission Isolation**: Runs matrix-style tests asserting permissions. An operator with `camera:view` must return a `403 Forbidden` response when attempting to download evidence, modify system retention schedules, or call AI configuration routes.
2. **Brute-Force & Adaptive Account Lock Verification**: Fires consecutive failing logins against active accounts, verifying that after exactly 5 failures, the database locks the account record, and any subsequent valid logins within 30 minutes return an explicit `423 Locked` response.
3. **Privilege Escalation & Token Injection Safeguards**: Simulates JWT payload injection by modifying role identifiers or token-scope parameters within the payload. The validator tests that downstream route managers reject the modified tokens immediately due to signature mismatches (HMAC/RSA signature failures).

---

### 13.5 Performance, Stress, and Load Testing Framework

Sentinel runs systematic high-load benchmarks to identify resource leaks, database connection starvation, and disk-write overhead.

```
       +--------------------------------------------------------------+
       |                       System Load Generator                  |
       |  - 1,000+ Concurrent Simulated Camera Streams                |
       |  - 500+ Concurrent Operators Querying API & Video Playback   |
       +------------------------------+-------------------------------+
                                      |
                                      v
       +------------------------------+-------------------------------+
       |                      Resource telemetry                      |
       |     - Memory Profile (v8 Heap allocation tracking)           |
       |     - Disk I/O Write Saturation Metrics                      |
       |     - GPU Tensor Core Usage Dynamics                         |
       +------------------------------+-------------------------------+
                                      |
                                      v
       +------------------------------+-------------------------------+
       |                      Performance Gates                       |
       |  - Memory growth bounds check (Memory Leak Detection)        |
       |  - Write-Latency < 15ms at 99th percentile                   |
       +--------------------------------------------------------------+
```

#### 13.5.1 Scalability Verification
- **Write Saturation and Disk Stress Testing**: Simulates parallel writing of 1,000 video channels, verifying that the `SegmentWriter` handles asynchronous chunked flushes without memory growth. The test validates that write-latency to disk remains below $15\text{ ms}$ at the 99th percentile.
- **Memory Leak Assertion (V8 Heap Profile)**: Exercises the recording, playback, and websocket notification pipelines continuously for 24 hours under maximum simulated user load. Memory usage is tracked via V8 heap snapshots; any baseline memory growth exceeding $1.5\%$ over a 6-hour interval fails the test.
- **High Concurrency Playback Benchmarking**: Simulates 500 concurrent operators querying HLS playlists, performing timeline searches, and seeking frames back and forth. Verifies that index database queries utilize optimized index trees, completing lookups in under $10\text{ ms}$.

---

### 13.6 CI/CD Testing Pipeline & Quality Gates

To prevent code degradation, every pull request (PR) and code merge is evaluated in a multi-stage automated pipeline that enforces strict code quality and security policies:

```yaml
# .github/workflows/sentinel-ci.yml (Reference CI Pipeline Blueprint)
name: Sentinel CI Core Pipeline

on:
  push:
    branches: [ main, release/* ]
  pull_request:
    branches: [ main ]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node environment
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run code formatter check
        run: npm run format:check
      - name: Code Syntax & Type Verification
        run: npm run lint
      - name: OWASP Security Dependency Scan
        run: npm run security:scan

  test-suite:
    needs: static-analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node environment
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Spin up Integration Services (Postgres, Redis)
        run: docker compose -f docker-compose.test.yml up -d
      - name: Execute Deterministic Unit Tests
        run: npm run test:unit
      - name: Execute Database & State Integration Tests
        run: npm run test:integration
      - name: Assert Code Coverage Standards
        run: npm run test:coverage -- --coverageThreshold=85

  ai-performance-gate:
    needs: test-suite
    runs-on: [self-hosted, linux, x64, gpu-cuda]
    steps:
      - uses: actions/checkout@v3
      - name: Validate Model Accuracy & Compute Latency Bounds
        run: python3 -m pytest tests/ai_validation/ --verbose
```

---

### 13.7 Key Architectural Decisions & Rationales

1. **Hardware-in-the-Loop (HIL) Mock Stream Servers over Physical Hardware Pools**:
   - *Decision*: Develop GStreamer/SOAP virtual device simulator harnesses to drive testing pipelines, rather than relying on a pool of real physical cameras.
   - *Rationale*: Physical camera setups are unstable and introduce non-deterministic factors (network disconnects, lighting shifts, physical hardware faults) that cause tests to fail randomly. GStreamer simulators deliver identical, frame-accurate binary data on every run, ensuring test results are completely reproducible.

2. **Strict Code Coverage Threshold ($85\%$) and Static Gates**:
   - *Decision*: Enforce a mandatory minimum threshold of $85\%$ statement, branch, and function coverage on all pull requests.
   - *Rationale*: In an enterprise system managing critical physical safety, uncovered edge cases (such as fallback connection handling or audit log rotation faults) represent severe security risks. Strict coverage metrics guarantee that all recovery paths are tested before deployment.

3. **Separate Dedicated Self-Hosted GPU Runner for CI AI Validation**:
   - *Decision*: Route AI validation pipelines to self-hosted GPU-equipped CI runners, keeping them separate from standard CPU runner processes.
   - *Rationale*: Running deep learning model tests on CPU environments is extremely slow, which slows down the development cycle. Additionally, CPU-based execution fails to verify GPU-specific optimizations (such as TensorRT kernels or CUDA memory bounds), leaving hardware compatibility issues undetected.

4. **Cryptographic Validation of Logs and Watermarks in Integration Tests**:
   - *Decision*: Programmatically verify watermark signatures and audit log SHA-256 chains during standard integration cycles.
   - *Rationale*: Ensures that even minor modifications to audit logging structures, cryptography packages, or video metadata wrappers are caught immediately if they break chain-of-custody compliance.

---

## 14. Enterprise Plugin SDK & Extensibility Model

To satisfy enterprise demands for custom integrations and field-programmable analytical capabilities without risking core system instability or breaking the central release train, Sentinel provides a decoupled, secure, and semantically versioned **Plugin SDK**. The architecture enforces a strict unidirectional dependency model: the core system has zero dependency on custom plugins, and plugins interact with the core exclusively through stable, sandbox-contained SDK interfaces.

```
+---------------------------------------------------------------------------------------------------------+
|                                         Sentinel Core VMS                                               |
|  - Ingestion Engine     - Database Manager     - Recording Scheduler     - Secret Store (Vault)         |
+----------------------------------------------------+----------------------------------------------------+
                                                     ^
                                                     | Implements & Interacts via
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                                           Sentinel SDK Layer                                            |
|  - ISdkContext          - ICameraPlugin        - IAiPlugin               - IStoragePlugin               |
|  - INotificationPlugin  - IAuthenticationPlugin - IEventPlugin           - ISecureLogger                |
+----------------------------------------------------+----------------------------------------------------+
                                                     ^
                                                     | Sandboxed Isolation
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                                        Plugin Isolation Sandbox                                         |
|  - v8-Isolate VM Boundary    - CPU/Memory Quota Guards    - Restrained System File & Process Descriptors |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                   +-----------------+-----------------+
                                   |                                   |
                                   v                                   v
                      +------------+------------+         +------------+------------+
                      |   Third-Party AI Plugin |         | Custom Ingestion Adapter|
                      +-------------------------+         +-------------------------+
```

---

### 14.1 The Plugin Lifecycle Contract

Every plugin must implement the unified `IWebPlugin` interface, which models a deterministic state machine managed by the Core's `PluginLoader`.

```typescript
export interface PluginMetadata {
  id: string;          // Globally unique identifier (e.g., "org.partner.smoke-detector")
  name: string;        // Human-readable name
  version: string;     // SemVer string (e.g., "1.4.2")
  sdkVersion: string;  // Target SDK compatibility range (e.g., "^2.1.0")
  description: string;
  author: string;
  dependencies?: Record<string, string>; // Dependency plugin IDs mapped to version bounds
}

export enum PluginState {
  UNINSTALLED = 'UNINSTALLED',
  INSTALLED = 'INSTALLED',
  LOADED = 'LOADED',
  INITIALIZED = 'INITIALIZED',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR'
}

export interface PluginHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  message?: string;
  uptimeSeconds: number;
  memoryUsageBytes: number;
}

export interface ISdkContext {
  logger: ISecureLogger;
  events: IEventDispatcher;
  getTemporaryDirectory(): string; // Sandboxed access only
  getSystemConfig(key: string): string | null; // Screened & approved keys only
}

export interface IWebPlugin {
  getMetadata(): PluginMetadata;
  getState(): PluginState;
  
  // Lifecycle Transition Hooks
  install(context: ISdkContext): Promise<void>;
  load(context: ISdkContext): Promise<void>;
  initialize(context: ISdkContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  unload(): Promise<void>;
  update(newVersion: string, context: ISdkContext): Promise<void>;
  
  // Health & Monitoring
  getHealth(): Promise<PluginHealth>;
}
```

---

### 14.2 High-Value Extensibility Interfaces

Rather than exposing core databases or direct OS execution threads, Sentinel provides specialized plugin interfaces that plug directly into our ingestion, event, and analytical pipelines.

#### 14.2.1 Camera Adapter Plugins (`ICameraAdapterPlugin`)
Used to interface with proprietary cameras or legacy streaming pipelines (e.g., custom thermal cameras, military radar stream feeds) not conforming to standard RTSP/ONVIF.
```typescript
export interface RawFramePayload {
  timestampMs: number;
  width: number;
  height: number;
  format: 'RGBA' | 'YUV420' | 'NV12';
  data: Uint8Array | SharedArrayBuffer;
}

export interface ICameraAdapterPlugin extends IWebPlugin {
  connect(connectionString: string, credentials: Record<string, string>): Promise<void>;
  startInferenceStream(frameCallback: (frame: RawFramePayload) => void): Promise<void>;
  sendPtzCommand(pan: number, tilt: number, zoom: number): Promise<void>;
  disconnect(): Promise<void>;
}
```

#### 14.2.2 AI Inference Plugins (`IAiInferencePlugin`)
Enables integration of third-party deep learning networks (such as specialized custom object classifiers, crowd density estimators, or smoke detectors) directly into the core frame execution pipeline.
```typescript
export interface DetectionBoundingBox {
  className: string;
  confidence: number;
  coordinates: [number, number, number, number]; // Normalized [ymin, xmin, ymax, xmax]
  features?: Record<string, any>; // Optional face templates, custom attributes
}

export interface IAiInferencePlugin extends IWebPlugin {
  getSupportedModels(): string[];
  warmup(modelName: string): Promise<void>;
  analyzeFrame(frame: RawFramePayload, modelName: string): Promise<DetectionBoundingBox[]>;
}
```

#### 14.2.3 Storage Provider Plugins (`IStorageProviderPlugin`)
Allows routing recorded clips and analytics events to bespoke storage infrastructures (e.g., custom regional clouds, physical tape archives, or proprietary object pools) without modifying the local segment recorder logic.
```typescript
export interface IStorageProviderPlugin extends IWebPlugin {
  writeVideoSegment(cameraId: string, startTimeMs: number, endTimeMs: number, segmentData: ReadableStream): Promise<string>; // Returns target storage URI
  deleteVideoSegment(segmentUri: string): Promise<void>;
  getDownloadUrl(segmentUri: string): Promise<string>;
}
```

#### 14.2.4 Notification Dispatcher Plugins (`INotificationDispatcherPlugin`)
Bridges Sentinel alarms and critical tracking outcomes to proprietary emergency dispatcher systems, physical siren triggers, enterprise chat rooms, or regional dispatch databases.
```typescript
export interface SystemAlert {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  timestamp: string;
  cameraId?: string;
  associatedClipUri?: string;
}

export interface INotificationDispatcherPlugin extends IWebPlugin {
  dispatchAlert(alert: SystemAlert): Promise<void>;
}
```

---

### 14.3 Plugin Sandboxing & Core Security Boundary

Sentinel maintains a hard security boundary around third-party plugin executions. Unrestricted execution of external assemblies or Node modules is **strictly prohibited**.

1. **V8 Isolate Isolation**:
   - Plugins run within isolated Javascript contexts (V8 Isolates or WebAssembly runtimes) or distinct operating system processes (`worker_threads` with restricted IPC channels).
   - CPU cycles and memory allocations are restricted per plugin (e.g., maximum 512MB RAM and 20% single-core allocation). Exceeding these bounds triggers an automated `PluginState.ERROR` transition and isolates the module.

2. **No Native File / Network Acccess**:
   - Plugins are blocked from importing the standard Node.js `fs`, `child_process`, `net`, or `http` modules.
   - Any external network request must traverse the `ISdkContext.fetch` interface, which applies strict outbound whitelist domain checks and rate limits.
   - Access to database drivers, environment secrets, and the underlying file system is completely blocked. System configuration parameter lookup is performed through strict, permission-screened environment variables passed by the core during initialization.

3. **Digital Signature Verification**:
   - During manual installation or remote registration from our enterprise registry, plugins are validated using the developer's public key certificate.
   - The plugin archive must contain a `manifest.json.sig` file signed by an approved, trust-verified Certificate Authority (CA). Unsigned or modified files fail safety checks and are rejected by the loader.

---

### 14.4 Versioning & Backward Compatibility

- **Semantic Versioning (SemVer)**: The SDK uses strict SemVer (`MAJOR.MINOR.PATCH`).
- **Compatibility Matrix**: 
  - Major releases (`v3.0.0`) can introduce breaking API changes.
  - Minor releases (`v2.1.0`) introduce backward-compatible interface updates.
  - Patch releases (`v2.0.1`) address security vulnerabilities or internal SDK bugs.
- **Deprecation Lifecycle**: If an SDK method must be retired, it is marked with the `@deprecated` JSDoc annotation. It remains functional through a minimum of one full Major release cycle, producing console warning logs that specify the deprecation path.

---

## 15. Official VMS Engineering Standards and Conventions

This section defines the mandatory, non-negotiable software engineering standards and architectural patterns for the Sentinel AI VMS codebase. All developers, code reviews, and automated CI pipelines are bound to these specifications.

---

### 15.1 Architectural and Engineering Foundations

We strictly adhere to core architectural patterns to prevent system decay and maintain extreme modularity over a 10+ year operational lifespan.

```
       +--------------------------------------------------------------+
       |                         Client View                          |
       +------------------------------+-------------------------------+
                                      | HTTP Requests / WebSockets
                                      v
       +------------------------------+-------------------------------+
       |                         Service Layer                        |
       |  (Pure Business Logic, Transaction Control, Orchestration)   |
       +------------------------------+-------------------------------+
                                      | DTOs & Domain Entities
                                      v
       +------------------------------+-------------------------------+
       |                      Repository Interface                    |
       |  (Abstract contracts decoupled from physical persistence)    |
       +------------------------------+-------------------------------+
                                      | SQL / NoSQL / Memory operations
                                      v
       +------------------------------+-------------------------------+
       |                   Database Persistence Layer                 |
       |            (Drizzle PostgreSQL / Firestore Auth)             |
       +--------------------------------------------------------------+
```

1. **Clean Architecture Separation of Concerns**:
   - Code must be decoupled into distinct, independent tiers. Core business logic is isolated from database drivers, physical device protocols, and HTTP frameworks.
   - The direction of dependency must always run inward toward the core domain logic, never outward to external systems.

2. **SOLID Principles in Practice**:
   - **Open/Closed Principle (OCP)**: Code modules must be open for extension but closed for modification. Adding a new camera brand or AI algorithm must be handled by implementing a designated interface (e.g., `ICameraAdapterPlugin`), never by editing central ingestion loop files.
   - **Dependency Inversion Principle (DIP)**: Core business modules must depend on abstract interfaces, never on concrete database or network clients. Downstream services are resolved at runtime via strict **Dependency Injection (DI)** patterns.

3. **Repository Pattern**:
   - Database operations (PostgreSQL, Firestore, Memory stores) must be wrapped inside concrete Repository classes implementing clean domain interface contracts. Direct, inline database queries inside HTTP routes are completely forbidden.

---

### 15.2 Code Quality, Style, and Naming Conventions

To ensure readability across distributed engineering teams, code must adhere to clean, uniform styling specifications.

- **Naming Standards**:
  - **Classes, Interfaces, Enums**: CamelCase starting with a capital letter (e.g., `RecordingManager`, `ICameraAdapter`, `PlaybackStatus`).
  - **Methods, Variables**: camelCase starting with a lower-case letter (e.g., `processFrame()`, `activeStreamCount`).
  - **Folders, Files**: kebab-case using all lowercase (e.g., `/recording-engine/`, `segment-writer.ts`).
  - **Explicit Types**: Use descriptive, fully qualified types. Avoid using generic types like `any`, `unknown` (unless strictly required for type-casting), or `Object`.

- **Strict Code Cleanliness (Anti-Slop & Dead Code Policy)**:
  - **No Dead Code**: Unused variables, unreachable return statements, and unused module imports are caught and blocked during CI linter passes.
  - **No Commented-Out Code**: All version history is managed in Git. Code files must be completely clean of commented-out logic, debugging remnants, or historical code blocks.
  - **Zero Magic Numbers**: System parameters, timeouts, memory bounds, and coordinate boundaries must be declared as strongly typed, descriptive constants or read from central configuration files.

---

### 15.3 Robust Exception and Error Management

The VMS must be resilient to external network issues, camera stream failures, and database timeouts. **Silent failures are strictly prohibited.**

1. **Exception Hierarchy**: All custom system exceptions must inherit from a unified `BaseVmsException` class, providing structural fields for audit logs:
```typescript
export abstract class BaseVmsException extends Error {
  public abstract readonly errorCode: string;
  public abstract readonly httpStatus: number;
  public readonly timestamp: string;

  constructor(message: string, public readonly correlationId: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CameraConnectionException extends BaseVmsException {
  public readonly errorCode = 'VMS_CAMERA_CONNECT_FAILED';
  public readonly httpStatus = 502;
}
```

2. **No Uncaught Rejections**: 
   - Every asynchronous promise must be protected by explicit `.catch()` handlers or wrapped inside structured `try-catch` blocks.
   - All errors must be logged using the centralized, structured JSON logger, including the associated `correlationId` and stack trace.

---

### 15.4 Versioned API Standards & Response Conventions

Our external API represents a contract with our integration partners and dashboard frontends. We enforce strict structure and versioning rules:

1. **Strict REST Versioning**:
   - All REST routes must be explicitly prefixed with their major version number (e.g., `/api/v1/cameras`, `/api/v2/analytics`).
   - Major version increments must only occur when backward-incompatible interface changes (such as payload field removals or route deletions) are required.

2. **Consistent Response Wrapper**:
   All API endpoints must deliver payloads encapsulated inside a predictable JSON envelope:
```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  correlationId: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}
```

3. **Filtering, Sorting, and Pagination Requirements**:
   - Endpoints returning list payloads must enforce server-side pagination with default limits (e.g., `limit=50`). Returning unbounded database arrays is forbidden.
   - Filter attributes must be passed explicitly via query string parameters (e.g., `status=ACTIVE`) and checked against strict validation schemas before executing database scans.

---

### 15.5 Git Flow and Pull Request Compliance Gates

Sentinel protects code branch stability through strict structural policies:

```
        +-------------------------------------------------------------+
        |                 Feature Branch (feature/ptz)                |
        +------------------------------+------------------------------+
                                       | Pull Request Target
                                       v
        +------------------------------+-----------------------------+
        |                 Release Candidate (release/v2.1)            |
        |  - Merges multiple features  - Subject to staging tests    |
        +------------------------------+-----------------------------+
                                       | Verified Release Merge
                                       v
+--------------------------------------+--------------------------------------+
|                           Main Production Branch                            |
|             - Strictly read-only     - Always builds successfully           |
+-----------------------------------------------------------------------------+
```

1. **Git Flow Workflow**:
   - **`main`**: The production branch. It must remain strictly read-only and always represent a deployable, stable release.
   - **`release/*`**: Branches dedicated to pre-release testing, hotfixes, and final documentation adjustments.
   - **`feature/*`**: Isolated branches for active feature development. Feature branches must never be merged directly into `main`.

2. **Pull Request Quality Gates**:
   Before a feature branch can be merged into a release or production branch, it must pass through automated and peer-reviewed gates:
   - **Automated Validation**: Code formatting must be compliant, lint verification must succeed (`npm run lint`), and unit and integration tests must execute with $100\%$ success.
   - **Structural Review**: Minimum of two senior engineers must review the changes to verify compliance with SOLID, DRY, and clean architecture standards.
   - **Documentation Integrity**: Any route updates, database changes, or design alterations must include corresponding updates in `VMS_ARCHITECTURE.md`.

---

## 16. Enterprise Detection & Tracking Engine Architecture

This section documents the high-throughput, low-latency Detection and Tracking Engine of the Sentinel AI VMS. This module is engineered to handle real-time frame ingestion, multi-class object detection, single-camera temporal tracking, cross-camera re-identification (ReID), and complex geometric spatial event analysis (zone intrusion, line-crossing, and loitering) across thousands of distributed streams.

```
                                      +---------------------------------------+
                                      |             Raw Frame                 |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |          Preprocessing                |
                                      |  - Aspect Ratio Pad   - Normalize     |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |          Deep Inference               |
                                      |  - CUDA TensorRT      - CPU Fallback  |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |          Post-Processing              |
                                      |  - Scale/NMS          - Class Filters |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |     Temporal In-Camera Tracking       |
                                      |  - ByteTrack / DeepSORT State         |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |    Re-Identification & Association    |
                                      |  - 512-dim Embedding  - Cosine Match  |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |         Geometric Event Engine        |
                                      |  - Line Crossing      - Poly Intrusion|
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +-------------------+-------------------+
                                      |         Metadata Storage & Bus        |
                                      |  - PostgreSQL DB      - Event Broker  |
                                      +---------------------------------------+
```

---

### 16.1 Supported Object Classes

The engine utilizes a standardized classification dictionary across all ingestion models. Custom classification layers are mapped back to this canonical schema to maintain downstream report and query consistency:

```typescript
export enum TargetObjectClass {
  PERSON = 'PERSON',
  VEHICLE = 'VEHICLE',
  MOTORCYCLE = 'MOTORCYCLE',
  BUS = 'BUS',
  TRUCK = 'TRUCK',
  BICYCLE = 'BICYCLE',
  ANIMAL = 'ANIMAL',
  BAG = 'BAG',
  HELMET = 'HELMET',
  SAFETY_VEST = 'SAFETY_VEST',
  FIRE = 'FIRE',
  SMOKE = 'SMOKE'
}
```

---

### 16.2 Pluggable Detector Interface (`IDetector`)

To ensure independence from specific deep learning runtimes (YOLOv8, YOLOv9, YOLOv10, or RT-DETR), the core execution thread interacts with models via a clean, abstract interface. Raw inference is never simulated; actual performance metrics are retrieved from compiled TensorRT kernels, ONVIF metadata streams, or CPU runtime models.

```typescript
export interface BoundingBox {
  xMin: number; // Normalized 0.0 to 1.0 relative to image width
  yMin: number; // Normalized 0.0 to 1.0 relative to image height
  xMax: number; 
  yMax: number; 
}

export interface DetectionResult {
  class: TargetObjectClass;
  confidence: number; // Real probability between 0.00 and 1.00
  boundingBox: BoundingBox;
  keypoints?: Array<{ x: number; y: number; confidence: number }>; // Optional pose keypoints
}

export interface InferenceConfig {
  confidenceThreshold: number; // Minimum confidence to accept detections (e.g. 0.25)
  iouThreshold: number;        // Intersection-over-Union threshold for NMS (e.g. 0.45)
  maxDetections: number;       // Upper bound on bounding boxes per frame
  classesFilter: TargetObjectClass[]; // Classes actively enabled for inference
}

export interface IDetector {
  getId(): string;
  getName(): string;
  getVersion(): string;
  
  // Model Lifespan Controls
  load(modelPath: string, useGpu: boolean): Promise<void>;
  warmup(batchSize: number): Promise<void>;
  
  // High-performance Execution
  detect(frameData: Uint8Array, width: number, height: number, config: InferenceConfig): Promise<DetectionResult[]>;
  detectBatch(frames: Uint8Array[], width: number, height: number, config: InferenceConfig): Promise<DetectionResult[][]>;
  
  unload(): Promise<void>;
}
```

---

### 16.3 Pluggable Single-Camera Tracker Interface (`ITracker`)

The Tracker associates bounding boxes across contiguous frames within a single camera's stream. It manages state transitions (Active, Lost, Terminated) and implements algorithms such as **ByteTrack** (which associates low-score detections to rescue occluded targets) or **DeepSORT** (which combines Kalman filter predictions with motion vector analysis).

```typescript
export enum TrackState {
  TRACK_STARTED = 'TRACK_STARTED',
  TRACKING = 'TRACKING',
  TRACK_LOST = 'TRACK_LOST',
  TRACK_ENDED = 'TRACK_ENDED'
}

export interface TrackedObject {
  trackId: string; // Unique within the active camera session (e.g., "cam101_track_482")
  class: TargetObjectClass;
  confidence: number;
  boundingBox: BoundingBox;
  motionVector: { dx: number; dy: number };
  state: TrackState;
  framesActiveCount: number;
  lastSeenTimestampMs: number;
  embedding?: Float32Array; // 512-dimension spatial feature vector for ReID
}

export interface ITracker {
  getId(): string;
  getName(): string;
  
  // Frame Update Loop
  update(
    detections: DetectionResult[], 
    timestampMs: number, 
    frameEmbeddings?: Float32Array[]
  ): Promise<TrackedObject[]>;
  
  // Session Controls
  reset(): void;
  getTrackedObjects(): TrackedObject[];
}
```

---

### 16.4 Multi-Camera Re-Identification (ReID) & Global Tracking Coordination

When an object exits a camera's field of view, Sentinel tracks its transition across the facility using a centralized Re-Identification (ReID) coordination pipeline.

#### 16.4.1 ReID Vector Embedding Engine
For every tracked target representing high-sensitivity classes (e.g., `PERSON`, `VEHICLE`), a lightweight feature extraction model (e.g., OSNet or ResNet-based ReID model) outputs a normalized 512-dimensional floating-point representation of the object's appearance.

#### 16.4.2 Cross-Camera Topological Matching
The Global Tracker correlates localized tracks by evaluating three factors:
1. **Appearance Similarity**: Cosine distance between the ReID embedding of a lost track ($E_{lost}$) and candidate new tracks ($E_{new}$):
   $$\text{CosineSimilarity}(E_{lost}, E_{new}) = \frac{E_{lost} \cdot E_{new}}{\|E_{lost}\| \|E_{new}\|}$$
2. **Topological Transition Probability**: Physical proximity and transition times modeled in the facility's camera graph (e.g., a person exiting door camera A is highly unlikely to appear in gate camera B within 2 seconds).
3. **Temporal Bounds**: Candidates must appear within a configurable time window ($T_{exit} < T_{entry} < T_{exit} + \Delta T$).

```typescript
export interface GlobalTrack {
  globalTrackId: string; // Globally unique tracked identity across the system (e.g. "GLOBAL_PERSON_9942")
  class: TargetObjectClass;
  firstSeenTimestampMs: number;
  lastSeenTimestampMs: number;
  reIdEmbedding: Float32Array; // Representative embedding (centroid of historic embeddings)
  cameraHops: Array<{
    cameraId: string;
    localTrackId: string;
    enteredAt: number;
    exitedAt: number;
  }>;
}

export interface IMultiCameraTracker {
  registerTrackLost(cameraId: string, trackedObject: TrackedObject, exitTimestampMs: number): Promise<void>;
  correlateNewTrack(cameraId: string, trackedObject: TrackedObject, entryTimestampMs: number): Promise<string | null>; // Returns globalTrackId or null
  getActiveGlobalTracks(): GlobalTrack[];
}
```

---

### 16.5 Geometric Spatial Event Engine (Zone & Line Analytics)

The Event Engine evaluates the coordinates of active tracks against geometric shapes defined on the camera's video coordinate space. All operations are calculated in normalized coordinates to remain independent of the raw stream's resolution.

```typescript
export interface Point {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
}

export interface LineDefinition {
  id: string;
  name: string;
  startPoint: Point;
  endPoint: Point;
  allowedDirections: 'FORWARD' | 'REVERSE' | 'BOTH';
}

export interface ZoneDefinition {
  id: string;
  name: string;
  polygon: Point[]; // Minimum 3 points representing a closed polygon
  minDwellTimeSeconds: number; // Threshold for loitering alarms
  maxCapacityThreshold?: number; // Capacity limits for occupancy events
}

export interface AnalyticsRule {
  id: string;
  cameraId: string;
  isEnabled: boolean;
  targetClasses: TargetObjectClass[];
  lines: LineDefinition[];
  zones: ZoneDefinition[];
}
```

#### 16.5.1 Spatial Algorithms

1. **Line Crossing Detection (Segment-Segment Intersection)**:
   The engine evaluates if the line segment representing the movement of a tracked object's centroid (from frame $T-1$ to frame $T$) intersects the defined tripwire. The intersection is validated using the vector cross product:
   
   Let $A B$ be the tripwire segment, and $C D$ be the object trajectory. An intersection occurs if and only if the cross products of vectors have opposite signs:
   $$\text{sign}((\vec{AB} \times \vec{AC})) \neq \text{sign}((\vec{AB} \times \vec{AD})) \quad \land \quad \text{sign}((\vec{CD} \times \vec{CA})) \neq \text{sign}((\vec{CD} \times \vec{CB}))$$
   
   Direction is evaluated relative to the normal vector of $AB$.

2. **Zone Containment Detection (Ray-Casting Polygon Intersection)**:
   To determine if a tracked object has entered or exited a custom zone, Sentinel implements the **Ray-Casting Algorithm** (Even-Odd rule). A ray is projected horizontally from the object's centroid coordinate. If the ray intersects the edges of the zone polygon an odd number of times, the point lies inside the zone.

```typescript
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
```

---

### 16.6 Real-Time Event Bus & State Envelopes

The results of spatial analysis and track transitions are published as strongly-typed events to our abstract Event Broker in real-time. Downstream logging, notification, and evidence-recording engines consume these channels:

```typescript
export enum VmsAiEventType {
  OBJECT_DETECTED = 'ai.event.object_detected',
  OBJECT_LOST = 'ai.event.object_lost',
  TRACK_STARTED = 'ai.event.track_started',
  TRACK_ENDED = 'ai.event.track_ended',
  LINE_CROSSED = 'ai.event.line_crossed',
  ZONE_ENTERED = 'ai.event.zone_entered',
  ZONE_EXITED = 'ai.event.zone_exited',
  INTRUSION_DETECTED = 'ai.event.intrusion_detected',
  LOITERING_DETECTED = 'ai.event.loitering_detected',
  COUNT_UPDATED = 'ai.event.count_updated'
}

export interface BaseAiEventPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  correlationId: string;
}

export interface ObjectDetectedPayload extends BaseAiEventPayload {
  localTrackId: string;
  globalTrackId?: string;
  class: TargetObjectClass;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface LineCrossedPayload extends BaseAiEventPayload {
  lineId: string;
  lineName: string;
  direction: 'FORWARD' | 'REVERSE';
  object: {
    localTrackId: string;
    class: TargetObjectClass;
    boundingBox: BoundingBox;
  };
}

export interface ZoneIntrusionPayload extends BaseAiEventPayload {
  zoneId: string;
  zoneName: string;
  dwellTimeSeconds: number;
  object: {
    localTrackId: string;
    class: TargetObjectClass;
    boundingBox: BoundingBox;
  };
}
```

---

### 16.7 Key Architectural Decisions & Rationales

1. **ByteTrack Association Logic**:
   - *Decision*: Rely on ByteTrack as our primary spatial tracking association model.
   - *Rationale*: Standard tracking algorithms (like DeepSORT) discard low-confidence detections (e.g., objects under $0.3$ confidence), leading to broken trajectories and fragmented Track IDs during target occlusion or temporary shadows. ByteTrack keeps all bounding boxes and matches low-score detections against existing tracks using spatial IoU overlapping, which prevents track identity swaps and stabilizes tracking indices in crowded environments.

2. **Centroid Ray-Casting over Bounding Box Overlap**:
   - *Decision*: Enforce ray-casting polygon containment on the object's bottom-center coordinate (representing contact with the ground), rather than verifying if any part of the bounding box overlaps the zone.
   - *Rationale*: Utilizing full bounding box overlaps creates massive false-positive intrusion alarms, especially when shadows or large objects (like vehicles or camera perspectives) cause bounding boxes to stretch into a forbidden zone even if the target is physically outside of it. Target-ground coordinates isolate containment checks to the exact physical position of the object.

3. **Normalized Floating-Point Coordinates ($0.0 \rightarrow 1.0$)**:
   - *Decision*: Store and calculate all bounding boxes, polygon definitions, and tripwires using normalized floating-point coordinates.
   - *Rationale*: Eliminates tight coupling between spatial definitions and stream resolutions. If a camera's resolution is reconfigured (e.g., upgraded from $1080\text{p}$ to $4\text{K}$), normalized geometric configurations remain valid without scaling or recalibration.

4. **Cosine Distance on Dedicated Vector Matrices**:
   - *Decision*: Offload the calculation of multi-camera cosine similarities to dedicated CUDA matrices or linear algebra libraries (such as NumPy or WebAssembly vector engines).
   - *Rationale*: Calculating cosine distances between hundreds of active tracks and historic ReID signatures in sequential JavaScript loops causes massive event loop blockages, dragging down system frame ingestion performance. Offloading to vector engines ensures comparisons occur in parallel sub-millisecond durations.

---

---

## 17. Enterprise Biometric Face Recognition Engine Architecture

This section documents the high-throughput, low-latency biometric face recognition engine of the Sentinel AI VMS. This module is engineered to detect, align, score, represent, track, and recognize human faces across real-time video streams, cross-referencing them against secure watchlists containing millions of registered identities with complete cryptographically-secured chain-of-custody.

```
+---------------------------------------------------------------------------------------------------------+
|                                        Video Stream Frame Ingestion                                     |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                Face Detection (e.g. RetinaFace) & Landmarking / Pose Filtering                        |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|               Face Alignment (Affine Warp) & Quality Filtering (Blur/Pose/Light)                       |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|             Biometric Feature Extraction (ArcFace) -> 512-dim Float32 Embedding                         |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|         High-Scale Vector Matching Engine (pgvector HNSW / Flat Index Matrix Search)                   |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|              Spatiotemporal Tracking & Multi-Camera Identity Correlation                               |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                Audit Ledger, Event Dispatcher & Encrypted Template Archive                              |
+---------------------------------------------------------------------------------------------------------+
```

---

### 17.1 Core Face Processing Pipeline

Processing faces in live enterprise streams follows a strict sequential pipeline where low-quality or non-frontal faces are filtered out early to prevent GPU/CPU waste and suppress false positives.

1. **Face Detection**: Dynamic detection using a multi-scale detector (e.g., RetinaFace or MTCNN) optimized via TensorRT, generating bounding boxes and 5 facial landmarks (left eye, right eye, nose tip, left mouth corner, right mouth corner).
2. **Face Alignment**: Mathematical alignment of facial landmarks using an affine transformation matrix, rotating and scaling the face to a standardized coordinate plane ($112 \times 112$ pixels).
3. **Quality Assessment**: Evaluation of the aligned face using physical checks (Laplacian variance for blur, pixel histograms for extreme exposure, and landmark distances for pitch, roll, and yaw angles).
4. **Embedding Extraction**: Generation of a deterministic, normalized 512-dimensional vector embedding using a deep metric learning model (e.g., ArcFace or CosFace).
5. **Embedding Search**: Parallel vector similarity searching across enrolled watchlists utilizing spatial-partitioned indexing.
6. **Temporal Tracking**: Associating subsequent faces in time to prevent re-matching on every frame.
7. **Event Output**: Publishing real-time events to the system event bus.

---

### 17.2 Specialized Biometric Interfaces

```typescript
export interface FacialLandmarks {
  leftEye: Point;
  rightEye: Point;
  nose: Point;
  mouthLeft: Point;
  mouthRight: Point;
}

export interface FaceQualityMetrics {
  sharpnessScore: number;     // 0.0 to 1.0 (Laplacian variance-based score)
  illuminationUniformity: number; // 0.0 to 1.0 (balanced brightness distribution)
  yawAngleDegrees: number;    // -90.0 to +90.0 (horizontal rotation)
  pitchAngleDegrees: number;  // -90.0 to +90.0 (vertical head tilt)
  rollAngleDegrees: number;   // -90.0 to +90.0 (lateral head tilt)
  isUsable: boolean;          // Evaluated against configured system quality thresholds
}

export interface DetectedFace {
  detectionId: string;
  boundingBox: BoundingBox;
  confidence: number;         // Detector probability score
  landmarks: FacialLandmarks;
  quality: FaceQualityMetrics;
}

export interface BiometricIdentity {
  subjectId: string;          // Cryptographically anonymous UUID matching enrolled DB
  watchlistId: string;
  fullName: string;
  metadata: Record<string, any>;
  version: number;            // Schema versioning for model upgrades
  createdAt: string;
}

export interface FaceMatch {
  identity: BiometricIdentity;
  similarityScore: number;    // Cosine similarity index [0.0 to 1.0]
}
```

#### 17.2.1 Detector and Quality Gate Interface (`IFacePipeline`)
```typescript
export interface FacePipelineConfig {
  detectionThreshold: number;
  minFaceSizePixels: number;
  maxYawAngle: number;        // e.g. 30 degrees limit for frontal check
  maxPitchAngle: number;      // e.g. 20 degrees limit
  minSharpness: number;       // e.g. 0.60 Laplacian threshold
  embeddingDistanceMetric: 'COSINE' | 'L2';
}

export interface IFacePipeline {
  detectFaces(frame: Uint8Array, width: number, height: number): Promise<DetectedFace[]>;
  alignAndCrop(frame: Uint8Array, width: number, height: number, face: DetectedFace): Promise<Uint8Array>;
  evaluateQuality(alignedFace: Uint8Array): Promise<FaceQualityMetrics>;
  extractEmbedding(alignedFace: Uint8Array): Promise<Float32Array>; // Output size: 512 floats
}
```

---

### 17.3 Scalable Face Database & Indexing Strategy

To handle databases scale of over 1,000,000 subjects with sub-50ms search latency, the Sentinel database architecture uses optimized vector-search indexing.

```
       +--------------------------------------------------------------+
       |                  Subject Enrollment Schema                   |
       |  - subject_id (UUID)      - encrypted_metadata (AES-256-GCM)  |
       +------------------------------+-------------------------------+
                                      | One-to-Many
                                      v
       +--------------------------------------------------------------+
       |                  Subject Biometric Vectors                   |
       |  - vector_id (UUID)       - face_embedding (vector(512))     |
       |  - model_signature (Text) - encrypted_face_crop (BLOB)       |
       +------------------------------+-------------------------------+
                                      | Indexed via HNSW Index
                                      v
       +--------------------------------------------------------------+
       |               High-Performance Search Engines                |
       |  - pgvector HNSW Index     - CUDA Linear Flat Scan Buffer     |
       +--------------------------------------------------------------+
```

#### 17.3.1 Relational Biometric Schema
Vector dimensions and distances are managed natively in our database layer. Enrolled records are partitioned by Watchlist definitions (`WHITELIST`, `BLACKLIST`, `WATCHLIST` custom classifications):

```sql
-- Schema Reference Definition
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE biometric_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_type VARCHAR(32) NOT NULL CHECK (watchlist_type IN ('WHITELIST', 'BLACKLIST', 'WATCHLIST_CUSTOM')),
  encrypted_name BYTEA NOT NULL, -- Encrypted AES-256-GCM
  encrypted_meta BYTEA,          -- Encrypted JSON metadata payload
  iv_salt BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE biometric_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES biometric_subjects(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL, -- 512-dimension vector from ArcFace
  model_signature VARCHAR(64) NOT NULL, -- e.g. "ArcFace_ResNet50_v2"
  encrypted_source_crop BYTEA, -- Encrypted reference face thumbnail
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- HNSW Vector Distance Indexing (Cosine-based search metric)
CREATE INDEX ON biometric_embeddings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

#### 17.3.2 Watchlist Index Search Strategy
Vector searches are triggered on quality-validated embeddings using a strict two-pass pruning strategy:
1. **Pass 1: Approximate Nearest Neighbor (ANN)**: Query executed using SQL matching `vector_cosine_ops` down to a broad neighborhood distance to retrieve candidate matches rapidly.
2. **Pass 2: Cosine Similarity and Confidence Score Assertions**: Candidate vectors are loaded into RAM where precise cosine similarities are calculated. Matches are accepted only if they clear the strict similarity confidence threshold (default: $0.75$, configurable per site/watchlist).

---

### 17.4 Spatiotemporal Cross-Camera Biometric Tracking

A primary challenge in face recognition systems is preventing redundant alerts (e.g. continuous matches from a person standing or walking past a camera) and maintaining persistent identity during brief exits.

```
                  +----------------------------------------------+
                  |         Active Stream Processing Thread      |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |           Face Spatial Tracker               |
                  |  - Frame-to-frame Hungarian IoU Mapping      |
                  +----------------------+-----------------------+
                                         |
                       Active Local Track Identified
                                         |
                    +--------------------+--------------------+
                    |                                         |
             First Seen Frame                            Track Active
                    v                                         v
      +-------------+-------------+             +-------------+-------------+
      |  Extract ArcFace Vector   |             |  Interpolate Position     |
      |  Trigger Vector Matching  |             |  Skip Core Embed Extraction|
      |  Map to Global Track ID   |             |  Audit Coordinate Path    |
      +---------------------------+             +---------------------------+
```

#### 17.4.1 Single-Camera Biometric Locking
- When a face is detected and tracked spatially via the Hungarian Algorithm (IoU coordinate association), the pipeline triggers the feature extractor model **once** on the first high-quality frontal frame.
- The resulting match or "Unknown Person" label is **biometrically locked** to that localized track identifier (`localFaceTrackId`).
- Subsequent frames containing the same tracked face do not trigger downstream face embedding extractions or vector database searches, reducing GPU utilization by up to $90\%$.

#### 17.4.2 Cross-Camera Biometric ReID & Track Recovery
- **Identity Re-Verification**: If a subject enters camera A's field of view, gets identified, exits, and enters camera B's field within a spatial transit duration (e.g. 5 minutes), the matching history is retrieved via a centralized redis cache index mapping active tracks.
- **Track Merging**: If high similarity is confirmed, the new trajectory is merged into the existing Global Track record (`globalTrackId`), preserving the continuity of the target's movement path across the facilities.

---

### 17.5 Strict Biometric Security & Cryptographic Protection

Physical security deployments require robust data protection to comply with biometric privacy standards (such as GDPR, CCPA, and BIPA).

1. **At-Rest AES-256 Envelope Encryption**:
   - Biometric vectors represent biometric signatures. However, raw cropped thumbnails and plaintext identification names (e.g. "John Doe") are **never** stored in plaintext.
   - Names, metadata, and cropped source thumbnails are encrypted with AES-256-GCM using keys rotated by the KMS (Key Management Service). The initialization vector (IV) is unique per row.
2. **Biometric Vector Isolation**:
   - Vector models are entirely mathematical coordinate weights. Reconstructing a recognizable human face image from a 512-dimension vector embedding is mathematically impossible. This design ensures that even a full database leak does not expose face likenesses.
3. **Anonymized Unknown Person Retention Policies**:
   - Unknown persons detected on site have temporary embeddings kept in volatile RAM/Redis caches for temporal tracking.
   - If no match occurs and the localized track ends, the unknown embedding is automatically deleted from volatile memory after 24 hours (unless flagged during investigation as a custom target of interest).

---

### 17.6 Biometric Event Bus Integration

The Face Recognition Engine publishes real-time states using standardized schemas to the central messaging system:

```typescript
export enum BiometricEventType {
  FACE_DETECTED = 'biometric.event.face_detected',
  FACE_RECOGNIZED = 'biometric.event.face_recognized',
  UNKNOWN_PERSON = 'biometric.event.unknown_person',
  WATCHLIST_MATCH = 'biometric.event.watchlist_match',
  BLACKLIST_MATCH = 'biometric.event.blacklist_match',
  WHITELIST_MATCH = 'biometric.event.whitelist_match',
  FACE_LOST = 'biometric.event.face_lost',
  RECOGNITION_FAILED = 'biometric.event.recognition_failed'
}

export interface BaseBiometricEventPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  correlationId: string;
}

export interface FaceRecognizedPayload extends BaseBiometricEventPayload {
  localTrackId: string;
  globalTrackId?: string;
  boundingBox: BoundingBox;
  subjectId: string;
  watchlistId: string;
  subjectName: string; // Decrypted at Gateway level for authorized roles only
  similarityScore: number;
}

export interface WatchlistMatchPayload extends BaseBiometricEventPayload {
  matchId: string;
  watchlistType: 'BLACKLIST' | 'WATCHLIST_CUSTOM';
  subjectId: string;
  subjectName: string;
  similarityScore: number;
  cameraId: string;
  associatedClipUri?: string;
  snapshotUri: string;
}
```

---

### 17.7 Key Architectural Decisions & Rationales

1. **Affine Landmark Alignment prior to Vector Extraction**:
   - *Decision*: Enforce affine face alignment based on standardized landmark coordinates before executing deep feature extraction.
   - *Rationale*: Face embedding networks are extremely sensitive to spatial rotation. A 15-degree head tilt or yaw rotation can degrade cosine similarity indices by over $30\%$, leading to false negative matches. Affine warp transformations mathematically align face poses, stabilizing features and boosting recognition accuracy across varying camera viewpoints.

2. **Laplacian Blur Pre-Filters (Quality Gate)**:
   - *Decision*: Reject aligned faces with Laplacian variance scores below $0.5$ prior to embedding extraction.
   - *Rationale*: Out-of-focus or motion-blurred face frames generate unstable feature vectors. If these vectors are compared against watchlists, they are highly prone to triggering false positives on similar facial structures. Filtering low-quality frames preserves accuracy and saves GPU processing cycles.

3. **Biometric Locking on Local Tracks**:
   - *Decision*: Lock the first matched biometric identity to its localized track, skipping embedding extraction on subsequent frames of the same track.
   - *Rationale*: Running ArcFace feature extraction on 30 frames per second for dozens of cameras is computationally intensive and redundant. Spatial tracking ensures target continuity, meaning only a single successful validation is required per track to secure identification.

4. **KMS-backed AES-256-GCM Envelope Encryption for Personally Identifiable Information (PII)**:
   - *Decision*: Protect names, reference crops, and metadata fields using table-row level envelope encryption.
   - *Rationale*: Satisfies strict international biometric compliance mandates (GDPR, BIPA). If physical database backups are compromised, the raw facial likenesses and matching names remain secure, preventing unauthorized identification.

---

---

## 18. Enterprise AI Video Analytics Engine Architecture

This section documents the high-scale, multi-purpose Video Analytics Engine of the Sentinel AI VMS. This module executes concurrent specialist analytics plugins (OCR, License Plate Recognition, Personal Protective Equipment, Fire & Smoke Detection, Crowd/Queue dynamics, and Object Lifecycle checks) over synchronized frame states, publishing structured event envelopes and calculating statistical report matrices.

```
+---------------------------------------------------------------------------------------------------------+
|                                    InferencePipeline Frame Decelerator                                  |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|               Multi-Plugin Router (Segmented Feature Maps & Cropped Sub-Regions)                        |
+----------------------------------------------------+----------------------------------------------------+
        |                      |                     |                        |                     |
        v                      v                     v                        v                     v
+---------------+      +---------------+      +--------------+        +---------------+      +------------+
|  OCR Engine   |      |  ALPR Engine  |      |  PPE Engine  |        | Fire / Smoke  |      | Crowd/Heat |
|  - Text-Loc   |      |  - Plate Det  |      |  - Helmet    |        |  - Volumetric |      |  - Density |
|  - CRNN Rec   |      |  - ResNet LPR |      |  - Vest      |        |  - Color/Temp |      |  - Queue   |
+---------------+      +---------------+      +--------------+        +---------------+      +------------+
        |                      |                     |                        |                     |
        +----------------------+---------------------+------------------------+---------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|              Confidence Evaluator & Dynamic False-Positive Suppressor Gate                             |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------+----------------------------------------------------+
|                    Event Bus & Relational Chronological Report Builder                                  |
+---------------------------------------------------------------------------------------------------------+
```

---

### 18.1 Comprehensive Analytics Plugin Architecture

To scale processing across thousands of channels without degrading stream performance, the engine wraps specialized deep models in an asynchronous, non-blocking plugin architecture.

#### 18.1.1 Configurable Engine Types & Classes
```typescript
export enum AnalyticsPluginType {
  OCR = 'ANALYTICS_OCR',
  LPR = 'ANALYTICS_LPR',
  PPE = 'ANALYTICS_PPE',
  FIRE_SMOKE = 'ANALYTICS_FIRE_SMOKE',
  CROWD_FLOW = 'ANALYTICS_CROWD_FLOW',
  OBJECT_LIFECYCLE = 'ANALYTICS_OBJECT_LIFECYCLE'
}

export enum PpeItemClass {
  HELMET = 'HELMET',
  SAFETY_VEST = 'SAFETY_VEST',
  MASK = 'MASK',
  GLOVES = 'GLOVES',
  SAFETY_SHOES = 'SAFETY_SHOES'
}

export enum ObjectLifecycleState {
  ABANDONED = 'ABANDONED',
  REMOVED = 'REMOVED',
  ILLEGAL_PARKING = 'ILLEGAL_PARKING'
}
```

---

### 18.2 Core Feature Modules

#### 18.2.1 Optical Character Recognition (OCR) Engine
The OCR plugin identifies printed alphanumeric sequences (such as shipping container codes, hazardous placard labels, or asset tags) in the camera field:
- **Text Detection**: Locates localized text boundaries using a DBNet (Real-time Scene Text Detection) model.
- **Text Recognition**: Extracts characters using a CRNN (Convolutional Recurrent Neural Network) + CTC Loss model.
- **Region Constraints**: Restricts searches to defined physical regions to conserve GPU memory.

#### 18.2.2 Automatic License Plate Recognition (ALPR / LPR) Engine
The LPR module locates and decodes vehicle plates:
- **Plate Detection**: Localizes license plates within a cropped vehicle bounding box.
- **Plate Recognition**: Performs character-level OCR parameterized by country-specific profile syntax (e.g. European Union star patterns, North American state characters, or Uzbekistan regional codes).
- **Vehicle Association**: Matches the plate's track identifier to its corresponding vehicle track to output unified vehicle-plate event payloads.

#### 18.2.3 Personal Protective Equipment (PPE) Engine
The PPE validator is a multi-head detection network checking safety compliance in hazardous industrial facilities:
- Detects subjects classified as `PERSON` from the primary object detector.
- Feeds person crop-regions into a localized high-resolution classification network to detect the presence or absence of compliance equipment: `HELMET`, `SAFETY_VEST`, `MASK`, `GLOVES`, and `SAFETY_SHOES`.
- Produces compliance logs containing absolute confidence grades and triggers immediate alarms on PPE violations.

#### 18.2.4 Fire & Smoke Detection Engine
A specialized volumetric analytics model optimized for early identification of flames and gaseous smoke:
- **Flashing/Motion Heat Evaluator**: Evaluates high-temperature pixel variations and high-contrast flickering patterns across a rolling frame buffer.
- **Volumetric Smoke Spread Tracker**: Analyzes expanding visual patterns that exhibit non-rigid, fluid-like movement.
- **False Alarm Suppression**: Rejects high-exposure light glare and steam exhausts by verifying temporal pattern persistence before publishing critical alerts.

#### 18.2.5 Crowd Flow, Queue & Heatmap Engine
- **Crowd Density & Counting**: Computes density matrices to evaluate occupancy and trigger alerts if a sector exceeds safe occupancy thresholds.
- **Queue Length Evaluator**: Evaluates stationary human structures inside configured checkout zones, calculating queue duration and average waiting times.
- **Dynamic Pixel Heatmap**: Maps coordinate dwelling points into a spatial grid to generate visual frequency heatmaps representing high-traffic sectors.

#### 18.2.6 Object Lifecycle Engine (Abandoned/Removed/Illegal Parking)
- **Abandoned Object Detection**: Triggers alerts if an static item (e.g., bag, box) is detached from a person and remains stationary in a zone for longer than a configured duration (e.g., 5 minutes).
- **Removed Object Detection**: Triggers alerts if a static high-value asset registered in a camera's geometric template disappears from its reference bounding coordinates.
- **Illegal Parking**: Triggers alerts if a vehicle stays inside a restricted fire lane polygon for longer than a specified dwell time (e.g., 60 seconds).

---

### 18.3 Dynamic Confidence Management & Gatekeepers

To prevent "alarm fatigue" in noisy outdoor environments, the engine implements a multi-tier confidence filter:

```typescript
export interface DynamicThresholds {
  classSpecificMin: Record<string, number>; // e.g. HELMET: 0.80, FIRE: 0.90, OCR: 0.70
  globalMin: number;                        // Low-bound cutoff (e.g. 0.45)
  lowLightPenaltyFactor: number;             // Adjusts threshold upwards in low-light/night scenes
}
```

- **Class-Specific Thresholds**: Vital safety alarms (such as `FIRE_DETECTED` or `PPE_VIOLATION`) require high threshold matching (e.g., $>0.85$) to filter out transient lighting noise, while low-severity counters can use relaxed thresholds (e.g., $>0.50$).
- **Dynamic Light Penalty**: Integrates light sensor feeds or camera exposure statistics to dynamically raise confidence requirements during night-time periods when sensor noise rises.

---

### 18.4 Analytics Event Bus Integration

The engine publishes analytics outcomes to the system-wide Event Broker using standardized, structured event payloads:

```typescript
export enum AnalyticsEventType {
  OCR_COMPLETED = 'analytics.event.ocr_completed',
  PLATE_RECOGNIZED = 'analytics.event.plate_recognized',
  FIRE_DETECTED = 'analytics.event.fire_detected',
  SMOKE_DETECTED = 'analytics.event.smoke_detected',
  PPE_VIOLATION = 'analytics.event.ppe_violation',
  CROWD_DETECTED = 'analytics.event.crowd_detected',
  QUEUE_DETECTED = 'analytics.event.queue_detected',
  HEATMAP_UPDATED = 'analytics.event.heatmap_updated',
  ANALYTICS_COMPLETED = 'analytics.event.analytics_completed'
}

export interface OcrCompletedPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  regionId?: string;
  detectedText: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface PlateRecognizedPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  plateText: string;
  confidence: number;
  countryProfile: string;
  vehicleTrackId?: string;
  boundingBox: BoundingBox;
}

export interface PpeViolationPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  subjectTrackId: string;
  missingItems: PpeItemClass[];
  confidence: number;
  boundingBox: BoundingBox;
}

export interface FireDetectedPayload {
  eventId: string;
  timestamp: string;
  cameraId: string;
  volumetricAreaRatio: number; // Ratio of screen size affected
  confidence: number;
  boundingBox: BoundingBox;
}
```

---

### 18.5 Enterprise Reporting & Statistical Trend Compilation

The results of the analytics plugins are structured into queryable database models to generate comprehensive operational reports:

```typescript
export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

export interface AnalyticsReport {
  reportId: string;
  cameraId: string;
  startTime: string;
  endTime: string;
  statistics: {
    totalVehiclesDetected: number;
    totalPeopleCount: number;
    ppeComplianceRate: number; // Percentage [0 - 100]
    averageQueueWaitSeconds: number;
    peakOccupancyCount: number;
  };
  trends: {
    occupancyTrend: TrendDataPoint[];
    trafficTrend: TrendDataPoint[];
    violationsTrend: TrendDataPoint[];
  };
}
```

---

### 18.6 Key Architectural Decisions & Rationales

1. **Cropped Region Sub-Inference**:
   - *Decision*: Execute LPR and PPE plugins exclusively on crop matrices generated by the primary vehicle/person detector, rather than running full-frame sub-inferencing.
   - *Rationale*: Running high-resolution text recognition or safety equipment checks across a full $4\text{K}$ video frame is computationally expensive and wastes GPU memory on empty background pixels. Cropping specific regions isolates inferences to target boundaries, improving accuracy and reducing processing times.

2. **Temporal Frame Deceleration for Non-Safety Plugins**:
   - *Decision*: Decelerate low-severity plugins (such as OCR, Heatmap, or Queue detection) to run at lower frame rates (e.g. 2-5 FPS) instead of standard stream frame rates.
   - *Rationale*: Operational analytics do not require millisecond-level responsiveness. Decelerating frames preserves GPU resources for critical tasks like spatial tracking and fire detection.

3. **Color-Texture Temporal Smoke Validation**:
   - *Decision*: Validate smoke alarms by checking both high-contrast color shifts and expanding texture boundaries across a 15-frame rolling buffer.
   - *Rationale*: Standard static object detectors frequently misclassify steam, dust, or high-exposure light glares as smoke. Analyzing structural expansion over time ensures high accuracy and reduces false alarms.

---

---







