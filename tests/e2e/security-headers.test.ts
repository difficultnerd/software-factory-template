/**
 * @file Security headers E2E test
 * @purpose Verify that security headers are present on live deployment.
 *          This validates that the headers middleware is running correctly
 *          in the Cloudflare Workers production environment, not just in tests.
 * @spec ASVS V14, Essential Eight application hardening
 */

import { test, expect } from '@playwright/test';

test.describe('Security Headers (Live Deployment)', () => {
  test('Strict-Transport-Security is set', async ({ request }) => {
    const response = await request.get('/health');
    const hsts = response.headers()['strict-transport-security'];
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
  });

  test('X-Content-Type-Options is nosniff', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options is DENY', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.headers()['x-frame-options']).toBe('DENY');
  });

  test('Content-Security-Policy is set', async ({ request }) => {
    const response = await request.get('/health');
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
  });

  test('Permissions-Policy restricts browser APIs', async ({ request }) => {
    const response = await request.get('/health');
    const pp = response.headers()['permissions-policy'];
    expect(pp).toBeTruthy();
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
  });

  test('Referrer-Policy is set', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
