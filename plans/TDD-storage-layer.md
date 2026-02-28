# Technical Design Document — Storage Layer
## This Mind Does Not Exist — v0.1

**Components:**  
- `packages/core/src/storage/trace-store.ts`  
- `packages/core/src/storage/template-store.ts`  

**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The storage layer provides persistent storage for debate traces and reasoning template metadata. It uses SQLite via `better-sqlite3` for synchronous, embedded, zero-config database access. ChromaDB handles vector embeddings separately; this layer handles structured metadata and full debate transcripts.

---

## 2. Design Decisions

### 2.1 better-sqlite3 (Synchronous)

We use `better-sqlite3` (synchronous API) rather than async SQLite drivers because:
- Debate traces are written once at the end of a debate — no async benefit
- Synchronous API is simpler and less error-prone
- `better-sqlite3` is significantly faster than async alternatives
- No risk of concurrent write conflicts (single-process, single-writer)

### 2.2 Schema Migrations

Migrations run on startup using a simple version table. Each migration is a SQL string applied in order. This avoids external migration tools for a simple embedded database.

### 2.3 JSON Columns

Complex nested data (templates used, timing, metadata) is stored as JSON strings in TEXT columns. This avoids over-normalization while keeping the schema simple.

### 2.4 Atomic Trace Writes

Traces and their rounds are written in a single SQLite transaction to ensure atomicity. A partial trace (e.g., from a crash mid-debate) is never written.

---

## 3. Database Schema

```sql
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One row per completed debate
CREATE TABLE IF NOT EXISTS traces (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    query TEXT NOT NULL,
    final_answer TEXT NOT NULL,
    total_rounds INTEGER NOT NULL,
    early_stopped INTEGER DEFAULT 0,  -- SQLite boolean (0/1)
    quality_score REAL,
    user_rating INTEGER,
    auto_score REAL,
    proposer_model TEXT NOT NULL,
    skeptic_model TEXT NOT NULL,
    synthesizer_model TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    total_duration_ms INTEGER,
    rag_duration_ms INTEGER,
    synthesis_duration_ms INTEGER,
    templates_used TEXT,  -- JSON array of template IDs
    metadata TEXT         -- JSON object for extensibility
);

-- One row per debate round
CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    proposer_response TEXT NOT NULL,
    skeptic_response TEXT NOT NULL,
    proposer_duration_ms INTEGER,
    skeptic_duration_ms INTEGER,
    UNIQUE(trace_id, round_number)
);

-- Reasoning template metadata
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    complexity TEXT,
    methodology TEXT,
    keywords TEXT,        -- JSON array
    description TEXT,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_traces_quality ON traces(quality_score);
CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_user_rating ON traces(user_rating);
CREATE INDEX IF NOT EXISTS idx_rounds_trace ON rounds(trace_id);
```

---

## 4. TraceStore Interface

```typescript
// packages/core/src/storage/trace-store.ts

import type { DebateTrace } from '../debate/types';

export interface TraceListOptions {
  limit?: number;       // Default: 20
  offset?: number;      // Default: 0
  minQuality?: number;  // Filter by quality_score >= minQuality
  search?: string;      // Full-text search on query
  orderBy?: 'created_at' | 'quality_score';
  order?: 'ASC' | 'DESC';
}

export interface TraceStats {
  totalTraces: number;
  avgQuality: number | null;
  fineTuneCandidates: number;  // Traces with quality >= 8
}

export class TraceStore {
  constructor(dbPath?: string);

  // Save a complete debate trace (atomic: traces + rounds in one transaction)
  saveTrace(trace: DebateTrace): string;  // Returns trace ID

  // Get a single trace with all rounds
  getTrace(id: string): DebateTrace | null;

  // List traces with pagination and filtering
  listTraces(options?: TraceListOptions): DebateTrace[];

  // Update user rating (1-10)
  rateTrace(id: string, rating: number): void;

  // Get traces suitable for fine-tuning
  getFineTuneTraces(minQuality?: number): DebateTrace[];

  // Get aggregate statistics
  getStats(): TraceStats;

  // Close the database connection
  close(): void;
}
```

---

## 5. TemplateStore Interface

```typescript
// packages/core/src/storage/template-store.ts

export interface TemplateRecord {
  id: string;
  name: string;
  domain: string;
  complexity: string;
  methodology: string;
  keywords: string[];
  description: string;
  filePath: string;
  createdAt: string;
  usageCount: number;
}

export class TemplateStore {
  constructor(db: Database.Database);  // Shares DB connection with TraceStore

  // Register or update a template
  register(template: Omit<TemplateRecord, 'createdAt' | 'usageCount'>): void;

  // Get all registered templates
  listTemplates(): TemplateRecord[];

  // Get a template by ID
  getTemplate(id: string): TemplateRecord | null;

  // Increment usage count
  recordUsage(templateId: string): void;

  // Get most-used templates
  getPopular(limit?: number): TemplateRecord[];
}
```

