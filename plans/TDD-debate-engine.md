# Technical Design Document — Core Debate Engine
## This Mind Does Not Exist — v0.1

**Component:** `packages/core/src/debate/orchestrator.ts` + `packages/core/src/debate/prompts.ts`  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The Debate Engine is the heart of the system. It orchestrates a structured adversarial debate between a **Proposer** model (which builds rigorous answers using reasoning templates) and a **Skeptic** model (which critiques and attacks every assumption and logical gap). After 3–5 rounds, a **Synthesizer** pass produces a clean, polished final answer.

The engine is implemented as an async generator that yields `DebateEvent` objects in real-time, enabling SSE streaming to clients.

---

## 2. Design Decisions

### 2.1 AsyncGenerator for Streaming

The `run()` method is an `AsyncGenerator<DebateEvent>` that yields events as they occur. This design:
- Enables zero-buffering token streaming to clients via SSE
- Allows the API layer to forward events directly without transformation
- Makes the orchestrator testable (caller can consume events at their own pace)

### 2.2 Prompt Builders are Pure Functions

Prompt building logic (`buildProposerPrompt`, `buildSkepticPrompt`, `buildSynthesisPrompt`) is separated from the orchestrator and implemented as pure functions. This makes them:
- Easily testable (given inputs → expected output)
- Reusable across different orchestrator implementations
- Pluggable (different prompt strategies can be swapped)

### 2.3 Early Termination Logic

The debate can end early in three scenarios:
1. **Skeptic signals "Ready for Synthesis"** — Skeptic explicitly marks the answer as satisfactory (score ≥ 8)
2. **Max rounds reached** — Hard limit prevents infinite debates
3. **No critical issues remain** — After min rounds, if Skeptic has no 🔴 issues, terminate

### 2.4 Error Handling Strategy

| Error Type | Handling |
|---|---|
| Model timeout | Retry once, then yield error event and stop |
| Model unavailable | Yield error event with clear message |
| OOM during generation | Yield partial results, then error event |
| Network error | Retry with exponential backoff (via OllamaClient) |

---

## 3. Interface Specification

### 3.1 Types

```typescript
// packages/core/src/debate/types.ts

export interface DebateConfig {
  minRounds: number;           // Default: 3
  maxRounds: number;           // Default: 5
  earlyStopScore: number;      // Default: 8 (Skeptic's score to trigger early stop)
  proposerModel: string;       // Default: 'qwen3:32b'
  skepticModel: string;        // Default: 'llama3.3:70b'
  synthesizerModel: string;    // Default: 'qwen3:32b'
  proposerTemperature: number; // Default: 0.7
  skepticTemperature: number;  // Default: 0.8
  synthesizerTemperature: number; // Default: 0.5
  ragTopK: number;             // Default: 3
}

export interface DebateRound {
  round: number;
  proposerResponse: string;
  skepticResponse: string;
  proposerDurationMs: number;
  skepticDurationMs: number;
}

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
  | { type: 'error'; error: string; round?: number };
```

### 3.2 Orchestrator Class

```typescript
export class DebateOrchestrator {
  constructor(
    private ollama: OllamaClient,
    private rag: RAGRetriever,
    private traceStore: TraceStore,
    private config: DebateConfig
  ) {}

  // Run a complete debate for the given query
  // Yields streaming events for real-time UI updates
  async *run(query: string): AsyncGenerator<DebateEvent> {
    // Implementation...
  }

  // Check if debate should terminate early
  private shouldTerminate(critique: string, roundNum: number): boolean {
    // Implementation...
  }
}
```

### 3.3 Prompt Builders

```typescript
export function buildProposerPrompt(
  query: string,
  templates: TemplateMatch[],
  previousRounds: DebateRound[]
): string;

export function buildSkepticPrompt(
  query: string,
  latestProposal: string,
  previousRounds: DebateRound[],
  roundNum: number,
  maxRounds: number
): string;

export function buildSynthesisPrompt(
  query: string,
  rounds: DebateRound[]
): string;
```

---

