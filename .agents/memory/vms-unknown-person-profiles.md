---
name: VMS Unknown Person Profiles
description: How unknown/anonymous persons detected on camera get persistent profiles and sequential IDs.
---

# Rule
Any person detected on camera — known or unknown — must have a persistent profile. Unknown persons get permanent sequential IDs (UNK-0001, UNK-0002, …).

**Why:** "Profil topilmadi" appeared because: (1) fetchPerson returned the full API wrapper instead of extracting data.profile; (2) GET /api/persons/:id returned 404 for raw track IDs; (3) find-or-create used random TRK-XXXXXXXX IDs.

**How to apply:**
- Sequential counter in `.data/unk_counter.json` via `services/personIntel/UnknownPersonCounter.ts`
- `find-or-create` POST uses `getNextUnknownPersonId()` for unknowns (UNK-0001 format)
- `GET /api/persons/:id` auto-creates profile on 404 (tries fusionId → trackId fallback first)
- `fetchPerson()` in PersonFullProfile.tsx must extract `j?.data?.profile`
- `openProfile()` in PersonProfileContext calls find-or-create first; opens with canonical UNK-XXXX id
- UserManagement "Noma'lum shaxslar" tab shows ANONYMOUS profiles from GET /api/persons?status=ANONYMOUS
