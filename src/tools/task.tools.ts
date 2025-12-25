import { ToolRegistry } from './types.js';
import { TaskService } from '../services/TaskService.js';
import { TaskStatus, Priority } from '../models/enums.js';

/**
 * Register task management tools
 */
export function registerTaskTools(
  registry: ToolRegistry,
  taskService: TaskService
): void {
  // add_task
  registry.register(
    'add_task',
    {
      description: 'Add a task to a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to add task to'
          },
          title: {
            type: 'string',
            description: 'Task title'
          },
          description: {
            type: 'string',
            description: 'Detailed description'
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'Task priority'
          },
          estimatedHours: {
            type: 'number',
            description: 'Estimated hours to complete'
          },
          dueDate: {
            type: 'string',
            description: 'Due date (ISO 8601 format)'
          },
          parentTaskId: {
            type: 'string',
            description: 'Parent task ID for subtasks'
          }
        },
        required: ['planId', 'title']
      }
    },
    (args) => {
      const task = taskService.createTask({
        planId: args.planId as string,
        title: args.title as string,
        description: args.description as string,
        priority: args.priority as Priority,
        estimatedHours: args.estimatedHours as number,
        dueDate: args.dueDate as string,
        parentTaskId: args.parentTaskId as string
      });

      return {
        taskId: task.id,
        title: task.title,
        status: task.status,
        message: `Created task "${task.title}"`
      };
    }
  );

  // update_task
  registry.register(
    'update_task',
    {
      description: 'Update task details',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to update'
          },
          title: {
            type: 'string',
            description: 'New title'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'New priority'
          },
          estimatedHours: {
            type: 'number',
            description: 'New estimated hours'
          },
          dueDate: {
            type: 'string',
            description: 'New due date'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const updated = taskService.updateTask(args.taskId as string, {
        title: args.title as string,
        description: args.description as string,
        priority: args.priority as Priority,
        estimatedHours: args.estimatedHours as number,
        dueDate: args.dueDate as string
      });

      if (!updated) {
        throw new Error(`Task not found: ${args.taskId}`);
      }

      return {
        taskId: updated.id,
        updated: true,
        task: updated
      };
    }
  );

  // start_task
  registry.register(
    'start_task',
    {
      description: 'Start working on a task (moves to in_progress)',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to start'
          },
          notes: {
            type: 'string',
            description: 'Notes about approach'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const result = taskService.startTask(args.taskId as string, args.notes as string);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        taskId: result.task!.id,
        status: result.task!.status,
        startedAt: result.task!.startedAt,
        message: `Started task "${result.task!.title}"`
      };
    }
  );

  // complete_task
  registry.register(
    'complete_task',
    {
      description: 'Complete a task with summary',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to complete'
          },
          summary: {
            type: 'string',
            description: 'Summary of what was accomplished'
          },
          actualHours: {
            type: 'number',
            description: 'Actual hours spent'
          }
        },
        required: ['taskId', 'summary']
      }
    },
    (args) => {
      const result = taskService.completeTask(args.taskId as string, {
        summary: args.summary as string,
        actualHours: args.actualHours as number
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        taskId: result.task!.id,
        status: result.task!.status,
        completedAt: result.task!.completedAt,
        message: `Completed task "${result.task!.title}"`
      };
    }
  );

  // block_task
  registry.register(
    'block_task',
    {
      description: 'Mark a task as blocked',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to block'
          },
          reason: {
            type: 'string',
            description: 'Reason for blocking'
          }
        },
        required: ['taskId', 'reason']
      }
    },
    (args) => {
      const result = taskService.blockTask(args.taskId as string, args.reason as string);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        taskId: result.task!.id,
        status: result.task!.status,
        message: `Blocked task "${result.task!.title}": ${args.reason}`
      };
    }
  );

  // unblock_task
  registry.register(
    'unblock_task',
    {
      description: 'Unblock a blocked task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to unblock'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const result = taskService.unblockTask(args.taskId as string);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        taskId: result.task!.id,
        status: result.task!.status,
        message: `Unblocked task "${result.task!.title}"`
      };
    }
  );

  // find_tasks
  registry.register(
    'find_tasks',
    {
      description: 'Search and filter tasks',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to search in'
          },
          status: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by status(es)'
          },
          priority: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by priority(ies)'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const tasks = taskService.getTasksForPlan(args.planId as string, {
        status: args.status as TaskStatus[],
        priority: args.priority as Priority[]
      });

      return {
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate
        })),
        count: tasks.length
      };
    }
  );

  // get_blocked
  registry.register(
    'get_blocked',
    {
      description: 'Get all blocked tasks for a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const blocked = taskService.getBlockedTasks(args.planId as string);

      return {
        blockedTasks: blocked.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority
        })),
        count: blocked.length
      };
    }
  );

  // get_progress
  registry.register(
    'get_progress',
    {
      description: 'Get progress statistics for a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const stats = taskService.getProgressStats(args.planId as string);

      return {
        ...stats,
        percentComplete: Math.round(stats.percentComplete * 100) / 100
      };
    }
  );

  // delete_task
  registry.register(
    'delete_task',
    {
      description: 'Delete a task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to delete'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const deleted = taskService.deleteTask(args.taskId as string);

      if (!deleted) {
        throw new Error(`Task not found: ${args.taskId}`);
      }

      return {
        taskId: args.taskId,
        deleted: true,
        message: 'Task deleted successfully'
      };
    }
  );

  // submit_for_review
  registry.register(
    'submit_for_review',
    {
      description: 'Submit an in-progress task for review',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to submit'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const result = taskService.transition(args.taskId as string, TaskStatus.REVIEW);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        taskId: result.task!.id,
        status: result.task!.status,
        message: `Submitted task "${result.task!.title}" for review`
      };
    }
  );
}
