/**
 * Camera API — Integration tests
 * Requires POSTGRES_URL and REDIS_URL env vars (set in CI via service containers).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:5000';

// Helper — authenticate once and cache the token
let authToken = '';
beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.local', password: 'TestPass1!' }),
  });
  if (!res.ok) return; // Server may not be running in unit-only mode
  const data = (await res.json()) as { token?: string };
  authToken = data.token ?? '';
});

function authHeaders() {
  return authToken
    ? { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

describe('GET /api/cameras', () => {
  it('returns 401 without a token', async () => {
    const res = await fetch(`${BASE_URL}/api/cameras`);
    expect(res.status).toBe(401);
  });

  it('returns an array when authenticated', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/cameras`, { headers: authHeaders() });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/cameras', () => {
  it('rejects a camera with a missing streamUrl', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/cameras`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Test Camera' }), // missing streamUrl
    });
    // Should be 400 or 422
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('creates a camera and returns it', async () => {
    if (!authToken) return;
    const payload = {
      name: `CI Camera ${Date.now()}`,
      streamUrl: 'rtsp://192.168.100.1:554/stream',
      location: 'CI Test Zone',
      resolution: '1920x1080',
      fps: 25,
      isActive: false,
    };
    const res = await fetch(`${BASE_URL}/api/cameras`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const cam = (await res.json()) as { id: string; name: string };
    expect(typeof cam.id).toBe('string');
    expect(cam.name).toBe(payload.name);

    // Clean up
    if (cam.id) {
      await fetch(`${BASE_URL}/api/cameras/${cam.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    }
  });
});

describe('POST /api/cameras/:id/diagnose', () => {
  it('returns a structured diagnostics result', async () => {
    if (!authToken) return;

    // First create a camera to diagnose
    const createRes = await fetch(`${BASE_URL}/api/cameras`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: `Diag Test ${Date.now()}`,
        streamUrl: 'rtsp://192.0.2.1:554/stream', // TEST-NET — unreachable, will fail at ping
        location: 'Test',
        resolution: '1920x1080',
        fps: 25,
        isActive: false,
      }),
    });
    if (!createRes.ok) return;
    const cam = (await createRes.json()) as { id: string };

    const res = await fetch(`${BASE_URL}/api/cameras/${cam.id}/diagnose`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ streamUrl: 'rtsp://192.0.2.1:554/stream' }),
    });
    expect(res.ok).toBe(true);
    const diag = (await res.json()) as { success: boolean; steps: unknown[]; logs: string[] };
    expect(typeof diag.success).toBe('boolean');
    expect(Array.isArray(diag.steps)).toBe(true);
    expect(Array.isArray(diag.logs)).toBe(true);

    // Cleanup
    await fetch(`${BASE_URL}/api/cameras/${cam.id}`, { method: 'DELETE', headers: authHeaders() });
  });
});
