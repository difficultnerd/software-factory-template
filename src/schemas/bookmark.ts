/**
 * @file Bookmark validation schemas
 * @purpose Zod schemas for validating bookmark API requests and responses
 * @inputs Raw request bodies, query parameters, and database records
 * @outputs Typed and validated bookmark data
 * @invariants All external input validated, URL format checked, array constraints enforced
 * @spec SPEC-2026-12
 */

import { z } from 'zod';

// Core bookmark entity schema
export const BookmarkSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  url: z.string().url().max(2048),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable(),
  tags: z.array(z.string().max(50)).max(20).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

// Schema for creating bookmarks (POST requests)
export const CreateBookmarkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Schema for updating bookmarks (PUT requests)
export const UpdateBookmarkSchema = z.object({
  url: z.string().url().max(2048).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Schema for query parameters (GET requests)
export const BookmarkQuerySchema = z.object({
  tag: z.string().max(50).optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 100)
    .optional(),
});

// Schema for route parameters
export const BookmarkParamsSchema = z.object({
  id: z.string().uuid(),
});

// Response envelope schemas
export const BookmarkResponseSchema = z.object({
  data: BookmarkSchema,
});

export const BookmarkListResponseSchema = z.object({
  data: z.array(BookmarkSchema),
  meta: z.object({
    cursor: z.string().uuid().optional(),
    hasMore: z.boolean(),
  }),
});

export const TagListResponseSchema = z.object({
  data: z.array(z.string()),
});

// Inferred types for use in handlers
export type Bookmark = z.infer<typeof BookmarkSchema>;
export type CreateBookmark = z.infer<typeof CreateBookmarkSchema>;
export type UpdateBookmark = z.infer<typeof UpdateBookmarkSchema>;
export type BookmarkQuery = z.infer<typeof BookmarkQuerySchema>;
export type BookmarkParams = z.infer<typeof BookmarkParamsSchema>;
