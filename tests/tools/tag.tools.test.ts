import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { taskTags } from '../../src/db/migrations/004-task-tags.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerTagTools } from '../../src/tools/tag.tools.js';

describe('Tag Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  let testPlanId: string;
  let taskA: string;
  let taskB: string;
  let taskC: string;

  beforeEach(() => {
    dbPath = getTestDbPath('tag-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);
    runner.runMigration(taskTags);

    planRepo = new PlanRepository(db);
    taskRepo = new TaskRepository(db);

    tools = new Map();
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        tools.set(name, { definition, handler });
      }
    };

    registerTagTools(registry, taskRepo);

    // Create test plan with tasks
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Tag Test Plan'
    });
    testPlanId = plan.id;

    // Create three tasks for testing tags
    const tA = taskRepo.create({ planId: testPlanId, title: 'Task A' });
    const tB = taskRepo.create({ planId: testPlanId, title: 'Task B' });
    const tC = taskRepo.create({ planId: testPlanId, title: 'Task C' });
    taskA = tA.id;
    taskB = tB.id;
    taskC = tC.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('add_tag', () => {
    it('should add a tag to a task', () => {
      const tool = tools.get('add_tag')!;
      const result = tool.handler({
        taskId: taskA,
        tag: 'frontend'
      }) as { success: boolean; tags: string[]; message: string };

      expect(result.success).toBe(true);
      expect(result.tags).toContain('frontend');
      expect(result.message).toContain('Added tag');
    });

    it('should normalize tags to lowercase', () => {
      const tool = tools.get('add_tag')!;
      const result = tool.handler({
        taskId: taskA,
        tag: 'FRONTEND'
      }) as { success: boolean; tags: string[] };

      expect(result.tags).toContain('frontend');
      expect(result.tags).not.toContain('FRONTEND');
    });

    it('should trim whitespace from tags', () => {
      const tool = tools.get('add_tag')!;
      const result = tool.handler({
        taskId: taskA,
        tag: '  backend  '
      }) as { success: boolean; tags: string[] };

      expect(result.tags).toContain('backend');
    });

    it('should not add duplicate tags', () => {
      const tool = tools.get('add_tag')!;
      tool.handler({ taskId: taskA, tag: 'frontend' });
      const result = tool.handler({
        taskId: taskA,
        tag: 'frontend'
      }) as { success: boolean; tags: string[] };

      expect(result.tags.filter(t => t === 'frontend').length).toBe(1);
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('add_tag')!;
      expect(() => tool.handler({
        taskId: 'non-existent-id',
        tag: 'frontend'
      })).toThrow('Task not found');
    });
  });

  describe('remove_tag', () => {
    it('should remove a tag from a task', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'frontend' });
      addTool.handler({ taskId: taskA, tag: 'backend' });

      const removeTool = tools.get('remove_tag')!;
      const result = removeTool.handler({
        taskId: taskA,
        tag: 'frontend'
      }) as { success: boolean; tags: string[]; message: string };

      expect(result.success).toBe(true);
      expect(result.tags).not.toContain('frontend');
      expect(result.tags).toContain('backend');
      expect(result.message).toContain('Removed tag');
    });

    it('should handle removing non-existent tag gracefully', () => {
      const tool = tools.get('remove_tag')!;
      const result = tool.handler({
        taskId: taskA,
        tag: 'non-existent'
      }) as { success: boolean; tags: string[] };

      expect(result.success).toBe(true);
      expect(result.tags).toEqual([]);
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('remove_tag')!;
      expect(() => tool.handler({
        taskId: 'non-existent-id',
        tag: 'frontend'
      })).toThrow('Task not found');
    });
  });

  describe('set_tags', () => {
    it('should set all tags for a task', () => {
      const tool = tools.get('set_tags')!;
      const result = tool.handler({
        taskId: taskA,
        tags: ['frontend', 'urgent', 'review']
      }) as { success: boolean; tags: string[]; message: string };

      expect(result.success).toBe(true);
      expect(result.tags).toEqual(['frontend', 'urgent', 'review']);
      expect(result.message).toContain('Set 3 tag(s)');
    });

    it('should replace existing tags', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'old-tag' });

      const setTool = tools.get('set_tags')!;
      const result = setTool.handler({
        taskId: taskA,
        tags: ['new-tag-1', 'new-tag-2']
      }) as { success: boolean; tags: string[] };

      expect(result.tags).not.toContain('old-tag');
      expect(result.tags).toContain('new-tag-1');
      expect(result.tags).toContain('new-tag-2');
    });

    it('should normalize and deduplicate tags', () => {
      const tool = tools.get('set_tags')!;
      const result = tool.handler({
        taskId: taskA,
        tags: ['Frontend', 'FRONTEND', '  frontend  ', 'backend']
      }) as { success: boolean; tags: string[] };

      expect(result.tags).toEqual(['frontend', 'backend']);
    });

    it('should handle empty tags array', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'old-tag' });

      const setTool = tools.get('set_tags')!;
      const result = setTool.handler({
        taskId: taskA,
        tags: []
      }) as { success: boolean; tags: string[] };

      expect(result.tags).toEqual([]);
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('set_tags')!;
      expect(() => tool.handler({
        taskId: 'non-existent-id',
        tags: ['frontend']
      })).toThrow('Task not found');
    });
  });

  describe('get_tags', () => {
    it('should get all unique tags in a plan', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'frontend' });
      addTool.handler({ taskId: taskA, tag: 'urgent' });
      addTool.handler({ taskId: taskB, tag: 'backend' });
      addTool.handler({ taskId: taskB, tag: 'urgent' }); // Duplicate across tasks
      addTool.handler({ taskId: taskC, tag: 'testing' });

      const tool = tools.get('get_tags')!;
      const result = tool.handler({
        planId: testPlanId
      }) as { planId: string; count: number; tags: string[] };

      expect(result.planId).toBe(testPlanId);
      expect(result.count).toBe(4); // frontend, urgent, backend, testing
      expect(result.tags).toContain('frontend');
      expect(result.tags).toContain('backend');
      expect(result.tags).toContain('urgent');
      expect(result.tags).toContain('testing');
    });

    it('should return sorted tags', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'zebra' });
      addTool.handler({ taskId: taskA, tag: 'apple' });
      addTool.handler({ taskId: taskB, tag: 'middle' });

      const tool = tools.get('get_tags')!;
      const result = tool.handler({
        planId: testPlanId
      }) as { tags: string[] };

      expect(result.tags).toEqual(['apple', 'middle', 'zebra']);
    });

    it('should return empty array for plan with no tags', () => {
      const tool = tools.get('get_tags')!;
      const result = tool.handler({
        planId: testPlanId
      }) as { count: number; tags: string[] };

      expect(result.count).toBe(0);
      expect(result.tags).toEqual([]);
    });
  });

  describe('find_by_tag', () => {
    it('should find all tasks with a specific tag', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'frontend' });
      addTool.handler({ taskId: taskB, tag: 'frontend' });
      addTool.handler({ taskId: taskC, tag: 'backend' });

      const tool = tools.get('find_by_tag')!;
      const result = tool.handler({
        planId: testPlanId,
        tag: 'frontend'
      }) as { tag: string; count: number; tasks: Array<{ id: string; title: string }> };

      expect(result.tag).toBe('frontend');
      expect(result.count).toBe(2);
      expect(result.tasks.map(t => t.title)).toContain('Task A');
      expect(result.tasks.map(t => t.title)).toContain('Task B');
      expect(result.tasks.map(t => t.title)).not.toContain('Task C');
    });

    it('should normalize tag when searching', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'frontend' });

      const tool = tools.get('find_by_tag')!;
      const result = tool.handler({
        planId: testPlanId,
        tag: 'FRONTEND'
      }) as { count: number };

      expect(result.count).toBe(1);
    });

    it('should return empty array when no tasks have the tag', () => {
      const tool = tools.get('find_by_tag')!;
      const result = tool.handler({
        planId: testPlanId,
        tag: 'non-existent'
      }) as { count: number; tasks: unknown[] };

      expect(result.count).toBe(0);
      expect(result.tasks).toEqual([]);
    });

    it('should include task metadata in results', () => {
      const addTool = tools.get('add_tag')!;
      addTool.handler({ taskId: taskA, tag: 'frontend' });
      addTool.handler({ taskId: taskA, tag: 'urgent' });

      const tool = tools.get('find_by_tag')!;
      const result = tool.handler({
        planId: testPlanId,
        tag: 'frontend'
      }) as { tasks: Array<{ id: string; title: string; status: string; priority: string; tags: string[] }> };

      expect(result.tasks[0]).toHaveProperty('id');
      expect(result.tasks[0]).toHaveProperty('title');
      expect(result.tasks[0]).toHaveProperty('status');
      expect(result.tasks[0]).toHaveProperty('priority');
      expect(result.tasks[0]).toHaveProperty('tags');
      expect(result.tasks[0].tags).toContain('frontend');
      expect(result.tasks[0].tags).toContain('urgent');
    });
  });

  describe('tool registration', () => {
    it('should register all tag tools', () => {
      expect(tools.has('add_tag')).toBe(true);
      expect(tools.has('remove_tag')).toBe(true);
      expect(tools.has('set_tags')).toBe(true);
      expect(tools.has('get_tags')).toBe(true);
      expect(tools.has('find_by_tag')).toBe(true);
    });

    it('should have proper input schemas', () => {
      const addTag = tools.get('add_tag')!;
      expect(addTag.definition.inputSchema.required).toContain('taskId');
      expect(addTag.definition.inputSchema.required).toContain('tag');

      const setTags = tools.get('set_tags')!;
      expect(setTags.definition.inputSchema.properties.tags.type).toBe('array');

      const getTags = tools.get('get_tags')!;
      expect(getTags.definition.inputSchema.required).toContain('planId');
    });
  });
});
