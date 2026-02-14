/**
 * @file Validation middleware tests
 * @purpose Verify that request validation middleware correctly rejects
 *          invalid input and passes validated data to route handlers.
 *          Derived from ASVS V5: all external input validated via Zod schemas.
 * @spec N/A (bootstrap security verification)
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody, validateQuery } from '../../src/middleware/validation.js';
import type { ValidationVariables } from '../../src/middleware/validation.js';

const TestBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
});

const TestQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

interface TestBodyResponse {
  received: { name: string; email?: string; age?: number; malicious?: string };
}

interface TestQueryResponse {
  query: { page?: string; limit?: string };
}

interface ErrorResponse {
  error: string;
  details?: Record<string, string[]>;
}

function createTestApp() {
  const app = new Hono<{ Variables: ValidationVariables }>();

  app.post('/api/test', validateBody(TestBodySchema), (c) => {
    const data = c.get('validatedBody');
    return c.json({ received: data });
  });

  app.get('/api/search', validateQuery(TestQuerySchema), (c) => {
    const query = c.get('validatedQuery');
    return c.json({ query });
  });

  return app;
}

describe('Validation Middleware', () => {
  describe('Body Validation (ASVS V5)', () => {
    it('passes valid body data to handler', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Thing' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TestBodyResponse;
      expect(body.received.name).toBe('Test Thing');
    });

    it('rejects empty name', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toBeTruthy();
    });

    it('rejects missing required fields', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('rejects name exceeding max length', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'a'.repeat(201) }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', email: 'not-an-email' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects non-JSON request body', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.error).toBe('Invalid JSON in request body');
    });

    it('strips unknown fields from validated data', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', malicious: '<script>alert(1)</script>' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TestBodyResponse;
      expect(body.received.malicious).toBeUndefined();
    });

    it('rejects negative age', async () => {
      const app = createTestApp();
      const res = await app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', age: -5 }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('Query Validation (ASVS V5)', () => {
    it('passes valid query parameters to handler', async () => {
      const app = createTestApp();
      const res = await app.request('/api/search?page=1&limit=10');

      expect(res.status).toBe(200);
      const body = (await res.json()) as TestQueryResponse;
      expect(body.query.page).toBe('1');
    });

    it('rejects non-numeric page parameter', async () => {
      const app = createTestApp();
      const res = await app.request('/api/search?page=abc');

      expect(res.status).toBe(400);
    });

    it('passes when optional query params are absent', async () => {
      const app = createTestApp();
      const res = await app.request('/api/search');

      expect(res.status).toBe(200);
    });
  });
});
