# AI-BOS Konsolidatsiya Audit Hisoboti

**Sana:** 2026-07-18  
**Maqsad:** Ikki parallel backend (Node/Express va Python) ni audit qilish, frontend qaysi backend bilan ishlashini aniqlash, va Python backendni arxivlash.

---

## 1. Umumiy holat

Loyihada ikkita mustaqil backend mavjud edi:

| Backend | Texnologiya | Fayl joyi |
|---|---|---|
| **Node/Express** | TypeScript, tsx runtime | `server.ts` (root) |
| **Python** | Python (InsightFace, NumPy) | `backend/` (endi `archive/python-backend/`) |

**Asosiy xulosa:** Frontend faqat Node backend bilan ishlaydi. Python backend hech qachon ishga tushirilmagan va Node server tomonidan chaqirilmagan.

---

## 2. Frontend qaysi backend bilan gaplashadi?

**Javob: Faqat Node/Express backend (`server.ts`).**

Frontend barcha API chaqiruvlarida **nisbiy URL** (`/api/...`) ishlatadi — `localhost:8000` yoki `localhost:5001` kabi to'g'ridan-to'g'ri Python manzil yo'q.

Frontend tomonidan chaqiriladigan endpointlar:

| Endpoint | Backend |
|---|---|
| `/api/auth/login`, `/api/auth/register` | Node ✅ |
| `/api/cameras`, `/api/cameras/:id` | Node ✅ |
| `/api/incidents`, `/api/security/alerts` | Node ✅ |
| `/api/analytics/events`, `/api/analytics/statistics` | Node ✅ |
| `/api/search/appearance`, `/api/search/natural-language` | Node ✅ |
| `/api/soc/reports/generate`, `/api/sites` | Node ✅ |
| `/api/system/health`, `/api/evidence/:ref` | Node ✅ |

---

## 3. Node backend — real vs mock/stub

### ✅ REAL (haqiqiy mantiq)

| Endpoint / Servis | Tavsif |
|---|---|
| `POST /api/auth/login` | Firebase Auth orqali haqiqiy autentifikatsiya |
| `GET/POST /api/cameras` | Firestore da kamera CRUD |
| `POST /api/cameras/:id/ptz` | PTZ boshqaruv (VMS servis) |
| `GET /api/cameras/:id/snapshot` | Snapshot manager |
| `GET /api/analytics/events` | Analytics Platform — 8 ta plugin |
| `GET /api/analytics/heatmap/:cameraId` | Heatmap plugin |
| `POST /api/security/alerts/:id/resolve` | Alarm Engine |
| `GET /api/persons/:id/timeline` | Person Intel Platform |
| `POST /api/incidents` | Incident Management |
| `GET /health/live`, `GET /metrics` | Prometheus metrics, health probes |
| `GET /api/search/appearance` | FAISS + HSV ko'rinish qidirish |
| `GET /api/evidence/:ref` | Evidence Manager |

### ⚠️ MOCK / SIMULYATSIYA

| Endpoint | Muammo |
|---|---|
| `POST /api/ai/analyze-video` | Haqiqiy GPU/model chaqiruvlarsiz generatsiya qilingan javob |
| `POST /api/ai/analyze-image` | Simulyatsiya — tashqi model chaqirilmaydi |
| `POST /api/ai/chat` | Qisman real (Gemini), qisman stub |
| `POST /api/ai/commission` (HazardDetector) | Faqat xavf simulyatsiyasi uchun |

---

## 4. Python backend — real vs mock/stub

### ✅ REAL (ishlab chiqarishga tayyor mantiq)

| Modul | Tavsif |
|---|---|
| `face_recognition/recognition_service.py` | InsightFace bilan yuz tanish pipeline |
| `face_recognition/detection_service.py` | Yuz aniqlash va embedding |
| `face_recognition/tracker.py` | ByteTrack + Kalman filtri (identifikatsiyani saqlash) |
| `digital_twin/frustum_engine.py` | Kamera FOV frustrumini 3D hisoblash |
| `digital_twin/ray_casting_engine.py` | 3D→2D proyeksiya (NumPy) |
| `digital_twin/coordinate_mapper.py` | Piksel→zamin koordinatalariga aylantirish |
| `face_recognition/heatmap/heatmap_service.py` | Stateful yo'nalish kuzatish |
| `face_recognition/heatmap/spatial_grid.py` | Katta maydon uchun spatial grid optimizatsiyasi |
| `security/zone_geometry.py` | Murakkab polygon kesishish testlari |

