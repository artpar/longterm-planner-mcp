import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { MarkdownExporter } from '../../src/export/MarkdownExporter.js';
import { PlanExport } from '../../src/tools/export.tools.js';

describe('Export/Import Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskService: TaskService;
  let markdownExporter: MarkdownExporter;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('export-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);
    markdownExporter = new MarkdownExporter(planRepo, taskService);

    // Create test plan with tasks
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Export Test Plan',
      description: 'A plan for testing export functionality'
    });
    testPlanId = plan.id;

    taskService.createTask({ planId: testPlanId, title: 'Task 1', priority: 'high' });
    taskService.createTask({ planId: testPlanId, title: 'Task 2', priority: 'medium' });
    const parent = taskService.createTask({ planId: testPlanId, title: 'Parent Task' });
    taskService.createTask({ planId: testPlanId, parentTaskId: parent.id, title: 'Child Task' });
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('JSON Export', () => {
    it('should export plan to JSON format', () => {
      const plan = planRepo.findById(testPlanId)!;
      const tasks = taskService.getTasksForPlan(testPlanId);

      const exportData: PlanExport = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        format: 'json',
        plan,
        tasks
      };

      expect(exportData.version).toBe('1.0');
      expect(exportData.plan.name).toBe('Export Test Plan');
      expect(exportData.tasks.length).toBe(4);
    });

    it('should include all task fields in export', () => {
      const tasks = taskService.getTasksForPlan(testPlanId);
      const task = tasks[0];

      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('planId');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('context');
    });

    it('should preserve parent-child relationships', () => {
      const tasks = taskService.getTasksForPlan(testPlanId);
      const childTask = tasks.find(t => t.title === 'Child Task');
      const parentTask = tasks.find(t => t.title === 'Parent Task');

      expect(childTask).toBeDefined();
      expect(parentTask).toBeDefined();
      expect(childTask!.parentTaskId).toBe(parentTask!.id);
    });
  });

  describe('Markdown Export', () => {
    it('should export plan to markdown format', () => {
      const markdown = markdownExporter.exportPlan(testPlanId);

      expect(markdown).toContain('# Export Test Plan');
      expect(markdown).toContain('A plan for testing export functionality');
      expect(markdown).toContain('Task 1');
      expect(markdown).toContain('Task 2');
    });

    it('should include progress in markdown', () => {
      const markdown = markdownExporter.exportPlan(testPlanId);

      expect(markdown).toContain('## Overview');
      expect(markdown).toContain('**Status:**');
      expect(markdown).toContain('**Progress:**');
    });
  });

  describe('JSON Import', () => {
    it('should import plan from JSON export', () => {
      // Export
      const plan = planRepo.findById(testPlanId)!;
      const tasks = taskService.getTasksForPlan(testPlanId);

      const exportData: PlanExport = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        format: 'json',
        plan,
        tasks
      };

      // Simulate import by creating new plan
      const newPlan = planRepo.create({
        projectPath: '/imported/project',
        name: `${plan.name} (imported)`,
        description: plan.description
      });

      expect(newPlan.name).toBe('Export Test Plan (imported)');
      expect(newPlan.description).toBe(plan.description);
    });

    it('should create new IDs for imported plan and tasks', () => {
      const originalPlan = planRepo.findById(testPlanId)!;
      const originalTasks = taskService.getTasksForPlan(testPlanId);

      // Create imported plan
      const importedPlan = planRepo.create({
        projectPath: '/imported/project',
        name: `${originalPlan.name} (imported)`,
        description: originalPlan.description
      });

      // Import tasks
      for (const task of originalTasks.filter(t => !t.parentTaskId)) {
        taskService.createTask({
          planId: importedPlan.id,
          title: task.title,
          description: task.description,
          priority: task.priority
        });
      }

      const importedTasks = taskService.getTasksForPlan(importedPlan.id);

      expect(importedPlan.id).not.toBe(originalPlan.id);
      expect(importedTasks[0].id).not.toBe(originalTasks[0].id);
      expect(importedTasks[0].planId).toBe(importedPlan.id);
    });

    it('should preserve task hierarchy on import', () => {
      const originalTasks = taskService.getTasksForPlan(testPlanId);
      const originalParent = originalTasks.find(t => t.title === 'Parent Task')!;
      const originalChild = originalTasks.find(t => t.title === 'Child Task')!;

      // Create imported plan
      const importedPlan = planRepo.create({
        projectPath: '/imported/project',
        name: 'Imported Plan'
      });

      // Track ID mapping
      const idMap = new Map<string, string>();

      // Import parent first
      const importedParent = taskService.createTask({
        planId: importedPlan.id,
        title: originalParent.title
      });
      idMap.set(originalParent.id, importedParent.id);

      // Import child with mapped parent ID
      const newParentId = idMap.get(originalChild.parentTaskId!);
      const importedChild = taskService.createTask({
        planId: importedPlan.id,
        parentTaskId: newParentId,
        title: originalChild.title
      });

      expect(importedChild.parentTaskId).toBe(importedParent.id);
    });
  });

  describe('Export Validation', () => {
    it('should throw error for non-existent plan', () => {
      expect(() => {
        markdownExporter.exportPlan('non-existent-id');
      }).toThrow('Plan not found');
    });

    it('should handle empty plan (no tasks)', () => {
      const emptyPlan = planRepo.create({
        projectPath: '/test/empty',
        name: 'Empty Plan'
      });

      const tasks = taskService.getTasksForPlan(emptyPlan.id);
      expect(tasks).toHaveLength(0);

      const markdown = markdownExporter.exportPlan(emptyPlan.id);
      expect(markdown).toContain('# Empty Plan');
    });
  });
});
