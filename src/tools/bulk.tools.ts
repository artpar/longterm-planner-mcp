import { ToolRegistry } from './types.js';
import { TaskRepository } from '../db/repositories/TaskRepository.js';
import { TaskStatus, Priority } from '../models/enums.js';

/**
 * Register bulk operation tools
 */
export function registerBulkTools(
  registry: ToolRegistry,
  taskRepo: TaskRepository
): void {
  // bulk_update_status
  registry.register(
    'bulk_update_status',
    {
      description: 'Update the status of multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to update'
          },
          status: {
            type: 'string',
            enum: ['backlog', 'ready', 'in_progress', 'review', 'blocked', 'completed', 'cancelled'],
            description: 'New status to set for all tasks'
          }
        },
        required: ['taskIds', 'status']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];
      const status = args.status as TaskStatus;

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkUpdateStatus(taskIds, status);

      return {
        success: true,
        status,
        updatedCount: result.updated.length,
        failedCount: result.failed.length,
        updated: result.updated.map(t => ({ id: t.id, title: t.title, status: t.status })),
        failed: result.failed,
        message: `Updated ${result.updated.length} task(s) to status "${status}"${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );

  // bulk_update_priority
  registry.register(
    'bulk_update_priority',
    {
      description: 'Update the priority of multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to update'
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
            description: 'New priority to set for all tasks'
          }
        },
        required: ['taskIds', 'priority']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];
      const priority = args.priority as Priority;

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkUpdatePriority(taskIds, priority);

      return {
        success: true,
        priority,
        updatedCount: result.updated.length,
        failedCount: result.failed.length,
        updated: result.updated.map(t => ({ id: t.id, title: t.title, priority: t.priority })),
        failed: result.failed,
        message: `Updated ${result.updated.length} task(s) to priority "${priority}"${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );

  // bulk_set_assignee
  registry.register(
    'bulk_set_assignee',
    {
      description: 'Set the assignee for multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to update'
          },
          assignee: {
            type: 'string',
            description: 'Assignee name to set (or null to unassign)'
          }
        },
        required: ['taskIds']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];
      const assignee = (args.assignee as string | undefined) ?? null;

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkUpdateAssignee(taskIds, assignee);

      return {
        success: true,
        assignee,
        updatedCount: result.updated.length,
        failedCount: result.failed.length,
        updated: result.updated.map(t => ({ id: t.id, title: t.title, assignee: t.assignee })),
        failed: result.failed,
        message: assignee
          ? `Assigned ${result.updated.length} task(s) to "${assignee}"${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
          : `Unassigned ${result.updated.length} task(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );

  // bulk_add_tag
  registry.register(
    'bulk_add_tag',
    {
      description: 'Add a tag to multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to update'
          },
          tag: {
            type: 'string',
            description: 'Tag to add to all tasks'
          }
        },
        required: ['taskIds', 'tag']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];
      const tag = args.tag as string;

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkAddTag(taskIds, tag);
      const normalizedTag = tag.toLowerCase().trim();

      return {
        success: true,
        tag: normalizedTag,
        updatedCount: result.updated.length,
        failedCount: result.failed.length,
        updated: result.updated.map(t => ({ id: t.id, title: t.title, tags: t.tags })),
        failed: result.failed,
        message: `Added tag "${normalizedTag}" to ${result.updated.length} task(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );

  // bulk_remove_tag
  registry.register(
    'bulk_remove_tag',
    {
      description: 'Remove a tag from multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to update'
          },
          tag: {
            type: 'string',
            description: 'Tag to remove from all tasks'
          }
        },
        required: ['taskIds', 'tag']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];
      const tag = args.tag as string;

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkRemoveTag(taskIds, tag);
      const normalizedTag = tag.toLowerCase().trim();

      return {
        success: true,
        tag: normalizedTag,
        updatedCount: result.updated.length,
        failedCount: result.failed.length,
        updated: result.updated.map(t => ({ id: t.id, title: t.title, tags: t.tags })),
        failed: result.failed,
        message: `Removed tag "${normalizedTag}" from ${result.updated.length} task(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );

  // bulk_delete
  registry.register(
    'bulk_delete',
    {
      description: 'Delete multiple tasks at once',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs to delete'
          }
        },
        required: ['taskIds']
      }
    },
    (args) => {
      const taskIds = args.taskIds as string[];

      if (taskIds.length === 0) {
        return { success: false, message: 'No task IDs provided' };
      }

      const result = taskRepo.bulkDelete(taskIds);

      return {
        success: true,
        deletedCount: result.deleted.length,
        failedCount: result.failed.length,
        deleted: result.deleted,
        failed: result.failed,
        message: `Deleted ${result.deleted.length} task(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      };
    }
  );
}
