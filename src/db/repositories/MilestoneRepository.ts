import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Milestone,
  CreateMilestoneInput,
  UpdateMilestoneInput
} from '../../models/Milestone.js';
import { MilestoneStatus } from '../../models/enums.js';

/**
 * Database row type for milestones
 */
interface MilestoneRow {
  id: string;
  objective_id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for finding milestones
 */
export interface MilestoneFilter {
  status?: MilestoneStatus[];
}

/**
 * Status counts for milestones
 */
export interface MilestoneStatusCounts {
  pending: number;
  in_progress: number;
  completed: number;
  missed: number;
  cancelled: number;
}

/**
 * Repository for Milestone entities
 */
export class MilestoneRepository extends BaseRepository<Milestone> {
  protected tableName = 'milestones';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Milestone {
    const r = row as MilestoneRow;
    return {
      id: r.id,
      objectiveId: r.objective_id,
      title: r.title,
      description: r.description,
      status: r.status as MilestoneStatus,
      dueDate: r.due_date,
      completedAt: r.completed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new milestone
   */
  create(input: CreateMilestoneInput): Milestone {
    const id = this.generateId();
    const timestamp = this.now();

    this.db
      .prepare(`
        INSERT INTO milestones (
          id, objective_id, title, description, due_date,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.objectiveId,
        input.title,
        input.description ?? '',
        input.dueDate ?? null,
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find milestones by objective ID with optional filters
   */
  findByObjectiveId(objectiveId: string, filter?: MilestoneFilter): Milestone[] {
    let sql = 'SELECT * FROM milestones WHERE objective_id = ?';
    const params: unknown[] = [objectiveId];

    if (filter?.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(', ');
      sql += ` AND status IN (${placeholders})`;
      params.push(...filter.status);
    }

    sql += ' ORDER BY due_date ASC NULLS LAST, created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as MilestoneRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a milestone
   */
  update(id: string, input: UpdateMilestoneInput): Milestone | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    // Handle completion timestamp
    let completedAt = existing.completedAt;
    if (input.status === MilestoneStatus.COMPLETED && !existing.completedAt) {
      completedAt = timestamp;
    }

    this.db
      .prepare(`
        UPDATE milestones
        SET title = ?,
            description = ?,
            status = ?,
            due_date = ?,
            completed_at = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.status ?? existing.status,
        input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        completedAt,
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Start a milestone
   */
  start(id: string): Milestone | null {
    return this.update(id, { status: MilestoneStatus.IN_PROGRESS });
  }

  /**
   * Complete a milestone
   */
  complete(id: string): Milestone | null {
    return this.update(id, { status: MilestoneStatus.COMPLETED });
  }

  /**
   * Mark a milestone as missed
   */
  miss(id: string): Milestone | null {
    return this.update(id, { status: MilestoneStatus.MISSED });
  }

  /**
   * Cancel a milestone
   */
  cancel(id: string): Milestone | null {
    return this.update(id, { status: MilestoneStatus.CANCELLED });
  }

  /**
   * Find pending milestones for an objective
   */
  findPending(objectiveId: string): Milestone[] {
    return this.findByObjectiveId(objectiveId, { status: [MilestoneStatus.PENDING] });
  }

  /**
   * Find in-progress milestones for an objective
   */
  findInProgress(objectiveId: string): Milestone[] {
    return this.findByObjectiveId(objectiveId, { status: [MilestoneStatus.IN_PROGRESS] });
  }

  /**
   * Find overdue milestones
   */
  findOverdue(objectiveId?: string): Milestone[] {
    const today = this.now().split('T')[0];
    let sql = `
      SELECT * FROM milestones
      WHERE due_date < ?
      AND status NOT IN ('completed', 'cancelled', 'missed')
    `;
    const params: unknown[] = [today];

    if (objectiveId) {
      sql += ' AND objective_id = ?';
      params.push(objectiveId);
    }

    sql += ' ORDER BY due_date ASC';

    const rows = this.db.prepare(sql).all(...params) as MilestoneRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find upcoming milestones within N days
   */
  findUpcoming(days: number, objectiveId?: string): Milestone[] {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    let sql = `
      SELECT * FROM milestones
      WHERE due_date >= ? AND due_date <= ?
      AND status NOT IN ('completed', 'cancelled', 'missed')
    `;
    const params: unknown[] = [todayStr, futureDateStr];

    if (objectiveId) {
      sql += ' AND objective_id = ?';
      params.push(objectiveId);
    }

    sql += ' ORDER BY due_date ASC';

    const rows = this.db.prepare(sql).all(...params) as MilestoneRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Count milestones by status for an objective
   */
  countByStatus(objectiveId: string): MilestoneStatusCounts {
    const rows = this.db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM milestones
        WHERE objective_id = ?
        GROUP BY status
      `)
      .all(objectiveId) as Array<{ status: string; count: number }>;

    const counts: MilestoneStatusCounts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      missed: 0,
      cancelled: 0
    };

    for (const row of rows) {
      const key = row.status as keyof MilestoneStatusCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Calculate completion percentage for an objective's milestones
   */
  getCompletionPercent(objectiveId: string): number {
    const counts = this.countByStatus(objectiveId);
    const total = counts.pending + counts.in_progress + counts.completed + counts.missed + counts.cancelled;
    if (total === 0) return 0;
    return Math.round((counts.completed / total) * 100);
  }

  /**
   * Check if milestone exists
   */
  exists(id: string): boolean {
    const result = this.db
      .prepare('SELECT 1 FROM milestones WHERE id = ?')
      .get(id);
    return result !== undefined;
  }
}
