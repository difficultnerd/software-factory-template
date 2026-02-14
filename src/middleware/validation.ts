/**
 * @file Request validation middleware factory
 * @purpose Provides a reusable middleware factory that validates incoming
 *          request bodies, query parameters, or route parameters against
 *          Zod schemas. Ensures all external input is validated before
 *          reaching route handlers (ASVS V5).
 * @inputs Zod schema and request data (body, query, or params)
 * @outputs Validated and typed data set on Hono context, or 400 error response
 * @invariants No route handler receives unvalidated external input.
 *             All validation errors return a consistent error format.
 *             No raw request.json() access in route handlers.
 * @spec N/A (bootstrap infrastructure)
 */

import { createMiddleware } from 'hono/factory';
import { type ZodSchema, type ZodError } from 'zod';
import { logger } from '../lib/logger.js';

/** Validated data stored in Hono context variables */
export interface ValidationVariables {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}

/**
 * Format Zod errors into a consistent, client-safe structure.
 * Does not expose internal schema details.
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

/**
 * Creates middleware that validates the request JSON body against a Zod schema.
 * Validated data is available via c.get('validatedBody') in route handlers.
 *
 * @example
 * app.post('/api/things', validateBody(CreateThingSchema), (c) => {
 *   const data = c.get('validatedBody') as CreateThing;
 *   // data is typed and validated
 * });
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return createMiddleware<{ Variables: ValidationVariables }>(async (c, next) => {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }

    const result = schema.safeParse(rawBody);

    if (!result.success) {
      let actor = 'unknown';
      try {
        actor = c.get('userId' as never) ?? 'unauthenticated';
      } catch {
        actor = 'unauthenticated';
      }

      logger.info({
        event: 'validation.body.failed',
        actor,
        outcome: 'failure',
        metadata: {
          path: c.req.path,
          method: c.req.method,
          errors: formatZodError(result.error),
        },
      });

      return c.json(
        {
          error: 'Validation failed',
          details: formatZodError(result.error),
        },
        400,
      );
    }

    c.set('validatedBody', result.data);
    await next();
  });
}

/**
 * Creates middleware that validates query parameters against a Zod schema.
 * Validated data is available via c.get('validatedQuery') in route handlers.
 *
 * @example
 * app.get('/api/things', validateQuery(ListQuerySchema), (c) => {
 *   const query = c.get('validatedQuery') as ListQuery;
 * });
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return createMiddleware<{ Variables: ValidationVariables }>(async (c, next) => {
    const rawQuery = c.req.query();
    const result = schema.safeParse(rawQuery);

    if (!result.success) {
      let actor = 'unknown';
      try {
        actor = c.get('userId' as never) ?? 'unauthenticated';
      } catch {
        actor = 'unauthenticated';
      }

      logger.info({
        event: 'validation.query.failed',
        actor,
        outcome: 'failure',
        metadata: {
          path: c.req.path,
          errors: formatZodError(result.error),
        },
      });

      return c.json(
        {
          error: 'Invalid query parameters',
          details: formatZodError(result.error),
        },
        400,
      );
    }

    c.set('validatedQuery', result.data);
    await next();
  });
}
