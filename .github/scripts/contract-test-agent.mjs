/**
 * @file Contract Test Agent - Claude API caller
 * @purpose Reads an approved spec and implementation plan, then generates
 *          contract tests and Zod schemas. Never sees implementation code.
 * @inputs Environment variables: ANTHROPIC_API_KEY, SPEC_FILE, PLAN_FILE, SPEC_ID
 * @outputs Writes test files to tests/contract/ and schemas to src/schemas/
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SPEC_FILE = process.env.SPEC_FILE;
const PLAN_FILE = process.env.PLAN_FILE;
const SPEC_ID = process.env.SPEC_ID;

if (!ANTHROPIC_API_KEY || !SPEC_FILE || !PLAN_FILE || !SPEC_ID) {
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
const planContent = readDoc(PLAN_FILE);
const conventions = readDoc('docs/CONVENTIONS.md');
const security = readDoc('docs/SECURITY_BASELINE.md');
const agents = readDoc('docs/AGENTS.md');

// Read existing schemas if any
let existingSchemas = '';
try {
  const schemaDir = 'src/schemas';
  const files = readdirSync(schemaDir).filter(f => f.endsWith('.ts'));
  for (const f of files) {
    existingSchemas += `\n--- ${f} ---\n` + readFileSync(join(schemaDir, f), 'utf8');
  }
} catch {
  existingSchemas = '(no existing schemas)';
}

const systemPrompt = `You are the Contract Test Agent in an AI software factory. Your role is to write tests from the specification BEFORE any implementation exists.

CRITICAL ISOLATION RULE: You NEVER see implementation code. Your context is the spec, plan, schemas, and test framework only. This prevents you from writing tests that confirm what code does rather than what the spec says.

You MUST follow the rules in AGENTS.md for the Contract Test Agent role.

You will output a JSON object containing files to create. Each file has a path and content.

Rules:
- Write tests using Vitest (import { describe, it, expect } from 'vitest')
- Use Given/When/Then from the spec's acceptance criteria
- Reference spec requirement IDs in describe blocks: describe('FR-001: Create bookmark', ...)
- Write security tests derived from the spec's Security Requirements section
- Write property-based tests using fast-check where requirements describe invariants
- Tag tests based on Tier 2 assumptions as assumption-dependent using it.todo() with a note
- Create Zod schemas in src/schemas/ for all data models and API contracts in the spec
- Use z.infer<typeof Schema> for TypeScript types
- Follow CONVENTIONS.md for file structure and header comments
- Tests should import schemas from src/schemas/ and test against them
- For API endpoint tests, test the expected request/response shapes and validation
- Do NOT import from src/api/, src/lib/, or src/ui/ (you cannot see implementation)

Output format: A JSON object with a "files" array. Each element has "path" (string) and "content" (string).
Example:
{
  "files": [
    { "path": "src/schemas/bookmark.ts", "content": "..." },
    { "path": "tests/contract/bookmark.test.ts", "content": "..." },
    { "path": "tests/security/bookmark-security.test.ts", "content": "..." }
  ]
}

Output ONLY valid JSON. No preamble, no explanation, no markdown code fences.`;

const userPrompt = `Here are the relevant documents:

<agents_md>
${agents}
</agents_md>

<conventions_md>
${conventions}
</conventions_md>

<security_baseline_md>
${security}
</security_baseline_md>

<existing_schemas>
${existingSchemas}
</existing_schemas>

---

Here is the approved specification:

<spec>
${specContent}
</spec>

---

Here is the implementation plan:

<plan>
${planContent}
</plan>

---

Generate:
1. Zod schemas in src/schemas/ for all data models and API request/response shapes
2. Contract tests in tests/contract/ for all functional requirements
3. Security tests in tests/security/ for all security requirements

Every test file must include the structured header comment per CONVENTIONS.md.
Every schema file must include the structured header comment per CONVENTIONS.md.
Use TypeScript strict mode compatible code (no 'any', proper type assertions).`;

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

  const textContent = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  if (!textContent || textContent.length < 50) {
    console.error('Response too short or empty. Response:', JSON.stringify(data));
    process.exit(1);
  }

  return textContent;
}

function parseFiles(responseText) {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed.files || !Array.isArray(parsed.files)) {
    throw new Error('Response does not contain a "files" array');
  }

  // Validate each file
  for (const file of parsed.files) {
    if (!file.path || !file.content) {
      throw new Error(`Invalid file entry: ${JSON.stringify(file).slice(0, 100)}`);
    }

    // Security: prevent writing outside allowed directories
    const allowedPrefixes = ['src/schemas/', 'tests/contract/', 'tests/security/'];
    const isAllowed = allowedPrefixes.some(prefix => file.path.startsWith(prefix));
    if (!isAllowed) {
      console.warn(`Skipping file outside allowed directories: ${file.path}`);
      continue;
    }
  }

  return parsed.files;
}

async function main() {
  console.log(`Generating contract tests for spec: ${SPEC_ID}`);
  console.log(`Spec file: ${SPEC_FILE}`);
  console.log(`Plan file: ${PLAN_FILE}`);
  console.log('Calling Claude API...');

  const responseText = await callClaude();
  console.log('Parsing response...');

  let files;
  try {
    files = parseFiles(responseText);
  } catch (err) {
    console.error('Failed to parse Claude response as JSON:', err.message);
    console.error('Raw response (first 500 chars):', responseText.slice(0, 500));
    process.exit(1);
  }

  const allowedPrefixes = ['src/schemas/', 'tests/contract/', 'tests/security/'];
  let writtenCount = 0;

  for (const file of files) {
    const isAllowed = allowedPrefixes.some(prefix => file.path.startsWith(prefix));
    if (!isAllowed) continue;

    const dir = dirname(file.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file.path, file.content, 'utf8');
    console.log(`  Written: ${file.path}`);
    writtenCount++;
  }

  console.log(`\nWrote ${writtenCount} files`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `files_written=${writtenCount}\n`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
