/**
 * @file Code Reviewer Agent - Claude API caller
 * @purpose Reviews implementation for architectural coherence, convention
 *          adherence, and AI maintainability. Runs after security review.
 * @inputs Environment variables: ANTHROPIC_API_KEY, PR_NUMBER, PR_DIFF
 * @outputs Posts review comments on the PR
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PR_DIFF = process.env.PR_DIFF;
const PR_NUMBER = process.env.PR_NUMBER;

if (!ANTHROPIC_API_KEY || !PR_DIFF || !PR_NUMBER) {
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

const conventions = readDoc('docs/CONVENTIONS.md');
const architecture = readDoc('docs/ARCHITECTURE.md');
const patterns = readDoc('docs/PATTERNS.md');
const agents = readDoc('docs/AGENTS.md');

let specContent = '(no spec found)';
try {
  const { readdirSync } = await import('fs');
  const specs = readdirSync('factory/specs').filter(f => f.startsWith('SPEC-') && f.endsWith('.md'));
  if (specs.length > 0) {
    specContent = readFileSync(`factory/specs/${specs[specs.length - 1]}`, 'utf8');
  }
} catch {
  // No specs found
}

let planContent = '(no plan found)';
try {
  const { readdirSync } = await import('fs');
  const plans = readdirSync('factory/plans').filter(f => f.startsWith('PLAN-') && f.endsWith('.md'));
  if (plans.length > 0) {
    planContent = readFileSync(`factory/plans/${plans[plans.length - 1]}`, 'utf8');
  }
} catch {
  // No plans found
}

const systemPrompt = `You are the Code Reviewer Agent in an AI software factory. Your role is to review implementation for architectural coherence, convention adherence, and maintainability.

You MUST follow the rules in AGENTS.md for the Code Reviewer role.

Your review checklist:
1. Does the implementation match the planner's task definition?
2. Does it follow patterns established in CONVENTIONS.md?
3. Are files focused (single concern, under 300 lines)?
4. Are header comments present and accurate?
5. Are types used correctly (no any, proper Zod inference)?
6. Is error handling consistent with the project pattern?
7. Would another AI agent understand this code from the file alone?

Output your review as JSON:
{
  "verdict": "approve" | "request_changes",
  "summary": "Brief overall assessment",
  "findings": [
    {
      "severity": "high" | "medium" | "low",
      "file": "path/to/file.ts",
      "issue": "What needs improving",
      "suggestion": "How to improve it"
    }
  ]
}

Rules:
- "approve": Code follows conventions and is maintainable. Minor suggestions noted but not blocking.
- "request_changes": Significant convention violations or architectural issues.
- You cannot override security reviewer decisions.

Output ONLY valid JSON. No preamble, no markdown fences.`;

const userPrompt = `Here are the project standards:

<conventions>
${conventions}
</conventions>

<architecture>
${architecture}
</architecture>

<patterns>
${patterns}
</patterns>

<spec>
${specContent}
</spec>

<plan>
${planContent}
</plan>

---

Here is the PR diff to review:

<diff>
${PR_DIFF}
</diff>

Review this implementation for code quality, conventions, and maintainability.`;

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
      max_tokens: 4096,
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

  return data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

function parseReview(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

async function main() {
  console.log(`Code review for PR #${PR_NUMBER}`);
  console.log('Calling Claude API...');

  const responseText = await callClaude();
  let review;

  try {
    review = parseReview(responseText);
  } catch (err) {
    console.error('Failed to parse review:', err.message);
    review = {
      verdict: 'request_changes',
      summary: 'Code review could not be completed due to a parsing error. Manual review required.',
      findings: [],
    };
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${review.verdict}\n`);
  }

  let comment = `## 📋 Code Review\n\n`;
  comment += `**Verdict:** ${review.verdict.toUpperCase()}\n\n`;
  comment += `${review.summary}\n\n`;

  if (review.findings && review.findings.length > 0) {
    comment += `### Findings\n\n`;
    for (const f of review.findings) {
      const icon = f.severity === 'high' ? '🟠' :
                   f.severity === 'medium' ? '🟡' : '🟢';
      comment += `${icon} **${f.severity.toUpperCase()}** - ${f.file || 'General'}\n`;
      comment += `- **Issue:** ${f.issue}\n`;
      comment += `- **Suggestion:** ${f.suggestion}\n\n`;
    }
  } else {
    comment += `No findings. Code follows project conventions.\n`;
  }

  comment += `\n---\n*Reviewed by code-reviewer-agent (claude-sonnet-4-20250514)*`;

  writeFileSync('/tmp/code-review.md', comment, 'utf8');
  console.log(`Verdict: ${review.verdict}`);
  console.log(`Findings: ${review.findings ? review.findings.length : 0}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
