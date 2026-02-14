/**
 * @file Individual bookmark endpoints
 * @purpose Handles GET/PUT/DELETE /api/bookmarks/:id
 * @inputs Bookmark ID parameter and update data
 * @outputs Individual bookmark details, updated bookmarks, or deletion confirmation
 * @invariants All operations scoped to authenticated user via RLS
 * @spec SPEC-2026-12
 */

import { Hono } from 'hono';
import { validateBody } from '../../middleware/validation.js';
import { createAuthenticatedSupabaseClient } from '../../lib/supabase.js';
import { BookmarkService } from '../../lib/bookmark-service.js';
import {
  UpdateBookmarkSchema,
  BookmarkParamsSchema,
  type UpdateBookmark,
} from '../../schemas/bookmark.js';
import type { AuthEnv, AuthVariables } from '../../middleware/auth.js';
import type { ValidationVariables } from '../../middleware/validation.js';

const app = new Hono<{
  Bindings: AuthEnv;
  Variables: AuthVariables & ValidationVariables;
}>();

// Helper to validate and extract ID parameter
function validateId(id: string): string {
  const result = BookmarkParamsSchema.safeParse({ id });
  if (!result.success) {
    throw new Error('Invalid ID format');
  }
  return result.data.id;
}

// GET /api/bookmarks/:id - Get a specific bookmark
app.get('/:id', async (c) => {
  const userId = c.get('userId');

  try {
    const id = validateId(c.req.param('id'));

    const supabase = createAuthenticatedSupabaseClient(c);
    const service = new BookmarkService(supabase, userId);

    const bookmark = await service.getBookmarkById(id);

    if (!bookmark) {
      return c.json({ error: 'Bookmark not found' }, 404);
    }

    return c.json({ data: bookmark });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid ID format') {
      return c.json({ error: 'Invalid bookmark ID' }, 400);
    }
    return c.json({ error: 'Failed to fetch bookmark' }, 500);
  }
});

// PUT /api/bookmarks/:id - Update a specific bookmark
app.put('/:id', validateBody(UpdateBookmarkSchema), async (c) => {
  const data = c.get('validatedBody') as UpdateBookmark;
  const userId = c.get('userId');

  try {
    const id = validateId(c.req.param('id'));

    const supabase = createAuthenticatedSupabaseClient(c);
    const service = new BookmarkService(supabase, userId);

    const bookmark = await service.updateBookmark(id, data);

    if (!bookmark) {
      return c.json({ error: 'Bookmark not found' }, 404);
    }

    return c.json({ data: bookmark });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid ID format') {
      return c.json({ error: 'Invalid bookmark ID' }, 400);
    }
    return c.json({ error: 'Failed to update bookmark' }, 500);
  }
});

// DELETE /api/bookmarks/:id - Soft delete a specific bookmark
app.delete('/:id', async (c) => {
  const userId = c.get('userId');

  try {
    const id = validateId(c.req.param('id'));

    const supabase = createAuthenticatedSupabaseClient(c);
    const service = new BookmarkService(supabase, userId);

    await service.deleteBookmark(id);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid ID format') {
      return c.json({ error: 'Invalid bookmark ID' }, 400);
    }
    return c.json({ error: 'Failed to delete bookmark' }, 500);
  }
});

export default app;
