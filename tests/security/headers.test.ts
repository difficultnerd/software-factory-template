/**
 * @file Security headers middleware tests
 * @purpose Verify that all required security headers are set on every response.
 *          Derived from ASVS V14 and Essential Eight application hardening controls.
 * @spec N/A (bootstrap security verification)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { headersMiddleware } from '../../src/middleware/headers.js';

function createTestApp() {
  const app = new Hono();
  app.use('*', headersMiddleware);
  app.get('/test', (c) => c.json({ ok: true }));
  app.get('/test-auth', (c) => {
    // Simulate an authenticated request by reading the header
    return c.json({ ok: true });
  });
  return app;
}

describe('Security Headers Middleware', () => {
  describe('ASVS V14: Security Headers', () => {
    it('sets Strict-Transport-Security header', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.headers.get('Strict-Transport-Security')).toBe(
        'max-age=63072000; includeSubDomains; preload',
      );
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets X-Frame-Options to DENY', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets Referrer-Policy', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Content-Security-Policy', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    });
  });

  describe('Essential Eight: Application Hardening', () => {
    it('sets Permissions-Policy restricting browser APIs', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      const pp = res.headers.get('Permissions-Policy');
      expect(pp).toBeTruthy();
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });
  });

  describe('ASVS V8: Cache Control for Authenticated Responses', () => {
    it('sets no-store cache control when Authorization header is present', async () => {
      const app = createTestApp();
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer test-token' },
      });
      expect(res.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
      expect(res.headers.get('Pragma')).toBe('no-cache');
    });

    it('does not set restrictive cache control for unauthenticated requests', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.headers.get('Cache-Control')).toBeNull();
    });
  });
});