## 4. Data Flow

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 0: RAG Retrieval                                               │
│ • Embed query using nomic-embed-text                                │
│ • Search ChromaDB for top-K templates                               │
│ • Yield: { type: 'rag_complete', templates: [...] }                │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 1: Debate Loop (3-5 rounds)                                  │
│                                                                     │
│  For each round:                                                    │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ Proposer Turn                                              │ │
│    │ • Build prompt with templates + query + history           │ │
│    │ • Stream tokens via OllamaClient.generate()                │ │
│    │ • Yield: { type: 'proposer_chunk', content: '...' }        │ │
│    │ • Yield: { type: 'proposer_complete', content, durationMs }│ │
│    └─────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ Skeptic Turn                                               │ │
│    │ • Build prompt with proposal + history                    │ │
│    │ • Stream tokens via OllamaClient.generate()                │ │
│    │ • Yield: { type: 'skeptic_chunk', content: '...' }         │ │
│    │ • Yield: { type: 'skeptic_complete', content, durationMs }│ │
│    └─────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│    Check Early Termination:                                         │
│      • Skeptic signals "Ready for Synthesis"? → Exit loop         │
│      • Max rounds reached? → Exit loop                             │
│      • No critical issues after min rounds? → Exit loop            │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 2: Synthesis                                                  │
│ • Build synthesis prompt with full debate transcript               │
│ • Stream final answer via Ollama                                    │
│ • Yield: { type: 'synthesis_chunk', content: '...' }              │
│ • Yield: { type: 'synthesis_complete', content, durationMs }      │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 3: Save & Return                                              │
│ • Assemble DebateTrace object                                       │
│ • Save to TraceStore                                                │
│ • Yield: { type: 'complete', trace: DebateTrace }                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Details

### 5.1 Orchestrator Run Method

```typescript
async *run(query: string): AsyncGenerator<DebateEvent> {
  const startTime = Date.now();
  const traceId = uuid();
  const rounds: DebateRound[] = [];
  const timing = { ragMs: 0, roundsMs: [] as number[], synthesisMs: 0 };

  try {
    // Phase 0: RAG Retrieval
    const ragStart = Date.now();
    const templates = await this.rag.search(query, this.config.ragTopK);
    timing.ragMs = Date.now() - ragStart;
    yield { type: 'rag_complete', templates };

    // Phase 1: Debate Loop
    let earlyStopped = false;
    for (let round = 1; round <= this.config.maxRounds; round++) {
      yield { type: 'round_start', round };

      // Proposer turn
      const proposerStart = Date.now();
      const proposerPrompt = buildProposerPrompt(query, templates, rounds);
      let proposerContent = '';

      for await (const token of this.ollama.generate({
        model: this.config.proposerModel,
        prompt: proposerPrompt,
        temperature: this.config.proposerTemperature,
      })) {
        proposerContent += token;
        yield { type: 'proposer_chunk', round, content: token };
      }

      const proposerDurationMs = Date.now() - proposerStart;
      yield {
        type: 'proposer_complete',
        round,
        content: proposerContent,
        durationMs: proposerDurationMs,
      };

      // Skeptic turn
      const skepticStart = Date.now();
      const skepticPrompt = buildSkepticPrompt(
        query,
        proposerContent,
        rounds,
        round,
        this.config.maxRounds
      );
      let skepticContent = '';

      for await (const token of this.ollama.generate({
        model: this.config.skepticModel,
        prompt: skepticPrompt,
        temperature: this.config.skepticTemperature,
      })) {
        skepticContent += token;
        yield { type: 'skeptic_chunk', round, content: token };
      }

      const skepticDurationMs = Date.now() - skepticStart;
      yield {
        type: 'skeptic_complete',
        round,
        content: skepticContent,
        durationMs: skepticDurationMs,
      };

      // Record round
      rounds.push({
        round,
        proposerResponse: proposerContent,
        skepticResponse: skepticContent,
        proposerDurationMs,
        skepticDurationMs,
      });
      timing.roundsMs.push(proposerDurationMs + skepticDurationMs);

      // Early termination check
      if (this.shouldTerminate(skepticContent, round)) {
        earlyStopped = true;
        break;
      }
    }

    // Phase 2: Synthesis
    const synthesisStart = Date.now();
    yield { type: 'synthesis_start' };

    const synthesisPrompt = buildSynthesisPrompt(query, rounds);
    let finalAnswer = '';

    for await (const token of this.ollama.generate({
      model: this.config.synthesizerModel,
      prompt: synthesisPrompt,
      temperature: this.config.synthesizerTemperature,
    })) {
      finalAnswer += token;
      yield { type: 'synthesis_chunk', content: token };
    }

    timing.synthesisMs = Date.now() - synthesisStart;
    yield {
      type: 'synthesis_complete',
      content: finalAnswer,
      durationMs: timing.synthesisMs,
    };

    // Phase 3: Save trace
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
      autoScore: null,
      models: {
        proposer: this.config.proposerModel,
        skeptic: this.config.skepticModel,
        synthesizer: this.config.synthesizerModel,
        embedding: 'nomic-embed-text',
      },
      timing: {
        totalMs: Date.now() - startTime,
        ...timing,
      },
    };

    await this.traceStore.saveTrace(trace);
    yield { type: 'complete', trace };

  } catch (error) {
    yield { type: 'error', error: error.message };
  }
}
```

