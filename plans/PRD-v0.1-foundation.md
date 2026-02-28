# Product Requirements Document — v0.1 Foundation
## This Mind Does Not Exist

**Version:** 0.1.0  
**Status:** Planning  
**Date:** 2026-02-27  
**Author:** Architecture Team

---

## 1. Executive Summary

**This Mind Does Not Exist (TMDE)** is a self-hosted adversarial reasoning system that orchestrates multiple local LLMs in a structured debate to produce significantly higher-quality answers than any single model alone. v0.1 establishes the foundational infrastructure: the core debate engine, RAG-based template retrieval, a streaming web UI, and a CLI interface — all running entirely on local hardware via Ollama.

---

## 2. Problem Statement

### 2.1 The Gap

Open-source models running locally on Ollama are capable but fall short of frontier closed-source models (GPT-4.5, Claude Opus, Grok-4) in reasoning quality. The primary cause is not model capability per se, but the absence of structured, adversarial reasoning processes that frontier models employ internally.

### 2.2 The Opportunity

By orchestrating two local models in a structured adversarial debate — a **Proposer** that builds rigorous answers using tested reasoning templates, and a **Skeptic** that attacks every assumption and logical gap — we can dramatically improve reasoning quality without requiring larger models or cloud APIs.

### 2.3 Target Users

| User Type | Description | Primary Need |
|---|---|---|
| **Power Users** | Developers, researchers, academics | High-quality local reasoning for complex problems |
| **Privacy-Conscious Users** | Anyone with sensitive queries | Full local execution, zero data leakage |
| **Cost-Sensitive Users** | Those avoiding API costs | Frontier-quality reasoning at zero ongoing cost |
| **Tinkerers** | AI enthusiasts | Transparent, hackable reasoning pipeline |

---

## 3. Goals & Non-Goals

### 3.1 Goals for v0.1

1. **Functional debate engine** — A working Proposer ↔ Skeptic loop that runs 3–5 rounds and produces a synthesized final answer
2. **RAG template retrieval** — Semantic search over reasoning templates that selects the best template for each query
3. **Real-time streaming** — Users see the debate unfold token-by-token via SSE
4. **Web UI** — A clean, functional web interface for submitting queries and watching debates
5. **CLI interface** — A terminal interface for power users
6. **Trace persistence** — Every debate is saved to SQLite for future reference
7. **Docker deployment** — One-command startup via `docker compose up`

### 3.2 Non-Goals for v0.1

- Auto-scoring of debate quality (v0.2)
- LoRA fine-tuning pipeline (v0.3)
- Trace browsing UI (v0.2)
- Configurable debate parameters via UI (v0.2)
- Multi-modal support (v0.4)
- Community template sharing (v1.0)

---

## 4. User Stories

### 4.1 Core Debate Flow

**US-001: Submit a Query**
> As a user, I want to submit a complex question and receive a high-quality answer, so that I can get better reasoning than a single model provides.

**Acceptance Criteria:**
- [ ] User can enter a query in the web UI text area
- [ ] User can submit via Enter key or Submit button
- [ ] Query is validated (non-empty, max 4000 characters)
- [ ] System responds within 2 seconds with a streaming connection
- [ ] User sees a loading indicator while the debate initializes

**US-002: Watch the Debate in Real-Time**
> As a user, I want to see the Proposer and Skeptic responses stream in real-time, so that I can follow the reasoning process as it unfolds.

**Acceptance Criteria:**
- [ ] Proposer's response streams token-by-token in the UI
- [ ] Skeptic's critique streams token-by-token after the Proposer completes
- [ ] Each round is visually distinct (labeled "Round 1", "Round 2", etc.)
- [ ] Proposer and Skeptic responses are visually differentiated (color, icon, label)
- [ ] A progress indicator shows current round vs total rounds
- [ ] User can scroll through previous rounds while new content streams

**US-003: Receive a Synthesized Final Answer**
> As a user, I want to receive a clean, polished final answer after the debate, so that I get the best possible response without needing to read the full debate.

**Acceptance Criteria:**
- [ ] After the final debate round, a Synthesizer pass produces a clean answer
- [ ] The final answer is visually prominent and distinct from the debate
- [ ] The final answer streams in real-time
- [ ] The full debate transcript is preserved and accessible
- [ ] The final answer includes a confidence score (1-10)

