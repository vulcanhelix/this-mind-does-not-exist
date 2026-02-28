// ============================================================
// This Mind Does Not Exist — Template Store
// ============================================================
// Manages reasoning template metadata in SQLite.
// Templates are markdown files with YAML frontmatter stored
// in data/bot-buffer/ and data/templates/.
// ============================================================

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Template {
  id: string;
  name: string;
  domain: string | null;
  complexity: string | null;
  methodology: string | null;
  filePath: string;
  content: string;
  createdAt: string;
  usageCount: number;
}

export class TemplateStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Load all templates from disk directories and upsert into SQLite.
   */
  loadFromDirs(templateDirs: string[]): number {
    let count = 0;
    for (const dir of templateDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          this.upsertFromFile(filePath);
          count++;
        } catch (err) {
          console.warn(`Failed to load template ${filePath}:`, err);
        }
      }
    }
    return count;
  }

  /**
   * Parse a template file and upsert into the database.
   */
  upsertFromFile(filePath: string): Template {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    const name = frontmatter.name || path.basename(filePath, '.md');
    const id = this.slugify(name);

    this.db.prepare(`
      INSERT INTO templates (id, name, domain, complexity, methodology, file_path)
      VALUES (@id, @name, @domain, @complexity, @methodology, @filePath)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        domain = excluded.domain,
        complexity = excluded.complexity,
        methodology = excluded.methodology,
        file_path = excluded.file_path
    `).run({
      id,
      name,
      domain: frontmatter.domain ?? null,
      complexity: frontmatter.complexity ?? null,
      methodology: frontmatter.methodology ?? null,
      filePath,
    });

    return {
      id,
      name,
      domain: frontmatter.domain ?? null,
      complexity: frontmatter.complexity ?? null,
      methodology: frontmatter.methodology ?? null,
      filePath,
      content: raw,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
  }

  /**
   * Get a template by ID, including its full content.
   */
  getTemplate(id: string): Template | null {
    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.rowToTemplate(row);
  }

  /**
   * List all templates.
   */
  listTemplates(): Template[] {
    const rows = this.db.prepare('SELECT * FROM templates ORDER BY usage_count DESC').all() as any[];
    return rows.map(r => this.rowToTemplate(r));
  }

  /**
   * Increment usage count for a template.
   */
  incrementUsage(id: string): void {
    this.db.prepare('UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }

  /**
   * Convert a database row to a Template object.
   */
  private rowToTemplate(row: any): Template {
    let content = '';
    try {
      if (row.file_path && fs.existsSync(row.file_path)) {
        content = fs.readFileSync(row.file_path, 'utf-8');
      }
    } catch {
      // file may have been moved
    }

    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      complexity: row.complexity,
      methodology: row.methodology,
      filePath: row.file_path,
      content,
      createdAt: row.created_at,
      usageCount: row.usage_count ?? 0,
    };
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