### ⚠️ MOCK / STUB (to'liq amalga oshirilmagan)

| Fayl | Muammo |
|---|---|
| `face_recognition/attendance/reporting.py` | Bo'sh `pass` metodlar |
| `face_recognition/security/privacy_engine.py` | Maskalash rutinalari skeleti |
| Manual override hooks (`AttendanceService`) | Oddiy placeholder'lar |

---

## 5. Node backendida yo'q Python biznes-mantig'i

Quyidagi funksiyalar Python backendda mavjud, lekin Node backendida hali yo'q va keyingi bosqichlarda ko'chirilishi kerak:

| Funksiya | Python fayli | Muhimlik |
|---|---|---|
| **Kalman filtri** (identifikatsiyani okklyuziyada saqlash) | `tracker.py` | 🔴 Yuqori |
| **3D→2D proyeksiya** (kamera matritsalari bilan) | `ray_casting_engine.py`, `camera_projection.py` | 🔴 Yuqori |
| **Spatial Grid** (katta maydonda heatmap optimizatsiyasi) | `spatial_grid.py` | 🟡 O'rta |
| **Polygon kesishish** (zona kirish ogohlantirishlari) | `zone_geometry.py` | 🟡 O'rta |
| **Davomiylik/Qatnashish (Attendance) reporting** | `attendance/reporting.py` | 🟢 Past (stub) |
| **Privacy/PII maskalash** | `privacy_engine.py` | 🟡 O'rta |

> **Tavsiya:** Kalman filtri va 3D proyeksiya mantig'i TypeScript/Node ga ko'chirilishi kerak (3D digital twin ishlashi uchun). Spatial grid va polygon mantiq keyingi bosqichlarda.

---

## 6. Arxivlash: nima ko'chirildi

| Harakat | Tafsilot |
|---|---|
| **Ko'chirildi** | `backend/` → `archive/python-backend/` |
| **O'chirildi** | `backend/` (root) |
| **Yo'qotildi** | Hech narsa — barcha fayllar `archive/python-backend/` da saqlanmoqda |

### Arxivlangan fayllar ro'yxati

```
archive/python-backend/
├── area_map/
│   ├── coordinate_mapper.py
│   ├── coverage_engine.py
│   └── zone_manager.py
├── digital_twin/
│   ├── camera_math.py
│   ├── camera_projection.py
│   ├── extrusion_engine.py
│   ├── frustum_engine.py
│   ├── models.py
│   ├── person_3d_mapper.py
│   ├── position_smoother.py
│   ├── ray_casting_engine.py
│   └── zone_extrusion_engine.py
├── face_recognition/
│   ├── alerting/         (alert_engine.py, webhook_dispatcher.py)
│   ├── attendance/       (models.py, reporting.py, rules.py)
│   ├── heatmap/          (heatmap_service.py, spatial_grid.py)
│   ├── security/         (crypto.py, privacy_engine.py)
│   ├── snapshot/         (snapshot_processor.py, snapshot_service.py)
│   └── [18 ta Python fayl: recognition, detection, embedding, tracking...]
└── security/
    ├── zone_engine.py
    ├── zone_geometry.py
    ├── zone_manager.py
    └── zone_policy.py
```

---

## 7. Keyingi bosqichlar (tavsiya etilgan tartibda)

| # | Vazifa | Prompt |
|---|---|---|
| 1 | Monorepo tuzilishiga o'tish (`apps/web`, `apps/api`) | Prompt 2 |
| 2 | JWT + RBAC butun ilova bo'ylab majburiy qilish | Prompt 3 |
| 3 | PostgreSQL + Prisma ORM ga o'tish | Prompt 4 |
| 4 | AIOrchestrator markazlashtirish | Prompt 5 |
| 5 | Biznes modullari (Finance birinchi) | Prompt 6 |

---

*Bu fayl har safar kod o'zgarganda yangilanishi kerak. Oxirgi yangilanish: 2026-07-18.*
