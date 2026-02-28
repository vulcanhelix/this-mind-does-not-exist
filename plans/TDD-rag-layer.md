# Technical Design Document — RAG Layer (Template Retrieval)
## This Mind Does Not Exist — v0.1

**Component:** `packages/core/src/rag/retriever.ts` + `packages/core/src/rag/types.ts`  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The RAG (Retrieval-Augmented Generation) Layer is responsible for semantic search over reasoning templates. When a user submits a query, the RAG retriever:
1. Embeds the query using `nomic-embed-text`
2. Searches the ChromaDB vector store for the most similar templates
3. Returns the top-K templates for the Proposer to use as reasoning scaffolds

This ensures the Proposer always uses the most appropriate reasoning strategy for the problem domain.

---

## 2. Design Decisions

### 2.1 ChromaDB for Vector Storage

We use ChromaDB because:
- Zero-config embedded vector database
- Simple HTTP API (can run in-process or as a service)
- Good integration with Python ecosystem (where ChromaDB is strongest)
- Supports cosine similarity, which aligns with our template matching needs

### 2.2 Composite Embeddings

Each template is embedded using a composite of:
- Title (from YAML frontmatter)
- Description (from YAML frontmatter)
- Keywords (from YAML frontmatter)
- Full content (the reasoning template steps)

This ensures semantic matching works even when the query doesn't exactly match the template content.

### 2.3 Similarity Threshold

Templates with cosine similarity < 0.65 are excluded. This prevents the Proposer from using weakly relevant templates. If no templates meet the threshold, we fall back to Chain-of-Thought.

### 2.4 Template Indexing on Startup

All templates in `data/bot-buffer/` and `data/templates/` are indexed on server startup. This ensures fast query-time retrieval without the overhead of on-the-fly indexing.

---

## 3. Interface Specification

### 3.1 Types

```typescript
// packages/core/src/rag/types.ts

export interface Template {
  id: string;                    // Derived from filename
  name: string;                   // From frontmatter
  domain: string;                 // e.g., "mathematics", "engineering"
  complexity: string;            // e.g., "simple", "moderate", "complex"
  methodology: string;           // e.g., "deductive", "exploratory"
  keywords: string[];            // From frontmatter
  description: string;            // From frontmatter
  content: string;                // Full markdown content
  filePath: string;               // Path on disk
}

export interface TemplateMatch {
  id: string;
  name: string;
  score: number;                 // Cosine similarity (0-1)
  description: string;
  content: string;
}

export interface RAGConfig {
  chromaUrl: string;
  embeddingModel: string;         // Default: 'nomic-embed-text'
  topK: number;                  // Default: 3
  similarityThreshold: number;   // Default: 0.65
  templateDirs: string[];        // ['data/bot-buffer', 'data/templates']
}
```

### 3.2 RAGRetriever Class

```typescript
export class RAGRetriever {
  constructor(
    private chroma: ChromaClient,
    private ollama: OllamaClient,
    private config: RAGConfig
  ) {}

  // Load all templates from disk and index them into ChromaDB
  // Called once on startup
  async indexTemplates(): Promise<number>;

  // Search for the most relevant reasoning templates
  // Returns empty array if no templates meet similarity threshold
  async search(query: string, topK?: number): Promise<TemplateMatch[]>;

  // Add a single template to the index
  async addTemplate(filePath: string): Promise<void>;

  // Get all indexed templates (for debugging/listing)
  async listTemplates(): Promise<Template[]>;

  // Check if templates are indexed
  async isReady(): Promise<boolean>;
}
```

---

## 4. Implementation Details

### 4.1 Template Parsing

Templates are stored as markdown files with YAML frontmatter:

```markdown
---
name: "Proof by Contradiction"
domain: mathematics
complexity: moderate
methodology: deductive
keywords: [proof, contradiction, negation, assume, QED]
description: "Template for proving statements by assuming the opposite"
---

## Steps

1. **State the Claim:** ...
2. **Assume the Negation:** ...
...
```

