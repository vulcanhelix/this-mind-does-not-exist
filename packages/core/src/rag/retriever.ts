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

// import { ChromaClient, Collection } from 'chromadb';
// import { OllamaClient } from '../ollama/client';
// import type { Template, TemplateMatch } from './types';
// import matter from 'gray-matter';
// import { glob } from 'glob';
// import fs from 'fs';

export class RAGRetriever {
  // private chroma: ChromaClient;
  // private collection: Collection;
  // private ollama: OllamaClient;

  constructor(/* chromaUrl: string, ollama: OllamaClient */) {
    // TODO: Initialize ChromaDB client
    // TODO: Get or create 'reasoning_templates' collection
  }

  /**
   * Load all templates from disk and index them into ChromaDB.
   * Called once on startup.
   */
  async indexTemplates(templateDirs: string[]): Promise<number> {
    // TODO: Glob for all .md files in template directories
    // TODO: Parse each file with gray-matter (YAML frontmatter)
    // TODO: Generate embeddings for each template
    // TODO: Upsert into ChromaDB
    // TODO: Return count of indexed templates
    return 0;
  }

  /**
   * Search for the most relevant reasoning templates for a query.
   */
  async search(query: string, topK: number = 3): Promise<any[]> {
    // TODO: Embed the query using Ollama nomic-embed-text
    // TODO: Query ChromaDB with the embedding
    // TODO: Filter by similarity threshold (0.65)
    // TODO: Return formatted TemplateMatch objects
    return [];
  }

  /**
   * Add a new template to the index.
   */
  async addTemplate(filePath: string): Promise<void> {
    // TODO: Parse the file, generate embedding, upsert into ChromaDB
  }
}
