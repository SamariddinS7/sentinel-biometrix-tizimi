# Enterprise AI Video Management System (AI VMS)
## Core AI Pipeline & Biometric Tracking: Production Design Specification

---

## Executive Summary

This document specifies the end-to-end design of the **Sentinel Biometric AI Analytics Pipeline** for the Enterprise AI Video Management System (AI VMS). This system is designed for high-concurrency, real-time video analytics running across hundreds of cameras simultaneously, leveraging a zero-trust model, zero-copy memory arrays, and hardware-accelerated processing. 

The pipeline strictly processes frames sequentially across 12 distinct logical steps, enforcing complete decoupling of the deep-learning engines from the application database, Auth layer, and secrets. It operates on a full-body-first policy: **a person is always detected and tracked continuously even when the face is invisible or occluded**. Facial recognition is treated as an optional multi-stage biometric upgrade executed exclusively when lighting, orientation, and image quality constraints are satisfied.

---

```
                                      SENTINEL BIOMETRIC PIPELINE
                                     +---------------------------+
                                     |  Ingested Camera Stream   |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 1. Person Detection (YOLO)|
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 2. Person Tracking (Byte) |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 3. Person Re-ID (ReID)    |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 4. Face Visibility Check  |
                                     +-------------+-------------+
                                                   |
                     +-----------------------------+-----------------------------+
                     | (Face Visible)                                            | (Face NOT Visible)
                     v                                                           v
       +-------------+-------------+                               +-------------+-------------+
       | 5. Face Detection         |                               | Keep Local Tracking &     |
       +-------------+-------------+                               | Cross-Camera ReID Active  |
                     |                                             +---------------------------+
                     v
       +-------------+-------------+
       | 6. Face Alignment         |
       +-------------+-------------+
                     |
                     v
       +-------------+-------------+
       | 7. Face Quality Check     |
       +-------------+-------------+
                     |
                     v
       +-------------+-------------+
       | 8. Face Embedding         |
       +-------------+-------------+
                     |
                     v
       +-------------+-------------+
       | 9. Face Recognition       |
       +-------------+-------------+
                     |
                     +-----------------------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 10. Person Profile Update |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 11. Movement History Log  |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +-------------+-------------+
                                     | 12. Central Event Engine  |
                                     +---------------------------+
```

---

## 1. Complete AI Pipeline Design (12-Stage In-Memory Processing Flow)

The system-wide `InferencePipeline` consumes raw video buffers from a zero-copy ring memory buffer and distributes them sequentially through the following 12 stages without skipping or altering order:

### Stage 1: Person Detection (YOLO)
* **Objective**: Bounding box localization of every human body within the coordinate space $(x_{min}, y_{min}, x_{max}, y_{max})$.
* **Operational Tolerance**: Must operate with high recall under extreme conditions (e.g., frontal/side/back profile angles, sitting, crawling, walking, partial occlusions under $70\%$, night vision/IR spectrums).
* **Processing Pattern**:
  1. The pre-allocated image buffer ($1920 \times 1080$ RGB) is downscaled using GPU bilinear filtering to $640 \times 640$ or $1280 \times 1280$ depending on the camera profile.
  2. Normalize float-point tensors: $x_{norm} = \frac{x_{raw}}{255.0}$.
  3. Propagate forward through the optimized YOLO/RT-DETR engine via TensorRT/CUDA context.
  4. Perform Non-Maximum Suppression (NMS) with $IoU \ge 0.45$ and confidence filter threshold $T_{conf} \ge 0.25$.

### Stage 2: Person Tracking (ByteTrack)
* **Objective**: Temporal track assignment across contiguous frames using spatial IoU association.
* **Mechanism**: Bypasses typical tracking failures where low-score bounding boxes (caused by illumination drop or partial occlusion) are prematurely discarded. 
  1. Split detections into high-score ($D_{high}$, confidence $> 0.5$) and low-score ($D_{low}$, $0.1 \le \text{confidence} \le 0.5$) subsets.
  2. Match $D_{high}$ with active/lost trajectories using Kalman Filter motion predictions.
  3. Match unmatched trajectories with low-score detections $D_{low}$ to recover occluded targets.
  4. Manage active states: `TRACK_STARTED`, `TRACKING`, `TRACK_LOST`, `TRACK_ENDED`.

