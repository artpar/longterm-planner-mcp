import type { Migration } from './runner.js';
import type { Database } from '../Database.js';

/**
 * Initial database schema with all core tables
 */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  up: (db: Database) => {
    // Plans table
    db.exec(`
      CREATE TABLE plans (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'completed', 'archived')),
        start_date TEXT,
        target_date TEXT,
        context TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_plans_project_path ON plans(project_path)');
    db.exec('CREATE INDEX idx_plans_status ON plans(status)');

    // Goals table
    db.exec(`
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        parent_goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        status TEXT NOT NULL DEFAULT 'not_started'
          CHECK (status IN ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled')),
        target_date TEXT,
        progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
        key_results TEXT DEFAULT '[]',
        sequence_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_goals_plan ON goals(plan_id)');
    db.exec('CREATE INDEX idx_goals_status ON goals(status)');

    // Objectives table
    db.exec(`
      CREATE TABLE objectives (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
        sequence_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_objectives_goal ON objectives(goal_id)');

    // Milestones table
    db.exec(`
      CREATE TABLE milestones (
        id TEXT PRIMARY KEY,
        objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'in_progress', 'completed', 'missed', 'cancelled')),
        due_date TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_milestones_objective ON milestones(objective_id)');
    db.exec('CREATE INDEX idx_milestones_status ON milestones(status)');

    // Tasks table (self-referential for subtasks)
    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
        parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'backlog'
          CHECK (status IN ('backlog', 'ready', 'in_progress', 'review', 'blocked', 'completed', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        estimated_hours REAL,
        actual_hours REAL,
        assignee TEXT,
        due_date TEXT,
        started_at TEXT,
        completed_at TEXT,
        context TEXT DEFAULT '{}',
        sequence_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_tasks_plan ON tasks(plan_id)');
    db.exec('CREATE INDEX idx_tasks_goal ON tasks(goal_id)');
    db.exec('CREATE INDEX idx_tasks_milestone ON tasks(milestone_id)');
    db.exec('CREATE INDEX idx_tasks_parent ON tasks(parent_task_id)');
    db.exec('CREATE INDEX idx_tasks_status ON tasks(status)');
    db.exec('CREATE INDEX idx_tasks_priority ON tasks(priority)');

    // Dependencies table (polymorphic)
    db.exec(`
      CREATE TABLE dependencies (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL
          CHECK (source_type IN ('goal', 'objective', 'milestone', 'task')),
        source_id TEXT NOT NULL,
        target_type TEXT NOT NULL
          CHECK (target_type IN ('goal', 'objective', 'milestone', 'task')),
        target_id TEXT NOT NULL,
        dependency_type TEXT NOT NULL DEFAULT 'blocks'
          CHECK (dependency_type IN ('blocks', 'required_by', 'related_to')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source_type, source_id, target_type, target_id)
      )
    `);

    db.exec('CREATE INDEX idx_deps_source ON dependencies(source_type, source_id)');
    db.exec('CREATE INDEX idx_deps_target ON dependencies(target_type, target_id)');

    // Blockers table
    db.exec(`
      CREATE TABLE blockers (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        severity TEXT NOT NULL DEFAULT 'major'
          CHECK (severity IN ('critical', 'major', 'minor')),
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'investigating', 'resolved', 'wont_fix')),
        resolution TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT
      )
    `);

    db.exec('CREATE INDEX idx_blockers_entity ON blockers(entity_type, entity_id)');
    db.exec('CREATE INDEX idx_blockers_status ON blockers(status)');

    // Decisions table
    db.exec(`
      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        options TEXT DEFAULT '[]',
        outcome TEXT,
        rationale TEXT,
        decided_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_decisions_entity ON decisions(entity_type, entity_id)');

    // Progress logs table
    db.exec(`
      CREATE TABLE progress_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        session_id TEXT,
        action TEXT NOT NULL,
        message TEXT NOT NULL,
        progress_delta INTEGER,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec('CREATE INDEX idx_progress_entity ON progress_logs(entity_type, entity_id)');
    db.exec('CREATE INDEX idx_progress_session ON progress_logs(session_id)');
    db.exec('CREATE INDEX idx_progress_created ON progress_logs(created_at DESC)');

    // Sessions table
    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        plan_id TEXT REFERENCES plans(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        context_summary TEXT DEFAULT '',
        continuation_hints TEXT DEFAULT '[]',
        active_task_id TEXT,
        environment_snapshot TEXT DEFAULT '{}'
      )
    `);

    db.exec('CREATE INDEX idx_sessions_plan ON sessions(plan_id)');
    db.exec('CREATE INDEX idx_sessions_started ON sessions(started_at DESC)');

    // Change log for undo/redo
    db.exec(`
      CREATE TABLE change_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        old_value TEXT,
        new_value TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        undone INTEGER DEFAULT 0
      )
    `);

    db.exec('CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id)');
    db.exec('CREATE INDEX idx_change_log_session ON change_log(session_id)');
    db.exec('CREATE INDEX idx_change_log_created ON change_log(created_at DESC)');
  }
};
