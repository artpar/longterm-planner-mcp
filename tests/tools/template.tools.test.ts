import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { TaskService } from '../../src/services/TaskService.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerTemplateTools } from '../../src/tools/template.tools.js';
import { getTemplates, getTemplateById, getTemplatesByCategory } from '../../src/templates/index.js';

describe('Template Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskService: TaskService;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;

  beforeEach(() => {
    dbPath = getTestDbPath('template-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);

    tools = new Map();
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        tools.set(name, { definition, handler });
      }
    };

    registerTemplateTools(registry, planRepo, taskService);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('Template Functions', () => {
    it('should return all built-in templates', () => {
      const templates = getTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.category === 'development')).toBe(true);
      expect(templates.some(t => t.category === 'general')).toBe(true);
    });

    it('should get template by ID', () => {
      const template = getTemplateById('web-app');
      expect(template).toBeDefined();
      expect(template!.name).toBe('Web Application');
      expect(template!.category).toBe('development');
    });

    it('should return undefined for non-existent template', () => {
      const template = getTemplateById('non-existent');
      expect(template).toBeUndefined();
    });

    it('should filter templates by category', () => {
      const devTemplates = getTemplatesByCategory('development');
      const generalTemplates = getTemplatesByCategory('general');

      expect(devTemplates.every(t => t.category === 'development')).toBe(true);
      expect(generalTemplates.every(t => t.category === 'general')).toBe(true);
    });
  });

  describe('list_templates tool', () => {
    it('should list all templates', () => {
      const tool = tools.get('list_templates')!;
      const result = tool.handler({}) as { count: number; templates: unknown[] };

      expect(result.count).toBeGreaterThan(0);
      expect(result.templates.length).toBe(result.count);
    });

    it('should filter by development category', () => {
      const tool = tools.get('list_templates')!;
      const result = tool.handler({ category: 'development' }) as {
        count: number;
        templates: Array<{ category: string }>;
      };

      expect(result.templates.every(t => t.category === 'development')).toBe(true);
    });

    it('should filter by general category', () => {
      const tool = tools.get('list_templates')!;
      const result = tool.handler({ category: 'general' }) as {
        count: number;
        templates: Array<{ category: string }>;
      };

      expect(result.templates.every(t => t.category === 'general')).toBe(true);
    });

    it('should include task count in template info', () => {
      const tool = tools.get('list_templates')!;
      const result = tool.handler({}) as {
        templates: Array<{ taskCount: number }>;
      };

      expect(result.templates[0].taskCount).toBeGreaterThan(0);
    });
  });

  describe('create_from_template tool', () => {
    it('should create plan from template', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'bug-fix',
        projectPath: '/test/project'
      }) as {
        success: boolean;
        planId: string;
        tasksCreated: number;
      };

      expect(result.success).toBe(true);
      expect(result.planId).toBeDefined();
      expect(result.tasksCreated).toBeGreaterThan(0);

      // Verify plan was created
      const plan = planRepo.findById(result.planId);
      expect(plan).toBeDefined();
      expect(plan!.name).toBe('Bug Fix');
    });

    it('should create plan with custom name', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'web-app',
        name: 'My Custom Web App',
        projectPath: '/test/project'
      }) as { planId: string };

      const plan = planRepo.findById(result.planId);
      expect(plan!.name).toBe('My Custom Web App');
    });

    it('should create plan with custom description', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'rest-api',
        description: 'My custom API description',
        projectPath: '/test/project'
      }) as { planId: string };

      const plan = planRepo.findById(result.planId);
      expect(plan!.description).toBe('My custom API description');
    });

    it('should create nested tasks from template', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'web-app',
        projectPath: '/test/project'
      }) as { planId: string; tasksCreated: number };

      const tasks = taskService.getTasksForPlan(result.planId);

      // Should have parent tasks with children
      const parentTasks = tasks.filter(t => !t.parentTaskId);
      const childTasks = tasks.filter(t => t.parentTaskId);

      expect(parentTasks.length).toBeGreaterThan(0);
      expect(childTasks.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent template', () => {
      const tool = tools.get('create_from_template')!;

      expect(() => {
        tool.handler({
          templateId: 'non-existent-template',
          projectPath: '/test/project'
        });
      }).toThrow('Template not found');
    });

    it('should preserve task priorities from template', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'bug-fix',
        projectPath: '/test/project'
      }) as { planId: string };

      const tasks = taskService.getTasksForPlan(result.planId);
      const highPriorityTask = tasks.find(t => t.title === 'Reproduce the bug');

      expect(highPriorityTask).toBeDefined();
      expect(highPriorityTask!.priority).toBe('high');
    });

    it('should default to medium priority when not specified', () => {
      const tool = tools.get('create_from_template')!;
      const result = tool.handler({
        templateId: 'web-app',
        projectPath: '/test/project'
      }) as { planId: string };

      const tasks = taskService.getTasksForPlan(result.planId);
      // Child tasks without explicit priority should default to medium
      const childTask = tasks.find(t => t.title === 'Initialize project structure');

      expect(childTask).toBeDefined();
      expect(childTask!.priority).toBe('medium');
    });
  });

  describe('Template Content', () => {
    it('should have web-app template with expected structure', () => {
      const template = getTemplateById('web-app');
      expect(template).toBeDefined();
      expect(template!.tasks.some(t => t.title === 'Project Setup')).toBe(true);
      expect(template!.tasks.some(t => t.title === 'Core Features')).toBe(true);
      expect(template!.tasks.some(t => t.title === 'Deployment')).toBe(true);
    });

    it('should have rest-api template with expected structure', () => {
      const template = getTemplateById('rest-api');
      expect(template).toBeDefined();
      expect(template!.tasks.some(t => t.title === 'API Design')).toBe(true);
      expect(template!.tasks.some(t => t.title === 'Core Implementation')).toBe(true);
    });

    it('should have release template with critical priority tasks', () => {
      const template = getTemplateById('release');
      expect(template).toBeDefined();

      const criticalTask = template!.tasks.find(t => t.title === 'Production deployment');
      expect(criticalTask).toBeDefined();
      expect(criticalTask!.priority).toBe('critical');
    });
  });
});
