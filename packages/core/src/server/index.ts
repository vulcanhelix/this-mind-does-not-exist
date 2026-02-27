// ============================================================
// This Mind Does Not Exist — Fastify API Server
// ============================================================
// REST API + SSE server for the reasoning engine.
//
// Endpoints:
//   POST /api/reason             → Start a new debate
//   GET  /api/reason/:id/stream  → SSE stream of debate events
//   GET  /api/traces             → List debate traces
//   GET  /api/traces/:id         → Get specific trace
//   POST /api/traces/:id/rate    → Rate a trace
//   GET  /api/templates          → List reasoning templates
//   POST /api/templates          → Add a custom template
//   GET  /api/models             → List available Ollama models
//   POST /api/finetune           → Trigger fine-tuning
//   GET  /api/finetune/status    → Check fine-tuning status
//   GET  /api/health             → Health check
// ============================================================

// import Fastify from 'fastify';
// import cors from '@fastify/cors';
// import { DebateOrchestrator } from '../debate/orchestrator';
// import { OllamaClient } from '../ollama/client';
// import { RAGRetriever } from '../rag/retriever';
// import { TraceStore } from '../storage/trace-store';
// import { FineTuneManager } from '../finetune/manager';

export async function createServer() {
  // const fastify = Fastify({ logger: true });

  // Register CORS
  // await fastify.register(cors, { origin: true });

  // Initialize services
  // const ollama = new OllamaClient(process.env.OLLAMA_BASE_URL);
  // const rag = new RAGRetriever();
  // const traceStore = new TraceStore(process.env.DATABASE_PATH);
  // const finetune = new FineTuneManager();
  // const debateOrchestrator = new DebateOrchestrator(config);

  // === Health Check ===
  // fastify.get('/api/health', async () => {
  //   const ollamaOk = await ollama.healthCheck();
  //   return { status: 'ok', ollama: ollamaOk, version: '0.1.0' };
  // });

  // === Reason (Start Debate) ===
  // fastify.post('/api/reason', async (request, reply) => {
  //   const { query, config } = request.body;
  //   // Start debate, return trace ID
  //   // Client then connects to /api/reason/:id/stream for SSE
  // });

  // === Reason Stream (SSE) ===
  // fastify.get('/api/reason/:id/stream', async (request, reply) => {
  //   // Set SSE headers
  //   // Stream debate events as they happen
  //   // Close connection when debate completes
  // });

  // === Traces ===
  // fastify.get('/api/traces', ...)
  // fastify.get('/api/traces/:id', ...)
  // fastify.post('/api/traces/:id/rate', ...)

  // === Templates ===
  // fastify.get('/api/templates', ...)
  // fastify.post('/api/templates', ...)

  // === Models ===
  // fastify.get('/api/models', ...)

  // === Fine-tuning ===
  // fastify.post('/api/finetune', ...)
  // fastify.get('/api/finetune/status', ...)

  // return fastify;
}

// Start the server
// const start = async () => {
//   const server = await createServer();
//   const port = parseInt(process.env.API_PORT || '3001');
//   const host = process.env.API_HOST || '0.0.0.0';
//   await server.listen({ port, host });
//   console.log(`🧠 TMDE API running at http://${host}:${port}`);
// };
// start();