---

## 6. Implementation Details

### 6.1 Migration System

```typescript
const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (...);
      CREATE TABLE IF NOT EXISTS traces (...);
      CREATE TABLE IF NOT EXISTS rounds (...);
      CREATE TABLE IF NOT EXISTS templates (...);
      -- indexes
    `
  }
];

private migrate(): void {
  const currentVersion = this.db
    .prepare('SELECT MAX(version) as v FROM schema_version')
    .get()?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      this.db.exec(migration.sql);
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)')
        .run(migration.version);
    }
  }
}
```

### 6.2 Atomic Trace Save

```typescript
saveTrace(trace: DebateTrace): string {
  const saveAll = this.db.transaction((trace: DebateTrace) => {
    this.db.prepare(`
      INSERT INTO traces (id, query, final_answer, total_rounds, ...)
      VALUES (?, ?, ?, ?, ...)
    `).run(trace.id, trace.query, trace.finalAnswer, trace.totalRounds, ...);

    for (const round of trace.rounds) {
      this.db.prepare(`
        INSERT INTO rounds (id, trace_id, round_number, ...)
        VALUES (?, ?, ?, ...)
      `).run(uuid(), trace.id, round.round, ...);
    }
  });

  saveAll(trace);
  return trace.id;
}
```

### 6.3 Trace Reconstruction

When loading a trace, rounds are fetched separately and assembled:

```typescript
getTrace(id: string): DebateTrace | null {
  const row = this.db.prepare('SELECT * FROM traces WHERE id = ?').get(id);
  if (!row) return null;

  const rounds = this.db
    .prepare('SELECT * FROM rounds WHERE trace_id = ? ORDER BY round_number')
    .all(id);

  return this.rowToTrace(row, rounds);
}
```

---

## 7. Test Specifications

**Test file:** `packages/core/src/storage/__tests__/trace-store.test.ts`  
**Framework:** Vitest  
**Database:** In-memory SQLite (`:memory:`) for tests

### 7.1 TraceStore Tests

#### Test Suite: `TraceStore — Initialization`

```typescript
describe('TraceStore — Initialization', () => {
  it('should create database tables on first run', () => {
    // Arrange: Create TraceStore with :memory: path
    // Assert: Tables exist (traces, rounds, templates, schema_version)
  });

  it('should not fail if tables already exist (idempotent migrations)', () => {
    // Arrange: Create TraceStore twice with same path
    // Assert: No error thrown
  });

  it('should record migration version', () => {
    // Assert: schema_version table has version 1
  });
});
```

#### Test Suite: `TraceStore.saveTrace()`

```typescript
describe('TraceStore.saveTrace()', () => {
  it('should save a complete trace with all rounds', () => {
    // Arrange: Create a DebateTrace with 3 rounds
    // Act: saveTrace(trace)
    // Assert: trace row exists in DB
    // Assert: 3 round rows exist in DB
  });

  it('should return the trace ID', () => {
    // Assert: Returns trace.id
  });

  it('should save trace atomically (all or nothing)', () => {
    // Arrange: Create trace with invalid round data that will fail mid-insert
    // Assert: No partial data in DB (transaction rolled back)
  });

  it('should serialize templatesUsed as JSON array', () => {
    // Arrange: trace.templatesUsed = ['template-1', 'template-2']
    // Assert: DB column contains valid JSON string
  });

  it('should handle null quality_score', () => {
    // Arrange: trace.qualityScore = null
    // Assert: Saved without error, retrieved as null
  });

  it('should throw on duplicate trace ID', () => {
    // Arrange: Save same trace twice
    // Assert: Second save throws
  });
});
```

#### Test Suite: `TraceStore.getTrace()`

```typescript
describe('TraceStore.getTrace()', () => {
  it('should retrieve a saved trace with all rounds', () => {
    // Arrange: Save trace with 3 rounds
    // Act: getTrace(trace.id)
    // Assert: Retrieved trace matches original
    // Assert: rounds array has 3 items in correct order
  });

  it('should return null for non-existent ID', () => {
    // Assert: Returns null
  });

  it('should correctly deserialize JSON fields', () => {
    // Assert: templatesUsed is string[], not string
    // Assert: timing object is correctly shaped
  });

  it('should order rounds by round_number', () => {
    // Arrange: Save trace with rounds in non-sequential order
    // Assert: Retrieved rounds are sorted by round_number
  });
});
```

#### Test Suite: `TraceStore.listTraces()`

```typescript
describe('TraceStore.listTraces()', () => {
  beforeEach(() => {
    // Insert 10 test traces with varying quality scores
  });

  it('should return traces with default pagination (20 items)', () => {
    // Assert: Returns up to 20 traces
  });

  it('should respect limit and offset', () => {
    // Act: listTraces({ limit: 3, offset: 2 })
    // Assert: Returns 3 traces starting from index 2
  });

  it('should filter by minQuality', () => {
    // Act: listTraces({ minQuality: 8 })
    // Assert: All returned traces have quality_score >= 8
  });

  it('should search by query text', () => {
    // Arrange: Traces with queries "math proof" and "code review"
    // Act: listTraces({ search: 'math' })
    // Assert: Only "math proof" trace returned
  });

  it('should order by created_at DESC by default', () => {
    // Assert: Most recent trace is first
  });

  it('should return empty array when no traces match', () => {
    // Act: listTraces({ minQuality: 10 })
    // Assert: Returns []
  });
});
```

#### Test Suite: `TraceStore.rateTrace()`

```typescript
describe('TraceStore.rateTrace()', () => {
  it('should update user_rating for existing trace', () => {
    // Arrange: Save trace
    // Act: rateTrace(id, 9)
    // Assert: getTrace(id).userRating === 9
  });

  it('should throw for invalid rating (< 1 or > 10)', () => {
    // Assert: rateTrace(id, 0) throws
    // Assert: rateTrace(id, 11) throws
  });

  it('should throw for non-existent trace ID', () => {
    // Assert: throws
  });
});
```

#### Test Suite: `TraceStore.getFineTuneTraces()`

```typescript
describe('TraceStore.getFineTuneTraces()', () => {
  it('should return traces with quality_score >= 8 by default', () => {
    // Arrange: Traces with scores 6, 7, 8, 9, 10
    // Assert: Returns traces with scores 8, 9, 10
  });

  it('should include traces with user_rating >= threshold', () => {
    // Arrange: Trace with quality_score = 5 but user_rating = 9
    // Assert: Included in results
  });

  it('should respect custom minQuality threshold', () => {
    // Act: getFineTuneTraces(9)
    // Assert: Only traces with score >= 9
  });
});
```

#### Test Suite: `TraceStore.getStats()`

```typescript
describe('TraceStore.getStats()', () => {
  it('should return correct total count', () => {
    // Arrange: Insert 5 traces
    // Assert: totalTraces === 5
  });

  it('should calculate average quality correctly', () => {
    // Arrange: Traces with scores 6, 8, 10
    // Assert: avgQuality === 8.0
  });

  it('should return null avgQuality when no scores exist', () => {
    // Arrange: Traces with null quality_score
    // Assert: avgQuality === null
  });

  it('should count fine-tune candidates correctly', () => {
    // Arrange: 3 traces with score >= 8, 2 below
    // Assert: fineTuneCandidates === 3
  });
});
```

### 7.2 TemplateStore Tests

**Test file:** `packages/core/src/storage/__tests__/template-store.test.ts`

```typescript
describe('TemplateStore.register()', () => {
  it('should insert a new template', () => {
    // Arrange: Template record
    // Act: register(template)
    // Assert: Template exists in DB
  });

  it('should update existing template on re-register (upsert)', () => {
    // Arrange: Register template, then register again with updated name
    // Assert: Only one row, name is updated
  });
});

