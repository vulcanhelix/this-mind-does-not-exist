// ============================================================
// This Mind Does Not Exist — Debate Types
// ============================================================

/** Configuration for a debate session */
export interface DebateConfig {
  /** Minimum number of debate rounds */
  minRounds: number;
  /** Maximum number of debate rounds */
  maxRounds: number;
  /** Auto-stop when Skeptic scores above this threshold */
  earlyStopScore: number;
  /** Ollama model ID for the Proposer */
  proposerModel: string;
  /** Ollama model ID for the Skeptic */
  skepticModel: string;
  /** Ollama model ID for the Synthesizer */
  synthesizerModel: string;
  /** Temperature for Proposer generation */
  proposerTemperature: number;
  /** Temperature for Skeptic generation */
  skepticTemperature: number;
  /** Temperature for Synthesizer generation */
  synthesizerTemperature: number;
  /** Number of RAG templates to retrieve */
  ragTopK: number;
}

/** A single round of the debate */
export interface DebateRound {
  /** Round number (1-indexed) */
  round: number;
  /** Proposer's response for this round */
  proposerResponse: string;
  /** Skeptic's critique for this round */
  skepticResponse: string;
  /** Time taken for Proposer's response (ms) */
  proposerDurationMs: number;
  /** Time taken for Skeptic's response (ms) */
  skepticDurationMs: number;
}

/** Events emitted during a debate for real-time streaming */
export type DebateEvent =
  | { type: 'rag_complete'; templates: TemplateMatch[] }
  | { type: 'round_start'; round: number }
  | { type: 'proposer_chunk'; round: number; content: string }
  | { type: 'proposer_complete'; round: number; content: string; durationMs: number }
  | { type: 'skeptic_chunk'; round: number; content: string }
  | { type: 'skeptic_complete'; round: number; content: string; durationMs: number }
  | { type: 'synthesis_start' }
  | { type: 'synthesis_chunk'; content: string }
  | { type: 'synthesis_complete'; content: string; durationMs: number }
  | { type: 'complete'; trace: DebateTrace }
  | { type: 'error'; error: string };

/** Template match from RAG retrieval */
export interface TemplateMatch {
  id: string;
  name: string;
  score: number;
  content: string;
}

/** Complete debate trace for storage */
export interface DebateTrace {
  id: string;
  createdAt: string;
  query: string;
  templatesUsed: string[];
  rounds: DebateRound[];
  finalAnswer: string;
  totalRounds: number;
  earlyStopped: boolean;
  qualityScore: number | null;
  userRating: number | null;
  autoScore: number | null;
  models: {
    proposer: string;
    skeptic: string;
    synthesizer: string;
    embedding: string;
  };
  timing: {
    totalMs: number;
    ragMs: number;
    roundsMs: number[];
    synthesisMs: number;
  };
}

/** Default debate configuration */
export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  minRounds: 3,
  maxRounds: 5,
  earlyStopScore: 8,
  proposerModel: 'qwen3:32b',
  skepticModel: 'llama3.3:70b',
  synthesizerModel: 'qwen3:32b',
  proposerTemperature: 0.7,
  skepticTemperature: 0.8,
  synthesizerTemperature: 0.5,
  ragTopK: 3,
};
