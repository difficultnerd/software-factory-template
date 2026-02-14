/**
 * @file Bookmark collection endpoints
 * @purpose Handles POST /api/bookmarks (create) and GET /api/bookmarks (list)
 * @inputs Create bookmark requests and list query parameters
 * @outputs Created bookmarks and paginated bookmark lists
 * @invariants All operations scoped to authenticated user via RLS
 * @spec SPEC-2026-12
 */

import { Hono } from 'hono';
import { validateBody, validateQuery } from '../../middleware/validation.js';
import { createAuthenticatedSupabaseClient } from '../../lib/supabase.js';
import { BookmarkService } from '../../lib/bookmark-service.js';
import {
  CreateBookmarkSchema,
  BookmarkQuerySchema,
  type CreateBookmark,
  type BookmarkQuery,
} from '../../schemas/bookmark.js';
import type { AuthEnv, AuthVariables } from '../../middleware/auth.js';
import type { ValidationVariables } from '../../middleware/validation.js';

const app = new Hono<{
  Bindings: AuthEnv;
  Variables: AuthVariables & ValidationVariables;
}>();

// POST /api/bookmarks - Create a new bookmark
app.post('/', validateBody(CreateBookmarkSchema), async (c) => {
  const data = c.get('validatedBody') as CreateBookmark;
  const userId = c.get('userId');

  const supabase = createAuthenticatedSupabaseClient(c);
  const service = new BookmarkService(supabase, userId);

  try {
    const bookmark = await service.createBookmark(data);
    return c.json({ data: bookmark }, 201);
  } catch {
    return c.json({ error: 'Failed to create bookmark' }, 500);
  }
});

// GET /api/bookmarks - List bookmarks with optional filtering and pagination
app.get('/', validateQuery(BookmarkQuerySchema), async (c) => {
  const query = c.get('validatedQuery') as BookmarkQuery;
  const userId = c.get('userId');

  const supabase = createAuthenticatedSupabaseClient(c);
  const service = new BookmarkService(supabase, userId);

  try {
    const result = await service.listBookmarks(query);
    return c.json({
      data: result.bookmarks,
      meta: {
        cursor: result.cursor,
        hasMore: result.hasMore,
      },
    });
  } catch {
    return c.json({ error: 'Failed to fetch bookmarks' }, 500);
  }
});

export default app;
