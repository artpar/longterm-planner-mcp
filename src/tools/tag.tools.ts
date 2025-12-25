import { ToolRegistry } from './types.js';
import { TaskRepository } from '../db/repositories/TaskRepository.js';

/**
 * Register tag management tools
 */
export function registerTagTools(
  registry: ToolRegistry,
  taskRepo: TaskRepository
): void {
  // add_tag
  registry.register(
    'add_tag',
    {
      description: 'Add a tag to a task for categorization',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to add tag to'
          },
          tag: {
            type: 'string',
            description: 'Tag to add (will be normalized to lowercase)'
          }
        },
        required: ['taskId', 'tag']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const tag = args.tag as string;

      const task = taskRepo.addTag(taskId, tag);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      return {
        success: true,
        taskId: task.id,
        title: task.title,
        tags: task.tags,
        message: `Added tag "${tag.toLowerCase().trim()}" to task "${task.title}"`
      };
    }
  );

  // remove_tag
  registry.register(
    'remove_tag',
    {
      description: 'Remove a tag from a task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to remove tag from'
          },
          tag: {
            type: 'string',
            description: 'Tag to remove'
          }
        },
        required: ['taskId', 'tag']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const tag = args.tag as string;

      const task = taskRepo.removeTag(taskId, tag);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      return {
        success: true,
        taskId: task.id,
        title: task.title,
        tags: task.tags,
        message: `Removed tag "${tag.toLowerCase().trim()}" from task "${task.title}"`
      };
    }
  );

  // set_tags
  registry.register(
    'set_tags',
    {
      description: 'Set all tags for a task (replaces existing tags)',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to set tags for'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of tags to set'
          }
        },
        required: ['taskId', 'tags']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const tags = args.tags as string[];

      const task = taskRepo.setTags(taskId, tags);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      return {
        success: true,
        taskId: task.id,
        title: task.title,
        tags: task.tags,
        message: `Set ${task.tags.length} tag(s) on task "${task.title}"`
      };
    }
  );

  // get_tags
  registry.register(
    'get_tags',
    {
      description: 'Get all unique tags used in a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to get tags for'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const planId = args.planId as string;

      const tags = taskRepo.getAllTags(planId);

      return {
        planId,
        count: tags.length,
        tags
      };
    }
  );

  // find_by_tag
  registry.register(
    'find_by_tag',
    {
      description: 'Find all tasks with a specific tag',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to search in'
          },
          tag: {
            type: 'string',
            description: 'Tag to search for'
          }
        },
        required: ['planId', 'tag']
      }
    },
    (args) => {
      const planId = args.planId as string;
      const tag = args.tag as string;

      const tasks = taskRepo.findByTag(planId, tag);

      return {
        tag: tag.toLowerCase().trim(),
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          tags: t.tags
        }))
      };
    }
  );
}
