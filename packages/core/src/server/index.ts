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

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { DebateOrchestrator } from '../debate/orchestrator';
import { DebateConfig, DEFAULT_DEBATE_CONFIG } from '../debate/types';
import { OllamaClient } from '../ollama/client';
import { RAGRetriever } from '../rag/retriever';
import { TraceStore } from '../storage/trace-store';
import { TemplateStore } from '../storage/template-store';
import { FineTuneManager } from '../finetune/manager';
import type { RAGConfig } from '../rag/types';

// In-memory store for active debate streams
const activeDebates = new Map<string, AsyncGenerator<any>>();

export async function createServer() {
  const fastify = Fastify({ 
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    }
  });

  // Register CORS
  await fastify.register(cors, { 
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // Initialize services
  const ollama = new OllamaClient(
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    parseInt(process.env.OLLAMA_TIMEOUT || '120000')
  );

  const dbPath = process.env.DATABASE_PATH || './data/traces.db';
  const traceStore = new TraceStore(dbPath);

  const ragConfig: RAGConfig = {
    chromaUrl: process.env.CHROMADB_URL || 'http://localhost:8000',
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
    topK: parseInt(process.env.RAG_TOP_K || '3'),
    similarityThreshold: 0.65,
    templateDirs: [
      process.env.TEMPLATES_DIR || './data',
      './data/bot-buffer',
      './data/templates',
    ],
  };
  const rag = new RAGRetriever(ragConfig, ollama);
  await rag.init();

  // Index templates on startup
  const templateDirs = [ './data/bot-buffer', './data/templates' ];
  const indexedCount = await rag.indexTemplates(templateDirs);
  console.log(`📚 Indexed ${indexedCount} reasoning templates`);

  const finetuneManager = new FineTuneManager(traceStore, ollama);

  // Debate configuration
  const getDebateConfig = (body: any): DebateConfig => ({
    ...DEFAULT_DEBATE_CONFIG,
    proposerModel: body?.proposerModel || process.env.PROPOSER_MODEL || 'qwen3:32b',
    skepticModel: body?.skepticModel || process.env.SKEPTIC_MODEL || 'llama3.3:70b',
    synthesizerModel: body?.synthesizerModel || process.env.SYNTHESIZER_MODEL || 'qwen3:32b',
    proposerTemperature: body?.proposerTemperature || parseFloat(process.env.PROPOSER_TEMPERATURE || '0.7'),
    skepticTemperature: body?.skepticTemperature || parseFloat(process.env.SKEPTIC_TEMPERATURE || '0.8'),
    synthesizerTemperature: body?.synthesizerTemperature || parseFloat(process.env.SYNTHESIZER_TEMPERATURE || '0.5'),
    maxRounds: body?.maxRounds || parseInt(process.env.DEBATE_ROUNDS || '4'),
    minRounds: body?.minRounds || 3,
    ragTopK: body?.ragTopK || parseInt(process.env.RAG_TOP_K || '3'),
    earlyStopScore: body?.earlyStopScore || 8,
  });

  // === Health Check ===
  fastify.get('/api/health', async (request, reply) => {
    const ollamaOk = await ollama.healthCheck();
    
    return { 
      status: ollamaOk ? 'ok' : 'degraded', 
      ollama: ollamaOk,
      version: '0.1.0',
      templates: indexedCount,
    };
  });

  // === Models ===
  fastify.get('/api/models', async (request, reply) => {
    try {
      const models = await ollama.listModels();
      return { models };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to fetch models', details: String(error) };
    }
  });

  // === Reason (Start Debate) ===
  fastify.post('/api/reason', async (request, reply) => {
    const body = request.body as any;
    const { query, config } = body;

    if (!query || typeof query !== 'string') {
      reply.code(400);
      return { error: 'Query is required' };
    }

    const traceId = randomUUID();
    const debateConfig = getDebateConfig(config);

    // Create orchestrator
    const orchestrator = new DebateOrchestrator(
      debateConfig,
      ollama,
      rag,
      traceStore
    );

    // Store the debate generator
    activeDebates.set(traceId, orchestrator.run(query));

    return { traceId, config: debateConfig };
  });

  // === Reason Stream (SSE) ===
  fastify.get('/api/reason/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    const generator = activeDebates.get(id);

    if (!generator) {
      reply.code(404);
      return { error: 'Debate not found or already completed' };
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      // Stream events
      for await (const event of generator) {
        const data = JSON.stringify(event);
        reply.raw.write(`data: ${data}\n\n`);
        
        // Flush to ensure real-time delivery
        (reply.raw as any).flush?.();

        // Clean up when complete
        if (event.type === 'complete' || event.type === 'error') {
          activeDebates.delete(id);
          break;
        }
      }
    } catch (error) {
      const errorEvent = { type: 'error', error: String(error) };
      reply.raw.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  // === Traces ===
  fastify.get('/api/traces', async (request, reply) => {
    const query = request.query as any;
    const traces = await traceStore.listTraces({
      limit: parseInt(query.limit || '20'),
      offset: parseInt(query.offset || '0'),
      minQuality: query.minQuality ? parseFloat(query.minQuality) : undefined,
      search: query.search,
    });
    
    const stats = await traceStore.getStats();
    return { traces, stats };
  });

  fastify.get('/api/traces/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const trace = await traceStore.getTrace(id);
    
    if (!trace) {
      reply.code(404);
      return { error: 'Trace not found' };
    }
    
    return { trace };
  });

  fastify.post('/api/traces/:id/rate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const { rating } = body;

    if (typeof rating !== 'number' || rating < 1 || rating > 10) {
      reply.code(400);
      return { error: 'Rating must be a number between 1 and 10' };
    }

    await traceStore.rateTrace(id, rating);
    return { success: true, rating };
  });

  // === Templates ===
  fastify.get('/api/templates', async (request, reply) => {
    // Get templates from the RAG retriever's index
    const templates = await rag.search('', 100); // Search empty to get all (implementation detail)
    return { templates };
  });

  fastify.post('/api/templates', async (request, reply) => {
    const body = request.body as any;
    const { filePath } = body;

    if (!filePath) {
      reply.code(400);
      return { error: 'filePath is required' };
    }

    try {
      await rag.addTemplate(filePath);
      return { success: true, filePath };
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to add template', details: String(error) };
    }
  });

  // === Fine-tuning ===
  fastify.post('/api/finetune', async (request, reply) => {
    const body = request.body as any;
    
    try {
      const result = await finetuneManager.startFineTune({
        baseModel: body?.baseModel,
        loraRank: body?.loraRank,
        loraAlpha: body?.loraAlpha,
        epochs: body?.epochs,
        learningRate: body?.learningRate,
      });
      return result;
    } catch (error) {
      reply.code(500);
      return { error: 'Failed to start fine-tuning', details: String(error) };
    }
  });

  fastify.get('/api/finetune/status', async (request, reply) => {
    const runs = traceStore.listFineTuneRuns();
    return { runs };
  });

  fastify.get('/api/finetune/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = traceStore.getFineTuneRun(id);
    
    if (!run) {
      reply.code(404);
      return { error: 'Fine-tune run not found' };
    }
    
    return { run };
  });

  return fastify;
}

// Start the server
const start = async () => {
  const server = await createServer();
  const port = parseInt(process.env.API_PORT || '3001');
  const host = process.env.API_HOST || '0.0.0.0';
  
  try {
    await server.listen({ port, host });
    console.log(`🧠 TMDE API running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
