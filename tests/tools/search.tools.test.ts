import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerSearchTools } from '../../src/tools/search.tools.js';

describe('Search Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  let planId1: string;
  let planId2: string;

  beforeEach(() => {
    dbPath = getTestDbPath('search-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    taskRepo = new TaskRepository(db);

    tools = new Map();
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        tools.set(name, { definition, handler });
      }
    };

    registerSearchTools(registry, db, planRepo, taskRepo);

    // Create test data
    const plan1 = planRepo.create({
      projectPath: '/test/project1',
      name: 'Web Application',
      description: 'Build a web app'
    });
    planId1 = plan1.id;

    const plan2 = planRepo.create({
      projectPath: '/test/project2',
      name: 'Mobile App',
      description: 'Build a mobile app'
    });
    planId2 = plan2.id;

    // Create tasks with various attributes
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const setupTask = taskRepo.create({
      planId: planId1,
      title: 'Setup project',
      description: 'Initialize the project structure',
      priority: 'high'
    });
    taskRepo.update(setupTask.id, { status: 'completed' });

    taskRepo.create({
      planId: planId1,
      title: 'Implement authentication',
      description: 'Add user login and registration',
      priority: 'critical',
      assignee: 'john',
      dueDate: tomorrow.toISOString().split('T')[0]
    });

    taskRepo.create({
      planId: planId1,
      title: 'Design database schema',
      priority: 'high',
      dueDate: yesterday.toISOString().split('T')[0] // Overdue
    });

    taskRepo.create({
      planId: planId2,
      title: 'Setup mobile project',
      priority: 'medium',
      assignee: 'jane'
    });

    taskRepo.create({
      planId: planId2,
      title: 'Implement authentication flow',
      description: 'Mobile auth with biometrics',
      priority: 'high',
      dueDate: nextWeek.toISOString().split('T')[0]
    });
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('search_tasks', () => {
    it('should search tasks by text query', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ query: 'authentication' }) as {
        count: number;
        tasks: Array<{ title: string }>;
      };

      expect(result.count).toBe(2);
      expect(result.tasks.every(t =>
        t.title.toLowerCase().includes('authentication') ||
        t.title.toLowerCase().includes('auth')
      )).toBe(true);
    });

    it('should filter tasks by plan', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ planId: planId1 }) as {
        count: number;
        tasks: Array<{ planId: string }>;
      };

      expect(result.tasks.every(t => t.planId === planId1)).toBe(true);
    });

    it('should filter tasks by status', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({
        status: ['completed'],
        includeCompleted: true
      }) as {
        count: number;
        tasks: Array<{ status: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.tasks[0].status).toBe('completed');
    });

    it('should filter tasks by priority', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ priority: ['critical'] }) as {
        count: number;
        tasks: Array<{ priority: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.tasks[0].priority).toBe('critical');
    });

    it('should filter tasks by assignee', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ assignee: 'john' }) as {
        count: number;
        tasks: Array<{ assignee: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.tasks[0].assignee).toBe('john');
    });

    it('should exclude completed tasks by default', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({}) as {
        count: number;
        tasks: Array<{ status: string }>;
      };

      expect(result.tasks.every(t =>
        t.status !== 'completed' && t.status !== 'cancelled'
      )).toBe(true);
    });

    it('should include completed tasks when requested', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ includeCompleted: true }) as {
        count: number;
        tasks: Array<{ status: string }>;
      };

      expect(result.tasks.some(t => t.status === 'completed')).toBe(true);
    });

    it('should combine multiple filters', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({
        planId: planId1,
        priority: ['high', 'critical']
      }) as {
        count: number;
        tasks: Array<{ planId: string; priority: string }>;
      };

      expect(result.tasks.every(t =>
        t.planId === planId1 &&
        (t.priority === 'high' || t.priority === 'critical')
      )).toBe(true);
    });

    it('should respect limit parameter', () => {
      const tool = tools.get('search_tasks')!;
      const result = tool.handler({ limit: 2, includeCompleted: true }) as {
        count: number;
      };

      expect(result.count).toBeLessThanOrEqual(2);
    });
  });

  describe('search_plans', () => {
    it('should search plans by name', () => {
      const tool = tools.get('search_plans')!;
      const result = tool.handler({ query: 'Web' }) as {
        count: number;
        plans: Array<{ name: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.plans[0].name).toBe('Web Application');
    });

    it('should search plans by description', () => {
      const tool = tools.get('search_plans')!;
      const result = tool.handler({ query: 'mobile app' }) as {
        count: number;
        plans: Array<{ name: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.plans[0].name).toBe('Mobile App');
    });

    it('should filter plans by status', () => {
      const tool = tools.get('search_plans')!;
      const result = tool.handler({ status: ['draft'] }) as {
        count: number;
        plans: Array<{ status: string }>;
      };

      expect(result.plans.every(p => p.status === 'draft')).toBe(true);
    });

    it('should filter plans by project path', () => {
      const tool = tools.get('search_plans')!;
      const result = tool.handler({ projectPath: 'project1' }) as {
        count: number;
        plans: Array<{ projectPath: string }>;
      };

      expect(result.count).toBe(1);
      expect(result.plans[0].projectPath).toContain('project1');
    });
  });

  describe('find_overdue_tasks', () => {
    it('should find overdue tasks', () => {
      const tool = tools.get('find_overdue_tasks')!;
      const result = tool.handler({}) as {
        count: number;
        overdueTasks: Array<{ title: string; daysOverdue: number }>;
      };

      expect(result.count).toBeGreaterThan(0);
      expect(result.overdueTasks.every(t => t.daysOverdue > 0)).toBe(true);
    });

    it('should filter overdue tasks by plan', () => {
      const tool = tools.get('find_overdue_tasks')!;
      const result = tool.handler({ planId: planId1 }) as {
        count: number;
        overdueTasks: Array<{ planId: string }>;
      };

      expect(result.overdueTasks.every(t => t.planId === planId1)).toBe(true);
    });

    it('should not include completed tasks in overdue', () => {
      // Complete the overdue task
      const overdueTask = taskRepo.findByPlanId(planId1).find(t =>
        t.title === 'Design database schema'
      );
      if (overdueTask) {
        taskRepo.update(overdueTask.id, { status: 'completed' });
      }

      const tool = tools.get('find_overdue_tasks')!;
      const result = tool.handler({ planId: planId1 }) as {
        count: number;
      };

      expect(result.count).toBe(0);
    });
  });

  describe('find_upcoming_tasks', () => {
    it('should find tasks due within specified days', () => {
      const tool = tools.get('find_upcoming_tasks')!;
      const result = tool.handler({ days: 3 }) as {
        count: number;
        upcomingTasks: Array<{ daysUntilDue: number }>;
      };

      expect(result.upcomingTasks.every(t => t.daysUntilDue <= 3)).toBe(true);
    });

    it('should default to 7 days', () => {
      const tool = tools.get('find_upcoming_tasks')!;
      const result = tool.handler({}) as {
        dateRange: { from: string; to: string };
      };

      const from = new Date(result.dateRange.from);
      const to = new Date(result.dateRange.to);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(7);
    });

    it('should filter by plan', () => {
      const tool = tools.get('find_upcoming_tasks')!;
      const result = tool.handler({ planId: planId1, days: 30 }) as {
        upcomingTasks: Array<{ planId: string }>;
      };

      expect(result.upcomingTasks.every(t => t.planId === planId1)).toBe(true);
    });
  });

  describe('get_task_summary', () => {
    it('should return task counts by status', () => {
      const tool = tools.get('get_task_summary')!;
      const result = tool.handler({}) as {
        total: number;
        byStatus: Record<string, number>;
      };

      expect(result.total).toBe(5);
      expect(result.byStatus).toBeDefined();
    });

    it('should return task counts by priority', () => {
      const tool = tools.get('get_task_summary')!;
      const result = tool.handler({}) as {
        byPriority: Record<string, number>;
      };

      expect(result.byPriority).toBeDefined();
      expect(result.byPriority['high']).toBeGreaterThan(0);
    });

    it('should calculate completion rate', () => {
      const tool = tools.get('get_task_summary')!;
      const result = tool.handler({}) as {
        total: number;
        completed: number;
        completionRate: number;
      };

      expect(result.completionRate).toBe(Math.round((result.completed / result.total) * 100));
    });

    it('should filter summary by plan', () => {
      const tool = tools.get('get_task_summary')!;
      const result = tool.handler({ planId: planId1 }) as {
        total: number;
      };

      expect(result.total).toBe(3); // Only plan1 tasks
    });

    it('should count overdue tasks', () => {
      const tool = tools.get('get_task_summary')!;
      const result = tool.handler({}) as {
        overdue: number;
      };

      expect(result.overdue).toBeGreaterThan(0);
    });
  });
});
