/**
 * @file Application entry point
 * @purpose Creates the Hono application with all middleware applied
 *          in the correct order. This is the Cloudflare Workers entry point.
 * @inputs HTTP requests via Cloudflare Workers
 * @outputs HTTP responses
 * @invariants Middleware order: errors (outermost) -> headers -> auth -> routes.
 *             Error middleware must be first to catch all downstream errors.
 *             Headers middleware must run on every response including errors.
 *             Auth middleware must run before any route handler.
 */

import { Hono } from 'hono';
import { errorMiddleware, headersMiddleware, authMiddleware } from './middleware/index.js';
import type { AuthEnv, AuthVariables } from './middleware/index.js';
import bookmarksIndex from './api/bookmarks/index.js';
import bookmarksById from './api/bookmarks/[id].js';
import bookmarksTags from './api/bookmarks/tags/index.js';

const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();

// Middleware order matters:
// 1. Error handler (outermost - catches everything)
// 2. Security headers (applied to all responses, including errors)
// 3. Authentication (verifies JWT before route handlers)
app.use('*', errorMiddleware);
app.use('*', headersMiddleware);
app.use('/api/*', authMiddleware);

// Health check (no auth required, outside /api/ path)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Bookmark routes
app.route('/api/bookmarks', bookmarksIndex);
app.route('/api/bookmarks', bookmarksById);
app.route('/api/bookmarks/tags', bookmarksTags);

export default app;
