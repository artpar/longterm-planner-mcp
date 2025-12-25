import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  ChangeLog,
  ChangeOperation,
  CreateChangeLogInput
} from '../../models/ChangeLog.js';
import { EntityType } from '../../models/enums.js';

/**
 * Database row type for change log
 */
interface ChangeLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  old_value: string | null;
  new_value: string | null;
  session_id: string | null;
  created_at: string;
  undone: number;
}

/**
 * Filter options for finding change logs
 */
export interface ChangeLogFilter {
  operation?: ChangeOperation[];
  sessionId?: string;
  includeUndone?: boolean;
}

/**
 * Repository for ChangeLog entities
 */
export class ChangeLogRepository extends BaseRepository<ChangeLog> {
  protected tableName = 'change_log';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): ChangeLog {
    const r = row as ChangeLogRow;
    return {
      id: r.id,
      entityType: r.entity_type as EntityType,
      entityId: r.entity_id,
      operation: r.operation as ChangeOperation,
      oldValue: this.parseJson<Record<string, unknown> | null>(r.old_value),
      newValue: this.parseJson<Record<string, unknown> | null>(r.new_value),
      sessionId: r.session_id,
      createdAt: r.created_at,
      undone: r.undone === 1
    };
  }

  /**
   * Log a change
   */
  create(input: CreateChangeLogInput): ChangeLog {
    const id = this.generateId();
    const timestamp = this.now();

    this.db
      .prepare(`
        INSERT INTO change_log (
          id, entity_type, entity_id, operation,
          old_value, new_value, session_id, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.entityType,
        input.entityId,
        input.operation,
        input.oldValue ? this.toJson(input.oldValue) : null,
        input.newValue ? this.toJson(input.newValue) : null,
        input.sessionId ?? null,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find changes for an entity
   */
  findByEntity(entityType: EntityType, entityId: string, filter?: ChangeLogFilter): ChangeLog[] {
    let sql = 'SELECT * FROM change_log WHERE entity_type = ? AND entity_id = ?';
    const params: unknown[] = [entityType, entityId];

    if (!filter?.includeUndone) {
      sql += ' AND undone = 0';
    }

    if (filter?.operation && filter.operation.length > 0) {
      const placeholders = filter.operation.map(() => '?').join(', ');
      sql += ` AND operation IN (${placeholders})`;
      params.push(...filter.operation);
    }

    if (filter?.sessionId) {
      sql += ' AND session_id = ?';
      params.push(filter.sessionId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as ChangeLogRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find changes for a session
   */
  findBySession(sessionId: string, includeUndone = false): ChangeLog[] {
    let sql = 'SELECT * FROM change_log WHERE session_id = ?';
    const params: unknown[] = [sessionId];

    if (!includeUndone) {
      sql += ' AND undone = 0';
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as ChangeLogRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get the most recent undoable change for an entity
   */
  getLastUndoable(entityType: EntityType, entityId: string): ChangeLog | null {
    const row = this.db
      .prepare(`
        SELECT * FROM change_log
        WHERE entity_type = ? AND entity_id = ? AND undone = 0
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(entityType, entityId) as ChangeLogRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Get the most recent undone change for an entity (for redo)
   */
  getLastRedoable(entityType: EntityType, entityId: string): ChangeLog | null {
    const row = this.db
      .prepare(`
        SELECT * FROM change_log
        WHERE entity_type = ? AND entity_id = ? AND undone = 1
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(entityType, entityId) as ChangeLogRow | undefined;

    return row ? this.mapRowToEntity(row) : null;
  }

  /**
   * Mark a change as undone
   */
  markUndone(id: string): ChangeLog | null {
    const existing = this.findById(id);
    if (!existing) return null;

    this.db
      .prepare('UPDATE change_log SET undone = 1 WHERE id = ?')
      .run(id);

    return this.findById(id);
  }

  /**
   * Mark a change as not undone (for redo)
   */
  markNotUndone(id: string): ChangeLog | null {
    const existing = this.findById(id);
    if (!existing) return null;

    this.db
      .prepare('UPDATE change_log SET undone = 0 WHERE id = ?')
      .run(id);

    return this.findById(id);
  }

  /**
   * Get undo stack for an entity (recent undoable changes)
   */
  getUndoStack(entityType: EntityType, entityId: string, limit = 10): ChangeLog[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM change_log
        WHERE entity_type = ? AND entity_id = ? AND undone = 0
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(entityType, entityId, limit) as ChangeLogRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get redo stack for an entity (recent undone changes)
   */
  getRedoStack(entityType: EntityType, entityId: string, limit = 10): ChangeLog[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM change_log
        WHERE entity_type = ? AND entity_id = ? AND undone = 1
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(entityType, entityId, limit) as ChangeLogRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Clear redo stack for an entity (called when new changes are made)
   */
  clearRedoStack(entityType: EntityType, entityId: string): number {
    const result = this.db
      .prepare(`
        DELETE FROM change_log
        WHERE entity_type = ? AND entity_id = ? AND undone = 1
      `)
      .run(entityType, entityId);

    return result.changes;
  }

  /**
   * Get recent changes (across all entities)
   */
  getRecent(limit = 50): ChangeLog[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM change_log
        WHERE undone = 0
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as ChangeLogRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Count changes for an entity
   */
  countForEntity(entityType: EntityType, entityId: string): { total: number; undone: number } {
    const total = this.db
      .prepare('SELECT COUNT(*) as count FROM change_log WHERE entity_type = ? AND entity_id = ?')
      .get(entityType, entityId) as { count: number };

    const undone = this.db
      .prepare('SELECT COUNT(*) as count FROM change_log WHERE entity_type = ? AND entity_id = ? AND undone = 1')
      .get(entityType, entityId) as { count: number };

    return {
      total: total.count,
      undone: undone.count
    };
  }

  /**
   * Prune old change logs (keep last N changes per entity)
   */
  pruneOld(keepCount = 100): number {
    // This is a more complex query - we delete old entries per entity
    const result = this.db
      .prepare(`
        DELETE FROM change_log
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY entity_type, entity_id
              ORDER BY created_at DESC
            ) as row_num
            FROM change_log
          ) WHERE row_num > ?
        )
      `)
      .run(keepCount);

    return result.changes;
  }
}
