import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../../setup.js';
import { Database } from '../../../src/db/Database.js';
import { MigrationRunner } from '../../../src/db/migrations/runner.js';
import { initialSchema } from '../../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../../src/db/repositories/TaskRepository.js';
import { TaskStatus, Priority } from '../../../src/models/enums.js';

describe('TaskRepository', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('task-repo');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);
    planRepo = new PlanRepository(db);
    taskRepo = new TaskRepository(db);

    // Create a test plan
    const plan = planRepo.create({ projectPath: '/test', name: 'Test Plan' });
    testPlanId = plan.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('create', () => {
    it('should create a task with required fields', () => {
      const task = taskRepo.create({
        planId: testPlanId,
        title: 'Test Task'
      });

      expect(task.id).toBeDefined();
      expect(task.planId).toBe(testPlanId);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.BACKLOG);
      expect(task.priority).toBe(Priority.MEDIUM);
    });

    it('should create a task with optional fields', () => {
      const task = taskRepo.create({
        planId: testPlanId,
        title: 'Test Task',
        description: 'A description',
        priority: Priority.HIGH,
        estimatedHours: 4,
        assignee: 'user1',
        dueDate: '2025-02-15'
      });

      expect(task.description).toBe('A description');
      expect(task.priority).toBe(Priority.HIGH);
      expect(task.estimatedHours).toBe(4);
      expect(task.assignee).toBe('user1');
      expect(task.dueDate).toBe('2025-02-15');
    });

    it('should create a subtask with parent', () => {
      const parent = taskRepo.create({ planId: testPlanId, title: 'Parent' });
      const child = taskRepo.create({
        planId: testPlanId,
        title: 'Child',
        parentTaskId: parent.id
      });

      expect(child.parentTaskId).toBe(parent.id);
    });
  });

  describe('findById', () => {
    it('should find an existing task', () => {
      const created = taskRepo.create({ planId: testPlanId, title: 'Test' });

      const found = taskRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe('Test');
    });

    it('should return null for non-existent id', () => {
      expect(taskRepo.findById('non-existent')).toBeNull();
    });
  });

  describe('findByPlanId', () => {
    it('should find all tasks for a plan', () => {
      taskRepo.create({ planId: testPlanId, title: 'Task 1' });
      taskRepo.create({ planId: testPlanId, title: 'Task 2' });

      const tasks = taskRepo.findByPlanId(testPlanId);

      expect(tasks).toHaveLength(2);
    });

    it('should filter by status', () => {
      const task1 = taskRepo.create({ planId: testPlanId, title: 'Task 1' });
      taskRepo.create({ planId: testPlanId, title: 'Task 2' });
      taskRepo.update(task1.id, { status: TaskStatus.IN_PROGRESS });

      const inProgress = taskRepo.findByPlanId(testPlanId, {
        status: [TaskStatus.IN_PROGRESS]
      });

      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 1');
    });

    it('should filter by priority', () => {
      taskRepo.create({ planId: testPlanId, title: 'High', priority: Priority.HIGH });
      taskRepo.create({ planId: testPlanId, title: 'Low', priority: Priority.LOW });

      const highPriority = taskRepo.findByPlanId(testPlanId, {
        priority: [Priority.HIGH, Priority.CRITICAL]
      });

      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].title).toBe('High');
    });
  });

  describe('findSubtasks', () => {
    it('should find all subtasks of a parent', () => {
      const parent = taskRepo.create({ planId: testPlanId, title: 'Parent' });
      taskRepo.create({ planId: testPlanId, title: 'Child 1', parentTaskId: parent.id });
      taskRepo.create({ planId: testPlanId, title: 'Child 2', parentTaskId: parent.id });

      const subtasks = taskRepo.findSubtasks(parent.id);

      expect(subtasks).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update task fields', () => {
      const task = taskRepo.create({ planId: testPlanId, title: 'Original' });

      const updated = taskRepo.update(task.id, {
        title: 'Updated',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH
      });

      expect(updated!.title).toBe('Updated');
      expect(updated!.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated!.priority).toBe(Priority.HIGH);
    });

    it('should set startedAt when transitioning to in_progress', () => {
      const task = taskRepo.create({ planId: testPlanId, title: 'Test' });

      const updated = taskRepo.update(task.id, { status: TaskStatus.IN_PROGRESS });

      expect(updated!.startedAt).toBeDefined();
    });

    it('should set completedAt when transitioning to completed', () => {
      const task = taskRepo.create({ planId: testPlanId, title: 'Test' });
      taskRepo.update(task.id, { status: TaskStatus.IN_PROGRESS });

      const completed = taskRepo.update(task.id, { status: TaskStatus.COMPLETED });

      expect(completed!.completedAt).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a task', () => {
      const task = taskRepo.create({ planId: testPlanId, title: 'Test' });

      const deleted = taskRepo.delete(task.id);

      expect(deleted).toBe(true);
      expect(taskRepo.findById(task.id)).toBeNull();
    });

    it('should cascade delete subtasks', () => {
      const parent = taskRepo.create({ planId: testPlanId, title: 'Parent' });
      const child = taskRepo.create({
        planId: testPlanId,
        title: 'Child',
        parentTaskId: parent.id
      });

      taskRepo.delete(parent.id);

      expect(taskRepo.findById(child.id)).toBeNull();
    });
  });

  describe('findBlocked', () => {
    it('should find all blocked tasks', () => {
      taskRepo.create({ planId: testPlanId, title: 'Task 1' });
      const blocked = taskRepo.create({ planId: testPlanId, title: 'Blocked' });
      taskRepo.update(blocked.id, { status: TaskStatus.BLOCKED });

      const blockedTasks = taskRepo.findBlocked(testPlanId);

      expect(blockedTasks).toHaveLength(1);
      expect(blockedTasks[0].title).toBe('Blocked');
    });
  });

  describe('findReady', () => {
    it('should find all ready tasks', () => {
      const ready = taskRepo.create({ planId: testPlanId, title: 'Ready' });
      taskRepo.create({ planId: testPlanId, title: 'Backlog' });
      taskRepo.update(ready.id, { status: TaskStatus.READY });

      const readyTasks = taskRepo.findReady(testPlanId);

      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].title).toBe('Ready');
    });
  });

  describe('countByStatus', () => {
    it('should count tasks by status', () => {
      taskRepo.create({ planId: testPlanId, title: 'Task 1' });
      taskRepo.create({ planId: testPlanId, title: 'Task 2' });
      const task3 = taskRepo.create({ planId: testPlanId, title: 'Task 3' });
      taskRepo.update(task3.id, { status: TaskStatus.COMPLETED });

      const counts = taskRepo.countByStatus(testPlanId);

      expect(counts.backlog).toBe(2);
      expect(counts.completed).toBe(1);
    });
  });
});
