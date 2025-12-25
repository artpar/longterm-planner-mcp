import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqliteDatabase, Statement, Options } from 'better-sqlite3';

export interface TableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Database wrapper with WAL mode, transactions, and retry logic
 */
export class Database {
  private db: BetterSqliteDatabase | null;
  private readonly dbPath: string;

  constructor(dbPath: string, options?: Options) {
    this.dbPath = dbPath;
    this.db = new BetterSqlite3(dbPath, options);

    // Enable WAL mode for concurrent access
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Set busy timeout to 5 seconds
    this.db.pragma('busy_timeout = 5000');
  }

  /**
   * Check if database connection is open
   */
  isOpen(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
    this.db = null;
  }

  /**
   * Get pragma value
   */
  pragma(name: string): unknown {
    this.ensureOpen();
    const result = this.db!.pragma(name);
    if (Array.isArray(result) && result.length > 0) {
      const firstResult = result[0];
      if (typeof firstResult === 'object' && firstResult !== null) {
        return Object.values(firstResult)[0];
      }
      return firstResult;
    }
    return result;
  }

  /**
   * Execute raw SQL
   */
  exec(sql: string): void {
    this.ensureOpen();
    this.db!.exec(sql);
  }

  /**
   * Prepare a statement
   */
  prepare(sql: string): Statement {
    this.ensureOpen();
    return this.db!.prepare(sql);
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    this.ensureOpen();
    const transaction = this.db!.transaction(fn);
    return transaction();
  }

  /**
   * Execute with retry logic for SQLITE_BUSY errors
   */
  executeWithRetry<T>(fn: () => T, maxRetries = 3): T {
    this.ensureOpen();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return this.transaction(fn);
      } catch (err) {
        const error = err as { code?: string };
        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 100;
          const start = Date.now();
          while (Date.now() - start < delay) {
            // Busy wait
          }
          continue;
        }
        throw err;
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Create a backup of the database
   */
  async backup(destinationPath: string): Promise<void> {
    this.ensureOpen();
    await this.db!.backup(destinationPath);
  }

  /**
   * Check if a table exists
   */
  tableExists(tableName: string): boolean {
    this.ensureOpen();
    const result = this.db!
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);
    return result !== undefined;
  }

  /**
   * Get table column information
   */
  getTableInfo(tableName: string): TableColumn[] {
    this.ensureOpen();
    return this.db!.pragma(`table_info(${tableName})`) as TableColumn[];
  }

  /**
   * Get the underlying database path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Get the raw better-sqlite3 database instance
   * Use with caution - prefer using the wrapper methods
   */
  getRaw(): BetterSqliteDatabase {
    this.ensureOpen();
    return this.db!;
  }

  private ensureOpen(): void {
    if (!this.db || !this.db.open) {
      throw new Error('Database is not open');
    }
  }
}
