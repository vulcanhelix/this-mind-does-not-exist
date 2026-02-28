# Technical Design Document — Ollama Client
## This Mind Does Not Exist — v0.1

**Component:** `packages/core/src/ollama/client.ts`  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The Ollama Client is a thin, typed wrapper around the Ollama HTTP API. It provides streaming text generation, chat completion, embedding generation, and model management. It is the lowest-level component in the stack — all LLM calls flow through it.

---

## 2. Design Decisions

### 2.1 Streaming via AsyncGenerator

All generation methods use `AsyncGenerator<string>` to yield tokens as they arrive. This allows the debate orchestrator to pipe tokens directly to SSE without buffering the full response.

```typescript
// Usage pattern
for await (const token of ollama.generate({ model, prompt })) {
  sseStream.write(token);
}
```

### 2.2 NDJSON Parsing

Ollama streams responses as newline-delimited JSON (NDJSON). Each line is a JSON object with a `response` field (for `/api/generate`) or `message.content` field (for `/api/chat`). The client parses these incrementally.

### 2.3 Retry with Exponential Backoff

Network errors and timeouts are retried up to 3 times with delays of 1s, 2s, 4s. This handles transient Ollama unavailability without failing the entire debate.

### 2.4 AbortController for Timeouts

Each request uses an `AbortController` with a configurable timeout (default: 120 seconds). This prevents hanging requests from blocking the debate loop.

---

## 3. Interface Specification

```typescript
// packages/core/src/ollama/client.ts

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface OllamaEmbedOptions {
  model: string;
  input: string | string[];
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
  digest: string;
}

export class OllamaClient {
  constructor(baseUrl?: string, timeout?: number);

  // Streaming text generation — yields tokens
  generate(options: OllamaGenerateOptions): AsyncGenerator<string>;

  // Streaming chat completion — yields tokens
  chat(options: OllamaChatOptions): AsyncGenerator<string>;

  // Embedding generation — returns vectors
  embed(options: OllamaEmbedOptions): Promise<number[][]>;

  // List available models
  listModels(): Promise<OllamaModelInfo[]>;

  // Check if Ollama is running
  healthCheck(): Promise<boolean>;

  // Pull a model (streaming progress)
  pullModel(modelName: string): AsyncGenerator<{ status: string; completed?: number; total?: number }>;
}
```

---

## 4. Implementation Details

### 4.1 `generate()` Implementation

```typescript
async *generate(options: OllamaGenerateOptions): AsyncGenerator<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), this.timeout);

  try {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options, stream: true }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OllamaError(`HTTP ${response.status}: ${await response.text()}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        if (parsed.response) yield parsed.response;
        if (parsed.done) return;
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 4.2 Retry Wrapper

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      if (error instanceof AbortError) throw error; // Don't retry timeouts
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
  throw new Error('Unreachable');
}
```

### 4.3 Error Types

```typescript
export class OllamaError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'OllamaError';
  }
}

export class OllamaTimeoutError extends OllamaError {
  constructor(model: string, timeoutMs: number) {
    super(`Model ${model} timed out after ${timeoutMs}ms`);
    this.name = 'OllamaTimeoutError';
  }
}