describe('TemplateStore.listTemplates()', () => {
  it('should return all registered templates', () => {
    // Arrange: Register 3 templates
    // Assert: Returns 3 templates
  });

  it('should deserialize keywords JSON array', () => {
    // Assert: keywords is string[], not string
  });
});

describe('TemplateStore.recordUsage()', () => {
  it('should increment usage_count', () => {
    // Arrange: Register template (usage_count = 0)
    // Act: recordUsage(id) twice
    // Assert: usage_count === 2
  });
});

describe('TemplateStore.getPopular()', () => {
  it('should return templates ordered by usage_count DESC', () => {
    // Arrange: 3 templates with usage counts 5, 1, 10
    // Assert: Order is [10, 5, 1]
  });

  it('should respect limit parameter', () => {
    // Act: getPopular(2)
    // Assert: Returns only 2 templates
  });
});
```

---

## 8. File Structure

```
packages/core/src/storage/
├── trace-store.ts          # TraceStore class
├── template-store.ts       # TemplateStore class
├── migrations.ts           # SQL migration definitions
├── db.ts                   # Database initialization and shared connection
└── __tests__/
    ├── trace-store.test.ts
    ├── template-store.test.ts
    └── fixtures/
        └── sample-trace.ts  # Factory function for test traces
```

---

## 9. Acceptance Criteria

- [ ] All unit tests pass with in-memory SQLite
- [ ] Migrations are idempotent (safe to run multiple times)
- [ ] Trace saves are atomic (no partial writes)
- [ ] JSON fields are correctly serialized/deserialized
- [ ] Pagination works correctly
- [ ] Quality filtering works correctly
- [ ] Database connection is properly closed on process exit
