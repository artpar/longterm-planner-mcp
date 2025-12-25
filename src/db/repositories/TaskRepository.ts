import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Task,
  TaskContext,
  CreateTaskInput,
  UpdateTaskInput,
  createEmptyTaskContext
} from '../../models/Task.js';
import { TaskStatus, Priority } from '../../models/enums.js';

/**
 * Database row type for tasks
 */
interface TaskRow {
  id: string;
  plan_id: string;
  goal_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimated_hours: number | null;
  actual_hours: number | null;
  assignee: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  context: string;
  tags: string;
  sequence_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for finding tasks
 */
export interface TaskFilter {
  status?: TaskStatus[];
  priority?: Priority[];
  assignee?: string;
  parentTaskId?: string | null;
}

/**
 * Status counts for a plan
 */
export interface TaskStatusCounts {
  backlog: number;
  ready: number;
  in_progress: number;
  review: number;
  blocked: number;
  completed: number;
  cancelled: number;
}

/**
 * Repository for Task entities
 */
export class TaskRepository extends BaseRepository<Task> {
  protected tableName = 'tasks';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Task {
    const r = row as TaskRow;
    return {
      id: r.id,
      planId: r.plan_id,
      goalId: r.goal_id,
      milestoneId: r.milestone_id,
      parentTaskId: r.parent_task_id,
      title: r.title,
      description: r.description,
      status: r.status as TaskStatus,
      priority: r.priority as Priority,
      estimatedHours: r.estimated_hours,
      actualHours: r.actual_hours,
      assignee: r.assignee,
      dueDate: r.due_date,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      context: this.parseJson<TaskContext>(r.context),
      tags: this.parseJson<string[]>(r.tags) || [],
      sequenceOrder: r.sequence_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new task
   */
  create(input: CreateTaskInput): Task {
    const id = this.generateId();
    const timestamp = this.now();
    const context = createEmptyTaskContext();

    // Get next sequence order
    const maxSeq = this.db
      .prepare('SELECT MAX(sequence_order) as max_seq FROM tasks WHERE plan_id = ?')
      .get(input.planId) as { max_seq: number | null };
    const sequenceOrder = (maxSeq.max_seq ?? -1) + 1;

    this.db
      .prepare(`
        INSERT INTO tasks (
          id, plan_id, goal_id, milestone_id, parent_task_id,
          title, description, priority, estimated_hours, assignee, due_date,
          context, sequence_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.planId,
        input.goalId ?? null,
        input.milestoneId ?? null,
        input.parentTaskId ?? null,
        input.title,
        input.description ?? '',
        input.priority ?? Priority.MEDIUM,
        input.estimatedHours ?? null,
        input.assignee ?? null,
        input.dueDate ?? null,
        this.toJson(context),
        sequenceOrder,
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find tasks by plan ID with optional filters
   */
  findByPlanId(planId: string, filter?: TaskFilter): Task[] {
    let sql = 'SELECT * FROM tasks WHERE plan_id = ?';
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

    if (filter?.assignee) {
      sql += ' AND assignee = ?';
      params.push(filter.assignee);
    }

    if (filter?.parentTaskId !== undefined) {
      if (filter.parentTaskId === null) {
        sql += ' AND parent_task_id IS NULL';
      } else {
        sql += ' AND parent_task_id = ?';
        params.push(filter.parentTaskId);
      }
    }

    sql += ' ORDER BY sequence_order ASC';

    const rows = this.db.prepare(sql).all(...params) as TaskRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find subtasks of a parent task
   */
  findSubtasks(parentTaskId: string): Task[] {
    const rows = this.db
      .prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY sequence_order ASC')
      .all(parentTaskId) as TaskRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a task
   */
  update(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    // Handle status transitions
    let startedAt = existing.startedAt;
    let completedAt = existing.completedAt;

    if (input.status === TaskStatus.IN_PROGRESS && !existing.startedAt) {
      startedAt = timestamp;
    }

    if (input.status === TaskStatus.COMPLETED && !existing.completedAt) {
      completedAt = timestamp;
    }

    // Merge context if provided
    let context = existing.context;
    if (input.context) {
      context = { ...existing.context, ...input.context };
    }

    this.db
      .prepare(`
        UPDATE tasks
        SET title = ?,
            description = ?,
            status = ?,
            priority = ?,
            estimated_hours = ?,
            actual_hours = ?,
            assignee = ?,
            due_date = ?,
            started_at = ?,
            completed_at = ?,
            context = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.status ?? existing.status,
        input.priority ?? existing.priority,
        input.estimatedHours !== undefined ? input.estimatedHours : existing.estimatedHours,
        input.actualHours !== undefined ? input.actualHours : existing.actualHours,
        input.assignee !== undefined ? input.assignee : existing.assignee,
        input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        startedAt,
        completedAt,
        this.toJson(context),
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Find all blocked tasks for a plan
   */
  findBlocked(planId: string): Task[] {
    return this.findByPlanId(planId, { status: [TaskStatus.BLOCKED] });
  }

  /**
   * Find all ready tasks for a plan
   */
  findReady(planId: string): Task[] {
    return this.findByPlanId(planId, { status: [TaskStatus.READY] });
  }

  /**
   * Find in-progress tasks for a plan
   */
  findInProgress(planId: string): Task[] {
    return this.findByPlanId(planId, { status: [TaskStatus.IN_PROGRESS] });
  }

  /**
   * Count tasks by status for a plan
   */
  countByStatus(planId: string): TaskStatusCounts {
    const rows = this.db
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM tasks
        WHERE plan_id = ?
        GROUP BY status
      `)
      .all(planId) as Array<{ status: string; count: number }>;

    const counts: TaskStatusCounts = {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      review: 0,
      blocked: 0,
      completed: 0,
      cancelled: 0
    };

    for (const row of rows) {
      const key = row.status as keyof TaskStatusCounts;
      if (key in counts) {
        counts[key] = row.count;
      }
    }

    return counts;
  }

  /**
   * Move task to new position
   */
  move(taskId: string, newSequence: number): Task | null {
    const task = this.findById(taskId);
    if (!task) return null;

    // Update sequence orders
    this.db.transaction(() => {
      // Shift tasks
      if (newSequence > task.sequenceOrder) {
        this.db
          .prepare(`
            UPDATE tasks
            SET sequence_order = sequence_order - 1
            WHERE plan_id = ? AND sequence_order > ? AND sequence_order <= ?
          `)
          .run(task.planId, task.sequenceOrder, newSequence);
      } else {
        this.db
          .prepare(`
            UPDATE tasks
            SET sequence_order = sequence_order + 1
            WHERE plan_id = ? AND sequence_order >= ? AND sequence_order < ?
          `)
          .run(task.planId, newSequence, task.sequenceOrder);
      }

      // Update the task's sequence
      this.db
        .prepare('UPDATE tasks SET sequence_order = ?, updated_at = ? WHERE id = ?')
        .run(newSequence, this.now(), taskId);
    });

    return this.findById(taskId);
  }

  /**
   * Add a tag to a task
   */
  addTag(taskId: string, tag: string): Task | null {
    const task = this.findById(taskId);
    if (!task) return null;

    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag) return task;

    // Don't add duplicate tags
    if (task.tags.includes(normalizedTag)) {
      return task;
    }

    const newTags = [...task.tags, normalizedTag];
    this.db
      .prepare('UPDATE tasks SET tags = ?, updated_at = ? WHERE id = ?')
      .run(this.toJson(newTags), this.now(), taskId);

    return this.findById(taskId);
  }

  /**
   * Remove a tag from a task
   */
  removeTag(taskId: string, tag: string): Task | null {
    const task = this.findById(taskId);
    if (!task) return null;

    const normalizedTag = tag.toLowerCase().trim();
    const newTags = task.tags.filter(t => t !== normalizedTag);

    if (newTags.length === task.tags.length) {
      return task; // Tag wasn't present
    }

    this.db
      .prepare('UPDATE tasks SET tags = ?, updated_at = ? WHERE id = ?')
      .run(this.toJson(newTags), this.now(), taskId);

    return this.findById(taskId);
  }

  /**
   * Set all tags for a task (replaces existing)
   */
  setTags(taskId: string, tags: string[]): Task | null {
    const task = this.findById(taskId);
    if (!task) return null;

    const normalizedTags = [...new Set(tags.map(t => t.toLowerCase().trim()).filter(t => t))];

    this.db
      .prepare('UPDATE tasks SET tags = ?, updated_at = ? WHERE id = ?')
      .run(this.toJson(normalizedTags), this.now(), taskId);

    return this.findById(taskId);
  }

  /**
   * Find tasks by tag
   */
  findByTag(planId: string, tag: string): Task[] {
    const normalizedTag = tag.toLowerCase().trim();
    // SQLite JSON search - tags is a JSON array
    const rows = this.db
      .prepare(`
        SELECT * FROM tasks
        WHERE plan_id = ?
        AND tags LIKE ?
        ORDER BY sequence_order ASC
      `)
      .all(planId, `%"${normalizedTag}"%`) as TaskRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get all unique tags used in a plan
   */
  getAllTags(planId: string): string[] {
    const rows = this.db
      .prepare('SELECT tags FROM tasks WHERE plan_id = ?')
      .all(planId) as Array<{ tags: string }>;

    const allTags = new Set<string>();
    for (const row of rows) {
      const tags = this.parseJson<string[]>(row.tags) || [];
      tags.forEach(tag => allTags.add(tag));
    }

    return Array.from(allTags).sort();
  }
}
