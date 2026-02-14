/**
 * @file Health endpoint E2E test
 * @purpose Verify the deployed application is responding correctly.
 *          Runs against the live Cloudflare Workers deployment.
 * @spec N/A (infrastructure verification)
 */

import { test, expect } from '@playwright/test';

test.describe('Health Endpoint', () => {
  test('returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
