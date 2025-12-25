import { Database } from '../Database.js';

/**
 * Migration definition
 */
export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

/**
 * Migration record stored in database
 */
interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

/**
 * Runs database migrations
 */
export class MigrationRunner {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Initialize the migrations table
   */
  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Get the current migration version
   */
  getMigrationVersion(): number {
    const result = this.db
      .prepare('SELECT MAX(version) as version FROM migrations')
      .get() as { version: number | null };
    return result.version ?? 0;
  }

  /**
   * Check if a migration has been applied
   */
  isMigrationApplied(version: number): boolean {
    const result = this.db
      .prepare('SELECT 1 FROM migrations WHERE version = ?')
      .get(version);
    return result !== undefined;
  }

  /**
   * Run a single migration if not already applied
   */
  runMigration(migration: Migration): boolean {
    if (this.isMigrationApplied(migration.version)) {
      return false;
    }

    this.db.transaction(() => {
      // Run the migration
      migration.up(this.db);

      // Record the migration
      this.db
        .prepare('INSERT INTO migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name);
    });

    return true;
  }

  /**
   * Run all pending migrations in order
   */
  runAll(migrations: Migration[]): number {
    // Sort by version
    const sorted = [...migrations].sort((a, b) => a.version - b.version);

    let count = 0;
    for (const migration of sorted) {
      if (this.runMigration(migration)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations(): MigrationRecord[] {
    return this.db
      .prepare('SELECT version, name, applied_at FROM migrations ORDER BY version')
      .all() as MigrationRecord[];
  }
}
