import type { Migration } from './runner.js';
import type { Database } from '../Database.js';

/**
 * Add comments/notes support to tasks
 */
export const taskComments: Migration = {
  version: 5,
  name: 'task-comments',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    // Create index for fast lookup by task
    db.exec('CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)');

    // Create index for chronological ordering
    db.exec('CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at)');
  }
};
