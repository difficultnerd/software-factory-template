/**
 * @file Authentication middleware tests
 * @purpose Verify that authentication middleware correctly rejects
 *          unauthenticated requests and allows public auth routes through.
 * @spec N/A (bootstrap security verification)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth.js';
import type { AuthEnv, AuthVariables } from '../../src/middleware/auth.js';

function createTestApp() {
  const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();

  app.use('/api/*', authMiddleware);

  app.get('/api/protected', (c) => {
    return c.json({ userId: c.get('userId') });
  });

  app.get('/api/auth/login', (c) => {
    return c.json({ status: 'login page' });
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}

describe('Authentication Middleware', () => {
  describe('Unauthenticated Rejection', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const app = createTestApp();
      const res = await app.request('/api/protected', {}, {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key',
      } as unknown as AuthEnv);

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Authentication required');
    });

    it('returns 401 when Authorization header has wrong format', async () => {
      const app = createTestApp();
      const res = await app.request(
        '/api/protected',
        {
          headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        },
        {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
        } as unknown as AuthEnv,
      );

      expect(res.status).toBe(401);
    });

    it('returns 401 when Bearer token is empty', async () => {
      const app = createTestApp();
      const res = await app.request(
        '/api/protected',
        {
          headers: { Authorization: 'Bearer ' },
        },
        {
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
        } as unknown as AuthEnv,
      );

      expect(res.status).toBe(401);
    });
  });

  describe('Public Path Bypass', () => {
    it('allows /api/auth/* routes without authentication', async () => {
      const app = createTestApp();
      const res = await app.request('/api/auth/login');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('login page');
    });
  });

  describe('Non-API Routes', () => {
    it('does not require auth for non-API routes', async () => {
      const app = createTestApp();
      const res = await app.request('/health');

      expect(res.status).toBe(200);
    });
  });
});