export class OllamaModelNotFoundError extends OllamaError {
  constructor(model: string) {
    super(`Model ${model} not found. Run: ollama pull ${model}`);
    this.name = 'OllamaModelNotFoundError';
  }
}
```

---

## 5. Test Specifications

**Test file:** `packages/core/src/ollama/__tests__/client.test.ts`  
**Framework:** Vitest  
**Mocking:** `vi.fn()` + `msw` (Mock Service Worker) for HTTP mocking

### 5.1 Unit Tests

#### Test Suite: `OllamaClient.generate()`

```typescript
describe('OllamaClient.generate()', () => {
  it('should yield tokens from NDJSON stream', async () => {
    // Arrange: Mock /api/generate to return NDJSON stream
    // {"response":"Hello","done":false}
    // {"response":" world","done":false}
    // {"response":"","done":true}
    
    // Act: Collect all yielded tokens
    const tokens: string[] = [];
    for await (const token of client.generate({ model: 'test', prompt: 'Hi' })) {
      tokens.push(token);
    }
    
    // Assert
    expect(tokens).toEqual(['Hello', ' world']);
  });

  it('should handle empty response lines gracefully', async () => {
    // Arrange: Stream with blank lines between JSON objects
    // Assert: No errors, tokens collected correctly
  });

  it('should throw OllamaError on non-200 response', async () => {
    // Arrange: Mock 404 response
    // Assert: throws OllamaError with status 404
  });

  it('should throw OllamaModelNotFoundError when model not found', async () => {
    // Arrange: Mock 404 with "model not found" message
    // Assert: throws OllamaModelNotFoundError
  });

  it('should abort and throw OllamaTimeoutError after timeout', async () => {
    // Arrange: Mock slow response (never resolves within timeout)
    // Act: Create client with 100ms timeout
    // Assert: throws OllamaTimeoutError within ~150ms
  });

  it('should retry on network error (up to 3 times)', async () => {
    // Arrange: Mock first 2 calls to fail, 3rd to succeed
    // Assert: Returns successfully, fetch called 3 times
  });

  it('should NOT retry on AbortError (timeout)', async () => {
    // Arrange: Mock to always timeout
    // Assert: fetch called exactly once, throws OllamaTimeoutError
  });

  it('should pass temperature and options to Ollama', async () => {
    // Arrange: Capture request body
    // Act: Call generate with temperature: 0.8
    // Assert: Request body contains temperature: 0.8
  });

  it('should always set stream: true in request body', async () => {
    // Assert: stream: true regardless of options.stream value
  });
});
```

#### Test Suite: `OllamaClient.chat()`

```typescript
describe('OllamaClient.chat()', () => {
  it('should yield tokens from chat NDJSON stream', async () => {
    // Arrange: Mock /api/chat NDJSON
    // {"message":{"role":"assistant","content":"Hello"},"done":false}
    // {"message":{"role":"assistant","content":" world"},"done":false}
    // {"done":true}
    
    // Assert: tokens = ['Hello', ' world']
  });

  it('should send messages array correctly', async () => {
    // Arrange: Capture request body
    // Act: Call chat with system + user messages
    // Assert: messages array matches input
  });

  it('should handle multi-turn conversation history', async () => {
    // Arrange: 3-message conversation
    // Assert: All messages sent in correct order
  });
});
```

#### Test Suite: `OllamaClient.embed()`

```typescript
describe('OllamaClient.embed()', () => {
  it('should return embedding vectors for single string', async () => {
    // Arrange: Mock /api/embed to return { embeddings: [[0.1, 0.2, ...]] }
    // Assert: Returns [[0.1, 0.2, ...]]
  });

  it('should return multiple embedding vectors for array input', async () => {
    // Arrange: Mock to return 2 vectors
    // Assert: Returns array of 2 vectors
  });

  it('should throw OllamaError on failure', async () => {
    // Arrange: Mock 500 response
    // Assert: throws OllamaError
  });
});
```

#### Test Suite: `OllamaClient.listModels()`

```typescript
describe('OllamaClient.listModels()', () => {
  it('should return list of available models', async () => {
    // Arrange: Mock /api/tags to return model list
    // Assert: Returns correctly shaped OllamaModelInfo[]
  });

  it('should return empty array when no models installed', async () => {
    // Arrange: Mock { models: [] }
    // Assert: Returns []
  });
});
```

#### Test Suite: `OllamaClient.healthCheck()`

```typescript
describe('OllamaClient.healthCheck()', () => {
  it('should return true when Ollama is running', async () => {
    // Arrange: Mock /api/tags to return 200
    // Assert: Returns true
  });

  it('should return false when Ollama is not running', async () => {
    // Arrange: Mock fetch to throw connection refused
    // Assert: Returns false (no throw)
  });

  it('should return false on non-200 response', async () => {
    // Arrange: Mock 503 response
    // Assert: Returns false
  });
});
```

### 5.2 Integration Tests

```typescript
describe('OllamaClient Integration (requires running Ollama)', () => {
  // These tests are skipped in CI unless OLLAMA_INTEGRATION=true
  
  it.skipIf(!process.env.OLLAMA_INTEGRATION)(
    'should generate text with real model',
    async () => {
      const client = new OllamaClient();
      const tokens: string[] = [];
      for await (const token of client.generate({
        model: 'nomic-embed-text', // Small model for testing
        prompt: 'Say "test" and nothing else',
      })) {
        tokens.push(token);
      }
      expect(tokens.join('')).toContain('test');
    }
  );
});
```

---

## 6. File Structure

```
packages/core/src/ollama/
├── client.ts          # Main OllamaClient class
├── errors.ts          # OllamaError, OllamaTimeoutError, etc.
├── types.ts           # OllamaGenerateOptions, OllamaChatOptions, etc.
└── __tests__/
    ├── client.test.ts # Unit tests
    └── fixtures/
        ├── generate-stream.ndjson   # Mock NDJSON response
        ├── chat-stream.ndjson       # Mock chat NDJSON response
        └── embed-response.json      # Mock embed response
```

---

## 7. Dependencies

- **No new dependencies required** — uses native `fetch` API (Node.js 18+)
- Test dependencies: `vitest`, `msw` (for HTTP mocking)

---

## 8. Acceptance Criteria

- [ ] All unit tests pass
- [ ] `generate()` correctly streams tokens from NDJSON
- [ ] `chat()` correctly streams tokens from chat NDJSON
- [ ] `embed()` returns correct vector arrays
- [ ] Timeout handling works correctly (AbortController)
- [ ] Retry logic works (3 attempts, exponential backoff)
- [ ] Error types are correctly thrown and distinguishable
- [ ] No memory leaks (ReadableStream readers are always released)