### 5.2 Early Termination Logic

```typescript
private shouldTerminate(critique: string, roundNum: number): boolean {
  // 1. Skeptic signals ready for synthesis
  if (critique.includes('Ready for Synthesis ✅')) {
    return true;
  }

  // 2. Max rounds reached
  if (roundNum >= this.config.maxRounds) {
    return true;
  }

  // 3. After min rounds, if no critical issues, terminate
  if (roundNum >= this.config.minRounds) {
    const hasCriticalIssues = critique.includes('🔴');
    if (!hasCriticalIssues) {
      return true;
    }
  }

  return false;
}
```

---

## 6. Test Specifications

**Test file:** `packages/core/src/debate/__tests__/orchestrator.test.ts`  
**Framework:** Vitest  
**Mocking:** `vi.mock()` for OllamaClient, RAGRetriever, TraceStore

### 6.1 Prompt Builder Tests

```typescript
describe('buildProposerPrompt()', () => {
  it('should include system prompt, templates, and query', () => {
    // Arrange
    const query = 'Prove that √2 is irrational';
    const templates = [{ id: 'bot-proof', name: 'Proof by Contradiction', content: '...' }];
    
    // Act
    const prompt = buildProposerPrompt(query, templates, []);
    
    // Assert
    expect(prompt).toContain('You are the Proposer');
    expect(prompt).toContain(query);
    expect(prompt).toContain('Proof by Contradiction');
  });

  it('should format templates correctly', () => {
    // Assert: Templates are formatted with ###Template sections
  });

  it('should include previous rounds in defense rounds', () => {
    // Arrange: previousRounds with round 1 critique
    // Act: buildProposerPrompt for round 2
    // Assert: Prompt includes critique and defense instructions
  });
});

describe('buildSkepticPrompt()', () => {
  it('should include system prompt, proposal, and history', () => {
    // Assert: Contains Skeptic identity, proposal, debate history
  });

  it('should include round context (e.g., "Round 2 of 5")', () => {
    // Assert: Prompt mentions current round number
  });

  it('should escalate critique intensity over rounds', () => {
    // Assert: Round 3 prompt has stronger language than round 1
  });
});

describe('buildSynthesisPrompt()', () => {
  it('should include full debate transcript', () => {
    // Assert: Contains all rounds' proposer and skeptic responses
  });

  it('should instruct synthesizer to produce polished final answer', () => {
    // Assert: Contains synthesis instructions
  });
});
```

### 6.2 Orchestrator Tests

