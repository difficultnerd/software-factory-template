/**
 * @file Contract tests for bookmark API endpoints
 * @purpose Verify API behavior matches specification without seeing implementation
 * @inputs Bookmark schemas and API contract specifications
 * @outputs Test verification of all functional requirements
 * @invariants Tests validate spec compliance, not implementation behavior
 * @spec SPEC-2026-12
 */

import { describe, it, expect } from 'vitest';
import { 
  BookmarkSchema,
  CreateBookmarkSchema,
  UpdateBookmarkSchema,
  BookmarkQuerySchema,
  BookmarkResponseSchema,
  BookmarkListResponseSchema,
  TagListResponseSchema
} from '../../src/schemas/bookmark';

describe('FR-001: Create bookmark', () => {
  it('should validate create bookmark request schema', () => {
    // Given: Valid bookmark data
    const validBookmark = {
      url: 'https://example.com',
      title: 'Example Site',
      description: 'A test bookmark',
      tags: ['web', 'example']
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(validBookmark);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validBookmark);
    }
  });

  it('should reject invalid URL format', () => {
    // Given: Invalid URL
    const invalidBookmark = {
      url: 'not-a-url',
      title: 'Test'
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(invalidBookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject URL exceeding 2048 characters', () => {
    // Given: URL exceeding limit
    const longUrl = 'https://example.com/' + 'x'.repeat(2048);
    const bookmark = {
      url: longUrl,
      title: 'Test'
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 500 characters', () => {
    // Given: Title exceeding limit
    const bookmark = {
      url: 'https://example.com',
      title: 'x'.repeat(501)
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    // Given: Empty title
    const bookmark = {
      url: 'https://example.com',
      title: ''
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject more than 20 tags', () => {
    // Given: Too many tags
    const bookmark = {
      url: 'https://example.com',
      title: 'Test',
      tags: Array.from({ length: 21 }, (_, i) => `tag${i}`)
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject tags longer than 50 characters', () => {
    // Given: Tag exceeding limit
    const bookmark = {
      url: 'https://example.com',
      title: 'Test',
      tags: ['x'.repeat(51)]
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should accept bookmark without optional fields', () => {
    // Given: Minimal valid bookmark
    const bookmark = {
      url: 'https://example.com',
      title: 'Test'
    };

    // When: Validating against schema
    const result = CreateBookmarkSchema.safeParse(bookmark);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });
});

describe('FR-002: List all bookmarks', () => {
  it('should validate bookmark list response schema', () => {
    // Given: Valid bookmark list response
    const response = {
      data: [{
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        url: 'https://example.com',
        title: 'Example',
        description: 'Test bookmark',
        tags: ['web'],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null
      }],
      meta: {
        cursor: 'cursor123',
        hasMore: true
      }
    };

    // When: Validating against schema
    const result = BookmarkListResponseSchema.safeParse(response);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });

  it('should validate query parameters', () => {
    // Given: Valid query parameters
    const query = {
      cursor: 'abc123',
      limit: 10
    };

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it('should apply default limit when not provided', () => {
    // Given: Query without limit
    const query = {};

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Should apply default limit
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('should reject limit exceeding 100', () => {
    // Given: Limit exceeding maximum
    const query = { limit: 101 };

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject limit below 1', () => {
    // Given: Invalid limit
    const query = { limit: 0 };

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });
});

describe('FR-003: Filter bookmarks by tag', () => {
  it('should validate tag filter parameter', () => {
    // Given: Valid tag filter
    const query = { tag: 'web' };

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tag).toBe('web');
    }
  });

  it('should reject tag longer than 50 characters', () => {
    // Given: Tag exceeding limit
    const query = { tag: 'x'.repeat(51) };

    // When: Validating against schema
    const result = BookmarkQuerySchema.safeParse(query);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });
});

describe('FR-004: Get single bookmark', () => {
  it('should validate single bookmark response schema', () => {
    // Given: Valid bookmark response
    const response = {
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        url: 'https://example.com',
        title: 'Example',
        description: null,
        tags: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null
      }
    };

    // When: Validating against schema
    const result = BookmarkResponseSchema.safeParse(response);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });

  it('should validate UUID format for bookmark ID', () => {
    // Given: Invalid UUID
    const invalidId = 'not-a-uuid';

    // When: Validating UUID
    const result = BookmarkSchema.shape.id.safeParse(invalidId);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });
});

describe('FR-005: Update bookmark', () => {
  it('should validate update bookmark request schema', () => {
    // Given: Valid update data
    const updateData = {
      title: 'Updated Title',
      description: 'Updated description',
      tags: ['updated', 'test']
    };

    // When: Validating against schema
    const result = UpdateBookmarkSchema.safeParse(updateData);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });

  it('should accept partial updates', () => {
    // Given: Partial update data
    const updateData = { title: 'New Title' };

    // When: Validating against schema
    const result = UpdateBookmarkSchema.safeParse(updateData);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL in update', () => {
    // Given: Invalid URL in update
    const updateData = { url: 'invalid-url' };

    // When: Validating against schema
    const result = UpdateBookmarkSchema.safeParse(updateData);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });

  it('should reject empty title in update', () => {
    // Given: Empty title in update
    const updateData = { title: '' };

    // When: Validating against schema
    const result = UpdateBookmarkSchema.safeParse(updateData);

    // Then: Validation should fail
    expect(result.success).toBe(false);
  });
});

describe('FR-006: Delete bookmark', () => {
  it('should validate bookmark with deleted_at timestamp', () => {
    // Given: Soft-deleted bookmark
    const bookmark = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      url: 'https://example.com',
      title: 'Deleted Bookmark',
      description: null,
      tags: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: '2026-01-01T12:00:00.000Z'
    };

    // When: Validating against schema
    const result = BookmarkSchema.safeParse(bookmark);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted_at).toBe('2026-01-01T12:00:00.000Z');
    }
  });
});

describe('FR-007: List all user tags', () => {
  it('should validate tag list response schema', () => {
    // Given: Valid tag list response
    const response = {
      data: ['web', 'example', 'test']
    };

    // When: Validating against schema
    const result = TagListResponseSchema.safeParse(response);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toHaveLength(3);
      expect(result.data.data).toContain('web');
    }
  });

  it('should validate empty tag list', () => {
    // Given: Empty tag list response
    const response = { data: [] };

    // When: Validating against schema
    const result = TagListResponseSchema.safeParse(response);

    // Then: Validation should succeed
    expect(result.success).toBe(true);
  });
});

// Property-based tests for invariants
describe('Bookmark schema invariants', () => {
  it('should maintain URL format invariant across all operations', () => {
    // Given: Various URL formats
    const validUrls = [
      'https://example.com',
      'http://test.org/path?param=value',
      'https://subdomain.domain.co.uk/deep/path#anchor'
    ];
    
    validUrls.forEach(url => {
      // When: Validating URL in different contexts
      const createResult = CreateBookmarkSchema.safeParse({ url, title: 'Test' });
      const updateResult = UpdateBookmarkSchema.safeParse({ url });
      
      // Then: All should succeed
      expect(createResult.success).toBe(true);
      expect(updateResult.success).toBe(true);
    });
  });

  it('should maintain tag array size invariant', () => {
    // Given: Maximum allowed tags
    const maxTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    
    // When: Validating in different contexts
    const createResult = CreateBookmarkSchema.safeParse({ 
      url: 'https://example.com', 
      title: 'Test', 
      tags: maxTags 
    });
    const updateResult = UpdateBookmarkSchema.safeParse({ tags: maxTags });
    
    // Then: Both should succeed
    expect(createResult.success).toBe(true);
    expect(updateResult.success).toBe(true);
  });

  it('should maintain field length invariants across operations', () => {
    // Given: Maximum length values
    const testCases = [
      { field: 'title', maxLength: 500 },
      { field: 'description', maxLength: 2000 },
      { field: 'url', maxLength: 2048 }
    ];
    
    testCases.forEach(({ field, maxLength }) => {
      const maxValue = 'x'.repeat(maxLength);
      const tooLong = 'x'.repeat(maxLength + 1);
      
      // When: Testing at boundary
      const validData = { [field]: maxValue };
      const invalidData = { [field]: tooLong };
      
      if (field === 'url') {
        validData.url = `https://example.com/${'x'.repeat(maxLength - 20)}`;
        invalidData.url = `https://example.com/${'x'.repeat(maxLength)}`;
      }
      if (field !== 'url') {
        validData.url = 'https://example.com';
        invalidData.url = 'https://example.com';
      }
      if (field !== 'title') {
        validData.title = 'Test';
        invalidData.title = 'Test';
      }
      
      const validResult = CreateBookmarkSchema.safeParse(validData);
      const invalidResult = CreateBookmarkSchema.safeParse(invalidData);
      
      // Then: Boundary respected
      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });
});