**US-004: Use the CLI**
> As a power user, I want to run debates from the terminal, so that I can integrate TMDE into my workflow without a browser.

**Acceptance Criteria:**
- [ ] `tmde "My question"` runs a full debate and prints the final answer
- [ ] `tmde --verbose "My question"` shows the full debate transcript
- [ ] `tmde --quiet "My question"` shows only the final answer
- [ ] `tmde --rounds 5 "My question"` sets the number of debate rounds
- [ ] `tmde health` checks system status
- [ ] `tmde models` lists available Ollama models
- [ ] Streaming output works in real-time (not buffered)
- [ ] Colors and formatting make the output readable

### 4.2 Template Retrieval

**US-005: Automatic Template Selection**
> As a user, I want the system to automatically select the best reasoning template for my query, so that the Proposer uses the most appropriate reasoning strategy.

**Acceptance Criteria:**
- [ ] System embeds the user query using `nomic-embed-text`
- [ ] System searches the template library and returns top-3 matches
- [ ] Templates with similarity score < 0.65 are excluded
- [ ] The selected template(s) are shown in the UI (collapsible)
- [ ] If no template matches, the system falls back to Chain-of-Thought

**US-006: Template Library**
> As a user, I want a library of reasoning templates to be available, so that the system can guide the Proposer with proven reasoning strategies.

**Acceptance Criteria:**
- [ ] At minimum 5 templates are available at launch (Chain-of-Thought, Proof by Contradiction, Tree-of-Thoughts, System Design Decomposition, Systematic Comparison)
- [ ] Templates are stored as markdown files with YAML frontmatter
- [ ] Templates are indexed into ChromaDB on startup
- [ ] New templates can be added by dropping `.md` files into `data/templates/`

### 4.3 System Health & Configuration

**US-007: Health Check**
> As a user/operator, I want to verify the system is running correctly, so that I can diagnose issues before submitting queries.

**Acceptance Criteria:**
- [ ] `GET /api/health` returns status of Ollama, ChromaDB, and required models
- [ ] Web UI shows a status indicator (green/yellow/red)
- [ ] If Ollama is unavailable, a clear error message is shown with remediation steps
- [ ] If required models are not pulled, the UI shows which models to pull

**US-008: Docker Deployment**
> As a user, I want to start the entire system with a single command, so that setup is frictionless.

**Acceptance Criteria:**
- [ ] `docker compose up` starts all services (core API, web UI, ChromaDB)
- [ ] Services are healthy within 60 seconds on a machine with models pre-pulled
- [ ] Environment variables are documented in `.env.example`
- [ ] Volumes persist data between restarts (SQLite, ChromaDB, templates)

---

## 5. Functional Requirements

### 5.1 Debate Engine

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | System MUST support 3–5 configurable debate rounds | P0 |
| FR-002 | System MUST support early termination when Skeptic signals "Ready for Synthesis ✅" | P0 |
| FR-003 | System MUST stream debate events via SSE | P0 |
| FR-004 | System MUST save every completed debate trace to SQLite | P0 |
| FR-005 | System MUST handle Ollama timeouts gracefully (retry once, then fail with partial results) | P0 |
| FR-006 | System MUST support configurable Proposer and Skeptic models | P1 |
| FR-007 | System MUST support configurable temperature per model role | P1 |
| FR-008 | System SHOULD support concurrent debates (max 2 simultaneous) | P1 |
| FR-009 | System SHOULD provide early termination if no critical issues remain after min rounds | P2 |

### 5.2 RAG Layer

| ID | Requirement | Priority |
|---|---|---|
| FR-010 | System MUST index all templates from `data/bot-buffer/` and `data/templates/` on startup | P0 |
| FR-011 | System MUST use `nomic-embed-text` for query and template embeddings | P0 |
| FR-012 | System MUST return top-3 templates by cosine similarity | P0 |
| FR-013 | System MUST filter templates below 0.65 similarity threshold | P0 |
| FR-014 | System MUST fall back to Chain-of-Thought if no templates meet threshold | P0 |
| FR-015 | System SHOULD re-index templates when new files are added | P2 |

