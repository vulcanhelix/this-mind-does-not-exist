// ============================================================
// This Mind Does Not Exist — Debate Orchestrator
// ============================================================
// The heart of the system. Manages the multi-round adversarial
// debate between Proposer and Skeptic models.
//
// Flow:
//   1. Receive user query
//   2. Retrieve reasoning templates via RAG
//   3. Send query + templates to Proposer
//   4. Send Proposer's answer to Skeptic
//   5. Loop for N rounds (early termination if quality threshold met)
//   6. Synthesize final answer
//   7. Save trace and auto-score
//
// Event streaming:
//   The orchestrator yields DebateEvent objects that can be
//   streamed to the client via SSE for real-time visualization.
// ============================================================

import type { DebateConfig, DebateEvent, DebateRound } from './types';
// import { OllamaClient } from '../ollama/client';
// import { RAGRetriever } from '../rag/retriever';
// import { TraceStore } from '../storage/trace-store';
// import { buildProposerPrompt, buildSkepticPrompt, buildSynthesisPrompt } from './prompts';

export class DebateOrchestrator {
  // private ollama: OllamaClient;
  // private rag: RAGRetriever;
  // private traceStore: TraceStore;
  // private config: DebateConfig;

  constructor(config: DebateConfig) {
    // TODO: Initialize Ollama client
    // TODO: Initialize RAG retriever
    // TODO: Initialize trace store
    // this.config = config;
  }

  /**
   * Run a complete debate for the given query.
   * Yields streaming events for real-time UI updates.
   */
  async *run(query: string): AsyncGenerator<DebateEvent> {
    // TODO: Implement the full debate loop
    // See packages/core/prompts/debate-template.md for exact flow

    // Phase 0: RAG Retrieval
    // const templates = await this.rag.search(query);
    // yield { type: 'rag_complete', templates };

    // Phase 1-3: Debate Rounds
    // for (let round = 1; round <= this.config.maxRounds; round++) { ... }

    // Phase 4: Synthesis
    // Phase 5: Save & Score

    yield {
      type: 'complete',
      data: { message: 'Debate orchestrator not yet implemented' }
    } as any;
  }

  /**
   * Check if the debate should terminate early based on
   * the Skeptic's latest critique.
   */
  private shouldTerminate(critique: string, roundNum: number): boolean {
    // Check for "Ready for Synthesis ✅" signal
    if (critique.includes('Ready for Synthesis ✅')) return true;

    // Check if max rounds reached
    // if (roundNum >= this.config.maxRounds) return true;

    // Check if no critical issues remain after min rounds
    // if (!critique.includes('🔴') && roundNum >= this.config.minRounds) return true;

    return false;
  }
}
