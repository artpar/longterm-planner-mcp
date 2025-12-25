import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HookHandlers } from '../../src/integrations/HookHandlers.js';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskService } from '../../src/services/TaskService.js';

describe('HookHandlers', () => {
  let dbPath: string;
  let db: Database;
  let hookHandlers: HookHandlers;
  let taskService: TaskService;
  let planRepo: PlanRepository;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('hook-handlers');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);
    hookHandlers = new HookHandlers(db, taskService, planRepo);

    // Create test plan
    const plan = planRepo.create({ projectPath: '/test/project', name: 'Hook Test Plan' });
    testPlanId = plan.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('handleSessionStart', () => {
    it('should create a new session', () => {
      const result = hookHandlers.handleSessionStart({
        planId: testPlanId
      });

      expect(result.sessionId).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should work without planId', () => {
      const result = hookHandlers.handleSessionStart({});
      expect(result.sessionId).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('handleSessionEnd', () => {
    it('should end an active session', () => {
      const startResult = hookHandlers.handleSessionStart({ planId: testPlanId });

      const endResult = hookHandlers.handleSessionEnd({
        sessionId: startResult.sessionId,
        summary: 'Completed work on feature'
      });

      expect(endResult.success).toBe(true);
    });

    it('should fail for non-existent session', () => {
      const result = hookHandlers.handleSessionEnd({
        sessionId: 'non-existent',
        summary: 'Test'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('handlePreToolUse', () => {
    it('should log tool usage for Bash command', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });
      taskService.startTask(task.id);

      const result = hookHandlers.handlePreToolUse({
        toolName: 'Bash',
        input: { command: 'npm test' },
        activeTaskId: task.id
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow all tool uses by default', () => {
      const result = hookHandlers.handlePreToolUse({
        toolName: 'Read',
        input: { file_path: '/some/file.ts' }
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('handlePostToolUse', () => {
    it('should log progress for completed tool', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });
      taskService.startTask(task.id);

      const result = hookHandlers.handlePostToolUse({
        toolName: 'Bash',
        input: { command: 'npm test' },
        output: 'All tests passed',
        activeTaskId: task.id
      });

      expect(result.logged).toBe(true);
    });

    it('should handle tool errors', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });
      taskService.startTask(task.id);

      const result = hookHandlers.handlePostToolUse({
        toolName: 'Bash',
        input: { command: 'npm test' },
        error: 'Tests failed',
        activeTaskId: task.id
      });

      expect(result.logged).toBe(true);
    });
  });

  describe('handleStop', () => {
    it('should save context on stop', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });
      taskService.startTask(task.id);

      const startResult = hookHandlers.handleSessionStart({ planId: testPlanId });

      const result = hookHandlers.handleStop({
        sessionId: startResult.sessionId,
        activeTaskId: task.id,
        summary: 'Stopped mid-task'
      });

      expect(result.success).toBe(true);
      expect(result.contextSaved).toBe(true);
    });
  });

  describe('handleNotification', () => {
    it('should log notification for task', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });

      const result = hookHandlers.handleNotification({
        type: 'reminder',
        message: 'Task deadline approaching',
        taskId: task.id
      });

      expect(result.acknowledged).toBe(true);
    });

    it('should handle notification without task', () => {
      const result = hookHandlers.handleNotification({
        type: 'info',
        message: 'General notification'
      });

      expect(result.acknowledged).toBe(true);
    });
  });

  describe('handleUserPromptSubmit', () => {
    it('should extract task mentions from prompt', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Login Feature'
      });

      const result = hookHandlers.handleUserPromptSubmit({
        prompt: `Work on task #task-${task.id}`
      });

      expect(result.detectedTasks).toContain(task.id);
    });

    it('should handle prompt without task mentions', () => {
      const result = hookHandlers.handleUserPromptSubmit({
        prompt: 'Regular prompt without task refs'
      });

      expect(result.detectedTasks).toHaveLength(0);
    });
  });

  describe('getActiveSession', () => {
    it('should return active session for plan', () => {
      hookHandlers.handleSessionStart({ planId: testPlanId });

      const session = hookHandlers.getActiveSession(testPlanId);
      expect(session).toBeDefined();
      expect(session?.planId).toBe(testPlanId);
    });

    it('should return null when no active session', () => {
      const session = hookHandlers.getActiveSession(testPlanId);
      expect(session).toBeNull();
    });
  });
});
