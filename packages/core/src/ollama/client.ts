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
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  /**
   * Retry a function with exponential backoff.
   */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: Error | unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) {
          await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }

  /**
   * Generate text completion (streaming).
   * Yields tokens as they are generated.
   */
  async *generate(options: OllamaGenerateOptions): AsyncGenerator<string> {
    const body: Record<string, any> = {
      model: options.model,
      prompt: options.prompt,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.options ?? {}),
      },
    };
    if (options.system) body.system = options.system;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await this.withRetry(() =>
        fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) yield parsed.response;
            if (parsed.done) return;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Chat completion (streaming).
   * Yields tokens as they are generated.
   */
  async *chat(options: OllamaChatOptions): AsyncGenerator<string> {
    const body: Record<string, any> = {
      model: options.model,
      messages: options.messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.options ?? {}),
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await this.withRetry(() =>
        fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) yield parsed.message.content;
            if (parsed.done) return;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate embeddings for text.
   */
  async embed(options: OllamaEmbedOptions): Promise<number[][]> {
    const response = await this.withRetry(() =>
      fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, input: options.input }),
      })
    );

    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings;
  }

  /**
   * List all available models.
   */
  async listModels(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    const response = await this.withRetry(() =>
      fetch(`${this.baseUrl}/api/tags`)
    );

    if (!response.ok) {
      throw new Error(`Ollama listModels failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      models: { name: string; size: number; modified_at: string }[]
    };

    return (data.models ?? []).map(m => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));
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
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Ollama pull failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.status === 'success') return;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
