import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../../setup.js';
import { Database } from '../../../src/db/Database.js';
import { MigrationRunner } from '../../../src/db/migrations/runner.js';
import { initialSchema } from '../../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../../src/db/repositories/PlanRepository.js';
import { PlanStatus } from '../../../src/models/enums.js';

describe('PlanRepository', () => {
  let dbPath: string;
  let db: Database;
  let repo: PlanRepository;

  beforeEach(() => {
    dbPath = getTestDbPath('plan-repo');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);
    repo = new PlanRepository(db);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('create', () => {
    it('should create a new plan with required fields', () => {
      const plan = repo.create({
        projectPath: '/test/project',
        name: 'Test Plan'
      });

      expect(plan.id).toBeDefined();
      expect(plan.projectPath).toBe('/test/project');
      expect(plan.name).toBe('Test Plan');
      expect(plan.status).toBe(PlanStatus.DRAFT);
      expect(plan.createdAt).toBeDefined();
      expect(plan.updatedAt).toBeDefined();
    });

    it('should create a plan with optional fields', () => {
      const plan = repo.create({
        projectPath: '/test/project',
        name: 'Test Plan',
        description: 'A test description',
        startDate: '2025-01-01',
        targetDate: '2025-03-31'
      });

      expect(plan.description).toBe('A test description');
      expect(plan.startDate).toBe('2025-01-01');
      expect(plan.targetDate).toBe('2025-03-31');
    });

    it('should initialize empty context', () => {
      const plan = repo.create({
        projectPath: '/test/project',
        name: 'Test Plan'
      });

      expect(plan.context).toBeDefined();
      expect(plan.context.summary).toBe('');
      expect(plan.context.keyDecisions).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find an existing plan by id', () => {
      const created = repo.create({
        projectPath: '/test/project',
        name: 'Test Plan'
      });

      const found = repo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Test Plan');
    });

    it('should return null for non-existent id', () => {
      const found = repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByProjectPath', () => {
    it('should find plans by project path', () => {
      repo.create({ projectPath: '/project/a', name: 'Plan A' });
      repo.create({ projectPath: '/project/a', name: 'Plan A2' });
      repo.create({ projectPath: '/project/b', name: 'Plan B' });

      const plans = repo.findByProjectPath('/project/a');

      expect(plans).toHaveLength(2);
      expect(plans.every(p => p.projectPath === '/project/a')).toBe(true);
    });

    it('should return empty array for non-existent path', () => {
      const plans = repo.findByProjectPath('/non/existent');
      expect(plans).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all plans', () => {
      repo.create({ projectPath: '/a', name: 'Plan A' });
      repo.create({ projectPath: '/b', name: 'Plan B' });

      const plans = repo.findAll();

      expect(plans).toHaveLength(2);
    });

    it('should filter by status', () => {
      const plan1 = repo.create({ projectPath: '/a', name: 'Plan A' });
      repo.create({ projectPath: '/b', name: 'Plan B' });
      repo.update(plan1.id, { status: PlanStatus.ACTIVE });

      const activePlans = repo.findAll({ status: PlanStatus.ACTIVE });

      expect(activePlans).toHaveLength(1);
      expect(activePlans[0].name).toBe('Plan A');
    });
  });

  describe('update', () => {
    it('should update plan fields', () => {
      const plan = repo.create({ projectPath: '/a', name: 'Original' });

      const updated = repo.update(plan.id, {
        name: 'Updated',
        description: 'New description',
        status: PlanStatus.ACTIVE
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated');
      expect(updated!.description).toBe('New description');
      expect(updated!.status).toBe(PlanStatus.ACTIVE);
    });

    it('should update updatedAt timestamp', async () => {
      const plan = repo.create({ projectPath: '/a', name: 'Test' });
      const originalUpdatedAt = plan.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = repo.update(plan.id, { name: 'Updated' });

      expect(updated!.updatedAt).toBeDefined();
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should return null for non-existent id', () => {
      const updated = repo.update('non-existent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should update context partially', () => {
      const plan = repo.create({ projectPath: '/a', name: 'Test' });

      const updated = repo.update(plan.id, {
        context: {
          summary: 'New summary',
          keyDecisions: ['Decision 1']
        }
      });

      expect(updated!.context.summary).toBe('New summary');
      expect(updated!.context.keyDecisions).toEqual(['Decision 1']);
      // Other context fields should remain
      expect(updated!.context.assumptions).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete an existing plan', () => {
      const plan = repo.create({ projectPath: '/a', name: 'Test' });

      const deleted = repo.delete(plan.id);

      expect(deleted).toBe(true);
      expect(repo.findById(plan.id)).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const deleted = repo.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('archive', () => {
    it('should set status to archived', () => {
      const plan = repo.create({ projectPath: '/a', name: 'Test' });

      const archived = repo.archive(plan.id);

      expect(archived).toBeDefined();
      expect(archived!.status).toBe(PlanStatus.ARCHIVED);
    });
  });
});
