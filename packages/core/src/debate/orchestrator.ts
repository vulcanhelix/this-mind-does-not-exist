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

import { randomUUID } from 'crypto';
import type { DebateConfig, DebateEvent, DebateRound, DebateTrace, TemplateMatch } from './types';
import { OllamaClient } from '../ollama/client';
import { RAGRetriever } from '../rag/retriever';
import { TraceStore } from '../storage/trace-store';
import { buildProposerPrompt, buildSkepticPrompt, buildSynthesisPrompt, buildAutoScorePrompt } from './prompts';

export class DebateOrchestrator {
  private ollama: OllamaClient;
  private rag: RAGRetriever;
  private traceStore: TraceStore;
  private config: DebateConfig;

  constructor(
    config: DebateConfig,
    ollama: OllamaClient,
    rag: RAGRetriever,
    traceStore: TraceStore
  ) {
    this.config = config;
    this.ollama = ollama;
    this.rag = rag;
    this.traceStore = traceStore;
  }

  /**
   * Run a complete debate for the given query.
   * Yields streaming events for real-time UI updates.
   */
  async *run(query: string): AsyncGenerator<DebateEvent> {
    const startTime = Date.now();
    const traceId = randomUUID();
    const rounds: DebateRound[] = [];
    let templates: TemplateMatch[] = [];
    let finalAnswer = '';
    let ragDuration = 0;
    let synthesisDuration = 0;
    let earlyStopped = false;

    try {
      // Phase 0: RAG Retrieval
      const ragStart = Date.now();
      yield { type: 'rag_start' } as DebateEvent;
      
      templates = await this.rag.search(query, this.config.ragTopK);
      ragDuration = Date.now() - ragStart;
      
      yield { type: 'rag_complete', templates } as DebateEvent;

      // Phase 1-N: Debate Rounds
      for (let round = 1; round <= this.config.maxRounds; round++) {
        yield { type: 'round_start', round } as DebateEvent;

        // Proposer turn
        const proposerPrompt = buildProposerPrompt(query, templates, rounds);
        let proposerResponse = '';
        const proposerStart = Date.now();

        yield { type: 'proposer_start', round } as DebateEvent;
        
        for await (const chunk of this.ollama.chat({
          model: this.config.proposerModel,
          messages: [
            { role: 'system', content: proposerPrompt.system },
            { role: 'user', content: proposerPrompt.user },
          ],
          temperature: this.config.proposerTemperature,
        })) {
          proposerResponse += chunk;
          yield { type: 'proposer_chunk', round, content: chunk } as DebateEvent;
        }

        const proposerDuration = Date.now() - proposerStart;
        yield { 
          type: 'proposer_complete', 
          round, 
          content: proposerResponse, 
          durationMs: proposerDuration 
        } as DebateEvent;

        // Skeptic turn
        const skepticPrompt = buildSkepticPrompt(
          query, 
          proposerResponse, 
          rounds, 
          round, 
          this.config.maxRounds
        );
        let skepticResponse = '';
        const skepticStart = Date.now();

        yield { type: 'skeptic_start', round } as DebateEvent;

        for await (const chunk of this.ollama.chat({
          model: this.config.skepticModel,
          messages: [
            { role: 'system', content: skepticPrompt.system },
            { role: 'user', content: skepticPrompt.user },
          ],
          temperature: this.config.skepticTemperature,
        })) {
          skepticResponse += chunk;
          yield { type: 'skeptic_chunk', round, content: chunk } as DebateEvent;
        }

        const skepticDuration = Date.now() - skepticStart;
        yield { 
          type: 'skeptic_complete', 
          round, 
          content: skepticResponse, 
          durationMs: skepticDuration 
        } as DebateEvent;

        // Record the round
        rounds.push({
          round,
          proposerResponse,
          skepticResponse,
          proposerDurationMs: proposerDuration,
          skepticDurationMs: skepticDuration,
        });

        // Check for early termination
        if (this.shouldTerminate(skepticResponse, round)) {
          earlyStopped = true;
          yield { type: 'early_stop', round } as DebateEvent;
          break;
        }
      }

      // Phase 4: Synthesis
      const synthesisStart = Date.now();
      yield { type: 'synthesis_start' } as DebateEvent;

      const synthesisPrompt = buildSynthesisPrompt(query, rounds);
      
      for await (const chunk of this.ollama.chat({
        model: this.config.synthesizerModel,
        messages: [
          { role: 'system', content: synthesisPrompt.system },
          { role: 'user', content: synthesisPrompt.user },
        ],
        temperature: this.config.synthesizerTemperature,
      })) {
        finalAnswer += chunk;
        yield { type: 'synthesis_chunk', content: chunk } as DebateEvent;
      }

      synthesisDuration = Date.now() - synthesisStart;
      yield { 
        type: 'synthesis_complete', 
        content: finalAnswer, 
        durationMs: synthesisDuration 
      } as DebateEvent;

      // Phase 5: Save trace and auto-score
      const totalDuration = Date.now() - startTime;
      const autoScore = await this.autoScore(query, finalAnswer);

      const trace: DebateTrace = {
        id: traceId,
        createdAt: new Date().toISOString(),
        query,
        templatesUsed: templates.map(t => t.id),
        rounds,
        finalAnswer,
        totalRounds: rounds.length,
        earlyStopped,
        qualityScore: null,
        userRating: null,
        autoScore,
        models: {
          proposer: this.config.proposerModel,
          skeptic: this.config.skepticModel,
          synthesizer: this.config.synthesizerModel,
          embedding: 'nomic-embed-text',
        },
        timing: {
          totalMs: totalDuration,
          ragMs: ragDuration,
          roundsMs: rounds.map(r => r.proposerDurationMs + r.skepticDurationMs),
          synthesisMs: synthesisDuration,
        },
      };

      await this.traceStore.saveTrace(trace);

      yield { type: 'complete', trace } as DebateEvent;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'error', error: errorMessage } as DebateEvent;
    }
  }

  /**
   * Check if the debate should terminate early based on
   * the Skeptic's latest critique.
   */
  private shouldTerminate(critique: string, roundNum: number): boolean {
    // Check for "Ready for Synthesis ✅" signal
    if (critique.includes('Ready for Synthesis ✅')) return true;

    // Check if max rounds reached
    if (roundNum >= this.config.maxRounds) return true;

    // Check if min rounds reached and no critical issues remain
    if (roundNum >= this.config.minRounds) {
      // If no critical issues (🔴) in the critique, we can stop
      if (!critique.includes('🔴')) return true;
    }

    return false;
  }

  /**
   * Auto-score the final answer using a lightweight judge.
   */
  private async autoScore(query: string, finalAnswer: string): Promise<number> {
    try {
      const scorePrompt = buildAutoScorePrompt(query, finalAnswer);
      let scoreText = '';
      
      for await (const chunk of this.ollama.chat({
        model: this.config.skepticModel, // Use skeptic as judge
        messages: [
          { role: 'system', content: scorePrompt.system },
          { role: 'user', content: scorePrompt.user },
        ],
        temperature: 0.3,
      })) {
        scoreText += chunk;
      }

      // Try to parse JSON response
      const match = scoreText.match(/\{[\s\S]*"score"\s*:\s*(\d+)[\s\S]*\}/);
      if (match) {
        return Math.min(10, Math.max(1, parseInt(match[1], 10)));
      }

      // Fallback: simple keyword-based scoring
      if (scoreText.includes('8') || scoreText.includes('9') || scoreText.includes('10')) return 8;
      if (scoreText.includes('7')) return 7;
      if (scoreText.includes('6')) return 6;
      return 5;

    } catch (error) {
      console.warn('Auto-scoring failed:', error);
      return 5; // Default score on error
    }
  }
}
