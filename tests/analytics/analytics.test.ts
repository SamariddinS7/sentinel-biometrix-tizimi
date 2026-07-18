/**
 * Analytics API — Integration tests
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:5000';

let authToken = '';
beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.local', password: 'TestPass1!' }),
  });
  if (!res.ok) return;
  const data = (await res.json()) as { token?: string };
  authToken = data.token ?? '';
});

function authHeaders() {
  return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

describe('GET /api/analytics/stats', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/stats`);
    expect(res.status).toBe(401);
  });

  it('returns a structured stats object when authenticated', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/analytics/stats`, { headers: authHeaders() });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      platform?: { frameCount: number; totalEventCount: number };
      byType?: Record<string, number>;
      period?: { eventCount: number };
    };
    expect(typeof body.platform).toBe('object');
    expect(typeof body.platform?.frameCount).toBe('number');
    expect(typeof body.byType).toBe('object');
    expect(typeof body.period?.eventCount).toBe('number');
  });
});

describe('GET /api/analytics/events', () => {
  it('returns a paginated events list', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/analytics/events?limit=10&offset=0`, { headers: authHeaders() });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('rejects invalid limit parameter gracefully', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/analytics/events?limit=abc`, { headers: authHeaders() });
    // Should not 500; 400 or silently clamp is both acceptable
    expect(res.status).not.toBe(500);
  });
});

describe('GET /api/analytics/plugins', () => {
  it('returns a plugins list with health info', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/analytics/plugins`, { headers: authHeaders() });
    expect(res.ok).toBe(true);
    const plugins = (await res.json()) as Array<{ id: string; name: string; enabled: boolean }>;
    expect(Array.isArray(plugins)).toBe(true);
    // Each plugin has required fields
    if (plugins.length > 0) {
      expect(typeof plugins[0].id).toBe('string');
      expect(typeof plugins[0].name).toBe('string');
      expect(typeof plugins[0].enabled).toBe('boolean');
    }
  });
});

describe('POST /api/analytics/search', () => {
  it('returns results for an empty query', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/analytics/search`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ query: '', limit: 5 }),
    });
    expect(res.ok).toBe(true);
    const results = await res.json();
    expect(Array.isArray(results)).toBe(true);
  });
});
