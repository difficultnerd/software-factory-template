---
plan_id: PLAN-SPEC-2026-27
spec_id: SPEC-2026-27
status: draft
author: planner-agent
created: 2026-02-16
---

## Overview

Building a Wordle clone with Australian spelling, unlimited daily games, and comprehensive statistics tracking. The system consists of a game engine API, statistics calculation, and a web interface. Architecture follows the standard Cloudflare Workers + Supabase pattern with RLS for data isolation.

## Task Dependency Graph

```
SCHEMAS → CONTRACT-TESTS (parallel) → IMPLEMENTATION (parallel)
   ↓            ↓                           ↓
DATABASE → UI-IMPLEMENTATION ← API-IMPLEMENTATION
```

Schemas and database setup must complete first. Contract tests and implementation tasks can then run in parallel. UI implementation depends on API being complete.

## Tasks

### TASK-001: Create Core Schemas
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** none
- **Parallel:** TASK-002
- **Spec requirements:** FR-002, SR-003, API contracts
- **Files to create/modify:**
  - src/schemas/game.ts (create)
  - src/schemas/guess.ts (create)
  - src/schemas/stats.ts (create)
- **Description:** Create Zod schemas for game creation, guess submission, game state, statistics, and history responses matching the API contracts
- **Acceptance criteria:** All schemas validate correct input/output shapes from API specification, include proper validation rules (5-letter words, guess limits)

### TASK-002: Database Migration and Setup
- **Phase:** contract-tests
- **Agent:** implementer-agent
- **Depends on:** none
- **Parallel:** TASK-001
- **Spec requirements:** Data models, SR-002, SR-004
- **Files to create/modify:**
  - migrations/001_initial_schema.sql (create)
  - migrations/002_rls_policies.sql (create)
  - migrations/003_word_dictionary.sql (create)
- **Description:** Create tables (games, guesses, australian_words, user_statistics), RLS policies, constraints, and indexes as specified in data models
- **Acceptance criteria:** All tables exist with proper constraints, RLS policies prevent cross-user access, indexes support query patterns

### TASK-003: Word Dictionary Population
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-002
- **Parallel:** none
- **Spec requirements:** FR-007, NFR-003
- **Files to create/modify:**
  - scripts/populate-words.ts (create)
  - data/australian-words.json (create)
- **Description:** Create script to populate australian_words table with curated 5-letter Australian English words (target + valid guess words)
- **Acceptance criteria:** Database contains 2000+ target words and 10000+ valid guess words, all properly flagged

### TASK-004: Game API Contract Tests
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** TASK-001, TASK-002
- **Parallel:** TASK-005, TASK-006
- **Spec requirements:** FR-001, FR-002, FR-003, FR-004, SR-001, SR-002
- **Files to create/modify:**
  - tests/contract/game-api.test.ts (create)
- **Description:** Test game creation, guess submission, game state retrieval, and completion flows against API contracts
- **Acceptance criteria:** Tests verify correct game flow, validation, authentication requirements, and data isolation

### TASK-005: Statistics API Contract Tests
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** TASK-001, TASK-002
- **Parallel:** TASK-004, TASK-006
- **Spec requirements:** FR-005, SR-002
- **Files to create/modify:**
  - tests/contract/stats-api.test.ts (create)
- **Description:** Test statistics calculation and retrieval matching the API contract structure
- **Acceptance criteria:** Tests verify correct calculation of wins, streaks, distributions, and user isolation

### TASK-006: History API Contract Tests
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** TASK-001, TASK-002
- **Parallel:** TASK-004, TASK-005
- **Spec requirements:** FR-006, SR-002
- **Files to create/modify:**
  - tests/contract/history-api.test.ts (create)
- **Description:** Test game history retrieval with pagination and user isolation
- **Acceptance criteria:** Tests verify correct history format, chronological order, pagination, and access control

