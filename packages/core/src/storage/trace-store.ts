// ============================================================
// This Mind Does Not Exist — Trace Store (SQLite)
// ============================================================
// Persistent storage for debate traces, rounds, and metadata.
// Uses better-sqlite3 for synchronous, embedded SQLite access.
//
// Tables:
//   traces    — One row per completed debate
//   rounds    — One row per debate round
//   templates — Reasoning template metadata
//   finetune_runs — Fine-tuning job history
//
// See docs/architecture.md for full schema.
// ============================================================

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { DebateTrace, DebateRound } from '../debate/types';
import fs from 'fs';
import path from 'path';

export class TraceStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/traces.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  /**
   * Create database tables if they don't exist.
   */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        query TEXT NOT NULL,
        final_answer TEXT NOT NULL,
        total_rounds INTEGER NOT NULL,
        early_stopped INTEGER DEFAULT 0,
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
        templates_used TEXT,
        metadata TEXT
      );

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

      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT,
        complexity TEXT,
        methodology TEXT,
        file_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS finetune_runs (
        id TEXT PRIMARY KEY,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'pending',
        traces_used INTEGER,
        lora_path TEXT,
        config TEXT,
        metrics TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_traces_quality ON traces(quality_score);
      CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
      CREATE INDEX IF NOT EXISTS idx_rounds_trace ON rounds(trace_id);
    `);
  }

  /**
   * Save a complete debate trace.
   */
  async saveTrace(trace: DebateTrace): Promise<string> {
    const id = trace.id || randomUUID();

    const insertTrace = this.db.prepare(`
      INSERT INTO traces (
        id, query, final_answer, total_rounds, early_stopped,
        quality_score, user_rating, auto_score,
        proposer_model, skeptic_model, synthesizer_model, embedding_model,
        total_duration_ms, rag_duration_ms, synthesis_duration_ms,
        templates_used, metadata
      ) VALUES (
        @id, @query, @finalAnswer, @totalRounds, @earlyStopped,
        @qualityScore, @userRating, @autoScore,
        @proposerModel, @skepticModel, @synthesizerModel, @embeddingModel,
        @totalDurationMs, @ragDurationMs, @synthesisDurationMs,
        @templatesUsed, @metadata
      )
    `);

    const insertRound = this.db.prepare(`
      INSERT INTO rounds (
        id, trace_id, round_number, proposer_response, skeptic_response,
        proposer_duration_ms, skeptic_duration_ms
      ) VALUES (
        @id, @traceId, @roundNumber, @proposerResponse, @skepticResponse,
        @proposerDurationMs, @skepticDurationMs
      )
    `);

    const transaction = this.db.transaction(() => {
      insertTrace.run({
        id,
        query: trace.query,
        finalAnswer: trace.finalAnswer,
        totalRounds: trace.totalRounds,
        earlyStopped: trace.earlyStopped ? 1 : 0,
        qualityScore: trace.qualityScore ?? null,
        userRating: trace.userRating ?? null,
        autoScore: trace.autoScore ?? null,
        proposerModel: trace.models.proposer,
        skepticModel: trace.models.skeptic,
        synthesizerModel: trace.models.synthesizer,
        embeddingModel: trace.models.embedding,
        totalDurationMs: trace.timing.totalMs ?? null,
        ragDurationMs: trace.timing.ragMs ?? null,
        synthesisDurationMs: trace.timing.synthesisMs ?? null,
        templatesUsed: JSON.stringify(trace.templatesUsed),
        metadata: null,
      });

      for (const round of trace.rounds) {
        insertRound.run({
          id: randomUUID(),
          traceId: id,
          roundNumber: round.round,
          proposerResponse: round.proposerResponse,
          skepticResponse: round.skepticResponse,
          proposerDurationMs: round.proposerDurationMs ?? null,
          skepticDurationMs: round.skepticDurationMs ?? null,
        });
      }
    });

    transaction();
    return id;
  }

  /**
   * Get a trace by ID.
   */
  async getTrace(id: string): Promise<DebateTrace | null> {
    const traceRow = this.db.prepare(`
      SELECT * FROM traces WHERE id = ?
    `).get(id) as any;

    if (!traceRow) return null;

    const roundRows = this.db.prepare(`
      SELECT * FROM rounds WHERE trace_id = ? ORDER BY round_number ASC
    `).all(id) as any[];

    return this.rowToTrace(traceRow, roundRows);
  }

  /**
   * List traces with pagination and filtering.
   */
  async listTraces(options?: {
    limit?: number;
    offset?: number;
    minQuality?: number;
    search?: string;
  }): Promise<DebateTrace[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.minQuality !== undefined) {
      conditions.push('(quality_score >= ? OR user_rating >= ?)');
      params.push(options.minQuality, options.minQuality);
    }

    if (options?.search) {
      conditions.push('query LIKE ?');
      params.push(`%${options.search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM traces ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const traceRows = this.db.prepare(sql).all(...params) as any[];

    return traceRows.map(row => {
      const roundRows = this.db.prepare(`
        SELECT * FROM rounds WHERE trace_id = ? ORDER BY round_number ASC
      `).all(row.id) as any[];
      return this.rowToTrace(row, roundRows);
    });
  }

  /**
   * Update the user rating for a trace.
   */
  async rateTrace(id: string, rating: number): Promise<void> {
    this.db.prepare(`
      UPDATE traces SET user_rating = ? WHERE id = ?
    `).run(rating, id);
  }

  /**
   * Get high-quality traces for fine-tuning.
   */
  async getFineTuneTraces(minQuality: number = 8): Promise<DebateTrace[]> {
    const traceRows = this.db.prepare(`
      SELECT * FROM traces
      WHERE quality_score >= ? OR user_rating >= ?
      ORDER BY created_at DESC
    `).all(minQuality, minQuality) as any[];

    return traceRows.map(row => {
      const roundRows = this.db.prepare(`
        SELECT * FROM rounds WHERE trace_id = ? ORDER BY round_number ASC
      `).all(row.id) as any[];
      return this.rowToTrace(row, roundRows);
    });
  }

  /**
   * Get statistics about stored traces.
   */
  async getStats(): Promise<{
    totalTraces: number;
    avgQuality: number;
    fineTuneCandidates: number;
  }> {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(COALESCE(quality_score, auto_score)) as avg_quality,
        SUM(CASE WHEN quality_score >= 8 OR user_rating >= 8 THEN 1 ELSE 0 END) as finetune_candidates
      FROM traces
    `).get() as any;

    return {
      totalTraces: stats.total ?? 0,
      avgQuality: stats.avg_quality ?? 0,
      fineTuneCandidates: stats.finetune_candidates ?? 0,
    };
  }

  /**
   * Save a fine-tune run record.
   */
  saveFineTuneRun(run: {
    id: string;
    status: string;
    tracesUsed?: number;
    loraPath?: string;
    config?: Record<string, any>;
  }): void {
    this.db.prepare(`
      INSERT INTO finetune_runs (id, status, traces_used, lora_path, config)
      VALUES (@id, @status, @tracesUsed, @loraPath, @config)
    `).run({
      id: run.id,
      status: run.status,
      tracesUsed: run.tracesUsed ?? null,
      loraPath: run.loraPath ?? null,
      config: run.config ? JSON.stringify(run.config) : null,
    });
  }

  /**
   * Update a fine-tune run record.
   */
  updateFineTuneRun(id: string, updates: {
    status?: string;
    completedAt?: string;
    loraPath?: string;
    metrics?: Record<string, any>;
  }): void {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); params.push(updates.completedAt); }
    if (updates.loraPath !== undefined) { fields.push('lora_path = ?'); params.push(updates.loraPath); }
    if (updates.metrics !== undefined) { fields.push('metrics = ?'); params.push(JSON.stringify(updates.metrics)); }

    if (fields.length === 0) return;
    params.push(id);
    this.db.prepare(`UPDATE finetune_runs SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  /**
   * Get a fine-tune run by ID.
   */
  getFineTuneRun(id: string): any {
    return this.db.prepare('SELECT * FROM finetune_runs WHERE id = ?').get(id);
  }

  /**
   * List all fine-tune runs.
   */
  listFineTuneRuns(): any[] {
    return this.db.prepare('SELECT * FROM finetune_runs ORDER BY started_at DESC').all() as any[];
  }

  /**
   * Convert a database row to a DebateTrace object.
   */
  private rowToTrace(row: any, roundRows: any[]): DebateTrace {
    const rounds: DebateRound[] = roundRows.map(r => ({
      round: r.round_number,
      proposerResponse: r.proposer_response,
      skepticResponse: r.skeptic_response,
      proposerDurationMs: r.proposer_duration_ms ?? 0,
      skepticDurationMs: r.skeptic_duration_ms ?? 0,
    }));

    return {
      id: row.id,
      createdAt: row.created_at,
      query: row.query,
      finalAnswer: row.final_answer,
      totalRounds: row.total_rounds,
      earlyStopped: row.early_stopped === 1,
      qualityScore: row.quality_score ?? null,
      userRating: row.user_rating ?? null,
      autoScore: row.auto_score ?? null,
      templatesUsed: row.templates_used ? JSON.parse(row.templates_used) : [],
      rounds,
      models: {
        proposer: row.proposer_model,
        skeptic: row.skeptic_model,
        synthesizer: row.synthesizer_model,
        embedding: row.embedding_model,
      },
      timing: {
        totalMs: row.total_duration_ms ?? 0,
        ragMs: row.rag_duration_ms ?? 0,
        roundsMs: rounds.map(r => (r.proposerDurationMs ?? 0) + (r.skepticDurationMs ?? 0)),
        synthesisMs: row.synthesis_duration_ms ?? 0,
      },
    };
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
