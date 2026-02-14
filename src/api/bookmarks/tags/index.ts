/**
 * @file Bookmark tags endpoint
 * @purpose Handles GET /api/bookmarks/tags (list all user tags)
 * @inputs None (authenticated user context only)
 * @outputs Array of unique tags used by the user
 * @invariants All operations scoped to authenticated user via RLS
 * @spec SPEC-2026-12
 */

import { Hono } from 'hono';
import { createAuthenticatedSupabaseClient } from '../../../lib/supabase.js';
import { BookmarkService } from '../../../lib/bookmark-service.js';
import type { AuthEnv, AuthVariables } from '../../../middleware/auth.js';

const app = new Hono<{
  Bindings: AuthEnv;
  Variables: AuthVariables;
}>();

// GET /api/bookmarks/tags - List all unique tags for the authenticated user
app.get('/', async (c) => {
  const userId = c.get('userId');

  try {
    const supabase = createAuthenticatedSupabaseClient(c);
    const service = new BookmarkService(supabase, userId);

    const tags = await service.getUserTags();

    return c.json({ data: tags });
  } catch (_error) {
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

export default app;
