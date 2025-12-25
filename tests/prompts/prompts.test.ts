import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { PromptRegistry } from '../../src/prompts/types.js';
import { registerPrompts, getPromptDefinitions } from '../../src/prompts/index.js';
import { Priority } from '../../src/models/enums.js';

describe('Prompts', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskService: TaskService;
  let prompts: Map<string, { handler: (args: Record<string, unknown>) => unknown }>;
  let testPlanId: string;

  beforeEach(() => {
    dbPath = getTestDbPath('prompts');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);

    prompts = new Map();
    const registry: PromptRegistry = {
      register: (name, _definition, handler) => {
        prompts.set(name, { handler });
      }
    };

    registerPrompts(registry, planRepo, taskService);

    // Create test data
    const plan = planRepo.create({ projectPath: '/test', name: 'Test Plan' });
    testPlanId = plan.id;

    taskService.createTask({ planId: testPlanId, title: 'Task 1', priority: Priority.HIGH });
    taskService.createTask({ planId: testPlanId, title: 'Task 2' });
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  function getPrompt(name: string, args: Record<string, unknown> = {}): unknown {
    const prompt = prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    return prompt.handler(args);
  }

  describe('getPromptDefinitions', () => {
    it('should return all prompt definitions', () => {
      const definitions = getPromptDefinitions();
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.find(p => p.name === 'plan_session')).toBeDefined();
      expect(definitions.find(p => p.name === 'daily_standup')).toBeDefined();
    });
  });

  describe('plan_session', () => {
    it('should generate planning session prompt for new plan', () => {
      const result = getPrompt('plan_session', {}) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].content.text).toContain('planning session');
    });

    it('should include plan context when planId provided', () => {
      const result = getPrompt('plan_session', { planId: testPlanId }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages[0].content.text).toContain('Test Plan');
    });
  });

  describe('daily_standup', () => {
    it('should generate daily standup summary', () => {
      const result = getPrompt('daily_standup', {}) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages[0].content.text).toContain('standup');
    });
  });

  describe('decompose', () => {
    it('should generate goal decomposition prompt', () => {
      const result = getPrompt('decompose', { goal: 'Build user authentication' }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages[0].content.text).toContain('Build user authentication');
      expect(result.messages[0].content.text).toContain('decompose');
    });
  });

  describe('prioritize', () => {
    it('should generate prioritization prompt', () => {
      const result = getPrompt('prioritize', { planId: testPlanId }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages[0].content.text).toContain('prioritize');
    });
  });

  describe('retrospective', () => {
    it('should generate retrospective prompt', () => {
      const result = getPrompt('retrospective', { planId: testPlanId }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages[0].content.text).toContain('retrospective');
    });
  });

  describe('unblock', () => {
    it('should generate unblock analysis prompt', () => {
      // First block a task
      const task = taskService.createTask({ planId: testPlanId, title: 'Blocked Task' });
      taskService.startTask(task.id);
      taskService.blockTask(task.id, 'API not ready');

      const result = getPrompt('unblock', { planId: testPlanId }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toBeDefined();
      expect(result.messages[0].content.text).toContain('block');
    });
  });
});
