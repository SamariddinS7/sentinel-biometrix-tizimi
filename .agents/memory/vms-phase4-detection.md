---
name: VMS Phase 4 — Person Detection & Tracking Engine
description: Architecture decisions, invariants, and model placement for the Phase 4 ONNX detection + ByteTrack system.
---

# VMS Phase 4 — Person Detection & Tracking Engine

## Core Invariant
Every person detection MUST originate from `PersonDetectorPlugin` (YOLOv8n ONNX). `detectMotionBlobs()` was removed. No fake data, no random confidence, no simulated tracks. The orchestrator is the ONLY legal entry point.

## Model
- **File:** `models/weights/yolov8n.onnx` (auto-downloaded at startup; may need manual placement in sandbox)
- **URL:** `https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx`
- **Input:** `[1, 3, 640, 640]` NCHW float32, letterboxed, normalised 0–1
- **Output:** `output0` `[1, 84, 8400]` — rows 0–3 bbox (cx/cy/w/h in 640-px), row 4 = class 0 (person) score
- **Sandbox download limitation:** GitHub CDN redirect may 404 in Replit sandbox; model must be placed manually

**Why:** YOLOv8n chosen over RT-DETR (8-10× heavier CPU) and NanoDet (15% accuracy gap). Class 0 = person in COCO. `onnxruntime-node` v1.21.x MIT, no native build required.

## Coordinate normalisation
Detections are normalised relative to the original frame (not the 640×640 letterboxed space):
- `effW = S - 2*padX`, `effH = S - 2*padY`  
- `x_norm = (cx_640 - padX) / effW`, `y_norm = (cy_640 - padY) / effH`

**Why:** Downstream Firestore records and WS clients expect [0,1] relative to the source frame, not the padded ONNX input.

## ByteTrack stages
- Stage 1: high-conf detections (≥0.5) vs ALL active tracks, IoU gate ≥0.5
- Stage 2 (BYTE): low-conf detections (0.1–0.5) vs UNMATCHED tracks only, IoU gate ≥0.35
- New tentative tracks created only from unmatched HIGH-confidence detections

**Why:** BYTE stage is the key innovation — low-conf detections during occlusion keep tracks alive without starting spurious new ones.

## Track lifecycle
- Tentative for first 3 frames (`CONFIRM_FRAMES = 3`)
- Confirmed on frame 3+
- Ended after 30 consecutive missed frames (`MAX_LOST_FRAMES = 30`)
- `PersonDetected` event emitted on first confirm; `PersonLost` on ended (if was confirmed)

## Kalman filter
- Per-component scalar Kalman: 2-state (position + velocity), measurement noise `r=1.0`, process noise `q=0.008`
- 4 Kalman instances per track: xMin, yMin, w, h
- `predict()` increments `missedFrames`; `update()` resets it to 0

## VmsAiEventType gap
The enum in `DetectionTrackingEngine.ts` lacks `TRACK_UPDATED`. Use string literal `'ai.event.track_updated'` directly in `PersonTrackingEngine.ts`.

## Module structure
```
services/ai/
  plugins/PersonDetectorPlugin.ts   — ONNX inference only
  PersonTrackingEngine.ts           — ScalarKalman, KalmanBoxTracker, KalmanByteTracker, PersonTrackingEngine singleton
  PersonDetectionOrchestrator.ts    — Wiring singleton, public API, performance metrics
```

## Server routes added (all under authenticateToken)
- `GET /api/ai/persons/current?cameraId=`
- `GET /api/ai/persons/history?cameraId=&limit=`
- `GET /api/ai/tracks/active?cameraId=`
- `GET /api/ai/tracks/history?cameraId=&limit=`
- `GET /api/ai/stats?cameraId=`
- `GET /api/ai/stats/live`
- `GET /api/ai/health`
- `GET /api/ai/performance`
- `POST /api/ai/engine/reload` (ADMIN only)
