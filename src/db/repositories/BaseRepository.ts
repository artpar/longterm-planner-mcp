import { Database } from '../Database.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';

/**
 * Base repository with common CRUD operations
 */
export abstract class BaseRepository<T> {
  protected db: Database;
  protected abstract tableName: string;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Generate a new unique ID
   */
  protected generateId(): string {
    return generateId();
  }

  /**
   * Get current timestamp
   */
  protected now(): string {
    return now();
  }

  /**
   * Parse JSON string to object
   */
  protected parseJson<U>(json: string | null): U {
    if (!json) return {} as U;
    try {
      return JSON.parse(json) as U;
    } catch {
      return {} as U;
    }
  }

  /**
   * Stringify object to JSON
   */
  protected toJson(obj: unknown): string {
    return JSON.stringify(obj);
  }

  /**
   * Map database row to entity
   */
  protected abstract mapRowToEntity(row: unknown): T;

  /**
   * Find entity by ID
   */
  findById(id: string): T | null {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id);

    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  /**
   * Delete entity by ID
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  /**
   * Count all entities
   */
  count(): number {
    const result = this.db
      .prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
      .get() as { count: number };
    return result.count;
  }
}