### TASK-007: Security Contract Tests
- **Phase:** contract-tests
- **Agent:** contract-test-agent
- **Depends on:** TASK-001, TASK-002
- **Parallel:** TASK-004, TASK-005, TASK-006
- **Spec requirements:** SR-001, SR-002, SR-003, SR-004, SR-005
- **Files to create/modify:**
  - tests/security/auth-isolation.test.ts (create)
  - tests/security/input-validation.test.ts (create)
  - tests/security/rate-limiting.test.ts (create)
- **Description:** Test authentication requirements, RLS enforcement, input validation, and rate limiting
- **Acceptance criteria:** Tests verify unauthorized access fails, malformed input rejected, rate limits enforced

### TASK-008: Game Engine Implementation
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-004, TASK-003
- **Parallel:** TASK-009, TASK-010
- **Spec requirements:** FR-001, FR-002, FR-003, FR-004, SR-003, SR-004
- **Files to create/modify:**
  - src/lib/game-engine.ts (create)
  - src/lib/word-validator.ts (create)
  - src/api/games/index.ts (create)
  - src/api/games/[gameId]/index.ts (create)
  - src/api/games/[gameId]/guesses.ts (create)
- **Description:** Implement game creation, guess processing, feedback generation, and state management
- **Acceptance criteria:** All game API contract tests pass, game logic correctly handles Australian spelling

### TASK-009: Statistics Implementation
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-005, TASK-003
- **Parallel:** TASK-008, TASK-010
- **Spec requirements:** FR-005, SR-002
- **Files to create/modify:**
  - src/lib/statistics.ts (create)
  - src/api/stats/index.ts (create)
  - migrations/004_statistics_triggers.sql (create)
- **Description:** Implement statistics calculation, materialized view refresh, and API endpoint
- **Acceptance criteria:** Statistics API contract tests pass, triggers update stats on game completion

### TASK-010: History Implementation
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-006, TASK-003
- **Parallel:** TASK-008, TASK-009
- **Spec requirements:** FR-006, SR-002
- **Files to create/modify:**
  - src/api/history/index.ts (create)
- **Description:** Implement game history retrieval with pagination
- **Acceptance criteria:** History API contract tests pass, proper pagination and ordering

### TASK-011: Game UI Implementation
- **Phase:** implementation
- **Agent:** implementer-agent
- **Depends on:** TASK-008, TASK-009, TASK-010
- **Parallel:** none
- **Spec requirements:** FR-008, NFR-001
- **Files to create/modify:**
  - src/components/game-board.tsx (create)
  - src/components/guess-input.tsx (create)
  - src/components/game-stats.tsx (create)
  - src/pages/game.tsx (create)
  - src/pages/stats.tsx (create)
  - src/pages/history.tsx (create)
- **Description:** Implement game board UI, input handling, statistics display, and history view
- **Acceptance criteria:** Visual game board shows 6x5 grid with color feedback, responsive input, statistics and history pages functional

## Schemas (Shared)

The following Zod schemas need creation in TASK-001 before other work begins:

- `GameSchema` - Game state structure
- `GuessSchema` - Guess submission and feedback
- `StatsSchema` - Statistics response structure
- `HistorySchema` - History item structure
- `CreateGameSchema` - Game creation request
- `SubmitGuessSchema` - Guess submission request

## Database Migrations

Required migrations in TASK-002 and TASK-003:
1. Core tables (games, guesses, australian_words, user_statistics)
2. RLS policies for user data isolation
3. Constraints and indexes for performance
4. Statistics calculation triggers (TASK-009)

## Escalations

1. **Word List Source** - The spec identifies this as an open question. Implementation cannot proceed without a concrete source for Australian English 5-letter words. This affects TASK-003 and the overall functionality.

2. **Case Handling** - Open question on input case handling affects both validation schema design (TASK-001) and UI implementation (TASK-011).

Human review needed for:
- Word dictionary sourcing and licensing
- Case handling specification
- Target word selection strategy confirmation