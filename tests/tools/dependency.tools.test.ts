import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { DependencyRepository } from '../../src/db/repositories/DependencyRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerDependencyTools } from '../../src/tools/dependency.tools.js';

describe('Dependency Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let dependencyRepo: DependencyRepository;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  let testPlanId: string;
  let taskA: string;
  let taskB: string;
  let taskC: string;

  beforeEach(() => {
    dbPath = getTestDbPath('dependency-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);

    planRepo = new PlanRepository(db);
    taskRepo = new TaskRepository(db);
    dependencyRepo = new DependencyRepository(db);

    tools = new Map();
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        tools.set(name, { definition, handler });
      }
    };

    registerDependencyTools(registry, dependencyRepo, taskRepo);

    // Create test plan with tasks
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Dependency Test Plan'
    });
    testPlanId = plan.id;

    // Create three tasks for testing dependencies
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

  describe('add_dependency', () => {
    it('should add a dependency between two tasks', () => {
      const tool = tools.get('add_dependency')!;
      const result = tool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      }) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain('Task B');
      expect(result.message).toContain('Task A');
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('add_dependency')!;

      expect(() => {
        tool.handler({
          taskId: 'non-existent',
          dependsOnTaskId: taskA
        });
      }).toThrow('Task not found');
    });

    it('should throw error for non-existent dependency task', () => {
      const tool = tools.get('add_dependency')!;

      expect(() => {
        tool.handler({
          taskId: taskB,
          dependsOnTaskId: 'non-existent'
        });
      }).toThrow('Dependency task not found');
    });

    it('should throw error for self-dependency', () => {
      const tool = tools.get('add_dependency')!;

      expect(() => {
        tool.handler({
          taskId: taskA,
          dependsOnTaskId: taskA
        });
      }).toThrow('cannot depend on itself');
    });

    it('should throw error for duplicate dependency', () => {
      const tool = tools.get('add_dependency')!;

      // Add first dependency
      tool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      });

      // Try to add duplicate
      expect(() => {
        tool.handler({
          taskId: taskB,
          dependsOnTaskId: taskA
        });
      }).toThrow('already exists');
    });

    it('should throw error for circular dependency', () => {
      const tool = tools.get('add_dependency')!;

      // A -> B (B depends on A)
      tool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      });

      // B -> C (C depends on B)
      tool.handler({
        taskId: taskC,
        dependsOnTaskId: taskB
      });

      // Try C -> A (A depends on C) - would create cycle A -> B -> C -> A
      expect(() => {
        tool.handler({
          taskId: taskA,
          dependsOnTaskId: taskC
        });
      }).toThrow('circular dependency');
    });

    it('should prevent tasks from different plans', () => {
      // Create another plan with a task
      const plan2 = planRepo.create({
        projectPath: '/test/project2',
        name: 'Other Plan'
      });
      const otherTask = taskRepo.create({ planId: plan2.id, title: 'Other Task' });

      const tool = tools.get('add_dependency')!;

      expect(() => {
        tool.handler({
          taskId: taskA,
          dependsOnTaskId: otherTask.id
        });
      }).toThrow('same plan');
    });
  });

  describe('remove_dependency', () => {
    it('should remove an existing dependency', () => {
      const addTool = tools.get('add_dependency')!;
      const removeTool = tools.get('remove_dependency')!;

      // Add dependency first
      addTool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      });

      // Remove it
      const result = removeTool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      }) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent dependency', () => {
      const tool = tools.get('remove_dependency')!;

      expect(() => {
        tool.handler({
          taskId: taskB,
          dependsOnTaskId: taskA
        });
      }).toThrow('Dependency not found');
    });
  });

  describe('get_dependencies', () => {
    it('should return dependencies for a task', () => {
      const addTool = tools.get('add_dependency')!;
      const getTool = tools.get('get_dependencies')!;

      // B depends on A
      addTool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      });

      // C depends on B
      addTool.handler({
        taskId: taskC,
        dependsOnTaskId: taskB
      });

      // Get dependencies for B
      const result = getTool.handler({ taskId: taskB }) as {
        dependsOn: Array<{ id: string }>;
        blockedBy: Array<{ id: string }>;
        canStart: boolean;
      };

      expect(result.dependsOn.length).toBe(1);
      expect(result.dependsOn[0].id).toBe(taskA);
      expect(result.blockedBy.length).toBe(1);
      expect(result.blockedBy[0].id).toBe(taskC);
    });

    it('should correctly report canStart status', () => {
      const addTool = tools.get('add_dependency')!;
      const getTool = tools.get('get_dependencies')!;

      // B depends on A (A is not complete)
      addTool.handler({
        taskId: taskB,
        dependsOnTaskId: taskA
      });

      let result = getTool.handler({ taskId: taskB }) as { canStart: boolean };
      expect(result.canStart).toBe(false);

      // Complete task A
      taskRepo.update(taskA, { status: 'completed' });

      result = getTool.handler({ taskId: taskB }) as { canStart: boolean };
      expect(result.canStart).toBe(true);
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('get_dependencies')!;

      expect(() => {
        tool.handler({ taskId: 'non-existent' });
      }).toThrow('Task not found');
    });
  });

  describe('get_dependency_chain', () => {
    it('should return upstream dependency chain', () => {
      const addTool = tools.get('add_dependency')!;
      const chainTool = tools.get('get_dependency_chain')!;

      // A -> B -> C (C depends on B, B depends on A)
      addTool.handler({ taskId: taskB, dependsOnTaskId: taskA });
      addTool.handler({ taskId: taskC, dependsOnTaskId: taskB });

      const result = chainTool.handler({
        taskId: taskC,
        direction: 'upstream'
      }) as { chain: Array<{ id: string; depth: number }> };

      expect(result.chain.length).toBe(2);
      expect(result.chain.find(c => c.id === taskB)?.depth).toBe(1);
      expect(result.chain.find(c => c.id === taskA)?.depth).toBe(2);
    });

    it('should return downstream dependency chain', () => {
      const addTool = tools.get('add_dependency')!;
      const chainTool = tools.get('get_dependency_chain')!;

      // A -> B -> C
      addTool.handler({ taskId: taskB, dependsOnTaskId: taskA });
      addTool.handler({ taskId: taskC, dependsOnTaskId: taskB });

      const result = chainTool.handler({
        taskId: taskA,
        direction: 'downstream'
      }) as { chain: Array<{ id: string; depth: number }> };

      expect(result.chain.length).toBe(2);
      expect(result.chain.find(c => c.id === taskB)?.depth).toBe(1);
      expect(result.chain.find(c => c.id === taskC)?.depth).toBe(2);
    });
  });

  describe('check_can_start', () => {
    it('should return true when no dependencies', () => {
      const tool = tools.get('check_can_start')!;

      const result = tool.handler({ taskId: taskA }) as {
        canStart: boolean;
        blockers: unknown[];
      };

      expect(result.canStart).toBe(true);
      expect(result.blockers.length).toBe(0);
    });

    it('should return false with incomplete dependencies', () => {
      const addTool = tools.get('add_dependency')!;
      const checkTool = tools.get('check_can_start')!;

      addTool.handler({ taskId: taskB, dependsOnTaskId: taskA });

      const result = checkTool.handler({ taskId: taskB }) as {
        canStart: boolean;
        incompleteBlockers: Array<{ id: string }>;
        message: string;
      };

      expect(result.canStart).toBe(false);
      expect(result.incompleteBlockers.length).toBe(1);
      expect(result.message).toContain('Task A');
    });

    it('should return true when all dependencies completed', () => {
      const addTool = tools.get('add_dependency')!;
      const checkTool = tools.get('check_can_start')!;

      addTool.handler({ taskId: taskB, dependsOnTaskId: taskA });

      // Complete A
      taskRepo.update(taskA, { status: 'completed' });

      const result = checkTool.handler({ taskId: taskB }) as {
        canStart: boolean;
        message: string;
      };

      expect(result.canStart).toBe(true);
      expect(result.message).toContain('all dependencies are satisfied');
    });

    it('should count cancelled tasks as complete', () => {
      const addTool = tools.get('add_dependency')!;
      const checkTool = tools.get('check_can_start')!;

      addTool.handler({ taskId: taskB, dependsOnTaskId: taskA });

      // Cancel A
      taskRepo.update(taskA, { status: 'cancelled' });

      const result = checkTool.handler({ taskId: taskB }) as { canStart: boolean };

      expect(result.canStart).toBe(true);
    });
  });
});
