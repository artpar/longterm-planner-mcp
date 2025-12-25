import { ToolRegistry } from './types.js';
import { DependencyRepository } from '../db/repositories/DependencyRepository.js';
import { TaskRepository } from '../db/repositories/TaskRepository.js';
import { EntityType, DependencyType } from '../models/enums.js';

/**
 * Register task dependency tools
 */
export function registerDependencyTools(
  registry: ToolRegistry,
  dependencyRepo: DependencyRepository,
  taskRepo: TaskRepository
): void {
  // add_dependency
  registry.register(
    'add_dependency',
    {
      description: 'Add a dependency between two tasks. The blocking task must be completed before the blocked task can start.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The task that will be blocked (cannot start until dependency is complete)'
          },
          dependsOnTaskId: {
            type: 'string',
            description: 'The task that blocks (must be completed first)'
          },
          dependencyType: {
            type: 'string',
            enum: ['blocks', 'required_by', 'related_to'],
            description: 'Type of dependency (default: blocks)'
          }
        },
        required: ['taskId', 'dependsOnTaskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const dependsOnTaskId = args.dependsOnTaskId as string;
      const dependencyType = (args.dependencyType as DependencyType) || DependencyType.BLOCKS;

      // Validate tasks exist
      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const dependsOnTask = taskRepo.findById(dependsOnTaskId);
      if (!dependsOnTask) {
        throw new Error(`Dependency task not found: ${dependsOnTaskId}`);
      }

      // Check tasks are in the same plan
      if (task.planId !== dependsOnTask.planId) {
        throw new Error('Tasks must be in the same plan to create a dependency');
      }

      // Check for self-dependency
      if (taskId === dependsOnTaskId) {
        throw new Error('A task cannot depend on itself');
      }

      // Check if dependency already exists
      if (dependencyRepo.exists(EntityType.TASK, dependsOnTaskId, EntityType.TASK, taskId)) {
        throw new Error('This dependency already exists');
      }

      // Check for circular dependency
      if (dependencyRepo.wouldCreateCycle(EntityType.TASK, dependsOnTaskId, EntityType.TASK, taskId)) {
        throw new Error('Adding this dependency would create a circular dependency');
      }

      // Create the dependency (source blocks target)
      const dependency = dependencyRepo.create({
        sourceType: EntityType.TASK,
        sourceId: dependsOnTaskId,
        targetType: EntityType.TASK,
        targetId: taskId,
        dependencyType
      });

      return {
        success: true,
        dependencyId: dependency.id,
        message: `Task "${task.title}" now depends on "${dependsOnTask.title}"`,
        blockedTask: { id: task.id, title: task.title },
        blockingTask: { id: dependsOnTask.id, title: dependsOnTask.title }
      };
    }
  );

  // remove_dependency
  registry.register(
    'remove_dependency',
    {
      description: 'Remove a dependency between two tasks',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The blocked task'
          },
          dependsOnTaskId: {
            type: 'string',
            description: 'The blocking task'
          }
        },
        required: ['taskId', 'dependsOnTaskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const dependsOnTaskId = args.dependsOnTaskId as string;

      const removed = dependencyRepo.deleteBetween(
        EntityType.TASK,
        dependsOnTaskId,
        EntityType.TASK,
        taskId
      );

      if (!removed) {
        throw new Error('Dependency not found');
      }

      return {
        success: true,
        message: 'Dependency removed successfully'
      };
    }
  );

  // get_dependencies
  registry.register(
    'get_dependencies',
    {
      description: 'Get all dependencies for a task (tasks that block it and tasks it blocks)',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to get dependencies for'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;

      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get tasks that block this task (this task depends on them)
      const blockers = dependencyRepo.getBlockers(EntityType.TASK, taskId);
      const blockingTasks = blockers.map(b => {
        const t = taskRepo.findById(b.id);
        return t ? { id: t.id, title: t.title, status: t.status } : null;
      }).filter(Boolean);

      // Get tasks that this task blocks (they depend on this task)
      const blocked = dependencyRepo.getBlocked(EntityType.TASK, taskId);
      const blockedTasks = blocked.map(b => {
        const t = taskRepo.findById(b.id);
        return t ? { id: t.id, title: t.title, status: t.status } : null;
      }).filter(Boolean);

      // Check if task can start (all blockers are completed/cancelled)
      const incompleteBlockers = blockingTasks.filter(
        t => t && t.status !== 'completed' && t.status !== 'cancelled'
      );

      return {
        task: { id: task.id, title: task.title, status: task.status },
        dependsOn: blockingTasks,
        blockedBy: blockedTasks,
        canStart: incompleteBlockers.length === 0,
        incompleteBlockers: incompleteBlockers.length
      };
    }
  );

  // get_dependency_chain
  registry.register(
    'get_dependency_chain',
    {
      description: 'Get the full dependency chain for a task (all transitive dependencies)',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to get dependency chain for'
          },
          direction: {
            type: 'string',
            enum: ['upstream', 'downstream'],
            description: 'Direction to traverse: upstream (tasks this depends on) or downstream (tasks that depend on this)'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const direction = (args.direction as 'upstream' | 'downstream') || 'upstream';

      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const chain = dependencyRepo.getDependencyChain(
        EntityType.TASK,
        taskId,
        direction
      );

      // Enrich with task details
      const enrichedChain = chain
        .filter(item => item.entity.type === EntityType.TASK)
        .map(item => {
          const t = taskRepo.findById(item.entity.id);
          return {
            id: item.entity.id,
            title: t?.title || 'Unknown',
            status: t?.status || 'unknown',
            depth: item.depth,
            dependencyType: item.dependencyType
          };
        });

      return {
        task: { id: task.id, title: task.title },
        direction,
        chain: enrichedChain,
        totalDependencies: enrichedChain.length
      };
    }
  );

  // check_can_start
  registry.register(
    'check_can_start',
    {
      description: 'Check if a task can be started based on its dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to check'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;

      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get all blocking tasks
      const blockers = dependencyRepo.getBlockers(EntityType.TASK, taskId);

      const blockingDetails = blockers.map(b => {
        const t = taskRepo.findById(b.id);
        if (!t) return null;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          isComplete: t.status === 'completed' || t.status === 'cancelled'
        };
      }).filter(Boolean);

      const incompleteBlockers = blockingDetails.filter(b => b && !b.isComplete);
      const canStart = incompleteBlockers.length === 0;

      return {
        task: { id: task.id, title: task.title, status: task.status },
        canStart,
        blockers: blockingDetails,
        incompleteBlockers: incompleteBlockers,
        message: canStart
          ? 'Task can be started - all dependencies are satisfied'
          : `Task cannot start - waiting on ${incompleteBlockers.length} task(s): ${incompleteBlockers.map(b => b?.title).join(', ')}`
      };
    }
  );
}
