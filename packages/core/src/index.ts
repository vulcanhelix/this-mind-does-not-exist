// ============================================================
// This Mind Does Not Exist — Core Package Entry
// ============================================================
// Re-exports all major modules from the core package.
// ============================================================

// Debate engine
export { DebateOrchestrator } from './debate/orchestrator';
export type { DebateConfig, DebateEvent, DebateRound } from './debate/types';

// RAG retriever
export { RAGRetriever } from './rag/retriever';
export type { Template, TemplateMatch } from './rag/types';

// Ollama client
export { OllamaClient } from './ollama/client';

// Storage
export { TraceStore } from './storage/trace-store';
export { TemplateStore } from './storage/template-store';

// Fine-tuning
export { FineTuneManager } from './finetune/manager';

// Server
export { createServer } from './server/index';
