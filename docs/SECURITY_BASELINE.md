# Security Baseline

## Target Standards

- **OWASP ASVS Level 2** (application security)
- **ASD Essential Eight Maturity Level 2** (where applicable to serverless)
- **ASD ISM NC controls** (software development, monitoring, operations)

## Enforcement Layer Hierarchy

Controls are pushed as high as possible. Higher layers are harder for AI-generated code to bypass.

1. **Platform** (Cloudflare, Supabase) - highest trust
2. **Database** (RLS policies, constraints)
3. **Framework middleware** (`src/middleware/`)
4. **CI pipeline** (deterministic, automated)
5. **Agent review** (probabilistic safety net)
6. **Application code** - lowest preference

If a control can live at a higher layer, it must not be implemented at a lower one.

## ASVS Control Matrix

### V2: Authentication

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Password policy (min 12 chars) | Supabase Auth config | Platform |
| Anti-automation | Cloudflare Turnstile | Platform |
| Credential recovery | Supabase Auth | Built-in |
| MFA (TOTP) | Supabase Auth | Per-project |
| Session management (JWT) | Supabase Auth | Platform config |

### V3: Session Management

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Session invalidation | Supabase Auth | Platform |
| Session timeout | Supabase JWT config | 15 min access, 7 day refresh |
| Cookie security attributes | Middleware | HttpOnly, Secure, SameSite=Strict |

### V4: Access Control

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Deny by default | Middleware | Default handler rejects |
| Data isolation (least privilege) | Supabase RLS | Users access own data only |
| No IDOR | RLS + contract tests | RLS prevents cross-user access |
| Admin separation | Spec-level | Separate deployments |

### V5: Validation and Encoding

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Input validation | Zod schemas at API boundary | Schema before handler |
| Output encoding | Framework default | React/Svelte prevent XSS |
| No raw HTML | Semgrep CI rule | Blocks dangerouslySetInnerHTML |
| External input through Zod | Convention + CI | No raw JSON.parse |

### V6: Cryptography

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Approved algorithms | Platform-managed | Agents never implement crypto |
| Key management | Platform + GitHub Secrets | No keys in code |

**Hard rule: No agent implements cryptographic functions. Always escalate.**

### V7: Error Handling and Logging

| Control | Enforcement | Notes |
|---------|-------------|-------|
| No sensitive data in logs | Semgrep + security review | CI + agent |
| No stack traces to clients | Middleware error handler | Configured once |
| Structured audit logging | Application code | Standard pattern in CONVENTIONS.md |

### V8: Data Protection

| Control | Enforcement | Notes |
|---------|-------------|-------|
| PII identification | Spec-level | Spec agent marks PII fields |
| HTTPS only | Cloudflare | Platform |
| Cache control | Middleware | no-store for authenticated responses |

### V13: API Security

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Consistent auth | Middleware | Single auth middleware |
| Input validation | Zod schemas | Same as V5 |
| REST only | Architecture constraint | No GraphQL |

### V14: Configuration

| Control | Enforcement | Notes |
|---------|-------------|-------|
| Dependency scanning | CI (npm audit, osv-scanner) | Every build |
| Security headers | Cloudflare + middleware | CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy |

## Essential Eight Mapping

| E8 Control | Our Equivalent | Enforcement |
|------------|---------------|-------------|
| Application control | Pipeline-approved code only | CI + branch protection |
| Patch applications | Dependency scanning + auto PR | Dependabot/Renovate + SCA |
| Restrict Office macros | N/A | Serverless, no Office |
| User application hardening | CSP + Permissions-Policy | Middleware + Cloudflare |
| Restrict admin privileges | Scoped tokens, no service_role in client | IaC policies + convention |
| Patch OS | Platform-managed | Cloudflare/Supabase |
| MFA | All operator accounts + TOTP for users | Account config + Supabase Auth |
| Regular backups | Supabase daily + pg_dump to R2 + git mirror | Platform + scheduled jobs |

## ISM Software Development Controls

| ISM Control | Description | Enforcement |
|-------------|-------------|-------------|
| ISM-0400 | Segregate environments | Branch-based + IaC |
| ISM-1419 | Dev only in dev environments | Feature branches |
| ISM-1420 | No prod data in non-prod | Convention + CI |
| ISM-2023 | Authoritative source | GitHub + branch protection |
| ISM-2025 | Issue tracking | GitHub Issues linked to specs |
| ISM-2026 | Scan artefacts | CI (Semgrep, SCA) |
| ISM-2027 | Verify artefact integrity | npm ci + lockfile hash |
| ISM-2028 | SAST/DAST/SCA on third-party | CI pipeline |
| ISM-2032 | Tests pass without warnings | CI gate (zero warnings) |
| ISM-2033 | Security requirements documented | Spec security section |
| ISM-2094 | AI content filtering | Full agent pipeline |
| ISM-1163 | Continuous monitoring | Weekly ZAP + fortnightly vuln scan |

## Supply Chain Security

- SBOM generated on every build (CycloneDX)
- `npm ci` enforced (not `npm install`)
- New dependencies flagged (Tier 2 normal, Tier 3 for native code)
- SCA scanning on every build (osv-scanner)
- Dependabot/Renovate for automated update PRs
- Critical vulns: auto-create GitHub Issue (48 hour response target)

## Monitoring and Logging

- Structured JSON logs (see CONVENTIONS.md for schema)
- Security events always logged (auth, authz, data changes, admin actions)
- Write-once log storage (INSERT-only Supabase table)
- Scheduled anomaly detection via GitHub Action
- Weekly full-scope ZAP scan

## Backups

- Supabase daily backups (7-day retention)
- Scheduled pg_dump to Cloudflare R2 (30-day retention)
- Pulumi state in Pulumi Cloud
- Git mirror to secondary host
- Quarterly restoration test

## Data Governance

- PII fields marked in spec data models
- Data sovereignty assessed per-spec for user-facing applications
- Privacy Act 1988 (Australian Privacy Principles) considered for apps handling third-party data
