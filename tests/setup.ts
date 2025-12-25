import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test database directory
export const TEST_DB_DIR = join(tmpdir(), 'longterm-planner-mcp-tests');

/**
 * Get a unique test database path
 */
export function getTestDbPath(testName: string): string {
  return join(TEST_DB_DIR, `${testName}-${Date.now()}.db`);
}

/**
 * Clean up test database files
 */
export function cleanupTestDb(dbPath: string): void {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const file of files) {
    if (existsSync(file)) {
      try {
        rmSync(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Global setup
beforeAll(() => {
  if (!existsSync(TEST_DB_DIR)) {
    mkdirSync(TEST_DB_DIR, { recursive: true });
  }
});

// Global teardown
afterAll(() => {
  if (existsSync(TEST_DB_DIR)) {
    try {
      rmSync(TEST_DB_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});
