# Incident Response Plan

**Status:** Skeletal (to be expanded once factory is operational)

## What Constitutes an Incident

- Unauthorised access to any account (GitHub, Cloudflare, Supabase, API providers)
- Data breach or suspected data exposure
- Credential exposure (API keys, tokens, passwords found in logs, code, or public sources)
- Supply chain compromise (malicious dependency, compromised build)
- Service compromise (unexpected behaviour, defacement, crypto mining)

## Response Steps

### 1. Isolate

- Revoke compromised API keys and tokens immediately
- Disable affected deployments (Cloudflare dashboard)
- Suspend affected Supabase project if database compromised
- Revoke GitHub personal access tokens if repo compromised

### 2. Investigate

- Check structured logs for unauthorised access patterns
- Review recent commits and PRs for unexpected changes
- Check dependency changes for supply chain indicators
- Review Cloudflare analytics for unusual traffic patterns

### 3. Remediate

- Rotate ALL credentials (not just the compromised ones)
- Patch the vulnerability that allowed the incident
- Update SECURITY_BASELINE.md with new control if gap identified
- Create a spec for any required code changes (process through full pipeline)

### 4. Recover

- Restore from backup if data affected (see backup procedures in SECURITY_BASELINE.md)
- Redeploy from known-good commit
- Verify RLS policies are intact
- Run full ZAP scan against restored services

## Credential Rotation Checklist

- [ ] GitHub personal access tokens
- [ ] Cloudflare API tokens
- [ ] Supabase project API keys (anon + service_role)
- [ ] Supabase database password
- [ ] Anthropic API key
- [ ] OpenAI API key (if used)
- [ ] Google AI API key (if used)
- [ ] Any other project-specific secrets in GitHub Secrets

## Reporting

- ASD cyber.gov.au reporting: recommended if user data affected
- Consider notification obligations under Privacy Act 1988 (Notifiable Data Breaches scheme) if third-party PII involved

---

*This document will be expanded with detailed runbooks once the factory is operational.*
