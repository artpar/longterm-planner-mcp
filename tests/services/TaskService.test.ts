import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { TaskStatus, Priority } from '../../src/models/enums.js';

describe('TaskService', () => {
  let dbPath: string;
  let db: Database;
  let taskService: TaskService;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('task-service');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    const planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);

    // Create test plan
    const plan = planRepo.create({ projectPath: '/test', name: 'Test Plan' });
    testPlanId = plan.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('createTask', () => {
    it('should create a task with defaults', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'New Task'
      });

      expect(task.title).toBe('New Task');
      expect(task.status).toBe(TaskStatus.BACKLOG);
      expect(task.priority).toBe(Priority.MEDIUM);
    });

    it('should create a task with custom priority', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'High Priority',
        priority: Priority.HIGH
      });

      expect(task.priority).toBe(Priority.HIGH);
    });
  });

  describe('transition', () => {
    it('should transition task from backlog to ready', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });

      const result = taskService.transition(task.id, TaskStatus.READY);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.READY);
    });

    it('should transition task from ready to in_progress', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.transition(task.id, TaskStatus.READY);

      const result = taskService.transition(task.id, TaskStatus.IN_PROGRESS);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.task?.startedAt).toBeDefined();
    });

    it('should reject invalid transition', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });

      const result = taskService.transition(task.id, TaskStatus.COMPLETED);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('should set completedAt when transitioning to completed', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.transition(task.id, TaskStatus.READY);
      taskService.transition(task.id, TaskStatus.IN_PROGRESS);
      taskService.transition(task.id, TaskStatus.REVIEW);

      const result = taskService.transition(task.id, TaskStatus.COMPLETED);

      expect(result.success).toBe(true);
      expect(result.task?.completedAt).toBeDefined();
    });
  });

  describe('startTask', () => {
    it('should move task from backlog to in_progress via ready', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });

      const result = taskService.startTask(task.id);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should move task from ready to in_progress', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.transition(task.id, TaskStatus.READY);

      const result = taskService.startTask(task.id);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('completeTask', () => {
    it('should complete a task in review', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.transition(task.id, TaskStatus.READY);
      taskService.transition(task.id, TaskStatus.IN_PROGRESS);
      taskService.transition(task.id, TaskStatus.REVIEW);

      const result = taskService.completeTask(task.id, {
        summary: 'Done!',
        actualHours: 2
      });

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.COMPLETED);
      expect(result.task?.actualHours).toBe(2);
    });
  });

  describe('blockTask', () => {
    it('should block an in-progress task', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.startTask(task.id);

      const result = taskService.blockTask(task.id, 'Waiting for API');

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.BLOCKED);
    });
  });

  describe('unblockTask', () => {
    it('should unblock a blocked task', () => {
      const task = taskService.createTask({ planId: testPlanId, title: 'Test' });
      taskService.startTask(task.id);
      taskService.blockTask(task.id, 'Waiting');

      const result = taskService.unblockTask(task.id);

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('getTasksForPlan', () => {
    it('should return all tasks for a plan', () => {
      taskService.createTask({ planId: testPlanId, title: 'Task 1' });
      taskService.createTask({ planId: testPlanId, title: 'Task 2' });

      const tasks = taskService.getTasksForPlan(testPlanId);

      expect(tasks).toHaveLength(2);
    });

    it('should filter by status', () => {
      const task1 = taskService.createTask({ planId: testPlanId, title: 'Task 1' });
      taskService.createTask({ planId: testPlanId, title: 'Task 2' });
      taskService.startTask(task1.id);

      const inProgress = taskService.getTasksForPlan(testPlanId, {
        status: [TaskStatus.IN_PROGRESS]
      });

      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 1');
    });
  });

  describe('getProgressStats', () => {
    it('should calculate task statistics', () => {
      const task1 = taskService.createTask({ planId: testPlanId, title: 'T1' });
      const task2 = taskService.createTask({ planId: testPlanId, title: 'T2' });
      taskService.createTask({ planId: testPlanId, title: 'T3' });

      taskService.startTask(task1.id);
      taskService.transition(task1.id, TaskStatus.REVIEW);
      taskService.completeTask(task1.id, { summary: 'Done' });

      taskService.startTask(task2.id);

      const stats = taskService.getProgressStats(testPlanId);

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.percentComplete).toBeCloseTo(33.33, 1);
    });
  });
});
