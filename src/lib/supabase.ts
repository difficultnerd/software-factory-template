/**
 * @file Supabase client utilities
 * @purpose Creates authenticated Supabase clients scoped to the request context
 * @inputs Request context with user authentication
 * @outputs Supabase client with RLS context for the authenticated user
 * @invariants Client always uses user JWT for RLS enforcement, never service role
 * @spec SPEC-2026-12
 */

import { createClient } from '@supabase/supabase-js';
import type { Context } from 'hono';
import type { AuthEnv, AuthVariables } from '../middleware/auth.js';

/**
 * Creates an authenticated Supabase client from the request context.
 * Uses the user's JWT for RLS enforcement.
 * Must be called from within an authenticated route handler.
 */
export function createAuthenticatedSupabaseClient(
  c: Context<{ Bindings: AuthEnv; Variables: AuthVariables }>,
) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    throw new Error('No authorization header found - client must be used in authenticated context');
  }

  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });
}
