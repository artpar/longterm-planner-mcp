import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Dependency,
  CreateDependencyInput
} from '../../models/Dependency.js';
import { DependencyType, EntityType } from '../../models/enums.js';

/**
 * Database row type for dependencies
 */
interface DependencyRow {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  dependency_type: string;
  created_at: string;
}

/**
 * Filter options for finding dependencies
 */
export interface DependencyFilter {
  dependencyType?: DependencyType[];
}

/**
 * Dependency chain item for traversal
 */
export interface DependencyChainItem {
  entity: { type: EntityType; id: string };
  dependencyType: DependencyType;
  depth: number;
}

/**
 * Repository for Dependency entities
 */
export class DependencyRepository extends BaseRepository<Dependency> {
  protected tableName = 'dependencies';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Dependency {
    const r = row as DependencyRow;
    return {
      id: r.id,
      sourceType: r.source_type as EntityType,
      sourceId: r.source_id,
      targetType: r.target_type as EntityType,
      targetId: r.target_id,
      dependencyType: r.dependency_type as DependencyType,
      createdAt: r.created_at
    };
  }

  /**
   * Create a new dependency
   */
  create(input: CreateDependencyInput): Dependency {
    const id = this.generateId();
    const timestamp = this.now();

    this.db
      .prepare(`
        INSERT INTO dependencies (
          id, source_type, source_id, target_type, target_id,
          dependency_type, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.sourceType,
        input.sourceId,
        input.targetType,
        input.targetId,
        input.dependencyType ?? DependencyType.BLOCKS,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find dependencies where entity is the source (this entity blocks others)
   */
  findBySource(sourceType: EntityType, sourceId: string, filter?: DependencyFilter): Dependency[] {
    let sql = 'SELECT * FROM dependencies WHERE source_type = ? AND source_id = ?';
    const params: unknown[] = [sourceType, sourceId];

    if (filter?.dependencyType && filter.dependencyType.length > 0) {
      const placeholders = filter.dependencyType.map(() => '?').join(', ');
      sql += ` AND dependency_type IN (${placeholders})`;
      params.push(...filter.dependencyType);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as DependencyRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find dependencies where entity is the target (this entity is blocked by others)
   */
  findByTarget(targetType: EntityType, targetId: string, filter?: DependencyFilter): Dependency[] {
    let sql = 'SELECT * FROM dependencies WHERE target_type = ? AND target_id = ?';
    const params: unknown[] = [targetType, targetId];

    if (filter?.dependencyType && filter.dependencyType.length > 0) {
      const placeholders = filter.dependencyType.map(() => '?').join(', ');
      sql += ` AND dependency_type IN (${placeholders})`;
      params.push(...filter.dependencyType);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as DependencyRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all dependencies involving an entity (as source or target)
   */
  findByEntity(entityType: EntityType, entityId: string): Dependency[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM dependencies
        WHERE (source_type = ? AND source_id = ?)
           OR (target_type = ? AND target_id = ?)
        ORDER BY created_at ASC
      `)
      .all(entityType, entityId, entityType, entityId) as DependencyRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Check if a dependency exists between two entities
   */
  exists(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ): boolean {
    const result = this.db
      .prepare(`
        SELECT 1 FROM dependencies
        WHERE source_type = ? AND source_id = ?
          AND target_type = ? AND target_id = ?
      `)
      .get(sourceType, sourceId, targetType, targetId);

    return result !== undefined;
  }

  /**
   * Delete a specific dependency between two entities
   */
  deleteBetween(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ): boolean {
    const result = this.db
      .prepare(`
        DELETE FROM dependencies
        WHERE source_type = ? AND source_id = ?
          AND target_type = ? AND target_id = ?
      `)
      .run(sourceType, sourceId, targetType, targetId);

    return result.changes > 0;
  }

  /**
   * Delete all dependencies for an entity
   */
  deleteAllForEntity(entityType: EntityType, entityId: string): number {
    const result = this.db
      .prepare(`
        DELETE FROM dependencies
        WHERE (source_type = ? AND source_id = ?)
           OR (target_type = ? AND target_id = ?)
      `)
      .run(entityType, entityId, entityType, entityId);

    return result.changes;
  }

  /**
   * Get entities that block this entity
   */
  getBlockers(entityType: EntityType, entityId: string): Array<{ type: EntityType; id: string }> {
    const deps = this.findByTarget(entityType, entityId, {
      dependencyType: [DependencyType.BLOCKS]
    });

    return deps.map(d => ({ type: d.sourceType, id: d.sourceId }));
  }

  /**
   * Get entities that this entity blocks
   */
  getBlocked(entityType: EntityType, entityId: string): Array<{ type: EntityType; id: string }> {
    const deps = this.findBySource(entityType, entityId, {
      dependencyType: [DependencyType.BLOCKS]
    });

    return deps.map(d => ({ type: d.targetType, id: d.targetId }));
  }

  /**
   * Check if adding a dependency would create a cycle
   * Adding "source blocks target" means "target depends on source"
   * A cycle occurs if source already (transitively) depends on target
   */
  wouldCreateCycle(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string
  ): boolean {
    // Self-dependency check
    if (sourceType === targetType && sourceId === targetId) {
      return true;
    }

    // Check if source already depends on target (which would create a cycle)
    const visited = new Set<string>();
    const queue: Array<{ type: EntityType; id: string }> = [{ type: sourceType, id: sourceId }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;

      if (visited.has(key)) continue;
      visited.add(key);

      // Check if we've reached the target - this would mean a cycle
      if (current.type === targetType && current.id === targetId) {
        return true;
      }

      // Get all entities that current depends on (its blockers)
      const blockers = this.getBlockers(current.type, current.id);
      queue.push(...blockers);
    }

    return false;
  }

  /**
   * Get dependency chain (all transitive dependencies)
   */
  getDependencyChain(
    entityType: EntityType,
    entityId: string,
    direction: 'upstream' | 'downstream' = 'upstream',
    maxDepth = 10
  ): DependencyChainItem[] {
    const result: DependencyChainItem[] = [];
    const visited = new Set<string>();
    const queue: Array<{ type: EntityType; id: string; depth: number }> = [
      { type: entityType, id: entityId, depth: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;

      if (visited.has(key) || current.depth > maxDepth) continue;
      visited.add(key);

      // Get dependencies based on direction
      const deps = direction === 'upstream'
        ? this.findByTarget(current.type, current.id)
        : this.findBySource(current.type, current.id);

      for (const dep of deps) {
        const nextEntity = direction === 'upstream'
          ? { type: dep.sourceType, id: dep.sourceId }
          : { type: dep.targetType, id: dep.targetId };

        result.push({
          entity: nextEntity,
          dependencyType: dep.dependencyType,
          depth: current.depth + 1
        });

        queue.push({ ...nextEntity, depth: current.depth + 1 });
      }
    }

    return result;
  }

  /**
   * Count dependencies for an entity
   */
  countForEntity(entityType: EntityType, entityId: string): { asSource: number; asTarget: number } {
    const asSource = this.db
      .prepare('SELECT COUNT(*) as count FROM dependencies WHERE source_type = ? AND source_id = ?')
      .get(entityType, entityId) as { count: number };

    const asTarget = this.db
      .prepare('SELECT COUNT(*) as count FROM dependencies WHERE target_type = ? AND target_id = ?')
      .get(entityType, entityId) as { count: number };

    return {
      asSource: asSource.count,
      asTarget: asTarget.count
    };
  }
}