### Stage 3: Person Re-Identification (ReID)
* **Objective**: Re-identify the tracked person across temporary complete dropouts or multiple non-overlapping camera fields of view.
* **Mechanism**: 
  1. Crop the full-body bounding box coordinates directly from the raw preprocessed frame.
  2. Pass through a ResNet50-based feature extractor to produce a robust 512-dimensional floating-point appearance template vector ($V_{reid}$).
  3. Compute Cosine distance against active and recently lost tracks across the camera pool:
     $$\text{Similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$
  4. If similarity $\ge 0.70$, assign the pre-existing global identifier ($G_{id}$), preventing duplicate tracking profiles.

### Stage 4: Face Visibility Analysis
* **Objective**: Evaluate whether the cropped human body contains a visible, recognizable frontal or profile face.
* **Mechanism**: 
  1. Analyze skeletal keypoint indices (specifically looking for facial landmarkers: eyes, ears, nose) or perform coarse segmentation.
  2. Classify orientation state: `NO_FACE`, `BACK_OF_HEAD`, `PROFILE_FACE`, `PARTIAL_FACE`, `FRONTAL_FACE`.
  3. **Conditional Branching**: If state is `NO_FACE` or `BACK_OF_HEAD`, terminate face-level processing immediately. Jump directly to **Stage 10 (Person Profile Update)** to register spatial tracking updates under the active $G_{id}$. If face is visible, transition to **Stage 5**.

### Stage 5: Face Detection (RetinaFace / MTCNN)
* **Objective**: Isolate precise facial bounding boxes within the body crop.
* **Mechanism**: Executes specialized sub-bounding box regression. Locates high-fidelity landmarks (left eye, right eye, nose, left mouth corner, right mouth corner). Tolerates partial masks, glasses, helmets, and caps.

### Stage 6: Face Alignment (Affine Transform)
* **Objective**: Re-align skewed, tilted, or non-frontal faces into a normalized 2D facial template.
* **Mechanism**: Calculates a 2D affine transformation matrix mapping the 5 detected landmarker coordinates to canonical standard face coordinates ($112 \times 112$ pixel grid). This stabilizes yaw, pitch, and roll variations.

### Stage 7: Face Quality Assessment (Biometric Gate)
* **Objective**: Enforce strict biometric quality standards before wasting compute on templates.
* **Metrics**:
  - **Sharpness**: Laplacian variance threshold ($Var(L) \ge 0.60$).
  - **Illumination Uniformity**: Histogram entropy balance checks.
  - **Pose Deviation**: Roll/Pitch/Yaw bounds (Yaw angle $\le 30^\circ$, Pitch angle $\le 20^\circ$).
  - **Resolution**: Minimum crop width of $64 \times 64$ raw pixels.
* **Biometric Gate Outcome**: If quality checks fail, the face is marked unusable ($isUsable = false$). The pipeline skips to **Stage 10**.

### Stage 8: Face Embedding (ArcFace)
* **Objective**: Mathematical extraction of a highly discriminative face biometric vector.
* **Mechanism**: Feeds the $112 \times 112$ aligned crop to the ArcFace Deep CNN. Outputs a 512-dimension unit-length float array ($V_{face}$, $\|V_{face}\| = 1.0$).

### Stage 9: Face Recognition (Biometric Match)
* **Objective**: Resolve face identity against enrolled database subjects.
* **Mechanism**: Performs 512-dimensional vector indexing over the `SecureFaceDatabase` using inner-product cosine similarity.
  - $\text{Score} \ge 0.85$: Matches resolved subject ($S_{id}$), classifying category (`WHITELIST`, `BLACKLIST`, `WATCHLIST_CUSTOM`).
  - $0.70 \le \text{Score} < 0.85$: Log as "Low Confidence Candidate", trigger audit log.
  - $\text{Score} < 0.70$: Classified as `UNKNOWN_PERSON`.

### Stage 10: Person Profile Update (Consolidation)
* **Objective**: Aggregate raw inference telemetry to the persistent global profile under a unified identity.
* **Mechanism**: Appends the latest detections, face templates (if generated), ReID vectors, and camera metadata to the unified profile. Does not overwrite historic assets.

### Stage 11: Movement History Log (Spatial Auditing)
* **Objective**: Build a temporal chain of presence for safety auditing.
* **Mechanism**: Commits camera coordinates, zone intersections (using Ray-Casting checks), dwell times, floor numbers, and transit paths to the database.

### Stage 12: Event Engine (System Bus Dispatch)
* **Objective**: Real-time broadcast of standardized system messages.
* **Mechanism**: Formulates structured JSON payloads and dispatches them via `vmsEventService`. This feeds UI consoles, logs, and triggers the Digital Twin viewport.

---

## 2. Person Lifecycle Design

A person within the Sentinel system transitions across five states, managing identity resolution:

```
    [ Detection ] ──> UNIDENTIFIED ───────────( ReID Match / Face Match )
                           │                               │
                           │ (No Match Resolved)           v
                           v                          IDENTIFIED
                     UNKNOWN_PERSON                        │
                           │                               │ (Enrolled in SecDB)
                           v                               v
                        [ LOST ] <──────────────────── ENROLLED
```

### Lifecycle States:
1. **UNIDENTIFIED**: Subject detected by YOLO and tracked locally. ReID and Face templates have not yet been evaluated.
2. **UNKNOWN_PERSON**: Evaluated via ReID and Face engines but returned similarity below the recognition thresholds ($<0.70$). Tracked as a persistent unique anonymous visitor.
3. **IDENTIFIED**: Associated with an existing tracking profile via spatial ReID centroids or face similarity, mapping cross-camera journeys.
4. **ENROLLED**: Subject is fully resolved to a known database profile (with real name, watchlist type, and structural metadata) from the secure partitions.
5. **LOST**: Active camera stream tracking terminated. Cached for a specific temporal retention time before transition to archive.

---

## 3. Tracking Lifecycle Design (ByteTrack-SORT States)

Local camera tracking manages track longevity, handling occlusion and crowd densities:

```
    [ YOLO Box ] ──> TRACK_STARTED ──────> TRACKING ──────> TRACK_LOST ──( Timeout )──> TRACK_ENDED
                           ^                │                  │
                           │                v                  │
                           +────────────────+──────────────────+ (Low-Score Match / IoU Recovery)
```

1. **TRACK_STARTED**: Initial state assigned when a high-confidence YOLO detection cannot be associated with any existing active track via IoU.
2. **TRACKING**: State assigned on subsequent frames when the track is successfully mapped to sequential bounding boxes (IoU $\ge 0.45$).
3. **TRACK_LOST**: Assigned immediately when a track loses detection support. This track enters a temporal cache where Kalman Filter estimations continue to approximate coordinates. Low-score detections (e.g., $0.15 \le C < 0.35$) are prioritized to rescue these trajectories, preventing ID swapping under heavy occlusion.
4. **TRACK_ENDED**: Transitioned if the track remains in `TRACK_LOST` state for more than $N$ contiguous frames (default: 45 frames at 30 FPS, i.e., 1.5 seconds) or leaves the physical boundary coordinates.

---

## 4. Face Lifecycle Design

A detected face traverses five strict operational pipeline states:

```
     [ Face Crop ] ──> DETECTED ──> ALIGNED ──> ASSESSED ──> VECTORIZED ──> RECOGNIZED / UNKNOWN
```

1. **DETECTED**: Facial bounding box regression completed; 5 landmarks localized.
2. **ALIGNED**: 2D affine scaling matrices computed and applied to normalize facial skew/tilt.
3. **ASSESSED**: Quality analysis gate executed. If checks for sharpness ($Var(L) \ge 0.60$) and tilt are passed, marked as usable. Otherwise, terminated.
4. **VECTORIZED**: arcFace-v2 512-dimension unit vector generated.
5. **RECOGNIZED / UNKNOWN**: Vector search completed against database records.

---

## 5. Biometric Recognition Workflow & Mathematical Integrity

To prevent false alarms and hardcoded simulator logic, face recognition is strictly calculated using linear algebraic distance metrics.

### Cosine Similarity Matrix:
For an unknown query vector $q \in \mathbb{R}^{512}$ and an enrolled vector $e \in \mathbb{R}^{512}$:
$$\text{Sim}(q, e) = \frac{\sum_{i=1}^{512} q_i e_i}{\sqrt{\sum_{i=1}^{512} q_i^2} \sqrt{\sum_{i=1}^{512} e_i^2}}$$

### Operational Parameters:
| Parameter | Value | Definition / Operational Impact |
| :--- | :--- | :--- |
| **Biometric Threshold** | $\ge 0.85$ | Strict gate for known profile matching. Prevents false positive alarms. |
| **Audit Gate Threshold** | $0.70 \le \text{Score} < 0.85$ | Triggers weak match alerts, alerting security to review the candidate. |
| **Unknown Threshold** | $< 0.70$ | Rejects association, classifying the target as an Anonymous Visitor. |
| **ReID Distance Bound** | $\ge 0.70$ | Full-body visual ReID template association threshold. |

---

## 6. Profile Updates Design (Data Schema & Persistence)

Profiles are unified records storing tracking, biometric, and event telemetry. They are updated dynamically using appending arrays to maintain complete audited histories.

### Data Schema Representation:
```typescript
interface PersonProfile {
  profileId: string;           // Cryptographically anonymous unique ID
  globalTrackId: string;       // Dynamic global link
  watchlistType: 'WHITELIST' | 'BLACKLIST' | 'WATCHLIST_CUSTOM' | 'ANONYMOUS';
  
  // Biometric Templates
  enrolledFaceEmbeddings: Array<{
    vectorId: string;
    embedding: number[];       // 512 Floats
    capturedAt: string;
    qualityScore: number;
  }>;
  
  // Appearance Features
  reIdCentroidEmbedding: number[]; // 512 Floats (centroid of historic body appearance vectors)
  
  // Audit-Log telemetry
  historyCount: number;
  lastSeenCameraId: string;
  lastSeenTimestamp: string;
}
```
* **Decoupling Constraint**: Biometric models do not make active queries to storage databases. Pointers are handed to the central `PostProcessor`, which manages Firestore write queues.

---

## 7. Movement History Design & Spatial Analytics

Movement tracking is calculated mathematically using polygon bounds intersection:

### Spatial Zone Containment:
We apply the **Ray-Casting Containment Algorithm** (Even-Odd rule) to check if a tracked person's centroid point $(p_x, p_y)$ falls within a zone polygon $Z$:
$$\text{Containment}(P, Z) = \left( \sum_{i=0}^{N-1} \text{Intersect}(P, Z_i, Z_{i+1}) \right) \bmod 2 \neq 0$$

```typescript
export interface MovementSegment {
  cameraId: string;
  zoneId: string;
  buildingId: string;
  floor: number;
  trackId: string;
  enteredAt: number;           // epoch milliseconds
  exitedAt: number;            // epoch milliseconds
  dwellTimeSeconds: number;
}
```

---

## 8. API Integration Design

API endpoints reside strictly in the server layer, proxying credentials and isolating the browser from raw biometric arrays.

### Proposed Endpoints:
* `POST /api/ai/pipeline/frame`: Receives frame buffers, dispatches to `InferencePipeline`.
* `GET /api/ai/profiles`: Fetches aggregated user tracking lists (anonymized names unless authenticated).
* `POST /api/ai/enroll`: Securely registers a new biometric template to the encrypted partitioning layer.
* `GET /api/ai/pipeline/health`: Exposes latency, VRAM footprint, and hardware drop metrics.

---

## 9. Event Integration Design (System Event Payloads)

All pipeline transitions emit structured events to `vmsEventService`. 

### Canonical Event Payload Contracts:

#### 1. PersonDetected (Stage 1 / 2)
```json
{
  "eventId": "evt_person_99421_1720743600",
  "timestamp": "2026-07-12T05:40:00.000Z",
  "cameraId": "cam_east_entrance",
  "correlationId": "track_482",
  "payload": {
    "trackId": "cam_east_entrance_track_482",
    "confidence": 0.94,
    "boundingBox": { "xMin": 0.12, "yMin": 0.23, "xMax": 0.34, "yMax": 0.89 },
    "motionVector": { "dx": 0.02, "dy": -0.01 }
  }
}
```

#### 2. FaceRecognized (Stage 9)
```json
{
  "eventId": "evt_face_rec_22340_1720743601",
  "timestamp": "2026-07-12T05:40:01.120Z",
  "cameraId": "cam_east_entrance",
  "correlationId": "track_482",
  "payload": {
    "subjectId": "usr_uuid_8842104-ff21",
    "name": "Jane Doe",
    "watchlistType": "WHITELIST",
    "similarityScore": 0.923,
    "boundingBox": { "xMin": 0.20, "yMin": 0.25, "xMax": 0.28, "yMax": 0.32 }
  }
}
```

---

## 10. Testing Strategy Design

The testing harness executes quantitative regression tests across each operational module, strictly rejecting synthetic mock generators:

### Validation Matrix & Success KPIs:
1. **YOLO Detection Accuracy**: Must evaluate standard mAP (Mean Average Precision). Bounding boxes must overlap labeled test grounds with $IoU \ge 0.50$.
2. **ByteTrack ID Longevity**: Measure Multiple Object Tracking Accuracy (MOTA) and ID Switches (IDSW).
3. **Biometric Similarity Variance**: Run tests over identical faces under varying tilts. Cosine similarity must remain within a $\pm 0.04$ confidence deviation.
4. **Hardware Latency Benchmarking**: Enforces strict performance budgets under high camera ingestion loads:

```
  Stream Ingest (30 FPS) ──> Preprocessing (<= 5ms) ──> Detection (<= 15ms) ──> Embedding (<= 25ms)
```

---

### Prepared and Signed by:
*Lead AI Architect, Sentinel VMS Core Platform*
