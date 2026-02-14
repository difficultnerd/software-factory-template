/**
 * @file Bookmark service layer
 * @purpose Business logic for bookmark operations with database interactions
 * @inputs Validated bookmark data and query parameters
 * @outputs Database results and formatted responses
 * @invariants All queries scoped to authenticated user via RLS
 * @spec SPEC-2026-12
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateBookmark,
  UpdateBookmark,
  BookmarkQuery,
  Bookmark,
} from '../schemas/bookmark.js';
import { logger } from './logger.js';

export class BookmarkService {
  constructor(
    private supabase: SupabaseClient,
    private userId: string,
  ) {}

  async createBookmark(data: CreateBookmark): Promise<Bookmark> {
    const bookmarkData = {
      ...data,
      user_id: this.userId,
      tags: data.tags || null,
      description: data.description || null,
    };

    const { data: bookmark, error } = await this.supabase
      .from('bookmarks')
      .insert(bookmarkData)
      .select()
      .single();

    if (error) {
      logger.error({
        event: 'bookmark.create.failed',
        actor: this.userId,
        outcome: 'failure',
        metadata: { error: error.message },
      });
      throw new Error('Failed to create bookmark');
    }

    logger.info({
      event: 'bookmark.created',
      actor: this.userId,
      resource: bookmark.id,
      outcome: 'success',
      metadata: { url: '[url]', title: bookmark.title },
    });

    return bookmark;
  }

  async listBookmarks(
    query: BookmarkQuery,
  ): Promise<{ bookmarks: Bookmark[]; hasMore: boolean; cursor?: string }> {
    let supabaseQuery = this.supabase
      .from('bookmarks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply tag filter if provided
    if (query.tag) {
      supabaseQuery = supabaseQuery.contains('tags', [query.tag]);
    }

    // Apply cursor-based pagination
    const limit = query.limit || 20;
    if (query.cursor) {
      const { data: cursorBookmark } = await this.supabase
        .from('bookmarks')
        .select('created_at')
        .eq('id', query.cursor)
        .single();

      if (cursorBookmark) {
        supabaseQuery = supabaseQuery.lt('created_at', cursorBookmark.created_at);
      }
    }

    // Fetch limit + 1 to check if there are more results
    const { data: bookmarks, error } = await supabaseQuery.limit(limit + 1);

    if (error) {
      logger.error({
        event: 'bookmark.list.failed',
        actor: this.userId,
        outcome: 'failure',
        metadata: { error: error.message, tag: query.tag },
      });
      throw new Error('Failed to fetch bookmarks');
    }

    const hasMore = bookmarks.length > limit;
    const resultBookmarks = hasMore ? bookmarks.slice(0, limit) : bookmarks;
    const cursor =
      hasMore && resultBookmarks.length > 0
        ? resultBookmarks[resultBookmarks.length - 1].id
        : undefined;

    logger.info({
      event: 'bookmark.listed',
      actor: this.userId,
      outcome: 'success',
      metadata: { count: resultBookmarks.length, hasMore, tag: query.tag },
    });

    return {
      bookmarks: resultBookmarks,
      hasMore,
      cursor,
    };
  }

  async getBookmarkById(id: string): Promise<Bookmark | null> {
    const { data: bookmark, error } = await this.supabase
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error({
        event: 'bookmark.get.failed',
        actor: this.userId,
        resource: id,
        outcome: 'failure',
        metadata: { error: error.message },
      });
      throw new Error('Failed to fetch bookmark');
    }

    logger.info({
      event: 'bookmark.retrieved',
      actor: this.userId,
      resource: id,
      outcome: 'success',
      metadata: {},
    });

    return bookmark;
  }

  async updateBookmark(id: string, data: UpdateBookmark): Promise<Bookmark | null> {
    const updateData = {
      ...data,
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.description !== undefined && { description: data.description }),
    };

    const { data: bookmark, error } = await this.supabase
      .from('bookmarks')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error({
        event: 'bookmark.update.failed',
        actor: this.userId,
        resource: id,
        outcome: 'failure',
        metadata: { error: error.message },
      });
      throw new Error('Failed to update bookmark');
    }

    logger.info({
      event: 'bookmark.updated',
      actor: this.userId,
      resource: id,
      outcome: 'success',
      metadata: { title: bookmark.title },
    });

    return bookmark;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('bookmarks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      logger.error({
        event: 'bookmark.delete.failed',
        actor: this.userId,
        resource: id,
        outcome: 'failure',
        metadata: { error: error.message },
      });
      throw new Error('Failed to delete bookmark');
    }

    logger.info({
      event: 'bookmark.deleted',
      actor: this.userId,
      resource: id,
      outcome: 'success',
      metadata: {},
    });

    return true;
  }

  async getUserTags(): Promise<string[]> {
    const { data: bookmarks, error } = await this.supabase
      .from('bookmarks')
      .select('tags')
      .is('deleted_at', null)
      .not('tags', 'is', null);

    if (error) {
      logger.error({
        event: 'bookmark.tags.failed',
        actor: this.userId,
        outcome: 'failure',
        metadata: { error: error.message },
      });
      throw new Error('Failed to fetch tags');
    }

    // Flatten and deduplicate tags
    const allTags = bookmarks
      .flatMap((bookmark) => bookmark.tags || [])
      .filter((tag, index, array) => array.indexOf(tag) === index)
      .sort();

    logger.info({
      event: 'bookmark.tags.listed',
      actor: this.userId,
      outcome: 'success',
      metadata: { count: allTags.length },
    });

    return allTags;
  }
}
