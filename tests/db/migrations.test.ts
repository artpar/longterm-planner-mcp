import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';

describe('MigrationRunner', () => {
  let dbPath: string;
  let db: Database;
  let runner: MigrationRunner;

  beforeEach(() => {
    dbPath = getTestDbPath('migrations');
    db = new Database(dbPath);
    runner = new MigrationRunner(db);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('initialization', () => {
    it('should create migrations table if not exists', () => {
      runner.initialize();
      expect(db.tableExists('migrations')).toBe(true);
    });

    it('should be idempotent', () => {
      runner.initialize();
      runner.initialize();
      expect(db.tableExists('migrations')).toBe(true);
    });
  });

  describe('runMigration', () => {
    it('should run a migration and record it', () => {
      runner.initialize();

      const migration = {
        version: 1,
        name: 'test-migration',
        up: (database: Database) => {
          database.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
        }
      };

      runner.runMigration(migration);

      expect(db.tableExists('test_table')).toBe(true);
      expect(runner.getMigrationVersion()).toBe(1);
    });

    it('should not run same migration twice', () => {
      runner.initialize();

      let runCount = 0;
      const migration = {
        version: 1,
        name: 'test-migration',
        up: (database: Database) => {
          runCount++;
          database.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
        }
      };

      runner.runMigration(migration);
      runner.runMigration(migration);

      expect(runCount).toBe(1);
    });
  });

  describe('runAll', () => {
    it('should run all pending migrations in order', () => {
      runner.initialize();

      const migrations = [
        {
          version: 1,
          name: 'first',
          up: (database: Database) => {
            database.exec('CREATE TABLE first (id INTEGER PRIMARY KEY)');
          }
        },
        {
          version: 2,
          name: 'second',
          up: (database: Database) => {
            database.exec('CREATE TABLE second (id INTEGER PRIMARY KEY)');
          }
        }
      ];

      runner.runAll(migrations);

      expect(db.tableExists('first')).toBe(true);
      expect(db.tableExists('second')).toBe(true);
      expect(runner.getMigrationVersion()).toBe(2);
    });
  });

  describe('getMigrationVersion', () => {
    it('should return 0 when no migrations run', () => {
      runner.initialize();
      expect(runner.getMigrationVersion()).toBe(0);
    });
  });
});

describe('Initial Schema Migration', () => {
  let dbPath: string;
  let db: Database;
  let runner: MigrationRunner;

  beforeEach(() => {
    dbPath = getTestDbPath('schema');
    db = new Database(dbPath);
    runner = new MigrationRunner(db);
    runner.initialize();
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  it('should create all required tables', () => {
    runner.runMigration(initialSchema);

    // Check all tables exist
    expect(db.tableExists('plans')).toBe(true);
    expect(db.tableExists('goals')).toBe(true);
    expect(db.tableExists('objectives')).toBe(true);
    expect(db.tableExists('milestones')).toBe(true);
    expect(db.tableExists('tasks')).toBe(true);
    expect(db.tableExists('dependencies')).toBe(true);
    expect(db.tableExists('blockers')).toBe(true);
    expect(db.tableExists('decisions')).toBe(true);
    expect(db.tableExists('progress_logs')).toBe(true);
    expect(db.tableExists('sessions')).toBe(true);
    expect(db.tableExists('change_log')).toBe(true);
  });

  it('should have correct columns in plans table', () => {
    runner.runMigration(initialSchema);

    const columns = db.getTableInfo('plans');
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('project_path');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('context');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('should have correct columns in tasks table', () => {
    runner.runMigration(initialSchema);

    const columns = db.getTableInfo('tasks');
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('plan_id');
    expect(columnNames).toContain('parent_task_id');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('priority');
    expect(columnNames).toContain('estimated_hours');
    expect(columnNames).toContain('actual_hours');
  });

  it('should enforce foreign key constraints', () => {
    runner.runMigration(initialSchema);

    // Try to insert a task with non-existent plan_id
    expect(() => {
      db.exec(`INSERT INTO tasks (id, plan_id, title, status, priority, sequence_order, created_at, updated_at)
               VALUES ('task-1', 'nonexistent-plan', 'Test', 'backlog', 'medium', 0, datetime('now'), datetime('now'))`);
    }).toThrow();
  });
});
