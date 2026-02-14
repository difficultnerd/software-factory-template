/**
 * @file Auth enforcement E2E test
 * @purpose Verify that protected API routes reject unauthenticated requests
 *          on the live deployment. Confirms auth middleware is active.
 * @spec ASVS V2, V4
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Enforcement (Live Deployment)', () => {
  test('protected API routes return 401 without auth', async ({ request }) => {
    const response = await request.get('/api/test');
    expect(response.status()).toBe(401);
  });

  test('protected API routes return 401 with invalid bearer token', async ({ request }) => {
    const response = await request.get('/api/test', {
      headers: {
        Authorization: 'Bearer invalid-token-that-should-fail',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('error response does not leak internal details', async ({ request }) => {
    const response = await request.get('/api/test');
    const text = await response.text();
    expect(text).not.toContain('stack');
    expect(text).not.toContain('supabase');
    expect(text).not.toContain('.ts:');
  });
});
