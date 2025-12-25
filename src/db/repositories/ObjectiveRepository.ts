import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Objective,
  CreateObjectiveInput,
  UpdateObjectiveInput
} from '../../models/Objective.js';
import { ObjectiveStatus } from '../../models/enums.js';

/**
 * Database row type for objectives
 */
interface ObjectiveRow {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  status: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for finding objectives
 */
export interface ObjectiveFilter {
  status?: ObjectiveStatus[];
}

/**
 * Status counts for objectives in a goal
 */
export interface ObjectiveStatusCounts {
  pending: number;
  active: number;
  completed: number;
  skipped: number;
}

/**
 * Repository for Objective entities
 */
export class ObjectiveRepository extends BaseRepository<Objective> {
  protected tableName = 'objectives';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Objective {
    const r = row as ObjectiveRow;
    return {
      id: r.id,
      goalId: r.goal_id,
      title: r.title,
      description: r.description,
      status: r.status as ObjectiveStatus,
      sequenceOrder: r.sequence_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new objective
   */
  create(input: CreateObjectiveInput): Objective {
    const id = this.generateId();
    const timestamp = this.now();

    // Get next sequence order
    const maxSeq = this.db
      .prepare('SELECT MAX(sequence_order) as max_seq FROM objectives WHERE goal_id = ?')
      .get(input.goalId) as { max_seq: number | null };
    const sequenceOrder = (maxSeq.max_seq ?? -1) + 1;

    this.db
      .prepare(`
        INSERT INTO objectives (
          id, goal_id, title, description, sequence_order,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.goalId,
        input.title,
        input.description ?? '',
        sequenceOrder,
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find objectives by goal ID with optional filters
   */
  findByGoalId(goalId: string, filter?: ObjectiveFilter): Objective[] {
    let sql = 'SELECT * FROM objectives WHERE goal_id = ?';
    const params: unknown[] = [goalId];

    if (filter?.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(', ');
      sql += ` AND status IN (${placeholders})`;
      params.push(...filter.status);
    }

    sql += ' ORDER BY sequence_order ASC';

    const rows = this.db.prepare(sql).all(...params) as ObjectiveRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update an objective
   */
  update(id: string, input: UpdateObjectiveInput): Objective | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE objectives
        SET title = ?,
            description = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.status ?? existing.status,
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Activate an objective
   */
  activate(id: string): Objective | null {
    return this.update(id, { status: ObjectiveStatus.ACTIVE });
  }

  /**
   * Complete an objective
   */
  complete(id: string): Objective | null {
    return this.update(id, { status: ObjectiveStatus.COMPLETED });
  }

  /**
   * Skip an objective
   */
  skip(id: string): Objective | null {
    return this.update(id, { status: ObjectiveStatus.SKIPPED });
  }

  /**
   * Find active objectives for a goal
   */
  findActive(goalId: string): Objective[] {
    return this.findByGoalId(goalId, { status: [ObjectiveStatus.ACTIVE] });
  }

  /**
   * Find pending objectives for a goal
   */
  findPending(goalId: string): Objective[] {
    return this.findByGoalId(goalId, { status: [ObjectiveStatus.PENDING] });
  }

  /**
   * Count objectives by status for a goal
   */
  countByStatus(goalId: string): ObjectiveStatusCounts {
    const rows = this.db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM objectives
        WHERE goal_id = ?
        GROUP BY status
      `)
      .all(goalId) as Array<{ status: string; count: number }>;

    const counts: ObjectiveStatusCounts = {
      pending: 0,
      active: 0,
      completed: 0,
      skipped: 0
    };

    for (const row of rows) {
      const key = row.status as keyof ObjectiveStatusCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Calculate completion percentage for a goal's objectives
   */
  getCompletionPercent(goalId: string): number {
    const counts = this.countByStatus(goalId);
    const total = counts.pending + counts.active + counts.completed + counts.skipped;
    if (total === 0) return 0;
    return Math.round((counts.completed / total) * 100);
  }

  /**
   * Move objective to new position
   */
  move(objectiveId: string, newSequence: number): Objective | null {
    const objective = this.findById(objectiveId);
    if (!objective) return null;

    this.db.transaction(() => {
      if (newSequence > objective.sequenceOrder) {
        this.db
          .prepare(`
            UPDATE objectives
            SET sequence_order = sequence_order - 1
            WHERE goal_id = ? AND sequence_order > ? AND sequence_order <= ?
          `)
          .run(objective.goalId, objective.sequenceOrder, newSequence);
      } else {
        this.db
          .prepare(`
            UPDATE objectives
            SET sequence_order = sequence_order + 1
            WHERE goal_id = ? AND sequence_order >= ? AND sequence_order < ?
          `)
          .run(objective.goalId, newSequence, objective.sequenceOrder);
      }

      this.db
        .prepare('UPDATE objectives SET sequence_order = ?, updated_at = ? WHERE id = ?')
        .run(newSequence, this.now(), objectiveId);
    });

    return this.findById(objectiveId);
  }

  /**
   * Check if objective exists
   */
  exists(id: string): boolean {
    const result = this.db
      .prepare('SELECT 1 FROM objectives WHERE id = ?')
      .get(id);
    return result !== undefined;
  }
}
