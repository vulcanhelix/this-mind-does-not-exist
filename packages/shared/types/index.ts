// ============================================================
// This Mind Does Not Exist — Shared Types & Schemas
// ============================================================
// Type definitions shared across all packages (core, web, cli).
// These are the canonical types for the entire system.
// ============================================================

// Re-export debate types
export type {
  DebateConfig,
  DebateEvent,
  DebateRound,
  DebateTrace,
  TemplateMatch,
} from '../../core/src/debate/types';

export type { Template, RAGConfig } from '../../core/src/rag/types';

// ─── API Request/Response Types ───

/** Request body for POST /api/reason */
export interface ReasonRequest {
  query: string;
  config?: Partial<{
    rounds: number;
    proposerModel: string;
    skepticModel: string;
    proposerTemperature: number;
    skepticTemperature: number;
  }>;
}

/** Response from POST /api/reason */
export interface ReasonResponse {
  traceId: string;
  streamUrl: string;
}

/** Response from GET /api/health */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  ollama: boolean;
  chromadb: boolean;
  version: string;
  models: {
    proposer: string;
    skeptic: string;
    embedding: string;
  };
}

/** Request body for POST /api/traces/:id/rate */
export interface RateRequest {
  rating: number; // 1-10
}

/** Response from GET /api/models */
export interface ModelsResponse {
  models: {
    name: string;
    size: number;
    modifiedAt: string;
    isDefault: boolean;
    role: 'proposer' | 'skeptic' | 'embedding' | 'available';
  }[];
}

// ─── UI State Types ───

export type DebateViewState = 'idle' | 'loading' | 'debating' | 'synthesizing' | 'complete' | 'error';
