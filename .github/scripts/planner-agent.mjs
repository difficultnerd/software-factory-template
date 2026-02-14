/**
 * @file Planner Agent - Claude API caller
 * @purpose Reads an approved spec and produces an implementation plan
 *          with discrete, parallelisable tasks for downstream agents.
 * @inputs Environment variables: ANTHROPIC_API_KEY, SPEC_FILE, SPEC_ID
 * @outputs Writes plan file to factory/plans/ and prints the filepath
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SPEC_FILE = process.env.SPEC_FILE;
const SPEC_ID = process.env.SPEC_ID;

if (!ANTHROPIC_API_KEY || !SPEC_FILE || !SPEC_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

function readDoc(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.warn(`Warning: Could not read ${path}`);
    return '(not found)';
  }
}

const specContent = readDoc(SPEC_FILE);
const governanceDocs = {
  agents: readDoc('docs/AGENTS.md'),
  architecture: readDoc('docs/ARCHITECTURE.md'),
  conventions: readDoc('docs/CONVENTIONS.md'),
  patterns: readDoc('docs/PATTERNS.md'),
  security: readDoc('docs/SECURITY_BASELINE.md'),
};

const today = new Date().toISOString().split('T')[0];

const systemPrompt = `You are the Planner Agent in an AI software factory. Your role is to decompose an approved specification into discrete implementation tasks.

You MUST follow the rules in AGENTS.md. You MUST NOT modify the spec. You MUST NOT write code. You MUST NOT resolve spec ambiguities yourself (escalate to human).

Rules:
- Each task must reference specific spec requirements (FR-NNN, SR-NNN).
- Identify which tasks can run in parallel vs which have dependencies.
- For each task, specify: files to create/modify, spec requirements satisfied, dependencies on other tasks.
- The Contract Test Agent works BEFORE the Implementer Agent. Plan accordingly.
- Middleware files (src/middleware/) are frozen. If changes seem needed, flag as ESCALATION.
- Consider the project conventions (CONVENTIONS.md) when planning file structure.
- Consider security requirements when planning task order (security-critical paths first).
- Keep tasks small enough to fit in a single AI agent context window.

Output ONLY the plan markdown. No preamble, no explanation, no wrapping code fences.`;

const userPrompt = `Here are the governance documents:

<agents_md>
${governanceDocs.agents}
</agents_md>

<architecture_md>
${governanceDocs.architecture}
</architecture_md>

<conventions_md>
${governanceDocs.conventions}
</conventions_md>

<patterns_md>
${governanceDocs.patterns}
</patterns_md>

<security_baseline_md>
${governanceDocs.security}
</security_baseline_md>

---

Here is the approved specification to decompose into tasks:

<spec>
${specContent}
</spec>

---

Produce an implementation plan using this structure:

---
plan_id: PLAN-${SPEC_ID}
spec_id: ${SPEC_ID}
status: draft
author: planner-agent
created: ${today}
---

## Overview
(Brief summary of what will be built and the general approach)

## Task Dependency Graph
(Show which tasks depend on which, and which can run in parallel)

## Tasks

### TASK-001: (Task name)
- **Phase:** contract-tests | implementation | integration
- **Agent:** contract-test-agent | implementer-agent
- **Depends on:** (task IDs or "none")
- **Parallel:** (can run alongside which task IDs)
- **Spec requirements:** (FR-NNN, SR-NNN references)
- **Files to create/modify:**
  - path/to/file.ts (create | modify)
- **Description:** (what specifically this task must accomplish)
- **Acceptance criteria:** (how to know this task is done)

(Repeat for each task)

## Schemas (Shared)
List any Zod schemas that need to be created in src/schemas/ before implementation tasks begin. These are a dependency for both contract tests and implementation.

## Database Migrations
List any Supabase migrations needed (tables, RLS policies). These must be applied before implementation.

## Escalations
List anything that cannot be planned without human input. If none, state "None identified."`;

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

  const planContent = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  if (!planContent || planContent.length < 100) {
    console.error('Plan content too short or empty. Response:', JSON.stringify(data));
    process.exit(1);
  }

  return planContent;
}

async function main() {
  console.log(`Generating plan for spec: ${SPEC_ID}`);
  console.log(`Spec file: ${SPEC_FILE}`);
  console.log('Calling Claude API...');

  const planContent = await callClaude();

  const planFilename = `PLAN-${SPEC_ID}.md`;
  const planDir = 'factory/plans';
  const planPath = join(planDir, planFilename);

  mkdirSync(planDir, { recursive: true });
  writeFileSync(planPath, planContent, 'utf8');

  console.log(`Plan written to ${planPath}`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `plan_file=${planPath}\n`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
