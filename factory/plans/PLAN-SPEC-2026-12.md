---
plan_id: PLAN-SPEC-2026-12
spec_id: SPEC-2026-12
status: draft
author: planner-agent
created: 2026-02-14
---

## Overview

This plan implements a REST API for personal bookmark management with CRUD operations, tagging, and tag-based filtering. The implementation follows the single-user pattern with Supabase RLS for data isolation. The system consists of database schema setup, Zod validation schemas, contract tests, and API route handlers running on Cloudflare Workers.

## Task Dependency Graph

```
Database Migration (TASK-001)
    ↓
Zod Schemas (TASK-002)
    ↓
Contract Tests (TASK-003) → API Routes Implementation (TASK-004)
                                    ↓
                            Integration Tests (TASK-005)
```

Tasks 003 and 004 can run in parallel after TASK-002 completes. TASK-005 requires both 003 and 004.

## Tasks

### TASK-001: Database schema and RLS policies
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** none
- **Parallel:** none
- **Spec requirements:** Data Models section, SR-004 (RLS policies), SR-005 (data isolation)
- **Files to create/modify:**
  - supabase/migrations/001_create_bookmarks_table.sql (create)
- **Description:** Create the bookmarks table with all required fields, indexes, and RLS policies as specified in the data model. Includes soft delete support and tag array with GIN indexing.
- **Acceptance criteria:** 
  - Table created with all specified columns and constraints
  - All indexes created (primary key, user_id, created_at, GIN on tags, partial on deleted_at)
  - RLS policies enforce user isolation for SELECT, INSERT, UPDATE, DELETE
  - Migration applies cleanly to fresh Supabase instance

### TASK-002: Zod validation schemas
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** none
- **Parallel:** TASK-001
- **Spec requirements:** FR-001 through FR-007, SR-008 (input validation), API Contracts
- **Files to create/modify:**
  - src/schemas/bookmark.ts (create)
- **Description:** Create comprehensive Zod schemas for bookmark validation including create/update request schemas, response schemas, query parameter schemas, and the core bookmark entity schema.
- **Acceptance criteria:**
  - All API request/response shapes have corresponding Zod schemas
  - Validation matches API contract specifications (field lengths, required fields, formats)
  - Schemas export proper TypeScript types via z.infer
  - URL format validation and tag array constraints implemented

### TASK-003: Contract tests for bookmark API
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** TASK-002
- **Parallel:** none
- **Spec requirements:** FR-001 through FR-007, all security requirements
- **Files to create/modify:**
  - tests/contract/bookmarks.test.ts (create)
  - tests/security/bookmarks-security.test.ts (create)
- **Description:** Write comprehensive contract tests that validate API behavior against the specification without seeing implementation. Tests must cover all functional requirements, error cases, authentication requirements, and security controls.
- **Acceptance criteria:**
  - All FR requirements have corresponding test cases using Given/When/Then format
  - Security tests verify authentication requirements and RLS isolation
  - Error cases tested (validation failures, not found, unauthorized access)
  - Tests are isolated and do not depend on implementation details
  - All tests initially fail (red phase confirmed)

### TASK-004: API route handlers implementation
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-002
- **Parallel:** TASK-003
- **Spec requirements:** FR-001 through FR-007, all security requirements, API Contracts
- **Files to create/modify:**
  - src/api/bookmarks/index.ts (create)
  - src/api/bookmarks/[id].ts (create) 
  - src/api/bookmarks/tags/index.ts (create)
  - src/lib/bookmark-service.ts (create)
- **Description:** Implement all API endpoints as specified in the API contracts. All routes must use authentication middleware, validate inputs with Zod schemas, interact with Supabase using RLS-scoped queries, and implement proper error handling and logging.
- **Acceptance criteria:**
  - All API endpoints implemented with correct HTTP methods and paths
  - Authentication middleware applied to all routes
  - Input validation via Zod schemas at API boundary
  - Supabase queries use authenticated client with RLS enforcement
  - Proper error responses and structured logging
  - Cursor-based pagination implemented for list endpoint
  - Tag filtering functionality works correctly
  - Soft delete implemented for DELETE operations

### TASK-005: Integration verification
- **Phase:** integration
- **Agent:** implementer-agent
- **Depends on:** TASK-003, TASK-004
- **Parallel:** none
- **Spec requirements:** All functional and security requirements
- **Files to create/modify:**
  - tests/integration/bookmark-flow.test.ts (create)
- **Description:** Create end-to-end integration tests that verify the complete bookmark management workflow works correctly with real database interactions and authentication.
- **Acceptance criteria:**
  - Complete CRUD workflow tested with real Supabase instance
  - Authentication and RLS policies verified in integration context
  - Tag filtering and listing functionality verified
  - Pagination behavior tested with real data
  - Error handling verified in integration context
  - All contract tests pass against implemented endpoints

## Schemas (Shared)

The following schemas must be created in TASK-002 before other tasks can proceed:

- `BookmarkSchema` - Core bookmark entity validation
- `CreateBookmarkSchema` - POST request body validation  
- `UpdateBookmarkSchema` - PUT request body validation
- `BookmarkQuerySchema` - GET query parameters (tag filter, pagination)
- `BookmarkResponseSchema` - Single bookmark response envelope
- `BookmarkListResponseSchema` - Paginated list response envelope
- `TagListResponseSchema` - Tag list response envelope

## Database Migrations

TASK-001 must create the following database objects:

- `bookmarks` table with all specified columns and constraints
- Primary key index on `id`
- Index on `user_id` for RLS performance
- Index on `created_at` for ordering
- GIN index on `tags` array for tag filtering
- Partial index on `deleted_at IS NULL` for active bookmarks
- RLS policies for SELECT, INSERT, UPDATE, DELETE operations
- Enable RLS on the bookmarks table

## Escalations

None identified. The specification is complete and all requirements can be implemented within the existing architecture constraints.