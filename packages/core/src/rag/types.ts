// ============================================================
// This Mind Does Not Exist — RAG Types
// ============================================================

/** A reasoning template loaded from disk */
export interface Template {
  /** Unique identifier (derived from filename) */
  id: string;
  /** Human-readable name from frontmatter */
  name: string;
  /** Problem domain (e.g., "mathematics", "engineering") */
  domain: string;
  /** Complexity level (e.g., "simple", "moderate", "complex") */
  complexity: string;
  /** Reasoning methodology (e.g., "deductive", "exploratory") */
  methodology: string;
  /** Search keywords */
  keywords: string[];
  /** Brief description */
  description: string;
  /** Full markdown content (the template steps) */
  content: string;
  /** File path on disk */
  filePath: string;
}

/** A template match result from semantic search */
export interface TemplateMatch {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Cosine similarity score (0-1) */
  score: number;
  /** Description of what the template is for */
  description: string;
  /** Full template content */
  content: string;
}

/** Configuration for the RAG retriever */
export interface RAGConfig {
  /** ChromaDB server URL */
  chromaUrl: string;
  /** Ollama embedding model name */
  embeddingModel: string;
  /** Number of templates to retrieve per query */
  topK: number;
  /** Minimum similarity score threshold */
  similarityThreshold: number;
  /** Directories to load templates from */
  templateDirs: string[];
}
