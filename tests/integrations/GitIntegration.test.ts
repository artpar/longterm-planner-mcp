import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitIntegration } from '../../src/integrations/GitIntegration.js';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskService } from '../../src/services/TaskService.js';

describe('GitIntegration', () => {
  let dbPath: string;
  let db: Database;
  let gitIntegration: GitIntegration;
  let taskService: TaskService;
  let planRepo: PlanRepository;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('git-integration');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);
    gitIntegration = new GitIntegration(db, taskService);

    // Create test plan
    const plan = planRepo.create({ projectPath: '/test/project', name: 'Git Test Plan' });
    testPlanId = plan.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('parseTaskReferences', () => {
    it('should parse task IDs from commit message', () => {
      const message = 'Fix bug in login form #task-abc123';
      const refs = gitIntegration.parseTaskReferences(message);
      expect(refs).toContain('abc123');
    });

    it('should parse multiple task IDs', () => {
      const message = 'Update UI #task-abc123 and #task-def456';
      const refs = gitIntegration.parseTaskReferences(message);
      expect(refs).toHaveLength(2);
      expect(refs).toContain('abc123');
      expect(refs).toContain('def456');
    });

    it('should return empty array for no references', () => {
      const message = 'Regular commit without task refs';
      const refs = gitIntegration.parseTaskReferences(message);
      expect(refs).toHaveLength(0);
    });

    it('should handle refs: prefix format', () => {
      const message = 'Fix issue refs: #task-abc123';
      const refs = gitIntegration.parseTaskReferences(message);
      expect(refs).toContain('abc123');
    });
  });

  describe('parseBranchTaskId', () => {
    it('should parse task ID from feature branch', () => {
      const branch = 'feature/task-abc123-add-login';
      const taskId = gitIntegration.parseBranchTaskId(branch);
      expect(taskId).toBe('abc123');
    });

    it('should parse task ID from fix branch', () => {
      const branch = 'fix/task-def456-bug-fix';
      const taskId = gitIntegration.parseBranchTaskId(branch);
      expect(taskId).toBe('def456');
    });

    it('should return null for branch without task ID', () => {
      const branch = 'main';
      const taskId = gitIntegration.parseBranchTaskId(branch);
      expect(taskId).toBeNull();
    });

    it('should handle task-id at start of branch name', () => {
      const branch = 'task-abc123-feature';
      const taskId = gitIntegration.parseBranchTaskId(branch);
      expect(taskId).toBe('abc123');
    });
  });

  describe('linkCommitToTask', () => {
    it('should link commit to task', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });

      const result = gitIntegration.linkCommitToTask({
        taskId: task.id,
        commitHash: 'abc123def456',
        message: 'Fix bug',
        author: 'dev@example.com',
        timestamp: new Date().toISOString()
      });

      expect(result.success).toBe(true);
    });

    it('should fail for non-existent task', () => {
      const result = gitIntegration.linkCommitToTask({
        taskId: 'non-existent',
        commitHash: 'abc123',
        message: 'Fix',
        author: 'dev@example.com',
        timestamp: new Date().toISOString()
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getCommitsForTask', () => {
    it('should return commits linked to task', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Test Task'
      });

      gitIntegration.linkCommitToTask({
        taskId: task.id,
        commitHash: 'commit1',
        message: 'First commit',
        author: 'dev@example.com',
        timestamp: '2024-01-01T10:00:00Z'
      });

      gitIntegration.linkCommitToTask({
        taskId: task.id,
        commitHash: 'commit2',
        message: 'Second commit',
        author: 'dev@example.com',
        timestamp: '2024-01-02T10:00:00Z'
      });

      const commits = gitIntegration.getCommitsForTask(task.id);
      expect(commits).toHaveLength(2);
      expect(commits[0].commitHash).toBe('commit2'); // Most recent first
      expect(commits[1].commitHash).toBe('commit1');
    });

    it('should return empty array for task with no commits', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'No Commits Task'
      });

      const commits = gitIntegration.getCommitsForTask(task.id);
      expect(commits).toHaveLength(0);
    });
  });

  describe('processCommit', () => {
    it('should auto-link commit based on message references', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Referenced Task'
      });

      const result = gitIntegration.processCommit({
        commitHash: 'abc123',
        message: `Fix login bug #task-${task.id}`,
        author: 'dev@example.com',
        timestamp: new Date().toISOString(),
        branch: 'feature/login-fix'
      });

      expect(result.linkedTasks).toHaveLength(1);
      expect(result.linkedTasks[0]).toBe(task.id);

      const commits = gitIntegration.getCommitsForTask(task.id);
      expect(commits).toHaveLength(1);
    });

    it('should auto-link commit based on branch name', () => {
      const task = taskService.createTask({
        planId: testPlanId,
        title: 'Branch Task'
      });

      const result = gitIntegration.processCommit({
        commitHash: 'def456',
        message: 'Some commit',
        author: 'dev@example.com',
        timestamp: new Date().toISOString(),
        branch: `feature/task-${task.id}-add-feature`
      });

      expect(result.linkedTasks).toContain(task.id);
    });
  });
});
