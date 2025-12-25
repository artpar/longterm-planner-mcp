import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupManager } from '../../src/backup/BackupManager.js';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { existsSync, unlinkSync, readdirSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BackupManager', () => {
  let dbPath: string;
  let db: Database;
  let backupManager: BackupManager;
  let planRepo: PlanRepository;
  let taskService: TaskService;
  let backupDir: string;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('backup-manager');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);

    // Create unique backup directory for test
    backupDir = join(tmpdir(), `backup-test-${Date.now()}`);
    mkdirSync(backupDir, { recursive: true });

    backupManager = new BackupManager(dbPath, backupDir);

    // Create test data
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Backup Test Plan'
    });
    testPlanId = plan.id;
    taskService.createTask({ planId: testPlanId, title: 'Task 1' });
    taskService.createTask({ planId: testPlanId, title: 'Task 2' });

    // Flush to ensure data is written to disk before backup tests
    db.flush();
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);

    // Clean up backup directory
    if (existsSync(backupDir)) {
      const files = readdirSync(backupDir);
      for (const file of files) {
        unlinkSync(join(backupDir, file));
      }
      rmdirSync(backupDir);
    }
  });

  describe('createBackup', () => {
    it('should create a backup file', () => {
      const result = backupManager.createBackup();

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
    });

    it('should include timestamp in backup name', () => {
      const result = backupManager.createBackup();

      expect(result.backupPath).toMatch(/backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should allow custom description', () => {
      const result = backupManager.createBackup('before-major-refactor');

      expect(result.backupPath).toContain('before-major-refactor');
    });
  });

  describe('listBackups', () => {
    it('should list all backups', () => {
      backupManager.createBackup('first');
      backupManager.createBackup('second');

      const backups = backupManager.listBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    it('should return backups sorted by date (newest first)', async () => {
      backupManager.createBackup('older');
      // Delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));
      backupManager.createBackup('newer');

      const backups = backupManager.listBackups();

      expect(backups[0].description).toBe('newer');
    });

    it('should return empty array when no backups', () => {
      const backups = backupManager.listBackups();
      expect(backups).toEqual([]);
    });
  });

  describe('restoreBackup', () => {
    it('should restore from backup', () => {
      // Create backup
      const backup = backupManager.createBackup('pre-change');

      // Delete the plan (simulating data loss)
      planRepo.delete(testPlanId);
      expect(planRepo.findById(testPlanId)).toBeNull();

      // Close current db connection before restore
      db.close();

      // Restore
      const result = backupManager.restoreBackup(backup.backupPath!);
      expect(result.success).toBe(true);

      // Verify restoration
      const restoredDb = new Database(dbPath);
      const restoredPlanRepo = new PlanRepository(restoredDb);
      const restoredPlan = restoredPlanRepo.findById(testPlanId);
      expect(restoredPlan).not.toBeNull();
      expect(restoredPlan!.name).toBe('Backup Test Plan');

      restoredDb.close();
    });

    it('should fail for non-existent backup', () => {
      const result = backupManager.restoreBackup('/non/existent/backup.db');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup file', () => {
      const backup = backupManager.createBackup('to-delete');
      expect(existsSync(backup.backupPath!)).toBe(true);

      const result = backupManager.deleteBackup(backup.backupPath!);
      expect(result.success).toBe(true);
      expect(existsSync(backup.backupPath!)).toBe(false);
    });

    it('should fail for non-existent backup', () => {
      const result = backupManager.deleteBackup('/non/existent.db');
      expect(result.success).toBe(false);
    });
  });

  describe('autoBackup', () => {
    it('should create automatic backup with rotation', () => {
      // Create more than max backups
      for (let i = 0; i < 5; i++) {
        backupManager.createBackup(`auto-${i}`);
      }

      // Perform auto-backup with max 3
      const result = backupManager.autoBackup(3);

      expect(result.success).toBe(true);

      // Should have at most 3 backups after rotation
      const backups = backupManager.listBackups();
      expect(backups.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getBackupInfo', () => {
    it('should return backup metadata', () => {
      const backup = backupManager.createBackup('info-test');

      const info = backupManager.getBackupInfo(backup.backupPath!);

      expect(info).not.toBeNull();
      expect(info!.path).toBe(backup.backupPath);
      expect(info!.size).toBeGreaterThan(0);
      expect(info!.createdAt).toBeDefined();
    });

    it('should return null for non-existent backup', () => {
      const info = backupManager.getBackupInfo('/non/existent.db');
      expect(info).toBeNull();
    });
  });
});
