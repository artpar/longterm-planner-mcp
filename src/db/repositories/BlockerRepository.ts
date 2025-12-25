import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Blocker,
  CreateBlockerInput,
  ResolveBlockerInput
} from '../../models/Blocker.js';
import { BlockerSeverity, BlockerStatus, EntityType } from '../../models/enums.js';

/**
 * Database row type for blockers
 */
interface BlockerRow {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Filter options for finding blockers
 */
export interface BlockerFilter {
  status?: BlockerStatus[];
  severity?: BlockerSeverity[];
}

/**
 * Status counts for blockers
 */
export interface BlockerStatusCounts {
  open: number;
  investigating: number;
  resolved: number;
  wont_fix: number;
}

/**
 * Severity counts for blockers
 */
export interface BlockerSeverityCounts {
  critical: number;
  major: number;
  minor: number;
}

/**
 * Repository for Blocker entities
 */
export class BlockerRepository extends BaseRepository<Blocker> {
  protected tableName = 'blockers';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Blocker {
    const r = row as BlockerRow;
    return {
      id: r.id,
      entityType: r.entity_type as EntityType,
      entityId: r.entity_id,
      title: r.title,
      description: r.description,
      severity: r.severity as BlockerSeverity,
      status: r.status as BlockerStatus,
      resolution: r.resolution,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at
    };
  }

  /**
   * Create a new blocker
   */
  create(input: CreateBlockerInput): Blocker {
    const id = this.generateId();
    const timestamp = this.now();

    this.db
      .prepare(`
        INSERT INTO blockers (
          id, entity_type, entity_id, title, description,
          severity, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.entityType,
        input.entityId,
        input.title,
        input.description ?? '',
        input.severity ?? BlockerSeverity.MAJOR,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find blockers by entity with optional filters
   */
  findByEntity(entityType: EntityType, entityId: string, filter?: BlockerFilter): Blocker[] {
    let sql = 'SELECT * FROM blockers WHERE entity_type = ? AND entity_id = ?';
    const params: unknown[] = [entityType, entityId];

    if (filter?.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(', ');
      sql += ` AND status IN (${placeholders})`;
      params.push(...filter.status);
    }

    if (filter?.severity && filter.severity.length > 0) {
      const placeholders = filter.severity.map(() => '?').join(', ');
      sql += ` AND severity IN (${placeholders})`;
      params.push(...filter.severity);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as BlockerRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all open blockers
   */
  findOpen(entityType?: EntityType, entityId?: string): Blocker[] {
    let sql = 'SELECT * FROM blockers WHERE status IN (?, ?)';
    const params: unknown[] = [BlockerStatus.OPEN, BlockerStatus.INVESTIGATING];

    if (entityType && entityId) {
      sql += ' AND entity_type = ? AND entity_id = ?';
      params.push(entityType, entityId);
    } else if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }

    sql += ' ORDER BY severity ASC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as BlockerRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find critical blockers
   */
  findCritical(): Blocker[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM blockers
        WHERE severity = ? AND status IN (?, ?)
        ORDER BY created_at DESC
      `)
      .all(BlockerSeverity.CRITICAL, BlockerStatus.OPEN, BlockerStatus.INVESTIGATING) as BlockerRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update blocker status
   */
  updateStatus(id: string, status: BlockerStatus): Blocker | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();
    let resolvedAt = existing.resolvedAt;

    // Set resolved timestamp when status becomes resolved or wont_fix
    if ((status === BlockerStatus.RESOLVED || status === BlockerStatus.WONT_FIX) && !existing.resolvedAt) {
      resolvedAt = timestamp;
    }

    this.db
      .prepare(`
        UPDATE blockers
        SET status = ?, resolved_at = ?
        WHERE id = ?
      `)
      .run(status, resolvedAt, id);

    return this.findById(id);
  }

  /**
   * Start investigating a blocker
   */
  investigate(id: string): Blocker | null {
    return this.updateStatus(id, BlockerStatus.INVESTIGATING);
  }

  /**
   * Resolve a blocker
   */
  resolve(id: string, input: ResolveBlockerInput): Blocker | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE blockers
        SET status = ?, resolution = ?, resolved_at = ?
        WHERE id = ?
      `)
      .run(BlockerStatus.RESOLVED, input.resolution, timestamp, id);

    return this.findById(id);
  }

  /**
   * Mark blocker as won't fix
   */
  wontFix(id: string, reason: string): Blocker | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE blockers
        SET status = ?, resolution = ?, resolved_at = ?
        WHERE id = ?
      `)
      .run(BlockerStatus.WONT_FIX, reason, timestamp, id);

    return this.findById(id);
  }

  /**
   * Reopen a blocker
   */
  reopen(id: string): Blocker | null {
    const existing = this.findById(id);
    if (!existing) return null;

    this.db
      .prepare(`
        UPDATE blockers
        SET status = ?, resolution = NULL, resolved_at = NULL
        WHERE id = ?
      `)
      .run(BlockerStatus.OPEN, id);

    return this.findById(id);
  }

  /**
   * Update blocker severity
   */
  updateSeverity(id: string, severity: BlockerSeverity): Blocker | null {
    const existing = this.findById(id);
    if (!existing) return null;

    this.db
      .prepare('UPDATE blockers SET severity = ? WHERE id = ?')
      .run(severity, id);

    return this.findById(id);
  }

  /**
   * Count blockers by status for an entity
   */
  countByStatus(entityType: EntityType, entityId: string): BlockerStatusCounts {
    const rows = this.db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM blockers
        WHERE entity_type = ? AND entity_id = ?
        GROUP BY status
      `)
      .all(entityType, entityId) as Array<{ status: string; count: number }>;

    const counts: BlockerStatusCounts = {
      open: 0,
      investigating: 0,
      resolved: 0,
      wont_fix: 0
    };

    for (const row of rows) {
      const key = row.status as keyof BlockerStatusCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Count blockers by severity (open/investigating only)
   */
  countBySeverity(entityType?: EntityType, entityId?: string): BlockerSeverityCounts {
    let sql = `
      SELECT severity, COUNT(*) as count
      FROM blockers
      WHERE status IN (?, ?)
    `;
    const params: unknown[] = [BlockerStatus.OPEN, BlockerStatus.INVESTIGATING];

    if (entityType && entityId) {
      sql += ' AND entity_type = ? AND entity_id = ?';
      params.push(entityType, entityId);
    }

    sql += ' GROUP BY severity';

    const rows = this.db.prepare(sql).all(...params) as Array<{ severity: string; count: number }>;

    const counts: BlockerSeverityCounts = {
      critical: 0,
      major: 0,
      minor: 0
    };

    for (const row of rows) {
      const key = row.severity as keyof BlockerSeverityCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Check if entity has any open blockers
   */
  hasOpenBlockers(entityType: EntityType, entityId: string): boolean {
    const result = this.db
      .prepare(`
        SELECT 1 FROM blockers
        WHERE entity_type = ? AND entity_id = ?
        AND status IN (?, ?)
        LIMIT 1
      `)
      .get(entityType, entityId, BlockerStatus.OPEN, BlockerStatus.INVESTIGATING);

    return result !== undefined;
  }

  /**
   * Get count of open blockers for an entity
   */
  countOpen(entityType: EntityType, entityId: string): number {
    const result = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM blockers
        WHERE entity_type = ? AND entity_id = ?
        AND status IN (?, ?)
      `)
      .get(entityType, entityId, BlockerStatus.OPEN, BlockerStatus.INVESTIGATING) as { count: number };

    return result.count;
  }
}
