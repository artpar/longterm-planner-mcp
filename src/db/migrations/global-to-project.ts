import { Database } from '../Database.js';
import { MigrationRunner } from './runner.js';
import { initialSchema } from './001-initial-schema.js';
import { taskTags } from './004-task-tags.js';
import { taskComments } from './005-task-comments.js';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, renameSync, mkdirSync } from 'fs';

interface Plan {
  id: string;
  project_path: string;
}

/**
 * Tables to migrate in order (respecting foreign key constraints)
 */
const TABLES_TO_MIGRATE = [
  'plans',
  'goals',
  'objectives',
  'milestones',
  'tasks',
  'task_tags',
  'dependencies',
  'blockers',
  'decisions',
  'progress_logs',
  'sessions',
  'change_log',
  'comments'
];

/**
 * Migrate data from global database to per-project databases
 *
 * This handles the transition from storing all plans in ~/.claude/planning/plans.db
 * to storing each project's plans in {project}/.claude/planning/plans.db
 */
export function migrateGlobalToProjectDatabases(): void {
  const globalDbPath = join(homedir(), '.claude', 'planning', 'plans.db');

  // Check if global database exists
  if (!existsSync(globalDbPath)) {
    return; // Nothing to migrate
  }

  // Check if already migrated (marked with .migrated suffix)
  const migratedMarker = `${globalDbPath}.migrated`;
  if (existsSync(migratedMarker)) {
    return; // Already migrated
  }

  console.error('Migrating global database to per-project databases...');

  let globalDb: Database | null = null;

  try {
    // Open global database
    globalDb = new Database(globalDbPath);

    // Check if plans table exists
    if (!globalDb.tableExists('plans')) {
      console.error('Global database has no plans table, skipping migration');
      globalDb.close();
      return;
    }

    // Get all unique project paths
    const plans = globalDb.prepare<Plan>('SELECT DISTINCT project_path FROM plans').all();

    if (plans.length === 0) {
      console.error('No plans found in global database');
      globalDb.close();
      // Mark as migrated even if empty
      renameSync(globalDbPath, migratedMarker);
      return;
    }

    console.error(`Found ${plans.length} project(s) to migrate`);

    // Migrate each project
    for (const { project_path } of plans) {
      if (!project_path) continue;

      try {
        migrateProject(globalDb, project_path);
        console.error(`  Migrated: ${project_path}`);
      } catch (err) {
        console.error(`  Failed to migrate ${project_path}: ${err}`);
      }
    }

    // Close global database before renaming
    globalDb.close();
    globalDb = null;

    // Mark global database as migrated
    renameSync(globalDbPath, migratedMarker);
    console.error('Migration complete. Global database archived as .migrated');

  } catch (err) {
    console.error(`Migration failed: ${err}`);
    if (globalDb) {
      globalDb.close();
    }
  }
}

/**
 * Migrate a single project's data from global database to project database
 */
function migrateProject(globalDb: Database, projectPath: string): void {
  // Create project database path
  const projectDbDir = join(projectPath, '.claude', 'planning');
  const projectDbPath = join(projectDbDir, 'plans.db');

  // Ensure directory exists
  if (!existsSync(projectDbDir)) {
    mkdirSync(projectDbDir, { recursive: true });
  }

  // Check if project database already exists with data
  if (existsSync(projectDbPath)) {
    const existingDb = new Database(projectDbPath);
    if (existingDb.tableExists('plans')) {
      const count = existingDb.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM plans').get();
      if (count && count.cnt > 0) {
        console.error(`  Skipping ${projectPath}: database already has ${count.cnt} plans`);
        existingDb.close();
        return;
      }
    }
    existingDb.close();
  }

  // Create and initialize project database
  const projectDb = new Database(projectDbPath);
  const runner = new MigrationRunner(projectDb);
  runner.initialize();
  runner.runMigration(initialSchema);
  runner.runMigration(taskTags);
  runner.runMigration(taskComments);

  // Get plan IDs for this project
  const planIds = globalDb.prepare<{ id: string }>(
    'SELECT id FROM plans WHERE project_path = ?'
  ).all(projectPath).map(p => p.id);

  if (planIds.length === 0) {
    projectDb.close();
    return;
  }

  // Migrate tables in order
  for (const table of TABLES_TO_MIGRATE) {
    try {
      migrateTable(globalDb, projectDb, table, planIds, projectPath);
    } catch (err) {
      // Table might not exist in older databases
      console.error(`    Warning: Could not migrate table ${table}: ${err}`);
    }
  }

  projectDb.flush();
  projectDb.close();
}

