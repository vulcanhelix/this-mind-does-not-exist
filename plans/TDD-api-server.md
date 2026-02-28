# Technical Design Document — Fastify API Server
## This Mind Does Not Exist — v0.1

**Component:** `packages/core/src/server/index.ts`  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The Fastify API Server is the HTTP layer that exposes the reasoning engine to clients (web UI and CLI). It provides REST endpoints for starting debates, managing traces, listing templates, and checking health. It also provides SSE (Server-Sent Events) endpoints for real-time streaming of debate events.

---

## 2. Design Decisions

### 2.1 Fastify over Express

We chose Fastify because:
- **Performance** — 2-3x faster than Express for JSON APIs
- **TypeScript-first** — Native TypeScript support with schema validation
- **Built-in SSE support** — `reply.sse()` method simplifies streaming
- **Schema validation** — JSON Schema validation is first-class

### 2.2 Stateless API

Each debate is a self-contained request. The API:
1. Accepts a query via POST
2. Returns a trace ID immediately
3. Client connects to SSE endpoint to stream the debate

This avoids session state and allows the client to reconnect if needed.

### 2.3 SSE over WebSockets

Server-Sent Events (SSE) are simpler than WebSockets for our use case:
- **Uni-directional** — Server pushes events to client (no client → server messages needed after initial connection)
- **HTTP-native** — No custom protocol, works over standard HTTP
- **Auto-reconnect** — Browsers automatically reconnect on connection drop
- **Simpler** — No need for WebSocket upgrade handshake

### 2.4 Request Validation with JSON Schema

All inputs are validated using Fastify's built-in JSON Schema support. This ensures:
- Invalid requests are rejected before reaching business logic
- Clear error messages are returned to clients
- Documentation is auto-generated from schemas

---

## 3. API Endpoints

### 3.1 Endpoints Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check (Ollama, ChromaDB, models) |
| `/api/reason` | POST | Start a new debate |
| `/api/reason/:id/stream` | GET | SSE stream of debate events |
| `/api/traces` | GET | List debate traces |
| `/api/traces/:id` | GET | Get a specific trace |
| `/api/traces/:id/rate` | POST | Rate a trace (1-10) |
| `/api/templates` | GET | List reasoning templates |
| `/api/templates` | POST | Add a custom template |
| `/api/models` | GET | List available Ollama models |

### 3.2 Request/Response Schemas

```typescript
// POST /api/reason
interface ReasonRequest {
  query: string;              // Required, 1-4000 chars
  config?: {
    rounds?: number;          // 1-10, default: 3
    proposerModel?: string;   // Ollama model name
    skepticModel?: string;
    proposerTemperature?: number; // 0-2, default: 0.7
    skepticTemperature?: number;  // 0-2, default: 0.8
  };
}

interface ReasonResponse {
  traceId: string;
  streamUrl: string;
}

// GET /api/traces
interface ListTracesQuery {
  limit?: number;       // 1-100, default: 20
  offset?: number;      // >= 0, default: 0
  minQuality?: number;  // 1-10
  search?: string;
  orderBy?: 'created_at' | 'quality_score';
  order?: 'ASC' | 'DESC';
}

interface ListTracesResponse {
  traces: DebateTrace[];
  total: number;
  hasMore: boolean;
}

// GET /api/traces/:id
interface TraceResponse {
  trace: DebateTrace;
}

// POST /api/traces/:id/rate
interface RateRequest {
  rating: number;  // 1-10, required
}

interface RateResponse {
  success: boolean;
  traceId: string;
}

// GET /api/health
interface HealthResponse {
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

// GET /api/models
interface ModelsResponse {
  models: OllamaModelInfo[];
}
```

---

## 4. Implementation Details

### 4.1 Server Creation

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';

