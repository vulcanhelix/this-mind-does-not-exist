// ============================================================
// This Mind Does Not Exist — Debate Prompt Builders
// ============================================================
// Functions that construct the exact prompts sent to each model
// during the debate process. Reads system prompts from the
// markdown files in packages/core/prompts/.
// ============================================================

// import fs from 'fs';
// import path from 'path';
// import type { DebateRound, TemplateMatch } from './types';

/**
 * Build the prompt for the Proposer's first round.
 * Includes: system prompt + RAG templates + user query
 */
export function buildProposerPrompt(
  query: string,
  templates: any[], // TemplateMatch[]
  previousRounds: any[] // DebateRound[]
): string {
  // TODO: Read system prompt from proposer.md
  // TODO: Format templates using rag-retrieval.md template
  // TODO: If previous rounds exist, include critique and defense instructions
  return ''; // Placeholder
}

/**
 * Build the prompt for the Skeptic.
 * Includes: system prompt + original query + Proposer's latest answer + history
 */
export function buildSkepticPrompt(
  query: string,
  latestProposal: string,
  previousRounds: any[], // DebateRound[]
  roundNum: number,
  maxRounds: number
): string {
  // TODO: Read system prompt from skeptic.md
  // TODO: Format debate history
  // TODO: Include round context (e.g., "Round 2 of 5")
  return ''; // Placeholder
}

/**
 * Build the prompt for the Synthesizer.
 * Includes: system prompt + original query + full debate transcript
 */
export function buildSynthesisPrompt(
  query: string,
  rounds: any[] // DebateRound[]
): string {
  // TODO: Read system prompt from synthesizer.md
  // TODO: Format complete debate transcript
  return ''; // Placeholder
}

/**
 * Build the prompt for auto-scoring a debate result.
 */
export function buildAutoScorePrompt(
  query: string,
  finalAnswer: string
): string {
  // TODO: Read auto-scoring template from debate-template.md
  return ''; // Placeholder
}
