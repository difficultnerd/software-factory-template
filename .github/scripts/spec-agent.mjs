/**
 * @file Spec Agent - Claude API caller
 * @purpose Reads governance docs and a feature request, calls Claude API
 *          to generate a structured specification document.
 * @inputs Environment variables: ANTHROPIC_API_KEY, ISSUE_TITLE, ISSUE_BODY, ISSUE_NUMBER
 * @outputs Writes spec file to factory/specs/ and prints the filepath
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ISSUE_TITLE = process.env.ISSUE_TITLE;
const ISSUE_BODY = process.env.ISSUE_BODY;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;

if (!ANTHROPIC_API_KEY || !ISSUE_TITLE || !ISSUE_BODY || !ISSUE_NUMBER) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Read governance documents
function readDoc(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.warn(`Warning: Could not read ${path}`);
    return '(not found)';
  }
}

const governanceDocs = {
  agents: readDoc('docs/AGENTS.md'),
  architecture: readDoc('docs/ARCHITECTURE.md'),
  security: readDoc('docs/SECURITY_BASELINE.md'),
  patterns: readDoc('docs/PATTERNS.md'),
  conventions: readDoc('docs/CONVENTIONS.md'),
};

const today = new Date().toISOString().split('T')[0];
const year = new Date().getFullYear();

const systemPrompt = `You are the Spec Agent in an AI software factory. Your role is to translate natural language feature descriptions into structured specification documents.

You MUST follow the rules in AGENTS.md. You MUST read and apply ARCHITECTURE.md, SECURITY_BASELINE.md, PATTERNS.md, and CONVENTIONS.md.

Rules:
- Be thorough and precise.
- If the description is ambiguous, list questions in Open Questions rather than guessing.
- Security requirements MUST reference specific ASVS controls from SECURITY_BASELINE.md.
- Data models MUST mark PII fields explicitly.
- All acceptance criteria MUST use Given/When/Then format.
- API contracts should use OpenAPI 3.1 style with request/response schemas.
- Consider free tier constraints (Cloudflare Workers 10ms CPU, Supabase free tier).
- Default to single-user unless specified otherwise (see PATTERNS.md).
- All user data must have RLS policies defined in the data model.

Output ONLY the spec markdown. No preamble, no explanation, no wrapping code fences.`;

const userPrompt = `Here are the governance documents for this project:

<agents_md>
${governanceDocs.agents}
</agents_md>

<architecture_md>
${governanceDocs.architecture}
</architecture_md>

<security_baseline_md>
${governanceDocs.security}
</security_baseline_md>

<patterns_md>
${governanceDocs.patterns}
</patterns_md>

<conventions_md>
${governanceDocs.conventions}
</conventions_md>

---

Please produce a structured specification for the following feature request:

**Title:** ${ISSUE_TITLE}

**Description:**
${ISSUE_BODY}

Use this exact template structure:

---
spec_id: SPEC-${year}-${ISSUE_NUMBER}
title: (descriptive title)
status: draft
author: spec-agent
created: ${today}
source_issue: "#${ISSUE_NUMBER}"
---

## Intent
(Paste the original feature request verbatim)

## Summary
(2-3 sentence summary)

## Functional Requirements
### FR-001: (Requirement name)
**Given** (precondition)
**When** (action)
**Then** (expected outcome)

(Repeat for each requirement)

## API Contracts
(OpenAPI 3.1 style endpoint definitions)

## Data Models
(Entities with fields, types, constraints. Mark PII.)

## Security Requirements
(Reference specific ASVS controls and enforcement mechanism)

## Non-Functional Requirements
(Performance, free tier constraints)

## Infrastructure Requirements
(New infra needed, or "None beyond current baseline")

## Out of Scope
(Explicit boundaries)

## Open Questions
(Questions for the human. If none, state "None identified.")

## Decision Log
| Timestamp | Agent | Tier | Decision | Reasoning |
|-----------|-------|------|----------|-----------|`;

// Call Claude API
async function callClaude() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`API request failed (${response.status}): ${errText}`);
    process.exit(1);
  }

  const data = await response.json();

  if (data.error) {
    console.error('API error:', JSON.stringify(data.error));
    process.exit(1);
  }

  const specContent = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  if (!specContent || specContent.length < 100) {
    console.error('Spec content too short or empty. Response:', JSON.stringify(data));
    process.exit(1);
  }

  return specContent;
}

async function main() {
  console.log(`Generating spec for issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}`);
  console.log('Calling Claude API...');

  const specContent = await callClaude();

  // Write spec file
  const specFilename = `SPEC-${year}-${ISSUE_NUMBER}.md`;
  const specDir = 'factory/specs';
  const specPath = join(specDir, specFilename);

  mkdirSync(specDir, { recursive: true });
  writeFileSync(specPath, specContent, 'utf8');

  console.log(`Spec written to ${specPath}`);

  // Write to GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `spec_file=${specPath}\n`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