```typescript
describe('DebateOrchestrator.run()', () => {
  let mockOllama: MockOllamaClient;
  let mockRAG: MockRAGRetriever;
  let mockTraceStore: MockTraceStore;
  let orchestrator: DebateOrchestrator;

  beforeEach(() => {
    mockOllama = createMockOllamaClient();
    mockRAG = createMockRAGRetriever();
    mockTraceStore = createMockTraceStore();
    orchestrator = new DebateOrchestrator(mockOllama, mockRAG, mockTraceStore, defaultConfig);
  });

  it('should yield rag_complete event with templates', async () => {
    // Arrange
    mockRAG.search.mockResolvedValue([template1, template2]);
    
    // Act
    const events = await collectEvents(orchestrator.run('test query'));
    
    // Assert: First event is rag_complete with templates
    expect(events[0].type).toBe('rag_complete');
    expect(events[0].templates).toHaveLength(2);
  });

  it('should run correct number of rounds', async () => {
    // Arrange: maxRounds = 3
    mockOllama.generate.mockImplementation(mockGenerator('proposal', 'critique'));
    
    // Act
    const events = await collectEvents(orchestrator.run('test'));
    
    // Assert: 3 rounds (round_start events for rounds 1, 2, 3)
    const roundStarts = events.filter(e => e.type === 'round_start');
    expect(roundStarts).toHaveLength(3);
  });

  it('should stream proposer chunks in real-time', async () => {
    // Arrange: Mock generates tokens "Hello", " ", "World"
    mockOllama.generate
      .mockImplementationOnce(mockChunkGenerator(['Hello', ' ', 'World'])) // proposer
      .mockImplementationOnce(mockChunkGenerator(['critique'])); // skeptic
    
    // Act & Assert: Chunks are yielded individually
    const chunks = events.filter(e => e.type === 'proposer_chunk');
    expect(chunks[0].content).toBe('Hello');
    expect(chunks[1].content).toBe(' ');
    expect(chunks[2].content).toBe('World');
  });

  it('should yield proposer_complete with duration', async () => {
    // Assert: Event includes durationMs > 0
  });

  it('should yield skeptic_complete with duration', async () => {
    // Assert: Event includes durationMs > 0
  });

  it('should early-terminate when Skeptic signals ready', async () => {
    // Arrange: Skeptic response includes "Ready for Synthesis ✅"
    mockOllama.generate
      .mockImplementationOnce(mockChunkGenerator(['proposal'])) // round 1 proposer
      .mockImplementationOnce(mockChunkGenerator(['critique with Ready for Synthesis ✅'])); // round 1 skeptic
    
    // Act
    const events = await collectEvents(orchestrator.run('test'));
    
    // Assert: Only 1 round despite maxRounds = 3
    const roundStarts = events.filter(e => e.type === 'round_start');
    expect(roundStarts).toHaveLength(1);
  });

  it('should not early-terminate before minRounds', async () => {
    // Arrange: Skeptic signals ready in round 1, but minRounds = 3
    // Assert: Continues to round 3 regardless
  });

  it('should run synthesis after debate loop', async () => {
    // Assert: Events include synthesis_start, synthesis_chunk, synthesis_complete
  });

  it('should save trace to TraceStore on complete', async () => {
    // Assert: mockTraceStore.saveTrace was called with DebateTrace
  });

  it('should yield complete event with full trace', async () => {
    // Assert: Final event is { type: 'complete', trace: DebateTrace }
  });

  it('should track timing correctly', async () => {
    // Assert: trace.timing includes ragMs, roundsMs[], synthesisMs, totalMs
  });

  it('should set earlyStopped flag when terminated early', async () => {
    // Assert: trace.earlyStopped === true when early-terminated
    // Assert: trace.earlyStopped === false when max rounds reached
  });
});
```

### 6.3 Error Handling Tests

```typescript
describe('DebateOrchestrator — Error Handling', () => {
  it('should yield error event when Ollama times out', async () => {
    // Arrange: Mock Ollama to throw timeout after first chunk
    mockOllama.generate.mockImplementation(() => {
      throw new OllamaTimeoutError('model', 120000);
    });
    
    // Act
    const events = await collectEvents(orchestrator.run('test'));
    
    // Assert: Last event is { type: 'error', error: '...' }
    expect(events[events.length - 1].type).toBe('error');
  });

  it('should yield error event when model is unavailable', async () => {
    // Arrange: Mock Ollama to throw model not found
    // Assert: Error event with helpful message
  });

  it('should yield error event when RAG fails', async () => {
    // Arrange: mockRAG.search throws
    // Assert: Error event
  });

  it('should continue if proposer fails but skeptic succeeds', async () => {
    // Note: Current design stops on ANY error. This is TBD.
  });
});
```

### 6.4 Configuration Tests

```typescript
describe('DebateOrchestrator — Configuration', () => {
  it('should use custom models from config', () => {
    // Arrange: config with custom proposerModel, skepticModel
    // Act
    // Assert: OllamaClient.generate called with correct model names
  });

  it('should use temperatures from config', () => {
    // Assert: generate called with correct temperature values
  });

  it('should use ragTopK from config', () => {
    // Assert: rag.search called with correct topK
  });
});
```

---

## 7. File Structure

```
packages/core/src/debate/
├── orchestrator.ts        # DebateOrchestrator class
├── prompts.ts             # Prompt builders (buildProposerPrompt, etc.)
├── types.ts               # Debate types (DebateConfig, DebateEvent, etc.)
├── early-stop.ts          # Early termination logic (extracted for testability)
└── __tests__/
    ├── orchestrator.test.ts
    ├── prompts.test.ts
    └── fixtures/
        ├── mock-ollama-client.ts
        ├── mock-rag-retriever.ts
        └── sample-trace.ts
```

---

## 8. Acceptance Criteria

- [ ] All unit tests pass
- [ ] Debate runs correct number of rounds based on config
- [ ] Early termination works (Skeptic signal, max rounds, no critical issues)
- [ ] Events stream in real-time (chunks yielded as they arrive)
- [ ] Timing is accurately tracked for all phases
- [ ] Traces are saved correctly to TraceStore
- [ ] Errors are handled gracefully and yield error events
- [ ] Configuration (models, temperatures) is respected
- [ ] Prompt builders produce correct output format