/**
 * Migrate a single table's data for a project
 */
function migrateTable(
  globalDb: Database,
  projectDb: Database,
  table: string,
  planIds: string[],
  projectPath: string
): void {
  if (!globalDb.tableExists(table)) {
    return;
  }

  // Get columns for this table
  const columns = globalDb.getTableInfo(table);
  if (columns.length === 0) return;

  const columnNames = columns.map(c => c.name);
  const placeholders = columnNames.map(() => '?').join(', ');
  const insertSql = `INSERT OR IGNORE INTO ${table} (${columnNames.join(', ')}) VALUES (${placeholders})`;

  // Build query based on table type
  let rows: Record<string, unknown>[];

  if (table === 'plans') {
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT * FROM plans WHERE project_path = ?`
    ).all(projectPath);
  } else if (table === 'tasks' || table === 'sessions') {
    // Tables with direct plan_id reference
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE plan_id IN (${planIdPlaceholders})`
    ).all(...planIds);
  } else if (table === 'goals') {
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT * FROM goals WHERE plan_id IN (${planIdPlaceholders})`
    ).all(...planIds);
  } else if (table === 'objectives') {
    // Get objectives via goals
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT o.* FROM objectives o
       JOIN goals g ON o.goal_id = g.id
       WHERE g.plan_id IN (${planIdPlaceholders})`
    ).all(...planIds);
  } else if (table === 'milestones') {
    // Get milestones via objectives -> goals
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT m.* FROM milestones m
       JOIN objectives o ON m.objective_id = o.id
       JOIN goals g ON o.goal_id = g.id
       WHERE g.plan_id IN (${planIdPlaceholders})`
    ).all(...planIds);
  } else if (table === 'task_tags' || table === 'comments') {
    // Get via tasks
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT tt.* FROM ${table} tt
       JOIN tasks t ON tt.task_id = t.id
       WHERE t.plan_id IN (${planIdPlaceholders})`
    ).all(...planIds);
  } else if (table === 'dependencies') {
    // Get dependencies where source or target is a task in our plans
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT DISTINCT d.* FROM dependencies d
       LEFT JOIN tasks t1 ON d.source_id = t1.id AND d.source_type = 'task'
       LEFT JOIN tasks t2 ON d.target_id = t2.id AND d.target_type = 'task'
       WHERE t1.plan_id IN (${planIdPlaceholders})
          OR t2.plan_id IN (${planIdPlaceholders})`
    ).all(...planIds, ...planIds);
  } else if (['blockers', 'decisions', 'progress_logs', 'change_log'].includes(table)) {
    // These tables have entity_type/entity_id - get entries related to our plans/tasks
    const planIdPlaceholders = planIds.map(() => '?').join(', ');
    rows = globalDb.prepare<Record<string, unknown>>(
      `SELECT DISTINCT e.* FROM ${table} e
       LEFT JOIN plans p ON e.entity_id = p.id AND e.entity_type = 'plan'
       LEFT JOIN tasks t ON e.entity_id = t.id AND e.entity_type = 'task'
       WHERE p.project_path = ?
          OR t.plan_id IN (${planIdPlaceholders})`
    ).all(projectPath, ...planIds);
  } else {
    return;
  }

  // Insert rows into project database
  const insertStmt = projectDb.prepare(insertSql);
  for (const row of rows) {
    const values = columnNames.map(col => row[col]);
    try {
      insertStmt.run(...values);
    } catch {
      // Ignore duplicate/constraint errors
    }
  }
}
