/**
 * @file Security Reviewer Agent - Claude API caller
 * @purpose Reviews implementation PRs against ASVS controls, ISM requirements,
 *          and the project security baseline. Can approve or veto.
 * @inputs Environment variables: ANTHROPIC_API_KEY, PR_NUMBER, PR_DIFF
 * @outputs Posts review comments on the PR
 */

import { readFileSync, appendFileSync } from 'fs';

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

const security = readDoc('docs/SECURITY_BASELINE.md');
const agents = readDoc('docs/AGENTS.md');
const conventions = readDoc('docs/CONVENTIONS.md');

// Find the spec for context
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

const systemPrompt = `You are the Security Reviewer Agent in an AI software factory. Your role is to review implementation code against ASVS controls and the project security baseline.

You MUST follow the rules in AGENTS.md for the Security Reviewer role.

Your review checklist:
1. Verify no endpoint bypasses auth middleware
2. Verify RLS policies match the data model's ownership rules
3. Check for logic flaws (race conditions, business logic bypass, state manipulation)
4. Verify Tier 2 decisions did not introduce security weaknesses
5. Check spec Security Requirements against implementation
6. Verify Zod schemas are used at all API boundaries
7. Check for sensitive data in logs or error responses
8. Verify no use of service_role key in client-facing code
9. Check for any direct SQL queries bypassing the query builder
10. Verify new dependencies are justified and scanned

Output your review as JSON:
{
  "verdict": "approve" | "request_changes" | "veto",
  "summary": "Brief overall assessment",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "file": "path/to/file.ts",
      "line_hint": "relevant code or description",
      "issue": "What is wrong",
      "remediation": "How to fix it",
      "control": "ASVS/ISM control reference"
    }
  ]
}

Rules for verdicts:
- "approve": No critical or high findings. Medium/low are noted but not blocking.
- "request_changes": High severity findings that need fixing.
- "veto": Critical security issues. Only the human can override a veto.

Output ONLY valid JSON. No preamble, no markdown fences.`;

const userPrompt = `Here is the security baseline for this project:

<security_baseline>
${security}
</security_baseline>

<conventions>
${conventions}
</conventions>

<spec>
${specContent}
</spec>

---

Here is the PR diff to review:

<diff>
${PR_DIFF}
</diff>

Review this implementation for security issues.`;

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
  console.log(`Security review for PR #${PR_NUMBER}`);
  console.log('Calling Claude API...');

  const responseText = await callClaude();
  let review;

  try {
    review = parseReview(responseText);
  } catch (err) {
    console.error('Failed to parse review:', err.message);
    console.error('Raw (first 500):', responseText.slice(0, 500));
    // Output a default review that flags the parse failure
    review = {
      verdict: 'request_changes',
      summary: 'Security review could not be completed due to a parsing error. Manual review required.',
      findings: [],
    };
  }

  // Write outputs for the workflow
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${review.verdict}\n`);
  }

  // Build the review comment
  let comment = `## 🔒 Security Review\n\n`;
  comment += `**Verdict:** ${review.verdict.toUpperCase()}\n\n`;
  comment += `${review.summary}\n\n`;

  if (review.findings && review.findings.length > 0) {
    comment += `### Findings\n\n`;
    for (const f of review.findings) {
      const icon = f.severity === 'critical' ? '🔴' :
                   f.severity === 'high' ? '🟠' :
                   f.severity === 'medium' ? '🟡' : '🟢';
      comment += `${icon} **${f.severity.toUpperCase()}** - ${f.file || 'General'}\n`;
      if (f.line_hint) comment += `> ${f.line_hint}\n`;
      comment += `- **Issue:** ${f.issue}\n`;
      comment += `- **Fix:** ${f.remediation}\n`;
      if (f.control) comment += `- **Control:** ${f.control}\n`;
      comment += `\n`;
    }
  } else {
    comment += `No security findings.\n`;
  }

  comment += `\n---\n*Reviewed by security-reviewer-agent (claude-sonnet-4-20250514)*`;

  // Write comment to file for the workflow to post
  writeFileSync('/tmp/security-review.md', comment, 'utf8');
  console.log(`Verdict: ${review.verdict}`);
  console.log(`Findings: ${review.findings ? review.findings.length : 0}`);
}

import { writeFileSync } from 'fs';

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
