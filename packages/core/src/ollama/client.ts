// ============================================================
// This Mind Does Not Exist — Ollama Client
// ============================================================
// Thin wrapper around the Ollama HTTP API for inference and
// embedding generation. Supports streaming for real-time output.
//
// Endpoints used:
//   POST /api/generate  → Text generation (streaming)
//   POST /api/chat      → Chat completion (streaming)
//   POST /api/embed     → Embedding generation
//   GET  /api/tags      → List available models
//   POST /api/pull      → Pull a model
//
// Features:
//   - Streaming via ReadableStream / async generator
//   - Automatic retry with exponential backoff
//   - Connection health checking
//   - Model warm-up (keep model in memory)
// ============================================================

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  stream?: boolean;
  options?: Record<string, any>;
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
  options?: Record<string, any>;
}

export interface OllamaEmbedOptions {
  model: string;
  input: string | string[];
}

export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:11434', timeout: number = 120000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Generate text completion (streaming).
   * Yields tokens as they are generated.
   */
  async *generate(options: OllamaGenerateOptions): AsyncGenerator<string> {
    // TODO: POST to /api/generate with stream: true
    // TODO: Parse NDJSON response stream
    // TODO: Yield each token's response field
    // TODO: Handle errors and timeouts
    yield ''; // Placeholder
  }

  /**
   * Chat completion (streaming).
   * Yields tokens as they are generated.
   */
  async *chat(options: OllamaChatOptions): AsyncGenerator<string> {
    // TODO: POST to /api/chat with stream: true
    // TODO: Parse NDJSON response stream
    // TODO: Yield each message content delta
    yield ''; // Placeholder
  }

  /**
   * Generate embeddings for text.
   */
  async embed(options: OllamaEmbedOptions): Promise<number[][]> {
    // TODO: POST to /api/embed
    // TODO: Return embedding vectors
    return []; // Placeholder
  }

  /**
   * List all available models.
   */
  async listModels(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    // TODO: GET /api/tags
    return []; // Placeholder
  }

  /**
   * Check if Ollama is running and accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Pull a model if not already available.
   */
  async pullModel(modelName: string): Promise<void> {
    // TODO: POST to /api/pull
    // TODO: Stream progress updates
  }
}
