/**
 * @file Error handling middleware tests
 * @purpose Verify that unhandled errors never leak internal details to clients.
 *          Derived from ASVS V7: no stack traces or sensitive data in error responses.
 * @spec N/A (bootstrap security verification)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { errorMiddleware } from '../../src/middleware/errors.js';

function createTestApp() {
  const app = new Hono();
  app.use('*', errorMiddleware);

  // Route that throws a normal error with sensitive info
  app.get('/throw-error', () => {
    throw new Error('Secret database connection string: postgres://admin:password@db.internal');
  });

  // Route that throws a non-Error object
  app.get('/throw-string', () => {
    throw 'something went wrong';
  });

  // Route that works normally
  app.get('/ok', (c) => c.json({ status: 'ok' }));

  return app;
}

describe('Error Handling Middleware', () => {
  describe('ASVS V7: No Internal Details in Error Responses', () => {
    it('returns 500 status for unhandled exceptions', async () => {
      const app = createTestApp();
      const res = await app.request('/throw-error');
      expect(res.status).toBe(500);
    });

    it('does not leak error messages to client', async () => {
      const app = createTestApp();
      const res = await app.request('/throw-error');
      const text = await res.text();
      expect(text).not.toContain('database');
      expect(text).not.toContain('password');
      expect(text).not.toContain('postgres');
    });

    it('does not leak stack traces to client', async () => {
      const app = createTestApp();
      const res = await app.request('/throw-error');
      const text = await res.text();
      expect(text).not.toContain('at ');
      expect(text).not.toContain('.ts:');
      expect(text).not.toContain('.js:');
    });

    it('handles non-Error thrown objects', async () => {
      const app = createTestApp();
      const res = await app.request('/throw-string');
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).not.toContain('something went wrong');
    });
  });

  describe('Normal Operation', () => {
    it('passes through successful responses unchanged', async () => {
      const app = createTestApp();
      const res = await app.request('/ok');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
    });
  });
});
