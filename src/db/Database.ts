import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

export interface TableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// Statement wrapper to match better-sqlite3 API
export interface Statement<T = unknown> {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
}

// Initialize sql.js at module load time using top-level await
const SQL = await initSqlJs();

/**
 * Database wrapper with file persistence and transaction support
 * Uses sql.js (pure JS/WASM) for universal compatibility
 */
export class Database {
  private db: SqlJsDatabase | null;
  private readonly dbPath: string;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed: boolean = false;

  constructor(dbPath: string, _options?: unknown) {
    this.dbPath = dbPath;

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Clean up WAL/SHM files from previous better-sqlite3 usage
    // sql.js doesn't support WAL mode and these files cause corruption
    this.cleanupWalFiles();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      try {
        const buffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(buffer);
        // Verify database is readable
        this.db.exec('SELECT 1');
      } catch (err) {
        // Database is corrupted - backup and create fresh
        const backupPath = `${dbPath}.corrupt.${Date.now()}`;
        try {
          fs.renameSync(dbPath, backupPath);
          console.error(`Database corrupted, backed up to: ${backupPath}`);
        } catch {
          // If rename fails, just delete
          fs.unlinkSync(dbPath);
          console.error('Database corrupted and removed, starting fresh');
        }
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    // Save initial database to disk
    this.saveNow();

    // Enable foreign keys AFTER initial save (db.export() resets PRAGMA settings)
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  /**
   * Clean up WAL and SHM files that may have been left by better-sqlite3
   * These files are incompatible with sql.js and can cause corruption errors
   */
  private cleanupWalFiles(): void {
    const walPath = `${this.dbPath}-wal`;
    const shmPath = `${this.dbPath}-shm`;

    if (fs.existsSync(walPath)) {
      try {
        fs.unlinkSync(walPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (fs.existsSync(shmPath)) {
      try {
        fs.unlinkSync(shmPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Save database to disk (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, 100); // Debounce saves by 100ms
  }

  /**
   * Save database to disk immediately
   */
  private saveNow(): void {
    if (!this.db || this.closed) return;

    const data = this.db.export();
    const buffer = Buffer.from(data);

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.dbPath, buffer);

    // Re-enable foreign keys (db.export() resets PRAGMA settings in sql.js)
    if (this.db && !this.closed) {
      this.db.exec('PRAGMA foreign_keys = ON');
    }
  }

  /**
   * Check if database connection is open
   */
  isOpen(): boolean {
    return this.db !== null && !this.closed;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.closed) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveNow(); // Final save before close
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.closed = true;
  }

  private ensureOpen(): SqlJsDatabase {
    if (!this.db || this.closed) {
      throw new Error('Database is not open');
    }
    return this.db;
  }

  /**
   * Get pragma value
   */
  pragma(name: string): unknown {
    const db = this.ensureOpen();
    const result = db.exec(`PRAGMA ${name}`);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    return undefined;
  }

  /**
   * Execute raw SQL (multiple statements)
   */
  exec(sql: string): void {
    const db = this.ensureOpen();
    db.run(sql);
    this.scheduleSave();
  }

  /**
   * Prepare a statement - returns a wrapper matching better-sqlite3 API
   */
  prepare<T = unknown>(sql: string): Statement<T> {
    const db = this.ensureOpen();
    const self = this;

    return {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
        db.run(sql, params as (string | number | null | Uint8Array)[]);
        self.scheduleSave();

        // Get changes and last insert rowid
        const changesResult = db.exec('SELECT changes()');
        const lastIdResult = db.exec('SELECT last_insert_rowid()');

        const changes = changesResult.length > 0 ? Number(changesResult[0].values[0][0]) : 0;
        const lastInsertRowid = lastIdResult.length > 0 ? Number(lastIdResult[0].values[0][0]) : 0;

        return { changes, lastInsertRowid };
      },

      get(...params: unknown[]): T | undefined {
        const stmt = db.prepare(sql);
        stmt.bind(params as (string | number | null | Uint8Array)[]);

        if (stmt.step()) {
          const columns = stmt.getColumnNames();
          const values = stmt.get();
          stmt.free();

          if (values) {
            const row: Record<string, unknown> = {};
            columns.forEach((col: string, i: number) => {
              row[col] = values[i];
            });
            return row as T;
          }
        }
        stmt.free();
        return undefined;
      },

      all(...params: unknown[]): T[] {
        const stmt = db.prepare(sql);
        stmt.bind(params as (string | number | null | Uint8Array)[]);

        const results: T[] = [];
        const columns = stmt.getColumnNames();

        while (stmt.step()) {
          const values = stmt.get();
          if (values) {
            const row: Record<string, unknown> = {};
            columns.forEach((col: string, i: number) => {
              row[col] = values[i];
            });
            results.push(row as T);
          }
        }
        stmt.free();
        return results;
      }
    };
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    const db = this.ensureOpen();
    db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      db.run('COMMIT');
      this.scheduleSave();
      return result;
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  }

  /**
   * Execute with retry logic (simplified - sql.js doesn't have SQLITE_BUSY)
   */
  executeWithRetry<T>(fn: () => T, _maxRetries = 3): T {
    // sql.js runs in-memory, no concurrent access issues
    return this.transaction(fn);
  }

  /**
   * Create a backup of the database
   */
  async backup(destinationPath: string): Promise<void> {
    const db = this.ensureOpen();
    const data = db.export();
    const buffer = Buffer.from(data);

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destinationPath, buffer);
  }

  /**
   * Check if a table exists
   */
  tableExists(tableName: string): boolean {
    const result = this.prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);
    return result !== undefined;
  }

  /**
   * Get table column information
   */
  getTableInfo(tableName: string): TableColumn[] {
    const db = this.ensureOpen();
    const result = db.exec(`PRAGMA table_info(${tableName})`);

    if (result.length === 0) return [];

    return result[0].values.map((row: (string | number | null | Uint8Array)[]) => ({
      cid: Number(row[0]),
      name: String(row[1]),
      type: String(row[2]),
      notnull: Number(row[3]),
      dflt_value: row[4] !== null ? String(row[4]) : null,
      pk: Number(row[5])
    }));
  }

  /**
   * Get the underlying database path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Get the raw sql.js database instance
   * Use with caution - prefer using the wrapper methods
   */
  getRaw(): SqlJsDatabase {
    return this.ensureOpen();
  }

  /**
   * Force save to disk immediately (flush pending changes)
   */
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveNow();
  }
}
