/**
 * @file Global error handler middleware
 * @purpose Catches all unhandled exceptions in route handlers.
 *          Logs structured error details server-side.
 *          Returns a generic error to the client with no internal details.
 *          Implements ASVS V7: no stack traces or sensitive data in responses.
 * @inputs Unhandled exceptions from downstream middleware and route handlers
 * @outputs Generic JSON error response (500) to client, structured log server-side
 * @invariants No stack trace, internal error message, or implementation detail
 *             is ever exposed to the client. All errors are logged with full
 *             detail server-side for debugging.
 * @spec N/A (bootstrap infrastructure)
 */

import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger.js';

/**
 * Global error handler middleware for Hono.
 * Must be registered before all route handlers so it can catch their errors.
 */
export const errorMiddleware = createMiddleware(async (c, next) => {
  try {
    await next();
  } catch (err) {
    // Extract useful info for logging without leaking to client
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Attempt to identify the authenticated user for the log entry
    let actor = 'unknown';
    try {
      actor = c.get('userId') ?? 'unauthenticated';
    } catch {
      actor = 'unauthenticated';
    }

    logger.error({
      event: 'server.unhandled_error',
      actor,
      outcome: 'failure',
      metadata: {
        path: c.req.path,
        method: c.req.method,
        error: errorMessage,
        stack: errorStack,
      },
    });

    // Return generic error to client (ASVS V7: no internal details)
    return c.json(
      {
        error: 'An internal error occurred',
      },
      500,
    );
  }
});
