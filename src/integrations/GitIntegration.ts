import { v4 as uuidv4 } from 'uuid';
import { Database } from '../db/Database.js';
import { TaskService } from '../services/TaskService.js';

export interface CommitLink {
  taskId: string;
  commitHash: string;
  message: string;
  author: string;
  timestamp: string;
  branch?: string;
}

export interface GitCommit {
  id: string;
  taskId: string;
  commitHash: string;
  message: string;
  author: string;
  branch?: string;
  timestamp: string;
  createdAt: string;
}

export interface LinkResult {
  success: boolean;
  error?: string;
}

export interface ProcessResult {
  linkedTasks: string[];
  errors: string[];
}

interface GitCommitRow {
  id: string;
  task_id: string;
  commit_hash: string;
  message: string;
  author: string;
  branch: string | null;
  timestamp: string;
  created_at: string;
}

/**
 * Git integration for linking commits to tasks
 */
export class GitIntegration {
  constructor(
    private db: Database,
    private taskService: TaskService
  ) {
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS git_commits (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        commit_hash TEXT NOT NULL,
        message TEXT NOT NULL,
        author TEXT NOT NULL,
        branch TEXT,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Parse task references from commit message
   * Supports formats: #task-{id}, task-{id}
   */
  parseTaskReferences(message: string): string[] {
    const pattern = /#?task-([a-zA-Z0-9-]+)/g;
    const matches: string[] = [];
    let match;

    while ((match = pattern.exec(message)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)]; // Dedupe
  }

  /**
   * Parse task ID from branch name
   * Supports formats: feature/task-{id}-*, fix/task-{id}-*, task-{id}-*
   */
  parseBranchTaskId(branch: string): string | null {
    const pattern = /task-([a-zA-Z0-9-]+)/;
    const match = branch.match(pattern);

    if (match) {
      // Extract just the ID part (first segment before any dash)
      const fullMatch = match[1];
      // If the match contains more dashes, take only the first part (UUID format)
      const idPart = fullMatch.split('-').slice(0, 5).join('-');

      // Check if it looks like a UUID (8-4-4-4-12 format) or short ID
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(idPart)) {
        return idPart;
      }
      // Otherwise return the first segment as short ID
      return fullMatch.split('-')[0];
    }

    return null;
  }

  /**
   * Link a commit to a task
   */
  linkCommitToTask(commit: CommitLink): LinkResult {
    // Verify task exists
    const task = this.taskService.getTask(commit.taskId);
    if (!task) {
      return {
        success: false,
        error: `Task not found: ${commit.taskId}`
      };
    }

    try {
      const id = uuidv4();
      const stmt = this.db.prepare(`
        INSERT INTO git_commits (id, task_id, commit_hash, message, author, branch, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        commit.taskId,
        commit.commitHash,
        commit.message,
        commit.author,
        commit.branch ?? null,
        commit.timestamp
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get all commits linked to a task
   */
  getCommitsForTask(taskId: string): GitCommit[] {
    const stmt = this.db.prepare(`
      SELECT * FROM git_commits
      WHERE task_id = ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(taskId) as GitCommitRow[];
    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      commitHash: row.commit_hash,
      message: row.message,
      author: row.author,
      branch: row.branch ?? undefined,
      timestamp: row.timestamp,
      createdAt: row.created_at
    }));
  }

  /**
   * Process a commit and auto-link to tasks based on references
   */
  processCommit(commit: {
    commitHash: string;
    message: string;
    author: string;
    timestamp: string;
    branch?: string;
  }): ProcessResult {
    const linkedTasks: string[] = [];
    const errors: string[] = [];

    // Parse task references from message
    const messageRefs = this.parseTaskReferences(commit.message);

    // Parse task ID from branch name
    const branchTaskId = commit.branch ? this.parseBranchTaskId(commit.branch) : null;

    // Combine all task IDs to link
    const taskIds = [...new Set([...messageRefs, ...(branchTaskId ? [branchTaskId] : [])])];

    for (const taskId of taskIds) {
      const result = this.linkCommitToTask({
        taskId,
        commitHash: commit.commitHash,
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
        branch: commit.branch
      });

      if (result.success) {
        linkedTasks.push(taskId);
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    return { linkedTasks, errors };
  }

  /**
   * Get commit by hash
   */
  getCommitByHash(hash: string): GitCommit | null {
    const stmt = this.db.prepare(`
      SELECT * FROM git_commits WHERE commit_hash = ? LIMIT 1
    `);

    const row = stmt.get(hash) as GitCommitRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      commitHash: row.commit_hash,
      message: row.message,
      author: row.author,
      branch: row.branch ?? undefined,
      timestamp: row.timestamp,
      createdAt: row.created_at
    };
  }
}
