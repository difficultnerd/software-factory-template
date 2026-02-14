# Architecture

## System Overview

This is a personal software factory that uses AI agents to build, test, review, and deploy software. The human operates as product owner and chief architect. AI agents handle all implementation.

## Tech Stack

- **Language:** TypeScript (end-to-end)
- **Frontend:** Next.js or SvelteKit on Cloudflare Pages
- **Backend:** Hono or Next.js API routes on Cloudflare Workers
- **Database:** Supabase (Postgres with Row Level Security)
- **Authentication:** Supabase Auth
- **Hosting:** Cloudflare (Pages, Workers, R2)
- **IaC:** Pulumi or SST (TypeScript)
- **CI/CD:** GitHub Actions

## Deployment Topology

```
Cloudflare Pages -- Frontend (static assets + SSR at edge)
       |
       v
Cloudflare Workers -- API layer (middleware + route handlers)
       |
       v
Supabase -- Postgres (with RLS) + Auth + Storage
```

All traffic over TLS via Cloudflare. No servers to manage. No OS to patch.

## Trust Boundaries

1. **Internet to Cloudflare:** DDoS protection, TLS termination, bot detection at platform level.
2. **Cloudflare to Application:** Security middleware (auth verification, headers, validation, error handling) runs before any route handler.
3. **Application to Database:** Supabase client uses authenticated user's JWT. RLS policies enforce data isolation at the database level regardless of application logic.

## Data Flow (Authenticated Request)

```
Client (browser/mobile)
  -> Cloudflare edge (TLS, DDoS, bot check)
    -> Worker (middleware: verify JWT, set security headers)
      -> Route handler (validate input via Zod schema)
        -> Supabase query (RLS scoped to authenticated user)
          -> Response (generic errors only, no internal details)
```

## Security Architecture

Security is structural, not inspected. Controls are enforced at the highest possible layer:

1. **Platform (Cloudflare/Supabase):** TLS, DDoS, auth, session management
2. **Database (Postgres RLS):** Data isolation, access control
3. **Middleware:** Auth verification, security headers, error handling, input validation
4. **CI Pipeline:** SAST, SCA, secret scanning, automated tests
5. **Agent Review:** Logic flaws, context-dependent issues
6. **Application Code:** Minimal security surface

See `SECURITY_BASELINE.md` for the full control matrix.

## Key Architectural Constraints

- **REST only.** No GraphQL. Smaller attack surface, simpler for AI agents to secure.
- **TypeScript only.** One language for the full stack. AI models produce better output with consistent language context.
- **Free tier hosting.** Design within Cloudflare Workers 10ms CPU limit and Supabase free tier constraints.
- **No custom crypto.** All cryptographic operations delegated to platform (Supabase Auth, Cloudflare TLS). Agents never implement crypto functions.
- **Serverless only.** No VMs, no containers, no long-running processes unless strictly necessary.
- **Single user by default.** Projects are personal software. Multi-tenancy only if explicitly specified in a spec.

## Factory Architecture

The factory control plane lives in `factory/` and is separate from application code. Application code in `src/` never references factory files.

```
factory/
  specs/       - Approved specifications (immutable once approved)
  plans/       - Planner output linked to specs
  decisions.md - T1/T2 decision log (append-only)
  escalations.md - T3 blocks awaiting human input
  reviews/     - Security and code review findings
```

Orchestration runs via GitHub Actions. State tracked through PRs, Issues, and factory files. See `AGENTS.md` for agent roles and operating rules.
