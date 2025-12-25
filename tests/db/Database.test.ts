import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { dirname } from 'path';

describe('Database', () => {
  let dbPath: string;
  let db: Database;

  beforeEach(() => {
    dbPath = getTestDbPath('database');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    cleanupTestDb(dbPath);
  });

  describe('initialization', () => {
    it('should create a new database file', () => {
      db = new Database(dbPath);
      expect(db).toBeDefined();
      expect(db.isOpen()).toBe(true);
    });

    it('should enable foreign keys', () => {
      db = new Database(dbPath);
      const result = db.pragma('foreign_keys');
      expect(result).toBe(1);
    });
  });

  describe('close', () => {
    it('should close the database connection', () => {
      db = new Database(dbPath);
      expect(db.isOpen()).toBe(true);
      db.close();
      expect(db.isOpen()).toBe(false);
    });

    it('should be safe to close multiple times', () => {
      db = new Database(dbPath);
      db.close();
      expect(() => db.close()).not.toThrow();
    });
  });

  describe('transaction', () => {
    it('should execute a transaction and return result', () => {
      db = new Database(dbPath);
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

      const result = db.transaction(() => {
        db.exec("INSERT INTO test (value) VALUES ('hello')");
        return db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
      });

      expect(result.count).toBe(1);
    });

    it('should rollback on error', () => {
      db = new Database(dbPath);
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

      try {
        db.transaction(() => {
          db.exec("INSERT INTO test (value) VALUES ('hello')");
          throw new Error('Test error');
        });
      } catch {
        // Expected
      }

      const result = db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
      expect(result.count).toBe(0);
    });
  });

  describe('executeWithRetry', () => {
    it('should execute successfully on first try', () => {
      db = new Database(dbPath);
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      const result = db.executeWithRetry(() => {
        db.exec('INSERT INTO test DEFAULT VALUES');
        return true;
      });

      expect(result).toBe(true);
    });
  });

  describe('backup', () => {
    it('should create a backup of the database', async () => {
      db = new Database(dbPath);
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      db.exec("INSERT INTO test (value) VALUES ('backup-test')");

      const backupPath = getTestDbPath('backup');
      await db.backup(backupPath);

      // Verify backup
      const backupDb = new Database(backupPath);
      const result = backupDb.prepare('SELECT value FROM test').get() as { value: string };
      expect(result.value).toBe('backup-test');
      backupDb.close();
      cleanupTestDb(backupPath);
    });
  });

  describe('schema operations', () => {
    it('should check if table exists', () => {
      db = new Database(dbPath);

      expect(db.tableExists('nonexistent')).toBe(false);

      db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
      expect(db.tableExists('test_table')).toBe(true);
    });

    it('should get table info', () => {
      db = new Database(dbPath);
      db.exec('CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER)');

      const info = db.getTableInfo('test_table');
      expect(info).toHaveLength(3);
      expect(info.map(c => c.name)).toEqual(['id', 'name', 'age']);
    });
  });

  describe('WAL file cleanup', () => {
    it('should remove WAL files on initialization', () => {
      // Create a database first
      db = new Database(dbPath);
      db.exec('CREATE TABLE test (id INTEGER)');
      db.close();

      // Simulate leftover WAL/SHM files from better-sqlite3
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      writeFileSync(walPath, 'fake wal data');
      writeFileSync(shmPath, 'fake shm data');

      expect(existsSync(walPath)).toBe(true);
      expect(existsSync(shmPath)).toBe(true);

      // Reopen database - should clean up WAL files
      db = new Database(dbPath);

      expect(existsSync(walPath)).toBe(false);
      expect(existsSync(shmPath)).toBe(false);
      expect(db.isOpen()).toBe(true);
    });
  });

  describe('corruption handling', () => {
    it('should handle corrupted database by creating fresh one', () => {
      // Write garbage to database file
      writeFileSync(dbPath, 'this is not a valid sqlite database');

      // Should not throw - should recover gracefully
      expect(() => {
        db = new Database(dbPath);
      }).not.toThrow();

      expect(db.isOpen()).toBe(true);

      // Should be a fresh working database
      db.exec('CREATE TABLE test (id INTEGER)');
      expect(db.tableExists('test')).toBe(true);
    });

    it('should backup corrupted database before replacing', () => {
      // Write garbage to database file
      writeFileSync(dbPath, 'corrupted data here');

      db = new Database(dbPath);

      // Check for backup file
      const dir = dirname(dbPath);
      const files = readdirSync(dir);
      const backupFile = files.find(f => f.includes('.corrupt.'));

      expect(backupFile).toBeDefined();

      // Cleanup backup
      if (backupFile) {
        unlinkSync(`${dir}/${backupFile}`);
      }
    });
  });
});
