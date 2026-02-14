# Coding Conventions

This document defines the coding standards for all code in this project. Every agent reads this before writing any code.

## Language

TypeScript exclusively. Strict mode enabled. No JavaScript files in `src/`.

## File Structure

### Size Limits
- Maximum 300 lines per file
- One concern per file
- If a file is growing beyond 300 lines, split it

### Header Comment (Required on Every File)

```typescript
/**
 * @file Short description of what this file does
 * @purpose Why this file exists and what problem it solves
 * @inputs What this module receives (props, parameters, data)
 * @outputs What this module produces (return values, side effects)
 * @invariants Conditions that must always be true
 * @spec SPEC-YYYY-NNNN (if applicable)
 */
```

### Naming

- Files: `kebab-case.ts` (e.g., `user-profile.ts`)
- Types/Interfaces: `PascalCase` (e.g., `UserProfile`)
- Functions: `camelCase` (e.g., `getUserProfile`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- Zod schemas: `PascalCase` suffixed with `Schema` (e.g., `UserProfileSchema`)
- Test files: `[name].test.ts` matching the source file name

### Imports

- Use path aliases where configured
- Group imports: external packages first, then internal modules, then types
- No circular imports

## TypeScript Rules

- `strict: true` in tsconfig (no exceptions)
- No `any` type. Use `unknown` and narrow with type guards if the type is genuinely unknown.
- No type assertions (`as`) unless unavoidable and commented with reason
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use Zod schema inference for API types: `type User = z.infer<typeof UserSchema>`
- No enums. Use `as const` objects or union types.

## Error Handling

### API Route Handlers

Do not throw raw errors. Use the Result pattern or return typed error responses:

```typescript
// Preferred: explicit error returns
if (!user) {
  return c.json({ error: 'User not found' }, 404);
}
```

The global error handler (`src/middleware/errors.ts`) catches unhandled exceptions. Route handlers should handle expected errors explicitly.

### Never Do

- Never catch and silently swallow errors
- Never log and rethrow without adding context
- Never expose internal error details to clients
- Never use `console.log` for error logging (use the structured logger)

## Input Validation

All external input goes through Zod schemas. No exceptions.

```typescript
// Correct: validate at the boundary
const parsed = ThingSchema.safeParse(request.body);
if (!parsed.success) {
  return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
}
// parsed.data is now typed and validated

// Incorrect: raw access
const body = await request.json(); // Never do this without validation
```

Semgrep CI rule enforces this: direct `request.json()` or `request.body` without Zod parsing is a build failure.

## Database Access

- Always use the authenticated Supabase client (with user JWT context for RLS)
- Never use the `service_role` key in client-facing code
- Never write raw SQL unless there is no query builder alternative (and document why)
- All queries must be scoped to the authenticated user via RLS (no application-level user filtering)

## Logging

Use structured JSON logging. Never use `console.log` in production code.

```typescript
logger.info({
  event: 'user.created',
  actor: userId,
  resource: newUser.id,
  metadata: { email: '[redacted]' }
});
```

### Log Schema

Every log entry must include:
- `timestamp`: ISO 8601
- `event`: dot-notation event type (e.g., `auth.login.success`, `thing.created`)
- `actor`: user ID or 'system'
- `resource`: ID of the affected resource (if applicable)
- `outcome`: 'success' or 'failure'
- `metadata`: additional context (never include PII, passwords, tokens, or full request bodies)

### Security-Relevant Events (Always Log)

- Authentication success and failure
- Authorisation denials
- Data creation, modification, deletion
- Administrative actions
- Input validation failures

## Dependencies

- Prefer the standard library and existing project dependencies over new packages
- New dependency additions require justification in the PR description
- New dependencies are automatically flagged as Tier 2 decisions
- Dependencies with native code or broad system permissions are Tier 3
- Lock file (`package-lock.json`) must always be committed
- Use `npm ci` in CI, never `npm install`

## Testing

- Tests go in the corresponding directory under `tests/`
- Contract tests in `tests/contract/` test against the spec, not the implementation
- Security tests in `tests/security/` verify ASVS/ISM controls
- Use `describe` blocks that reference spec requirement IDs: `describe('FR-001: Create thing', ...)`
- Property-based tests (fast-check) preferred for functions with clear invariants
- No test should depend on execution order
- No test should depend on external services (mock them)

## Middleware Security Kernel

Files in `src/middleware/` are **frozen after bootstrap**. Rules:

- Implementer agents do not modify these files unless explicitly assigned by the planner
- Any modification to middleware is automatically Tier 3 (human approval required)
- If you think middleware needs changing, escalate. Do not modify.

## Formatting

- Indentation: 2 spaces
- Semicolons: yes
- Trailing commas: yes (ES5 style)
- Single quotes for strings
- Max line length: 100 characters (soft limit)

Prettier configuration enforces these rules. Do not override.

## Comments

- Write comments that explain **why**, not **what**
- Every function exported from a module gets a JSDoc comment
- Complex business logic gets inline comments explaining the reasoning
- Reference spec requirements in comments where relevant: `// Per SR-002: RLS enforces data isolation`
- Do not leave TODO comments without a linked GitHub Issue
