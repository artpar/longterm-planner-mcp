import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { ResourceRegistry } from '../../src/resources/types.js';
import { registerResources } from '../../src/resources/index.js';
import { TaskStatus, Priority } from '../../src/models/enums.js';

describe('Resources', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskService: TaskService;
  let resources: Map<string, { pattern: RegExp; handler: (uri: string, match: RegExpMatchArray) => unknown }>;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('resources');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);

    resources = new Map();
    const registry: ResourceRegistry = {
      register: (pattern, handler) => {
        resources.set(pattern.source, { pattern, handler });
      }
    };

    registerResources(registry, planRepo, taskService);

    // Create test data
    const plan = planRepo.create({ projectPath: '/test', name: 'Test Plan' });
    testPlanId = plan.id;

    // Create some tasks
    const task1 = taskService.createTask({ planId: testPlanId, title: 'Task 1', priority: Priority.HIGH });
    const task2 = taskService.createTask({ planId: testPlanId, title: 'Task 2' });
    const task3 = taskService.createTask({ planId: testPlanId, title: 'Task 3' });

    taskService.startTask(task1.id);
    taskService.startTask(task2.id);
    taskService.blockTask(task2.id, 'Waiting for API');
    taskService.transition(task3.id, TaskStatus.READY);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  function getResource(uri: string): unknown {
    for (const [, { pattern, handler }] of resources) {
      const match = uri.match(pattern);
      if (match) {
        return handler(uri, match);
      }
    }
    throw new Error(`Resource not found: ${uri}`);
  }

  describe('plan://overview', () => {
    it('should return overview of all plans', () => {
      const result = getResource('plan://overview') as {
        plans: Array<{ id: string; name: string; status: string }>;
        summary: { totalPlans: number };
      };

      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].name).toBe('Test Plan');
      expect(result.summary.totalPlans).toBe(1);
    });

    it('should include task statistics in plan overview', () => {
      const result = getResource('plan://overview') as {
        plans: Array<{
          tasksTotal: number;
          tasksCompleted: number;
          tasksInProgress: number;
        }>;
      };

      expect(result.plans[0].tasksTotal).toBe(3);
      expect(result.plans[0].tasksInProgress).toBe(1); // task1 is in_progress
    });
  });

  describe('plan://kanban/{planId}', () => {
    it('should return kanban board view', () => {
      const result = getResource(`plan://kanban/${testPlanId}`) as {
        columns: Array<{
          status: string;
          tasks: Array<{ id: string; title: string }>;
        }>;
      };

      expect(result.columns).toBeDefined();
      expect(Array.isArray(result.columns)).toBe(true);

      // Find the in_progress column
      const inProgressColumn = result.columns.find(c => c.status === 'in_progress');
      expect(inProgressColumn).toBeDefined();
      expect(inProgressColumn!.tasks).toHaveLength(1);
    });
  });

  describe('plan://blockers', () => {
    it('should return all blocked tasks', () => {
      const result = getResource('plan://blockers') as {
        blockedTasks: Array<{ taskId: string; title: string }>;
        count: number;
      };

      expect(result.count).toBe(1);
      expect(result.blockedTasks[0].title).toBe('Task 2');
    });

    it('should filter blockers by plan', () => {
      const result = getResource(`plan://blockers/${testPlanId}`) as {
        blockedTasks: Array<{ taskId: string }>;
        count: number;
      };

      expect(result.count).toBe(1);
    });
  });

  describe('plan://progress/{planId}', () => {
    it('should return progress statistics', () => {
      const result = getResource(`plan://progress/${testPlanId}`) as {
        planId: string;
        total: number;
        completed: number;
        percentComplete: number;
      };

      expect(result.planId).toBe(testPlanId);
      expect(result.total).toBe(3);
      expect(result.completed).toBe(0);
      expect(result.percentComplete).toBe(0);
    });
  });

  describe('plan://today', () => {
    it('should return today focus view', () => {
      const result = getResource('plan://today') as {
        inProgress: Array<{ id: string }>;
        blocked: Array<{ id: string }>;
        ready: Array<{ id: string }>;
      };

      expect(result.inProgress).toHaveLength(1);
      expect(result.blocked).toHaveLength(1);
      expect(result.ready).toHaveLength(1);
    });
  });
});
