import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import { Comment, CreateCommentInput, UpdateCommentInput } from '../../models/Comment.js';

/**
 * Database row type for comments
 */
interface CommentRow {
  id: string;
  task_id: string;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for Comment entities
 */
export class CommentRepository extends BaseRepository<Comment> {
  protected tableName = 'task_comments';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Comment {
    const r = row as CommentRow;
    return {
      id: r.id,
      taskId: r.task_id,
      content: r.content,
      author: r.author,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new comment
   */
  create(input: CreateCommentInput): Comment {
    const id = this.generateId();
    const timestamp = this.now();

    this.db
      .prepare(`
        INSERT INTO task_comments (id, task_id, content, author, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.taskId,
        input.content,
        input.author ?? null,
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find all comments for a task
   */
  findByTaskId(taskId: string): Comment[] {
    const rows = this.db
      .prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC')
      .all(taskId) as CommentRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find comments for a task in reverse chronological order
   */
  findByTaskIdDesc(taskId: string): Comment[] {
    const rows = this.db
      .prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at DESC')
      .all(taskId) as CommentRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a comment
   */
  update(id: string, input: UpdateCommentInput): Comment | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE task_comments
        SET content = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.content ?? existing.content,
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Delete a comment
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM task_comments WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Delete all comments for a task
   */
  deleteByTaskId(taskId: string): number {
    const result = this.db
      .prepare('DELETE FROM task_comments WHERE task_id = ?')
      .run(taskId);
    return result.changes;
  }

  /**
   * Count comments for a task
   */
  countByTaskId(taskId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM task_comments WHERE task_id = ?')
      .get(taskId) as { count: number };
    return result.count;
  }

  /**
   * Get recent comments across all tasks in a plan
   */
  findRecentByPlanId(planId: string, limit: number = 10): Array<Comment & { taskTitle: string }> {
    const rows = this.db
      .prepare(`
        SELECT c.*, t.title as task_title
        FROM task_comments c
        JOIN tasks t ON c.task_id = t.id
        WHERE t.plan_id = ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `)
      .all(planId, limit) as Array<CommentRow & { task_title: string }>;

    return rows.map(row => ({
      ...this.mapRowToEntity(row),
      taskTitle: row.task_title
    }));
  }
}
