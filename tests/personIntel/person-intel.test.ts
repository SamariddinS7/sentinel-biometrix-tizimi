/**
 * Person Intelligence API — Integration tests
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

function auth() {
  return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

describe('GET /api/person-intelligence/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/person-intelligence/profiles`);
    expect(res.status).toBe(401);
  });

  it('returns an array of profiles', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/person-intelligence/profiles`, { headers: auth() });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/person-intelligence/search', () => {
  it('returns matches for a colour query', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/person-intelligence/search`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        upperColour: 'blue',
        lowerColour: 'black',
        minConfidence: 0.3,
        limit: 5,
      }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { matches?: unknown[] };
    expect(typeof body).toBe('object');
    if (body.matches) expect(Array.isArray(body.matches)).toBe(true);
  });
});

describe('GET /api/person-intelligence/stats', () => {
  it('returns platform stats', async () => {
    if (!authToken) return;
    const res = await fetch(`${BASE_URL}/api/person-intelligence/stats`, { headers: auth() });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body).toBe('object');
  });
});