### 5.3 API Server

| ID | Requirement | Priority |
|---|---|---|
| FR-016 | Server MUST expose `POST /api/reason` to start a debate | P0 |
| FR-017 | Server MUST expose `GET /api/reason/:id/stream` for SSE streaming | P0 |
| FR-018 | Server MUST expose `GET /api/health` | P0 |
| FR-019 | Server MUST expose `GET /api/models` | P0 |
| FR-020 | Server MUST expose `GET /api/templates` | P0 |
| FR-021 | Server MUST expose `GET /api/traces` and `GET /api/traces/:id` | P0 |
| FR-022 | Server MUST expose `POST /api/traces/:id/rate` | P1 |
| FR-023 | Server MUST support CORS for web UI origin | P0 |
| FR-024 | Server MUST validate all request bodies with JSON schema | P0 |

### 5.4 Web UI

| ID | Requirement | Priority |
|---|---|---|
| FR-025 | UI MUST provide a text input for queries | P0 |
| FR-026 | UI MUST display streaming debate in real-time | P0 |
| FR-027 | UI MUST display the final synthesized answer prominently | P0 |
| FR-028 | UI MUST show which reasoning templates were selected | P1 |
| FR-029 | UI MUST show a debate progress indicator | P1 |
| FR-030 | UI MUST handle connection errors gracefully | P0 |
| FR-031 | UI SHOULD support markdown rendering in responses | P1 |
| FR-032 | UI SHOULD support syntax highlighting for code blocks | P1 |

### 5.5 CLI

| ID | Requirement | Priority |
|---|---|---|
| FR-033 | CLI MUST support `tmde "<query>"` as the primary command | P0 |
| FR-034 | CLI MUST stream debate output in real-time | P0 |
| FR-035 | CLI MUST support `--verbose`, `--quiet`, `--rounds` flags | P0 |
| FR-036 | CLI MUST support `tmde health` subcommand | P0 |
| FR-037 | CLI MUST support `tmde models` subcommand | P0 |
| FR-038 | CLI SHOULD support `tmde traces` to list past debates | P1 |
| FR-039 | CLI SHOULD support `tmde rate <id> <score>` | P1 |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Time to first token (Proposer) | < 5 seconds |
| NFR-002 | Total debate duration (3 rounds, 32B models) | < 10 minutes |
| NFR-003 | RAG retrieval latency | < 2 seconds |
| NFR-004 | API response time for non-streaming endpoints | < 500ms |
| NFR-005 | SQLite write latency for trace save | < 100ms |

### 6.2 Reliability

| ID | Requirement |
|---|---|
| NFR-006 | System MUST handle Ollama unavailability without crashing |
| NFR-007 | System MUST handle ChromaDB unavailability without crashing (degrade to no-template mode) |
| NFR-008 | System MUST persist traces atomically (no partial writes) |
| NFR-009 | SSE connections MUST be cleaned up on client disconnect |

### 6.3 Security

| ID | Requirement |
|---|---|
| NFR-010 | All user inputs MUST be sanitized before being passed to models |
| NFR-011 | API MUST validate Content-Type headers |
| NFR-012 | No sensitive data (API keys, etc.) MUST be logged |

### 6.4 Observability

| ID | Requirement |
|---|---|
| NFR-013 | All API requests MUST be logged with method, path, status, duration |
| NFR-014 | Debate events MUST be logged with trace ID and round number |
| NFR-015 | Errors MUST be logged with full stack traces |

---

## 7. System Architecture

### 7.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces                           │
│   ┌──────────────────┐        ┌──────────────────────┐      │
│   │  Web UI          │        │  CLI                 │      │
│   │  Next.js 15      │        │  Node.js + Commander │      │
│   │  :3000           │        │  tmde binary         │      │
│   └────────┬─────────┘        └──────────┬───────────┘      │
└────────────┼──────────────────────────────┼──────────────────┘
             │ HTTP/SSE                      │ HTTP/SSE
             ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Fastify Server  :3001                               │  │
│   │  REST + SSE endpoints                                │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core Engine                               │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ RAG Retriever│  │ Debate       │  │ Trace Store      │  │
│   │ ChromaDB     │  │ Orchestrator │  │ SQLite           │  │
│   └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
└──────────┼────────────────┼────────────────────────────────┘
           │                │
           ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ollama                                    │
