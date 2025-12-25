import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Goal,
  KeyResult,
  CreateGoalInput,
  UpdateGoalInput
} from '../../models/Goal.js';
import { GoalStatus, Priority } from '../../models/enums.js';

/**
 * Database row type for goals
 */
interface GoalRow {
  id: string;
  plan_id: string;
  parent_goal_id: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  target_date: string | null;
  progress_percent: number;
  key_results: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for finding goals
 */
export interface GoalFilter {
  status?: GoalStatus[];
  priority?: Priority[];
  parentGoalId?: string | null;
}

/**
 * Status counts for goals in a plan
 */
export interface GoalStatusCounts {
  not_started: number;
  in_progress: number;
  blocked: number;
  completed: number;
  cancelled: number;
}

/**
 * Repository for Goal entities
 */
export class GoalRepository extends BaseRepository<Goal> {
  protected tableName = 'goals';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Goal {
    const r = row as GoalRow;
    return {
      id: r.id,
      planId: r.plan_id,
      parentGoalId: r.parent_goal_id,
      title: r.title,
      description: r.description,
      priority: r.priority as Priority,
      status: r.status as GoalStatus,
      targetDate: r.target_date,
      progressPercent: r.progress_percent,
      keyResults: this.parseJson<KeyResult[]>(r.key_results),
      sequenceOrder: r.sequence_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new goal
   */
  create(input: CreateGoalInput): Goal {
    const id = this.generateId();
    const timestamp = this.now();

    // Convert key result descriptions to KeyResult objects
    const keyResults: KeyResult[] = (input.keyResults ?? []).map(desc => ({
      id: this.generateId(),
      description: desc,
      targetValue: null,
      currentValue: null,
      completed: false
    }));

    // Get next sequence order
    const maxSeq = this.db
      .prepare('SELECT MAX(sequence_order) as max_seq FROM goals WHERE plan_id = ?')
      .get(input.planId) as { max_seq: number | null };
    const sequenceOrder = (maxSeq.max_seq ?? -1) + 1;

    this.db
      .prepare(`
        INSERT INTO goals (
          id, plan_id, parent_goal_id, title, description,
          priority, target_date, key_results, sequence_order,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.planId,
        input.parentGoalId ?? null,
        input.title,
        input.description ?? '',
        input.priority ?? Priority.MEDIUM,
        input.targetDate ?? null,
        this.toJson(keyResults),
        sequenceOrder,
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find goals by plan ID with optional filters
   */
  findByPlanId(planId: string, filter?: GoalFilter): Goal[] {
    let sql = 'SELECT * FROM goals WHERE plan_id = ?';
    const params: unknown[] = [planId];

    if (filter?.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(', ');
      sql += ` AND status IN (${placeholders})`;
      params.push(...filter.status);
    }

    if (filter?.priority && filter.priority.length > 0) {
      const placeholders = filter.priority.map(() => '?').join(', ');
      sql += ` AND priority IN (${placeholders})`;
      params.push(...filter.priority);
    }

    if (filter?.parentGoalId !== undefined) {
      if (filter.parentGoalId === null) {
        sql += ' AND parent_goal_id IS NULL';
      } else {
        sql += ' AND parent_goal_id = ?';
        params.push(filter.parentGoalId);
      }
    }

    sql += ' ORDER BY sequence_order ASC';

    const rows = this.db.prepare(sql).all(...params) as GoalRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find top-level goals (no parent)
   */
  findTopLevel(planId: string): Goal[] {
    return this.findByPlanId(planId, { parentGoalId: null });
  }

  /**
   * Find sub-goals of a parent goal
   */
  findSubGoals(parentGoalId: string): Goal[] {
    const rows = this.db
      .prepare('SELECT * FROM goals WHERE parent_goal_id = ? ORDER BY sequence_order ASC')
      .all(parentGoalId) as GoalRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a goal
   */
  update(id: string, input: UpdateGoalInput): Goal | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE goals
        SET title = ?,
            description = ?,
            priority = ?,
            status = ?,
            target_date = ?,
            progress_percent = ?,
            key_results = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.priority ?? existing.priority,
        input.status ?? existing.status,
        input.targetDate !== undefined ? input.targetDate : existing.targetDate,
        input.progressPercent !== undefined ? input.progressPercent : existing.progressPercent,
        this.toJson(input.keyResults ?? existing.keyResults),
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Update goal progress
   */
  updateProgress(id: string, progressPercent: number): Goal | null {
    return this.update(id, { progressPercent });
  }

  /**
   * Update a key result
   */
  updateKeyResult(goalId: string, keyResultId: string, updates: Partial<KeyResult>): Goal | null {
    const goal = this.findById(goalId);
    if (!goal) return null;

    const keyResults = goal.keyResults.map(kr => {
      if (kr.id === keyResultId) {
        return { ...kr, ...updates };
      }
      return kr;
    });

    // Calculate progress based on completed key results
    const completedCount = keyResults.filter(kr => kr.completed).length;
    const progressPercent = keyResults.length > 0
      ? Math.round((completedCount / keyResults.length) * 100)
      : 0;

    return this.update(goalId, { keyResults, progressPercent });
  }

  /**
   * Add a key result to a goal
   */
  addKeyResult(goalId: string, description: string, targetValue?: number): Goal | null {
    const goal = this.findById(goalId);
    if (!goal) return null;

    const newKeyResult: KeyResult = {
      id: this.generateId(),
      description,
      targetValue: targetValue ?? null,
      currentValue: null,
      completed: false
    };

    const keyResults = [...goal.keyResults, newKeyResult];
    return this.update(goalId, { keyResults });
  }

  /**
   * Remove a key result from a goal
   */
  removeKeyResult(goalId: string, keyResultId: string): Goal | null {
    const goal = this.findById(goalId);
    if (!goal) return null;

    const keyResults = goal.keyResults.filter(kr => kr.id !== keyResultId);
    return this.update(goalId, { keyResults });
  }

  /**
   * Find blocked goals for a plan
   */
  findBlocked(planId: string): Goal[] {
    return this.findByPlanId(planId, { status: [GoalStatus.BLOCKED] });
  }

  /**
   * Find in-progress goals for a plan
   */
  findInProgress(planId: string): Goal[] {
    return this.findByPlanId(planId, { status: [GoalStatus.IN_PROGRESS] });
  }

  /**
   * Count goals by status for a plan
   */
  countByStatus(planId: string): GoalStatusCounts {
    const rows = this.db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM goals
        WHERE plan_id = ?
        GROUP BY status
      `)
      .all(planId) as Array<{ status: string; count: number }>;

    const counts: GoalStatusCounts = {
      not_started: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
      cancelled: 0
    };

    for (const row of rows) {
      const key = row.status as keyof GoalStatusCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Move goal to new position
   */
  move(goalId: string, newSequence: number): Goal | null {
    const goal = this.findById(goalId);
    if (!goal) return null;

    this.db.transaction(() => {
      if (newSequence > goal.sequenceOrder) {
        this.db
          .prepare(`
            UPDATE goals
            SET sequence_order = sequence_order - 1
            WHERE plan_id = ? AND sequence_order > ? AND sequence_order <= ?
          `)
          .run(goal.planId, goal.sequenceOrder, newSequence);
      } else {
        this.db
          .prepare(`
            UPDATE goals
            SET sequence_order = sequence_order + 1
            WHERE plan_id = ? AND sequence_order >= ? AND sequence_order < ?
          `)
          .run(goal.planId, newSequence, goal.sequenceOrder);
      }

      this.db
        .prepare('UPDATE goals SET sequence_order = ?, updated_at = ? WHERE id = ?')
        .run(newSequence, this.now(), goalId);
    });

    return this.findById(goalId);
  }

  /**
   * Check if goal exists
   */
  exists(id: string): boolean {
    const result = this.db
      .prepare('SELECT 1 FROM goals WHERE id = ?')
      .get(id);
    return result !== undefined;
  }
}
