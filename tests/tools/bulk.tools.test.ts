import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { taskTags } from '../../src/db/migrations/004-task-tags.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerBulkTools } from '../../src/tools/bulk.tools.js';
import { TaskStatus, Priority } from '../../src/models/enums.js';

describe('Bulk Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  let testPlanId: string;
  let taskA: string;
  let taskB: string;
  let taskC: string;
  let taskD: string;

  beforeEach(() => {
    dbPath = getTestDbPath('bulk-tools');
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

    registerBulkTools(registry, taskRepo);

    // Create test plan with tasks
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Bulk Test Plan'
    });
    testPlanId = plan.id;

    // Create four tasks for testing bulk operations
    const tA = taskRepo.create({ planId: testPlanId, title: 'Task A' });
    const tB = taskRepo.create({ planId: testPlanId, title: 'Task B' });
    const tC = taskRepo.create({ planId: testPlanId, title: 'Task C' });
    const tD = taskRepo.create({ planId: testPlanId, title: 'Task D' });
    taskA = tA.id;
    taskB = tB.id;
    taskC = tC.id;
    taskD = tD.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('bulk_update_status', () => {
    it('should update status for multiple tasks', () => {
      const tool = tools.get('bulk_update_status')!;
      const result = tool.handler({
        taskIds: [taskA, taskB, taskC],
        status: 'in_progress'
      }) as { success: boolean; updatedCount: number; status: string };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(result.status).toBe('in_progress');

      // Verify tasks were updated
      const tA = taskRepo.findById(taskA)!;
      const tB = taskRepo.findById(taskB)!;
      const tC = taskRepo.findById(taskC)!;
      expect(tA.status).toBe(TaskStatus.IN_PROGRESS);
      expect(tB.status).toBe(TaskStatus.IN_PROGRESS);
      expect(tC.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should set startedAt when transitioning to in_progress', () => {
      const tool = tools.get('bulk_update_status')!;
      tool.handler({
        taskIds: [taskA],
        status: 'in_progress'
      });

      const task = taskRepo.findById(taskA)!;
      expect(task.startedAt).not.toBeNull();
    });

    it('should set completedAt when transitioning to completed', () => {
      const tool = tools.get('bulk_update_status')!;
      tool.handler({
        taskIds: [taskA],
        status: 'completed'
      });

      const task = taskRepo.findById(taskA)!;
      expect(task.completedAt).not.toBeNull();
    });

    it('should handle non-existent task IDs', () => {
      const tool = tools.get('bulk_update_status')!;
      const result = tool.handler({
        taskIds: [taskA, 'non-existent', taskB],
        status: 'ready'
      }) as { success: boolean; updatedCount: number; failedCount: number; failed: string[] };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failed).toContain('non-existent');
    });

    it('should return error for empty task IDs', () => {
      const tool = tools.get('bulk_update_status')!;
      const result = tool.handler({
        taskIds: [],
        status: 'ready'
      }) as { success: boolean; message: string };

      expect(result.success).toBe(false);
      expect(result.message).toContain('No task IDs provided');
    });
  });

  describe('bulk_update_priority', () => {
    it('should update priority for multiple tasks', () => {
      const tool = tools.get('bulk_update_priority')!;
      const result = tool.handler({
        taskIds: [taskA, taskB],
        priority: 'critical'
      }) as { success: boolean; updatedCount: number; priority: string };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
      expect(result.priority).toBe('critical');

      const tA = taskRepo.findById(taskA)!;
      const tB = taskRepo.findById(taskB)!;
      expect(tA.priority).toBe(Priority.CRITICAL);
      expect(tB.priority).toBe(Priority.CRITICAL);
    });

    it('should handle non-existent task IDs', () => {
      const tool = tools.get('bulk_update_priority')!;
      const result = tool.handler({
        taskIds: ['fake-id-1', 'fake-id-2'],
        priority: 'high'
      }) as { success: boolean; updatedCount: number; failedCount: number };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
      expect(result.failedCount).toBe(2);
    });
  });

  describe('bulk_set_assignee', () => {
    it('should set assignee for multiple tasks', () => {
      const tool = tools.get('bulk_set_assignee')!;
      const result = tool.handler({
        taskIds: [taskA, taskB, taskC],
        assignee: 'John Doe'
      }) as { success: boolean; updatedCount: number; assignee: string };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(result.assignee).toBe('John Doe');

      const tA = taskRepo.findById(taskA)!;
      const tB = taskRepo.findById(taskB)!;
      expect(tA.assignee).toBe('John Doe');
      expect(tB.assignee).toBe('John Doe');
    });

    it('should unassign when assignee not provided', () => {
      // First assign
      taskRepo.update(taskA, { assignee: 'Jane Doe' });

      const tool = tools.get('bulk_set_assignee')!;
      const result = tool.handler({
        taskIds: [taskA, taskB]
      }) as { success: boolean; assignee: string | null; message: string };

      expect(result.success).toBe(true);
      expect(result.assignee).toBeNull();
      expect(result.message).toContain('Unassigned');

      const tA = taskRepo.findById(taskA)!;
      expect(tA.assignee).toBeNull();
    });
  });

  describe('bulk_add_tag', () => {
    it('should add tag to multiple tasks', () => {
      const tool = tools.get('bulk_add_tag')!;
      const result = tool.handler({
        taskIds: [taskA, taskB, taskC],
        tag: 'urgent'
      }) as { success: boolean; updatedCount: number; tag: string };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(result.tag).toBe('urgent');

      const tA = taskRepo.findById(taskA)!;
      const tB = taskRepo.findById(taskB)!;
      const tC = taskRepo.findById(taskC)!;
      expect(tA.tags).toContain('urgent');
      expect(tB.tags).toContain('urgent');
      expect(tC.tags).toContain('urgent');
    });

    it('should normalize tag to lowercase', () => {
      const tool = tools.get('bulk_add_tag')!;
      const result = tool.handler({
        taskIds: [taskA],
        tag: 'URGENT'
      }) as { tag: string };

      expect(result.tag).toBe('urgent');

      const task = taskRepo.findById(taskA)!;
      expect(task.tags).toContain('urgent');
    });

    it('should not add duplicate tags', () => {
      taskRepo.addTag(taskA, 'existing');

      const tool = tools.get('bulk_add_tag')!;
      tool.handler({
        taskIds: [taskA],
        tag: 'existing'
      });

      const task = taskRepo.findById(taskA)!;
      expect(task.tags.filter(t => t === 'existing').length).toBe(1);
    });
  });

  describe('bulk_remove_tag', () => {
    it('should remove tag from multiple tasks', () => {
      // Add tags first
      taskRepo.addTag(taskA, 'remove-me');
      taskRepo.addTag(taskB, 'remove-me');
      taskRepo.addTag(taskC, 'keep-me');

      const tool = tools.get('bulk_remove_tag')!;
      const result = tool.handler({
        taskIds: [taskA, taskB, taskC],
        tag: 'remove-me'
      }) as { success: boolean; updatedCount: number; tag: string };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);

      const tA = taskRepo.findById(taskA)!;
      const tB = taskRepo.findById(taskB)!;
      const tC = taskRepo.findById(taskC)!;
      expect(tA.tags).not.toContain('remove-me');
      expect(tB.tags).not.toContain('remove-me');
      expect(tC.tags).toContain('keep-me');
    });

    it('should handle tasks without the tag gracefully', () => {
      const tool = tools.get('bulk_remove_tag')!;
      const result = tool.handler({
        taskIds: [taskA, taskB],
        tag: 'non-existent-tag'
      }) as { success: boolean; updatedCount: number };

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
    });
  });

  describe('bulk_delete', () => {
    it('should delete multiple tasks', () => {
      const tool = tools.get('bulk_delete')!;
      const result = tool.handler({
        taskIds: [taskA, taskB]
      }) as { success: boolean; deletedCount: number; deleted: string[] };

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.deleted).toContain(taskA);
      expect(result.deleted).toContain(taskB);

      // Verify tasks were deleted
      expect(taskRepo.findById(taskA)).toBeNull();
      expect(taskRepo.findById(taskB)).toBeNull();
      // Others should still exist
      expect(taskRepo.findById(taskC)).not.toBeNull();
      expect(taskRepo.findById(taskD)).not.toBeNull();
    });

    it('should handle non-existent task IDs', () => {
      const tool = tools.get('bulk_delete')!;
      const result = tool.handler({
        taskIds: [taskA, 'non-existent', taskB]
      }) as { success: boolean; deletedCount: number; failedCount: number; failed: string[] };

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failed).toContain('non-existent');
    });

    it('should return error for empty task IDs', () => {
      const tool = tools.get('bulk_delete')!;
      const result = tool.handler({
        taskIds: []
      }) as { success: boolean; message: string };

      expect(result.success).toBe(false);
      expect(result.message).toContain('No task IDs provided');
    });
  });

  describe('tool registration', () => {
    it('should register all bulk tools', () => {
      expect(tools.has('bulk_update_status')).toBe(true);
      expect(tools.has('bulk_update_priority')).toBe(true);
      expect(tools.has('bulk_set_assignee')).toBe(true);
      expect(tools.has('bulk_add_tag')).toBe(true);
      expect(tools.has('bulk_remove_tag')).toBe(true);
      expect(tools.has('bulk_delete')).toBe(true);
    });

    it('should have proper input schemas with array types', () => {
      const bulkStatus = tools.get('bulk_update_status')!;
      expect(bulkStatus.definition.inputSchema.properties.taskIds.type).toBe('array');
      expect(bulkStatus.definition.inputSchema.required).toContain('taskIds');
      expect(bulkStatus.definition.inputSchema.required).toContain('status');

      const bulkDelete = tools.get('bulk_delete')!;
      expect(bulkDelete.definition.inputSchema.properties.taskIds.type).toBe('array');
    });
  });
});
