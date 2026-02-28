// ============================================================
// This Mind Does Not Exist — RAG Retriever
// ============================================================
// Semantic search over reasoning templates using ChromaDB.
//
// On startup:
//   1. Load all templates from data/bot-buffer/ and data/templates/
//   2. Parse YAML frontmatter + markdown content
//   3. Generate embeddings via Ollama (nomic-embed-text)
//   4. Index into ChromaDB collection
//
// On query:
//   1. Embed the user's query
//   2. Search ChromaDB for top-K matches
//   3. Format and return templates for the Proposer
// ============================================================

import { ChromaClient, Collection } from 'chromadb';
import { OllamaClient } from '../ollama/client';
import type { TemplateMatch, RAGConfig } from './types';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';

export class RAGRetriever {
  private chroma: ChromaClient;
  private collection: Collection | null = null;
  private ollama: OllamaClient;
  private config: RAGConfig;

  constructor(config: RAGConfig, ollama: OllamaClient) {
    this.config = config;
    this.ollama = ollama;
    this.chroma = new ChromaClient({ path: config.chromaUrl });
  }

  /**
   * Initialize the ChromaDB collection.
   */
  async init(): Promise<void> {
    this.collection = await this.chroma.getOrCreateCollection({
      name: 'reasoning_templates',
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  /**
   * Load all templates from disk and index them into ChromaDB.
   * Called once on startup.
   */
  async indexTemplates(templateDirs: string[]): Promise<number> {
    if (!this.collection) await this.init();

    const templates: Array<{
      id: string;
      document: string;
      metadata: Record<string, string>;
      embedding: number[];
    }> = [];

    for (const dir of templateDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const { data: frontmatter, content } = matter(raw);

          const name = frontmatter.name || path.basename(file, '.md');
          const id = this.slugify(name);
          const description = frontmatter.description || '';
          const keywords = Array.isArray(frontmatter.keywords)
            ? frontmatter.keywords.join(', ')
            : '';

          // Build a rich document string for embedding
          const document = [
            `Name: ${name}`,
            description ? `Description: ${description}` : '',
            keywords ? `Keywords: ${keywords}` : '',
            frontmatter.domain ? `Domain: ${frontmatter.domain}` : '',
            frontmatter.methodology ? `Methodology: ${frontmatter.methodology}` : '',
            content.slice(0, 1000), // first 1000 chars of content
          ].filter(Boolean).join('\n');

          // Generate embedding
          const embeddings = await this.ollama.embed({
            model: this.config.embeddingModel,
            input: document,
          });

          if (embeddings.length > 0) {
            templates.push({
              id,
              document,
              metadata: {
                name,
                description,
                domain: frontmatter.domain || '',
                complexity: frontmatter.complexity || '',
                methodology: frontmatter.methodology || '',
                filePath,
              },
              embedding: embeddings[0],
            });
          }
        } catch (err) {
          console.warn(`Failed to index template ${filePath}:`, err);
        }
      }
    }

    if (templates.length === 0) return 0;

    // Upsert all templates into ChromaDB
    await this.collection!.upsert({
      ids: templates.map(t => t.id),
      documents: templates.map(t => t.document),
      metadatas: templates.map(t => t.metadata),
      embeddings: templates.map(t => t.embedding),
    });

    return templates.length;
  }

  /**
   * Search for the most relevant reasoning templates for a query.
   */
  async search(query: string, topK: number = 3): Promise<TemplateMatch[]> {
    if (!this.collection) await this.init();

    // Embed the query
    const embeddings = await this.ollama.embed({
      model: this.config.embeddingModel,
      input: query,
    });

    if (embeddings.length === 0) return [];

    // Query ChromaDB
    const results = await this.collection!.query({
      queryEmbeddings: [embeddings[0]],
      nResults: topK,
      include: ['documents', 'metadatas', 'distances'] as any,
    });

    const matches: TemplateMatch[] = [];

    const ids = results.ids[0] ?? [];
    const distances = results.distances?.[0] ?? [];
    const metadatas = results.metadatas?.[0] ?? [];

    for (let i = 0; i < ids.length; i++) {
      // ChromaDB cosine distance: 0 = identical, 2 = opposite
      // Convert to similarity: 1 - (distance / 2)
      const distance = distances[i] ?? 1;
      const score = 1 - distance / 2;

      if (score < this.config.similarityThreshold) continue;

      const meta = metadatas[i] as any;
      const filePath = meta?.filePath || '';

      let content = '';
      try {
        if (filePath && fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf-8');
        }
      } catch {
        // file may have been moved
      }

      matches.push({
        id: ids[i],
        name: meta?.name || ids[i],
        score,
        description: meta?.description || '',
        content,
      });
    }

    return matches;
  }

  /**
   * Add a new template to the index.
   */
  async addTemplate(filePath: string): Promise<void> {
    if (!this.collection) await this.init();

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    const name = frontmatter.name || path.basename(filePath, '.md');
    const id = this.slugify(name);
    const description = frontmatter.description || '';
    const keywords = Array.isArray(frontmatter.keywords)
      ? frontmatter.keywords.join(', ')
      : '';

    const document = [
      `Name: ${name}`,
      description ? `Description: ${description}` : '',
      keywords ? `Keywords: ${keywords}` : '',
      frontmatter.domain ? `Domain: ${frontmatter.domain}` : '',
      content.slice(0, 1000),
    ].filter(Boolean).join('\n');

    const embeddings = await this.ollama.embed({
      model: this.config.embeddingModel,
      input: document,
    });

    if (embeddings.length > 0) {
      await this.collection!.upsert({
        ids: [id],
        documents: [document],
        metadatas: [{
          name,
          description,
          domain: frontmatter.domain || '',
          complexity: frontmatter.complexity || '',
          methodology: frontmatter.methodology || '',
          filePath,
        }],
        embeddings: [embeddings[0]],
      });
    }
  }

  /**
   * Convert a name to a URL-safe slug ID.
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
