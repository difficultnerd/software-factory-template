/**
 * @file Authentication middleware
 * @purpose Verifies Supabase JWT on every request. Rejects unauthenticated
 *          requests with 401. Injects authenticated user ID into Hono context
 *          for use by route handlers and Supabase RLS queries.
 * @inputs Authorization header (Bearer token) from incoming request
 * @outputs Sets 'userId' and 'supabaseClient' on Hono context variables
 * @invariants All routes except those under /api/auth/* require a valid JWT.
 *             No request reaches a route handler without verified authentication.
 * @spec N/A (bootstrap infrastructure)
 */

import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';

/**
 * Environment bindings expected by the auth middleware.
 * These are set via wrangler.toml (vars) or wrangler secret put (secrets).
 */
export interface AuthEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

/** Shape of context variables set by auth middleware */
export interface AuthVariables {
  userId: string;
}

/** Paths that do not require authentication */
const PUBLIC_PATH_PREFIX = '/api/auth';

/**
 * Authentication middleware for Hono.
 * Verifies the Supabase JWT from the Authorization header.
 * Public paths (under /api/auth/) bypass authentication.
 */
export const authMiddleware = createMiddleware<{
  Bindings: AuthEnv;
  Variables: AuthVariables;
}>(async (c, next) => {
  // Allow public auth routes through without verification
  if (c.req.path.startsWith(PUBLIC_PATH_PREFIX)) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({
      event: 'auth.missing_token',
      actor: 'anonymous',
      outcome: 'failure',
      metadata: { path: c.req.path, method: c.req.method },
    });
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  try {
    // Create a Supabase client with the user's JWT to verify it
    // and to scope all subsequent queries via RLS
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn({
        event: 'auth.invalid_token',
        actor: 'anonymous',
        outcome: 'failure',
        metadata: { path: c.req.path, method: c.req.method, error: error?.message },
      });
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Set verified user ID in context for route handlers
    c.set('userId', user.id);

    logger.info({
      event: 'auth.verified',
      actor: user.id,
      outcome: 'success',
      metadata: { path: c.req.path, method: c.req.method },
    });

    await next();
  } catch (err) {
    logger.error({
      event: 'auth.verification_error',
      actor: 'anonymous',
      outcome: 'failure',
      metadata: {
        path: c.req.path,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    return c.json({ error: 'Authentication failed' }, 401);
  }
});