export async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,  // Allow all origins in dev
  });

  // Initialize services
  const ollama = new OllamaClient(process.env.OLLAMA_BASE_URL);
  const chroma = new ChromaClient(process.env.CHROMA_URL);
  const rag = new RAGRetriever(chroma, ollama, ragConfig);
  const traceStore = new TraceStore(process.env.DATABASE_PATH);
  const orchestrator = new DebateOrchestrator(ollama, rag, traceStore, debateConfig);

  // Index templates on startup
  await rag.indexTemplates();

  // Register routes
  await registerHealthRoutes(fastify, ollama, chroma);
  await registerReasonRoutes(fastify, orchestrator);
  await registerTraceRoutes(fastify, traceStore);
  await registerTemplateRoutes(fastify, rag);
  await registerModelRoutes(fastify, ollama);

  return fastify;
}
```

### 4.2 Health Check Route

```typescript
async function registerHealthRoutes(fastify, ollama, chroma) {
  fastify.get('/api/health', async () => {
    const ollamaOk = await ollama.healthCheck();
    let chromaOk = false;
    try {
      await chroma.listCollections();
      chromaOk = true;
    } catch {
      chromaOk = false;
    }

    const status = ollamaOk && chromaOk ? 'ok' 
      : ollamaOk || chromaOk ? 'degraded' 
      : 'error';

    return {
      status,
      ollama: ollamaOk,
      chromadb: chromaOk,
      version: '0.1.0',
      models: {
        proposer: 'qwen3:32b',
        skeptic: 'llama3.3:70b',
        embedding: 'nomic-embed-text',
      },
    };
  });
}
```

### 4.3 Reason (Start Debate) Route

```typescript
async function registerReasonRoutes(fastify, orchestrator) {
  const startSchema = {
    body: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 4000 },
        config: {
          type: 'object',
          properties: {
            rounds: { type: 'integer', minimum: 1, maximum: 10 },
            proposerModel: { type: 'string' },
            skepticModel: { type: 'string' },
            proposerTemperature: { type: 'number', minimum: 0, maximum: 2 },
            skepticTemperature: { type: 'number', minimum: 0, maximum: 2 },
          },
        },
      },
    },
  };

  fastify.post('/api/reason', { schema: startSchema }, async (request, reply) => {
    const { query, config } = request.body;
    const traceId = uuid();

    // Merge with default config
    const debateConfig = {
      ...DEFAULT_DEBATE_CONFIG,
      ...config,
    };

    // Start the debate (don't await - run in background)
    const debatePromise = orchestrator.run(query, debateConfig);

    // Store the promise so the SSE endpoint can consume it
    activeDebates.set(traceId, debatePromise);

    return {
      traceId,
      streamUrl: `/api/reason/${traceId}/stream`,
    };
  });
}
```

### 4.4 SSE Stream Route

```typescript
fastify.get('/api/reason/:id/stream', async (request, reply) => {
  const { id } = request.params;
  const debatePromise = activeDebates.get(id);

  if (!debatePromise) {
    return reply.status(404).send({ error: 'Debate not found' });
  }

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send debate events as SSE
  for await (const event of await debatePromise) {
    const sseData = `data: ${JSON.stringify(event)}\n\n`;
    reply.raw.write(sseData);
  }

  // Clean up
  activeDebates.delete(id);
  reply.raw.end();
});
```

### 4.5 Traces Routes

```typescript
async function registerTraceRoutes(fastify, traceStore) {
  // GET /api/traces
  fastify.get('/api/traces', async (request) => {
    const { limit = 20, offset = 0, minQuality, search, orderBy, order } = request.query;
    const traces = traceStore.listTraces({ limit, offset, minQuality, search, orderBy, order });
    return { traces, total: traces.length, hasMore: traces.length === limit };
  });

  // GET /api/traces/:id
  fastify.get('/api/traces/:id', async (request, reply) => {
    const { id } = request.params;
    const trace = traceStore.getTrace(id);
    if (!trace) {
      return reply.status(404).send({ error: 'Trace not found' });
    }
    return { trace };
  });

  // POST /api/traces/:id/rate
  fastify.post('/api/traces/:id/rate', async (request, reply) => {
    const { id } = request.params;
    const { rating } = request.body;

    if (rating < 1 || rating > 10) {
      return reply.status(400).send({ error: 'Rating must be between 1 and 10' });
    }

    await traceStore.rateTrace(id, rating);
    return { success: true, traceId: id };
  });
}
```

---

## 5. Test Specifications

**Test file:** `packages/core/src/server/__tests__/api.test.ts`  
**Framework:** Vitest + `fastify` test client  
**Database:** In-memory SQLite (`:memory:`) for tests

### 5.1 Health Check Tests

```typescript
describe('GET /api/health', () => {
  it('should return ok when Ollama and ChromaDB are healthy', async () => {
    // Arrange: Mock Ollama and ChromaDB to be healthy
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  it('should return degraded when Ollama is down', async () => {
    // Assert: status = 'degraded', ollama = false
  });

  it('should return error when both are down', async () => {
    // Assert: status = 'error'
  });
});
```

### 5.2 POST /api/reason Tests

```typescript
describe('POST /api/reason', () => {
  const schema = {
    body: {
      query: { type: 'string', minLength: 1, maxLength: 4000 },
    },
  };

  it('should return 400 when query is missing', async () => {
    // Act
    const response = await app.inject({ method: 'POST', url: '/api/reason', payload: {} });
    // Assert
    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when query exceeds 4000 chars', async () => {
    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/api/reason',
      payload: { query: 'x'.repeat(4001) },
    });
    // Assert
    expect(response.statusCode).toBe(400);
  });

  it('should return traceId and streamUrl on valid request', async () => {
    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/api/reason',
      payload: { query: 'Prove that √2 is irrational' },
    });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().traceId).toBeDefined();
    expect(response.json().streamUrl).toContain('/api/reason/');
  });

  it('should accept custom config', async () => {
    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/api/reason',
      payload: {
        query: 'test',
        config: { rounds: 5, proposerModel: 'custom-model' },
      },
    });
    // Assert
    expect(response.statusCode).toBe(200);
  });
});
```

### 5.3 GET /api/reason/:id/stream Tests

```typescript
describe('GET /api/reason/:id/stream', () => {
  it('should return 404 for unknown debate ID', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/reason/unknown/stream' });
    // Assert
    expect(response.statusCode).toBe(404);
  });

  it('should stream SSE events', async () => {
    // Arrange: Start a debate
    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/reason',
      payload: { query: 'test' },
    });
    const { traceId } = startResponse.json();

    // Act: Connect to stream
    const response = await app.inject({
      method: 'GET',
      url: `/api/reason/${traceId}/stream`,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    // Parse SSE events
    const events = parseSSE(response.body);
    expect(events).toContainEqual(expect.objectContaining({ type: 'rag_complete' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'round_start' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'complete' }));
  });

  it('should close connection after debate completes', async () => {
    // Assert: Response ends properly
  });
});
```

### 5.4 GET /api/traces Tests

```typescript
describe('GET /api/traces', () => {
  beforeEach(async () => {
    // Insert test traces
  });

  it('should return traces with default pagination', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/traces' });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().traces).toHaveLength(20);
    expect(response.json().total).toBeGreaterThan(0);
  });

  it('should respect limit parameter', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/traces?limit=5' });
    // Assert: traces.length === 5
  });

  it('should respect offset parameter', async () => {
    // Assert: Correctly paginated
  });

  it('should filter by minQuality', async () => {
    // Act: /api/traces?minQuality=8
    // Assert: All traces have quality >= 8
  });

  it('should search by query text', async () => {
    // Act: /api/traces?search=math
    // Assert: Only traces with "math" in query
  });
});
```

### 5.5 POST /api/traces/:id/rate Tests

```typescript
describe('POST /api/traces/:id/rate', () => {
  it('should return 404 for unknown trace', async () => {
    // Assert: 404
  });

  it('should return 400 for invalid rating', async () => {
    // Act: POST with rating: 0, rating: 11
    // Assert: 400
  });

  it('should update rating successfully', async () => {
    // Act
    const response = await app.inject({
      method: 'POST',
      url: '/api/traces/trace-1/rate',
      payload: { rating: 9 },
    });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });
});
```

### 5.6 GET /api/templates Tests

```typescript
describe('GET /api/templates', () => {
  it('should return list of templates', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/templates' });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().templates).toBeInstanceOf(Array);
  });
});
```

### 5.7 GET /api/models Tests

```typescript
describe('GET /api/models', () => {
  it('should return list of available Ollama models', async () => {
    // Act
    const response = await app.inject({ method: 'GET', url: '/api/models' });
    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.json().models).toBeInstanceOf(Array);
  });
});
```

---

## 6. File Structure

```
packages/core/src/server/
├── index.ts                 # createServer() function
├── routes/
│   ├── health.ts           # /api/health
│   ├── reason.ts           # /api/reason
│   ├── traces.ts           # /api/traces
│   ├── templates.ts        # /api/templates
│   └── models.ts           # /api/models
├── plugins/
│   └── validation.ts       # JSON Schema validation setup
└── __tests__/
    ├── api.test.ts         # Main API tests
    ├── health.test.ts
    ├── reason.test.ts
    ├── traces.test.ts
    └── fixtures/
        └── mock-services.ts
```

---

## 7. Acceptance Criteria

- [ ] All unit tests pass
- [ ] Health check correctly reports Ollama and ChromaDB status
- [ ] POST /api/reason returns traceId and streamUrl
- [ ] GET /api/reason/:id/stream streams SSE events correctly
- [ ] Events are properly formatted as SSE (`data: {...}\n\n`)
- [ ] Connection closes after debate completes
- [ ] Traces are listed with correct pagination
- [ ] Rating a trace works correctly
- [ ] Invalid requests return 400 with clear error messages
- [ ] Unknown resources return 404
- [ ] CORS is enabled for web UI
- [ ] Request validation rejects invalid input early
