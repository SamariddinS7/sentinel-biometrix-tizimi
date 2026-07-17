---
name: VMS Identity Intelligence Gap Fixes
description: What was done to close the gaps in the Enterprise Identity Intelligence Platform (Prompt 5 spec).
---

# VMS Identity Intelligence Gap Fixes

## What was done

### 1. YOLOv8n ONNX model (person detection restored)
- GitHub release URLs all 404 for onnx — fixed by installing `ultralytics` + `onnx` pip packages and exporting `yolov8n.pt` → `models/weights/yolov8n.onnx` (12.2 MB).
- `PersonDetectorPlugin.ts` provider names updated from `CPUExecutionProvider` → `cpu` (onnxruntime-node v1.27+ uses lowercase names).
- Model now loads on CPU:0 at startup.

### 2. FAISS vector search
- Installed `faiss-cpu` pip package.
- Rewrote `backend/face_recognition/embedding_store.py`: keeps encrypted Fernet JSON storage for persistence, builds `faiss.IndexFlatIP` in memory on load, uses FAISS for search when >50 embeddings (numpy linear scan below that).
- Rewrote `backend/face_recognition/matcher.py`: added `match_with_store()` (FAISS path) and `match_top_k()` helper alongside original `match_one_to_many()`.

### 3. Real HSV colour-based appearance extraction
- Both `IdentityFusionEngine.ts::extractAppearanceAttributes` and `AppearanceIntelligenceEngine.ts::extractAppearanceFeatures` previously used hash-based deterministic stubs (fake colours from embedding index math).
- Replaced with real HSV colour histogram analysis: samples ~196 pixels from upper-body (10-50% of box height) and lower-body (50-90%) regions of the decoded RGB frame.
- `fuseObservation()` signature extended with optional `frameBuffer`, `frameWidth`, `frameHeight`.
- `InferencePipeline.ts` now passes the decoded RGB frame buffer through to `fuseObservation`.
- When no frame data is available, falls back to `'Unknown'` labels (never fake random values).

### 4. Search API routes (server.ts)
New routes added:
- `GET  /api/search/identities` — list fused identities with ?status=&role=&limit= filters
- `GET  /api/search/identity/:id` — single identity detail
- `POST /api/search/appearance` — filter by upperColor, lowerColor, backpack, helmet, vest, umbrella, suitcase, bodySize
- `POST /api/search/natural-language` — free-text search; Gemini parses to structured query when API key set, keyword fallback otherwise
- `GET  /api/search/appearance-profiles` — all AppearanceIntelligenceEngine profiles (ADMIN/SUPERVISOR)
- `POST /api/identities/merge` — manual identity merge (ADMIN)
Imports for `identityFusionEngine` and `appearanceIntelligenceEngine` added to server.ts.

### 5. Vite file watcher fix
- Installed Python packages (ultralytics, faiss-cpu, torch, onnx) fill `.pythonlibs/` with thousands of files → Vite hit the kernel inotify limit (ENOSPC).
- Fixed by adding `watch.ignored` to `vite.config.ts` excluding `.pythonlibs/**`, `node_modules/**`, `models/**`, `.git/**`.

## Key constraints / gotchas
**Why:** onnxruntime-node v1.27 dropped the old `CUDAExecutionProvider`/`CPUExecutionProvider` names; use lowercase `'cpu'`/`'cuda'` instead.
**How to apply:** Any new ONNX plugin that specifies execution providers must use lowercase names.

**Why:** ultralytics needs `onnx` pip package installed separately for ONNX export; the export also requires opencv-python-headless (not opencv-python) to avoid libxcb GUI dependency.
**How to apply:** When re-exporting or updating the model: `pip install ultralytics onnx opencv-python-headless` first.

**Why:** The FAISS IndexFlatIP gives cosine similarity for L2-normalized vectors (inner product = cosine when norms = 1). InsightFace embeddings are already L2-normalized.
**How to apply:** Always L2-normalize query vectors before calling `index.search()`.
