# Patterns

This document captures recurring design decisions. The spec agent reads this to avoid asking the same questions repeatedly.

Updated as patterns emerge from completed specs.

## General Preferences

- Single-user applications by default (no multi-tenancy unless specified)
- Supabase RLS over application-level access control
- REST APIs only (no GraphQL)
- Serverless-first (no VMs or containers)
- Free tier hosting (Cloudflare + Supabase)

## Data Modelling

- All tables include: `id` (uuid, PK), `created_at` (timestamptz), `updated_at` (timestamptz)
- User-owned data includes: `user_id` (uuid, FK to auth.users, not null) with RLS policy
- Soft delete preferred over hard delete for user-facing data
- PII fields explicitly marked in specs

## API Design

- Standard response envelope: `{ data, error, meta }`
- Pagination via cursor-based approach (not offset)
- Consistent error format: `{ error: string, details?: object }`
- All endpoints require authentication except explicitly public routes

## Authentication

- Supabase Auth for all user authentication
- JWT verification in middleware, not per-route
- MFA (TOTP) offered but not required by default

---

*This file will grow as the factory builds more projects.*
