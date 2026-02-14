/**
 * @file Zod validation schemas for bookmark API
 * @purpose Provide type-safe validation for all bookmark-related requests and responses
 * @inputs API request bodies, query parameters, database records
 * @outputs Validated and typed data structures for bookmark operations
 * @invariants All external input validated before processing, URLs properly formatted, tags within limits
 * @spec SPEC-2026-12
 */

import { z } from 'zod';

// Core bookmark entity schema matching database structure
export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  url: z.string().url().max(2048),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable(),
  tags: z.array(z.string().max(50)).max(20).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable()
});

// Schema for creating new bookmarks (POST /api/bookmarks)
export const CreateBookmarkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional()
});

// Schema for updating existing bookmarks (PUT /api/bookmarks/{id})
export const UpdateBookmarkSchema = z.object({
  url: z.string().url().max(2048).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional()
});

// Schema for bookmark list query parameters (GET /api/bookmarks)
export const BookmarkQuerySchema = z.object({
  tag: z.string().max(50).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Schema for bookmark ID path parameter
export const BookmarkIdSchema = z.object({
  id: z.string().uuid()
});

// Response envelope schemas
export const BookmarkResponseSchema = z.object({
  data: BookmarkSchema
});

export const BookmarkListResponseSchema = z.object({
  data: z.array(BookmarkSchema),
  meta: z.object({
    cursor: z.string().optional(),
    hasMore: z.boolean()
  })
});

export const TagListResponseSchema = z.object({
  data: z.array(z.string())
});

// Error response schemas
export const ValidationErrorSchema = z.object({
  error: z.string(),
  details: z.record(z.array(z.string())).optional()
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional()
});

// TypeScript type exports
export type Bookmark = z.infer<typeof BookmarkSchema>;
export type CreateBookmarkRequest = z.infer<typeof CreateBookmarkSchema>;
export type UpdateBookmarkRequest = z.infer<typeof UpdateBookmarkSchema>;
export type BookmarkQuery = z.infer<typeof BookmarkQuerySchema>;
export type BookmarkResponse = z.infer<typeof BookmarkResponseSchema>;
export type BookmarkListResponse = z.infer<typeof BookmarkListResponseSchema>;
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;