We use `gray-matter` to parse the frontmatter and content:

```typescript
import matter from 'gray-matter';
import { glob } from 'glob';
import fs from 'fs';

async function parseTemplate(filePath: string): Promise<Template> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  const id = path.basename(filePath, '.md');

  return {
    id,
    name: data.name,
    domain: data.domain || 'general',
    complexity: data.complexity || 'moderate',
    methodology: data.methodology || 'sequential',
    keywords: data.keywords || [],
    description: data.description || '',
    content,
    filePath,
  };
}
```

### 4.2 Composite Embedding Generation

```typescript
async function generateTemplateEmbedding(
  template: Template,
  ollama: OllamaClient
): Promise<number[]> {
  const compositeText = `
    ${template.name}. 
    ${template.description}.
    Keywords: ${template.keywords.join(', ')}.
    Method: ${template.methodology}.
    ${template.content.substring(0, 1000)}  // First 1000 chars
  `;

  const vectors = await ollama.embed({
    model: 'nomic-embed-text',
    input: compositeText,
  });

  return vectors[0];
}
```

### 4.3 Index Templates

```typescript
async indexTemplates(): Promise<number> {
  const collection = await this.chroma.getOrCreateCollection({
    name: 'reasoning_templates',
    metadata: { 'hnsw:space': 'cosine' }
  });

  const templateFiles = [
    ...await glob(`${this.config.templateDirs[0]}/*.md`),
    ...await glob(`${this.config.templateDirs[1]}/*.md`),
  ];

  let indexedCount = 0;

  for (const filePath of templateFiles) {
    const template = await parseTemplate(filePath);
    const embedding = await generateTemplateEmbedding(template, this.ollama);

    await collection.upsert({
      ids: [template.id],
      documents: [template.content],  // Store for retrieval
      embeddings: [embedding],
      metadatas: [{
        name: template.name,
        domain: template.domain,
        complexity: template.complexity,
        methodology: template.methodology,
        description: template.description,
      }]
    });

    indexedCount++;
  }

  return indexedCount;
}
```

### 4.4 Search

```typescript
async search(query: string, topK?: number): Promise<TemplateMatch[]> {
  const k = topK ?? this.config.topK;
  const collection = await this.chroma.getOrCreateCollection({
    name: 'reasoning_templates'
  });

  // Embed query
  const queryVectors = await this.ollama.embed({
    model: this.config.embeddingModel,
    input: query,
  });

  // Search ChromaDB
  const results = await collection.query({
    queryEmbeddings: queryVectors,
    nResults: k,
  });

  // Format and filter results
  const matches: TemplateMatch[] = [];

  for (let i = 0; i < results.ids[0].length; i++) {
    const score = results.distances?.[0][i] ?? 0;
    const similarity = 1 - score;  // Convert distance to similarity

    if (similarity >= this.config.similarityThreshold) {
      matches.push({
        id: results.ids[0][i],
        name: results.metadatas[0][i].name,
        score: similarity,
        description: results.metadatas[0][i].description,
        content: results.documents[0][i],
      });
    }
  }

  // Fallback to Chain-of-Thought if no matches
  if (matches.length === 0) {
    const cotTemplate = await collection.get('bot-chain-of-thought');
    if (cotTemplate) {
      matches.push({
        id: 'bot-chain-of-thought',
        name: 'Chain of Thought',
        score: 0.5,  // Low score but usable as fallback
        description: 'Step-by-step reasoning fallback',
        content: cotTemplate.documents[0],
      });
    }
  }

  return matches;
}
```

---

## 5. Test Specifications

**Test file:** `packages/core/src/rag/__tests__/retriever.test.ts`  
**Framework:** Vitest  
**Mocking:** `vi.mock()` for ChromaDB and OllamaClient

### 5.1 Template Parsing Tests

```typescript
describe('RAGRetriever — Template Parsing', () => {
  it('should parse YAML frontmatter correctly', async () => {
    // Arrange: Template file with frontmatter
    // Assert: Returns Template with correct fields
  });

  it('should derive ID from filename', () => {
    // Assert: file "proof-by-contradiction.md" → id = "proof-by-contradiction"
  });

  it('should use defaults for missing frontmatter fields', () => {
    // Assert: Missing domain → 'general', missing complexity → 'moderate'
  });

  it('should extract content after frontmatter', () => {
    // Assert: content does not include YAML
  });
});
```

### 5.2 Indexing Tests

```typescript
describe('RAGRetriever.indexTemplates()', () => {
  it('should load all .md files from configured directories', async () => {
    // Arrange: 5 files in bot-buffer, 2 in templates
    // Act
    // Assert: 7 templates indexed
  });

  it('should generate embeddings for each template', async () => {
    // Assert: ollama.embed called N times (once per template)
  });

  it('should upsert templates into ChromaDB', async () => {
    // Assert: chroma.upsert called with correct data
  });

  it('should return count of indexed templates', async () => {
    // Assert: Returns 7
  });

  it('should be idempotent (can re-index without duplicates)', async () => {
    // Assert: Still 7 templates after re-index
  });
});
```

### 5.3 Search Tests

```typescript
describe('RAGRetriever.search()', () => {
  beforeEach(async () => {
    // Index test templates
    await retriever.indexTemplates();
  });

  it('should embed the query using nomic-embed-text', async () => {
    // Arrange
    // Act: search('Prove that √2 is irrational')
    // Assert: ollama.embed called with query
  });

  it('should query ChromaDB with the embedding', async () => {
    // Assert: chroma.query called
  });

  it('should return top-K templates by default', async () => {
    // Assert: Returns 3 templates (default topK)
  });

  it('should respect custom topK parameter', async () => {
    // Act: search(query, 5)
    // Assert: Returns 5 templates
  });

  it('should filter out templates below similarity threshold', async () => {
    // Arrange: Mock ChromaDB to return templates with low similarity (0.3, 0.4)
    // Act
    // Assert: Returns empty array (or fallback)
  });

  it('should convert distance to similarity score correctly', () => {
    // Assert: score = 1 - distance
  });

  it('should fallback to Chain-of-Thought when no templates meet threshold', async () => {
    // Arrange: All results below 0.65
    // Assert: Returns bot-chain-of-thought with lower score
  });

  it('should handle empty template library gracefully', async () => {
    // Assert: Returns fallback (not throws)
  });
});
```

### 5.4 Add Template Tests

```typescript
describe('RAGRetriever.addTemplate()', () => {
  it('should parse and index a single template file', async () => {
    // Arrange: New template file
    // Act: addTemplate('/path/to/new-template.md')
    // Assert: ChromaDB has new template
  });

  it('should handle duplicate template IDs (upsert)', async () => {
    // Assert: Updates existing template
  });
});
```

### 5.5 List Templates Tests

```typescript
describe('RAGRetriever.listTemplates()', () => {
  it('should return all indexed templates', async () => {
    // Assert: Returns array of Template objects
  });
});
```

---

## 6. File Structure

```
packages/core/src/rag/
├── retriever.ts           # RAGRetriever class
├── types.ts               # Template, TemplateMatch, RAGConfig
├── parser.ts              # Template file parsing logic
├── embedder.ts            # Composite embedding generation
└── __tests__/
    ├── retriever.test.ts
    ├── parser.test.ts
    └── fixtures/
        ├── sample-template.md
        └── mock-chroma.ts
```

---

## 7. Acceptance Criteria

- [ ] All unit tests pass
- [ ] Templates are correctly parsed from markdown + YAML
- [ ] Composite embeddings are generated for each template
- [ ] ChromaDB is populated with template vectors
- [ ] Search returns top-K templates by cosine similarity
- [ ] Templates below 0.65 similarity are excluded
- [ ] Fallback to Chain-of-Thought works when no templates match
- [ ] New templates can be added via `addTemplate()`
- [ ] Indexing is idempotent (re-indexing doesn't duplicate)
- [ ] Empty library is handled gracefully