│   nomic-embed-text  │  qwen3:32b  │  llama3.3:70b           │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Data Flow

```
User Query
    │
    ▼
POST /api/reason → returns { traceId, streamUrl }
    │
    ▼
GET /api/reason/:id/stream (SSE connection)
    │
    ├── event: rag_complete { templates[] }
    ├── event: round_start { round: 1 }
    ├── event: proposer_chunk { content: "..." }  (many)
    ├── event: proposer_complete { content, durationMs }
    ├── event: skeptic_chunk { content: "..." }   (many)
    ├── event: skeptic_complete { content, durationMs }
    ├── event: round_start { round: 2 }
    │   ... (repeat for each round)
    ├── event: synthesis_start
    ├── event: synthesis_chunk { content: "..." } (many)
    ├── event: synthesis_complete { content, durationMs }
    └── event: complete { trace: DebateTrace }
```

---

## 8. Dependencies

### 8.1 Runtime Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| Ollama | Latest | Local LLM inference |
| ChromaDB | 1.8+ | Vector store for template embeddings |
| Node.js | 20+ | Runtime for API and CLI |
| Docker | 24+ | Container orchestration |

### 8.2 Required Models

| Model | Size | Role |
|---|---|---|
| `qwen3:32b` | ~20GB | Proposer (primary) |
| `llama3.3:70b` | ~40GB | Skeptic (primary) |
| `nomic-embed-text` | ~274MB | Embeddings |

### 8.3 Minimum Hardware

| Resource | Minimum | Recommended |
|---|---|---|
| RAM | 16GB | 32GB+ |
| VRAM | 8GB | 24GB+ |
| Storage | 80GB | 120GB+ |
| CPU | 8 cores | 16 cores |

---

## 9. Milestones & Deliverables

### Phase 1: Core Infrastructure (Week 1)
- [ ] Ollama client with streaming support
- [ ] SQLite trace store with migrations
- [ ] ChromaDB integration and template indexing
- [ ] Basic Fastify server skeleton

### Phase 2: Debate Engine (Week 2)
- [ ] Prompt builders (Proposer, Skeptic, Synthesizer)
- [ ] Debate orchestrator with round loop
- [ ] Early termination logic
- [ ] SSE event streaming

### Phase 3: Interfaces (Week 3)
- [ ] Web UI with streaming debate viewer
- [ ] CLI with all required commands
- [ ] Docker Compose configuration

### Phase 4: Testing & Polish (Week 4)
- [ ] Unit tests for all core components
- [ ] Integration tests for API endpoints
- [ ] End-to-end test with real Ollama
- [ ] Documentation updates

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ollama model too slow for UX | High | Medium | Show streaming output immediately; set expectations |
| ChromaDB startup issues | Medium | Medium | Graceful degradation to no-template mode |
| Memory exhaustion with 70B model | High | High | Document hardware requirements clearly; support smaller model alternatives |
| SSE connection drops | Medium | Low | Client-side reconnection logic |
| Template quality insufficient | Low | Medium | Curate templates carefully; allow user additions |

---

## 11. Success Metrics for v0.1

| Metric | Target |
|---|---|
| Debate completes successfully | 95%+ of queries |
| Time to first token | < 5 seconds |
| Template retrieval accuracy | Top-1 template is relevant for 80%+ of queries |
| Docker startup time | < 60 seconds (models pre-pulled) |
| Zero data loss | 100% of completed debates saved to SQLite |

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Proposer** | The LLM role that builds and defends answers |
| **Skeptic** | The LLM role that critiques and challenges answers |
| **Synthesizer** | The final pass that produces a clean answer from the debate |
| **Debate Trace** | The complete record of a debate including all rounds and final answer |
| **RAG** | Retrieval-Augmented Generation — using semantic search to find relevant context |
| **BoT** | Buffer of Thoughts — a library of reusable reasoning templates |
| **SSE** | Server-Sent Events — HTTP-based unidirectional streaming |
| **LoRA** | Low-Rank Adaptation — parameter-efficient fine-tuning technique |
