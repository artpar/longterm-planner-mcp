import type { Migration } from './runner.js';
import type { Database } from '../Database.js';

/**
 * Git integration schema - links commits to tasks
 */
export const gitIntegration: Migration = {
  version: 2,
  name: 'git-integration',
  up: (db: Database) => {
    // Git commits table
    db.exec(`
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

    db.exec('CREATE INDEX IF NOT EXISTS idx_git_commits_task ON git_commits(task_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_git_commits_hash ON git_commits(commit_hash)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_git_commits_timestamp ON git_commits(timestamp DESC)');
  }
};
