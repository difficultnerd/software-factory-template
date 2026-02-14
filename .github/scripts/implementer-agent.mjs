/**
 * @file Implementer Agent - Claude API caller
 * @purpose Reads the spec, plan, schemas, and tests, then writes
 *          implementation code to make the tests pass.
 * @inputs Environment variables: ANTHROPIC_API_KEY, SPEC_FILE, PLAN_FILE, SPEC_ID
 * @outputs Writes implementation files to src/ directories
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync, statSync } from 'fs';
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

// Recursively read all .ts files from a directory
function readAllFiles(dir) {
  let result = '';
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        result += readAllFiles(fullPath);
      } else if (entry.name.endsWith('.ts')) {
        result += `\n--- ${fullPath} ---\n` + readFileSync(fullPath, 'utf8');
      }
    }
  } catch {
    // Directory may not exist
  }
  return result;
}

const specContent = readDoc(SPEC_FILE);
const planContent = readDoc(PLAN_FILE);
const conventions = readDoc('docs/CONVENTIONS.md');
const architecture = readDoc('docs/ARCHITECTURE.md');
const patterns = readDoc('docs/PATTERNS.md');
const agents = readDoc('docs/AGENTS.md');

// Read existing code the implementer is allowed to see
const schemas = readAllFiles('src/schemas');
const middleware = readAllFiles('src/middleware');
const existingLib = readAllFiles('src/lib');
const existingApi = readAllFiles('src/api');
const indexTs = readDoc('src/index.ts');

// Read tests (the implementer reads tests to know what to implement)
const contractTests = readAllFiles('tests/contract');
const securityTests = readAllFiles('tests/security');

const systemPrompt = `You are the Implementer Agent in an AI software factory. Your role is to write code that makes the contract tests pass.

You MUST follow the rules in AGENTS.md for the Implementer Agent role.

Rules:
- Write code to make the provided tests pass.
- Follow CONVENTIONS.md strictly (header comments, no any, Zod validation, structured logging, etc).
- Follow ARCHITECTURE.md for system design decisions.
- Follow PATTERNS.md for recurring patterns.
- Do NOT modify test files.
- Do NOT modify middleware files (src/middleware/) unless the plan explicitly assigns it as T3.
- Do NOT modify governance documents, CI config, or infrastructure code.
- Use the authenticated Supabase client for all database queries (RLS context).
- Never use the service_role key in client-facing code.
- All external input through Zod schemas (import from src/schemas/).
- Use the structured logger from src/lib/logger.ts.
- Keep files under 300 lines, one concern per file.
- Register new routes in src/index.ts.
- If you need to create Supabase migration SQL, include it as a separate file.

Output format: A JSON object with a "files" array. Each element has "path" (string) and "content" (string).
Example:
{
  "files": [
    { "path": "src/api/bookmarks.ts", "content": "..." },
    { "path": "src/index.ts", "content": "..." },
    { "path": "supabase/migrations/001_create_bookmarks.sql", "content": "..." }
  ]
}

Output ONLY valid JSON. No preamble, no explanation, no markdown code fences.`;

const userPrompt = `Here are the governance documents:

<agents_md>
${agents}
</agents_md>

<conventions_md>
${conventions}
</conventions_md>

<architecture_md>
${architecture}
</architecture_md>

<patterns_md>
${patterns}
</patterns_md>

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

Here are the Zod schemas (already created, import from these):

<schemas>
${schemas}
</schemas>

---

Here is the existing middleware (DO NOT MODIFY):

<middleware>
${middleware}
</middleware>

---

Here is the existing application entry point:

<index_ts>
${indexTs}
</index_ts>

---

Here are the existing library files:

<lib>
${existingLib || '(none yet)'}
</lib>

---

Here are the existing API route files:

<api>
${existingApi || '(none yet)'}
</api>

---

Here are the contract tests your code must pass:

<contract_tests>
${contractTests}
</contract_tests>

---

Here are the security tests your code must pass:

<security_tests>
${securityTests}
</security_tests>

---

Write implementation code that:
1. Makes all the contract tests pass
2. Makes all the security tests pass
3. Follows all conventions
4. Registers routes in src/index.ts (update the existing file)
5. Includes Supabase migration SQL if new tables are needed
6. Includes RLS policies in the migration for all user-owned tables

Important:
- For the Supabase client helper, create a utility in src/lib/ that creates an authenticated client from the request context
- Route handlers should use validateBody/validateQuery from middleware
- All database queries must go through the authenticated Supabase client (RLS enforced)`;

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
      max_tokens: 16384,
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
    console.error('Response too short or empty.');
    process.exit(1);
  }

  // Check for stop reason
  if (data.stop_reason === 'max_tokens') {
    console.warn('WARNING: Response was truncated due to max_tokens limit.');
    console.warn('The implementation may be incomplete. Consider splitting into smaller tasks.');
  }

  return textContent;
}

function parseFiles(responseText) {
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

  return parsed.files;
}

async function main() {
  console.log(`Implementing features for spec: ${SPEC_ID}`);
  console.log(`Spec file: ${SPEC_FILE}`);
  console.log(`Plan file: ${PLAN_FILE}`);
  console.log('Calling Claude API...');

  const responseText = await callClaude();
  console.log('Parsing response...');

  let files;
  try {
    files = parseFiles(responseText);
  } catch (err) {
    console.error('Failed to parse response as JSON:', err.message);
    console.error('Raw response (first 1000 chars):', responseText.slice(0, 1000));
    process.exit(1);
  }

  // Allowed write paths
  const allowedPrefixes = [
    'src/api/',
    'src/lib/',
    'src/schemas/',
    'src/ui/',
    'src/index.ts',
    'supabase/migrations/',
  ];

  // Blocked paths (security kernel)
  const blockedPrefixes = [
    'src/middleware/',
    'tests/',
    'factory/',
    'docs/',
    '.github/',
    'infra/',
  ];

  let writtenCount = 0;

  for (const file of files) {
    // Check blocked first
    const isBlocked = blockedPrefixes.some(prefix => file.path.startsWith(prefix));
    if (isBlocked) {
      console.warn(`BLOCKED: ${file.path} (protected directory)`);
      continue;
    }

    // Check allowed
    const isAllowed = allowedPrefixes.some(prefix =>
      file.path === prefix || file.path.startsWith(prefix)
    );
    if (!isAllowed) {
      console.warn(`Skipping: ${file.path} (not in allowed directories)`);
      continue;
    }

    const dir = dirname(file.path);
    if (dir !== '.') {
      mkdirSync(dir, { recursive: true });
    }
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
