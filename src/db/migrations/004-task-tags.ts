import type { Migration } from './runner.js';
import type { Database } from '../Database.js';

/**
 * Add tags support to tasks
 */
export const taskTags: Migration = {
  version: 4,
  name: 'task-tags',
  up: (db: Database) => {
    // Add tags column to tasks table (JSON array of strings)
    db.exec(`ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]'`);

    // Create index for tag searching
    db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks(tags)');
  }
};
