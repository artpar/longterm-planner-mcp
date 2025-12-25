import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarkdownExporter } from '../../src/export/MarkdownExporter.js';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { Priority, TaskStatus } from '../../src/models/enums.js';

describe('MarkdownExporter', () => {
  let dbPath: string;
  let db: Database;
  let exporter: MarkdownExporter;
  let taskService: TaskService;
  let planRepo: PlanRepository;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('markdown-export');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);
    exporter = new MarkdownExporter(planRepo, taskService);

    // Create test plan
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Test Plan',
      description: 'A test plan for export'
    });
    testPlanId = plan.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('exportPlan', () => {
    it('should export plan with title and description', () => {
      const markdown = exporter.exportPlan(testPlanId);

      expect(markdown).toContain('# Test Plan');
      expect(markdown).toContain('A test plan for export');
    });

    it('should export plan status', () => {
      const markdown = exporter.exportPlan(testPlanId);

      expect(markdown).toContain('**Status:**');
    });

    it('should export tasks grouped by status', () => {
      taskService.createTask({
        planId: testPlanId,
        title: 'Backlog Task',
        status: TaskStatus.BACKLOG
      });

      const inProgressTask = taskService.createTask({
        planId: testPlanId,
        title: 'In Progress Task'
      });
      taskService.startTask(inProgressTask.id);

      const markdown = exporter.exportPlan(testPlanId);

      expect(markdown).toContain('## Backlog');
      expect(markdown).toContain('Backlog Task');
      expect(markdown).toContain('## In Progress');
      expect(markdown).toContain('In Progress Task');
    });

    it('should include task priorities', () => {
      taskService.createTask({
        planId: testPlanId,
        title: 'Critical Task',
        priority: Priority.CRITICAL
      });

      const markdown = exporter.exportPlan(testPlanId);

      expect(markdown).toContain('Critical Task');
      expect(markdown).toMatch(/critical/i);
    });

    it('should use checkbox format for tasks', () => {
      taskService.createTask({
        planId: testPlanId,
        title: 'Incomplete Task'
      });

      const task2 = taskService.createTask({
        planId: testPlanId,
        title: 'Complete Task'
      });
      taskService.startTask(task2.id);
      taskService.transition(task2.id, TaskStatus.REVIEW);
      taskService.completeTask(task2.id, { summary: 'Done' });

      const markdown = exporter.exportPlan(testPlanId);

      expect(markdown).toContain('- [ ] Incomplete Task');
      expect(markdown).toContain('- [x] Complete Task');
    });

    it('should throw for non-existent plan', () => {
      expect(() => exporter.exportPlan('non-existent')).toThrow();
    });
  });

  describe('exportPlanSummary', () => {
    it('should export concise summary', () => {
      taskService.createTask({ planId: testPlanId, title: 'Task 1' });
      taskService.createTask({ planId: testPlanId, title: 'Task 2' });
      const task3 = taskService.createTask({ planId: testPlanId, title: 'Task 3' });
      taskService.startTask(task3.id);
      taskService.transition(task3.id, TaskStatus.REVIEW);
      taskService.completeTask(task3.id, { summary: 'Done' });

      const summary = exporter.exportPlanSummary(testPlanId);

      expect(summary).toContain('Test Plan');
      expect(summary).toContain('3'); // Total tasks
      expect(summary).toContain('1'); // Completed
    });
  });

  describe('exportAllPlans', () => {
    it('should export all plans', () => {
      planRepo.create({ projectPath: '/test', name: 'Plan 2' });

      const markdown = exporter.exportAllPlans();

      expect(markdown).toContain('Test Plan');
      expect(markdown).toContain('Plan 2');
    });

    it('should include overview section', () => {
      const markdown = exporter.exportAllPlans();

      expect(markdown).toContain('# Planning Overview');
    });
  });

  describe('exportTaskDetails', () => {
    it('should export detailed task info', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Detailed Task',
        description: 'This is a detailed description',
        priority: Priority.HIGH,
        estimatedHours: 4
      });

      const markdown = exporter.exportTaskDetails(task.id);

      expect(markdown).toContain('Detailed Task');
      expect(markdown).toContain('This is a detailed description');
      expect(markdown).toContain('high');
      expect(markdown).toContain('4');
    });

    it('should include subtasks', () => {
      const parent = taskService.createTask({
        planId: testPlanId,
        title: 'Parent Task'
      });

      taskService.createTask({
        planId: testPlanId,
        title: 'Child Task',
        parentTaskId: parent.id
      });

      const markdown = exporter.exportTaskDetails(parent.id);

      expect(markdown).toContain('Child Task');
    });
  });

  describe('parseMarkdown', () => {
    it('should parse task checkboxes', () => {
      const markdown = `
## Backlog
- [ ] Task 1
- [ ] Task 2

## Completed
- [x] Done Task
`;

      const parsed = exporter.parseMarkdown(markdown);

      expect(parsed.tasks).toHaveLength(3);
      expect(parsed.tasks.find(t => t.title === 'Task 1')?.completed).toBe(false);
      expect(parsed.tasks.find(t => t.title === 'Done Task')?.completed).toBe(true);
    });

    it('should parse task with priority', () => {
      const markdown = `
## Tasks
- [ ] [critical] Important Task
- [ ] [high] High Priority Task
`;

      const parsed = exporter.parseMarkdown(markdown);

      expect(parsed.tasks.find(t => t.title === 'Important Task')?.priority).toBe('critical');
      expect(parsed.tasks.find(t => t.title === 'High Priority Task')?.priority).toBe('high');
    });
  });
});
