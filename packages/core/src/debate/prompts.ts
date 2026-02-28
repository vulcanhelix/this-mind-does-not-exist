// ============================================================
// This Mind Does Not Exist — Debate Prompt Builders
// ============================================================
// Functions that construct the exact prompts sent to each model
// during the debate process. Reads system prompts from the
// markdown files in packages/core/prompts/.
// ============================================================

import fs from 'fs';
import path from 'path';
import type { DebateRound, TemplateMatch } from './types';

// Cache loaded prompts in memory
const promptCache: Record<string, string> = {};

function loadPrompt(filename: string): string {
  if (promptCache[filename]) return promptCache[filename];

  // Try multiple locations for the prompts directory
  const candidates = [
    path.join(__dirname, '../../prompts', filename),
    path.join(process.cwd(), 'packages/core/prompts', filename),
    path.join(process.cwd(), 'prompts', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8');
      promptCache[filename] = content;
      return content;
    }
  }

  console.warn(`Prompt file not found: ${filename}`);
  return '';
}

function formatTemplates(templates: TemplateMatch[]): string {
  if (templates.length === 0) {
    return `## No Strong Template Match

I was unable to find a reasoning template that closely matches your question.
I will use a general structured reasoning approach instead:

1. Problem Analysis — Break down the question
2. Approach Selection — Choose the best methodology
3. Step-by-Step Reasoning — Execute the approach
4. Verification — Check the result
5. Conclusion — Synthesize the answer`;
  }

  const lines = ['## Available Reasoning Templates', ''];
  lines.push('Based on your question, I\'ve retrieved the following reasoning templates from our library.');
  lines.push('You MUST select the most appropriate template and use it as the structural foundation for your answer.');
  lines.push('You may adapt or extend the template as needed, but your response should follow its core structure.');
  lines.push('');

  templates.forEach((t, i) => {
    lines.push(`### Template ${i + 1}: ${t.name}`);
    lines.push(`**Match Score:** ${(t.score * 100).toFixed(0)}%`);
    if (t.description) lines.push(`**Best For:** ${t.description}`);
    lines.push('**Structure:**');
    lines.push(t.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  lines.push('## Instructions');
  lines.push('1. Review all templates above');
  lines.push('2. Select the one most appropriate for this question (or combine elements from multiple)');
  lines.push('3. State which template(s) you chose and why');
  lines.push('4. Use the template structure as your response scaffold');
  lines.push('5. If none of the templates fit well, use the closest one and extend it');

  return lines.join('\n');
}

function formatDebateHistory(rounds: DebateRound[]): string {
  if (rounds.length === 0) return '';

  const lines = ['## Debate History', ''];
  for (const round of rounds) {
    lines.push(`### Round ${round.round}`);
    lines.push('');
    lines.push('**Proposer\'s Response:**');
    lines.push(round.proposerResponse);
    lines.push('');
    lines.push('**Skeptic\'s Critique:**');
    lines.push(round.skepticResponse);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Build the prompt for the Proposer's first round.
 * Includes: system prompt + RAG templates + user query
 */
export function buildProposerPrompt(
  query: string,
  templates: TemplateMatch[],
  previousRounds: DebateRound[]
): { system: string; user: string } {
  const systemPrompt = loadPrompt('proposer.md');
  const templateSection = formatTemplates(templates);

  if (previousRounds.length === 0) {
    // First round
    const user = [
      templateSection,
      '',
      '---',
      '',
      '## Your Task',
      '',
      `**Question:** ${query}`,
      '',
      'Using the most appropriate reasoning template above, provide your structured first draft answer.',
      'Follow the "First Draft (Round 1)" format from your instructions.',
    ].join('\n');

    return { system: systemPrompt, user };
  } else {
    // Defense round
    const lastRound = previousRounds[previousRounds.length - 1];
    const history = formatDebateHistory(previousRounds.slice(0, -1));

    const user = [
      history.length > 0 ? history : '',
      `## Skeptic's Latest Critique (Round ${lastRound.round})`,
      '',
      lastRound.skepticResponse,
      '',
      '---',
      '',
      '## Your Task',
      '',
      `**Original Question:** ${query}`,
      '',
      `This is Round ${previousRounds.length + 1}. Address every point the Skeptic raised.`,
      'Follow the "Defense Rounds (Rounds 2+)" format from your instructions.',
    ].filter(Boolean).join('\n');

    return { system: systemPrompt, user };
  }
}

/**
 * Build the prompt for the Skeptic.
 * Includes: system prompt + original query + Proposer's latest answer + history
 */
export function buildSkepticPrompt(
  query: string,
  latestProposal: string,
  previousRounds: DebateRound[],
  roundNum: number,
  maxRounds: number
): { system: string; user: string } {
  const systemPrompt = loadPrompt('skeptic.md');
  const history = formatDebateHistory(previousRounds);

  const user = [
    history.length > 0 ? history : '',
    `## Proposer's Latest Response (Round ${roundNum})`,
    '',
    latestProposal,
    '',
    '---',
    '',
    '## Your Task',
    '',
    `**Original Question:** ${query}`,
    '',
    `This is Round ${roundNum} of ${maxRounds}. Apply your critique systematically.`,
    roundNum >= maxRounds
      ? 'This is the FINAL round. Be thorough but fair. If the answer is strong enough (8+/10), signal readiness for synthesis.'
      : roundNum > 1
        ? 'Focus on remaining issues. Acknowledge what was fixed. Dig deeper on persistent problems.'
        : 'This is Round 1. Provide a full comprehensive critique. Hit everything.',
    '',
    'If the answer has reached satisfactory quality (8+/10), end with the "Ready for Synthesis ✅" signal.',
  ].filter(Boolean).join('\n');

  return { system: systemPrompt, user };
}

/**
 * Build the prompt for the Synthesizer.
 * Includes: system prompt + original query + full debate transcript
 */
export function buildSynthesisPrompt(
  query: string,
  rounds: DebateRound[]
): { system: string; user: string } {
  const systemPrompt = loadPrompt('synthesizer.md');
  const transcript = formatDebateHistory(rounds);

  const user = [
    '## Original Question',
    '',
    query,
    '',
    '---',
    '',
    '## Complete Debate Transcript',
    '',
    transcript,
    '---',
    '',
    '## Your Task',
    '',
    'Synthesize the above debate into a single, polished, definitive answer.',
    'Follow the response format from your instructions.',
    'The final answer should be demonstrably better than any individual round.',
  ].join('\n');

  return { system: systemPrompt, user };
}

/**
 * Build the prompt for auto-scoring a debate result.
 */
export function buildAutoScorePrompt(
  query: string,
  finalAnswer: string
): { system: string; user: string } {
  const system = `You are an expert quality evaluator. Your job is to rate the quality of an answer to a question on a scale of 1-10.

Scoring criteria:
- 10: Publication-quality. Could appear in a textbook or journal.
- 9: Expert-level. A domain specialist would be impressed.
- 8: Very strong. Minor improvements possible but answer is solid.
- 7: Good. Addresses the question well with room for polish.
- 6: Adequate. Correct but lacking depth or nuance.
- 5: Mixed. Some good points but significant gaps.
- 1-4: Insufficient. Fundamental problems remain.

Respond with ONLY a JSON object in this exact format:
{"score": <number 1-10>, "reasoning": "<one sentence explanation>"}`;

  const user = `Question: ${query}

Answer:
${finalAnswer}

Rate this answer.`;

  return { system, user };
}
