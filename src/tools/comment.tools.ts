import { ToolRegistry } from './types.js';
import { CommentRepository } from '../db/repositories/CommentRepository.js';
import { TaskRepository } from '../db/repositories/TaskRepository.js';

/**
 * Register comment/note tools
 */
export function registerCommentTools(
  registry: ToolRegistry,
  commentRepo: CommentRepository,
  taskRepo: TaskRepository
): void {
  // add_comment
  registry.register(
    'add_comment',
    {
      description: 'Add a comment or note to a task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to add comment to'
          },
          content: {
            type: 'string',
            description: 'The comment/note content'
          },
          author: {
            type: 'string',
            description: 'Author of the comment (optional)'
          }
        },
        required: ['taskId', 'content']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const content = args.content as string;
      const author = args.author as string | undefined;

      // Verify task exists
      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const comment = commentRepo.create({
        taskId,
        content,
        author
      });

      return {
        success: true,
        comment: {
          id: comment.id,
          taskId: comment.taskId,
          content: comment.content,
          author: comment.author,
          createdAt: comment.createdAt
        },
        taskTitle: task.title,
        message: `Added comment to task "${task.title}"`
      };
    }
  );

  // list_comments
  registry.register(
    'list_comments',
    {
      description: 'List all comments/notes for a task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to get comments for'
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Order by creation time (asc=oldest first, desc=newest first). Default: asc'
          }
        },
        required: ['taskId']
      }
    },
    (args) => {
      const taskId = args.taskId as string;
      const order = (args.order as string) || 'asc';

      // Verify task exists
      const task = taskRepo.findById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const comments = order === 'desc'
        ? commentRepo.findByTaskIdDesc(taskId)
        : commentRepo.findByTaskId(taskId);

      return {
        taskId,
        taskTitle: task.title,
        count: comments.length,
        comments: comments.map(c => ({
          id: c.id,
          content: c.content,
          author: c.author,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      };
    }
  );

  // update_comment
  registry.register(
    'update_comment',
    {
      description: 'Update an existing comment',
      inputSchema: {
        type: 'object',
        properties: {
          commentId: {
            type: 'string',
            description: 'Comment ID to update'
          },
          content: {
            type: 'string',
            description: 'New content for the comment'
          }
        },
        required: ['commentId', 'content']
      }
    },
    (args) => {
      const commentId = args.commentId as string;
      const content = args.content as string;

      const comment = commentRepo.update(commentId, { content });
      if (!comment) {
        throw new Error(`Comment not found: ${commentId}`);
      }

      return {
        success: true,
        comment: {
          id: comment.id,
          taskId: comment.taskId,
          content: comment.content,
          author: comment.author,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt
        },
        message: 'Comment updated successfully'
      };
    }
  );

  // delete_comment
  registry.register(
    'delete_comment',
    {
      description: 'Delete a comment from a task',
      inputSchema: {
        type: 'object',
        properties: {
          commentId: {
            type: 'string',
            description: 'Comment ID to delete'
          }
        },
        required: ['commentId']
      }
    },
    (args) => {
      const commentId = args.commentId as string;

      const deleted = commentRepo.delete(commentId);
      if (!deleted) {
        throw new Error(`Comment not found: ${commentId}`);
      }

      return {
        success: true,
        commentId,
        message: 'Comment deleted successfully'
      };
    }
  );

  // get_recent_comments
  registry.register(
    'get_recent_comments',
    {
      description: 'Get recent comments across all tasks in a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to get recent comments for'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of comments to return (default: 10)'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const planId = args.planId as string;
      const limit = (args.limit as number) || 10;

      const comments = commentRepo.findRecentByPlanId(planId, limit);

      return {
        planId,
        count: comments.length,
        comments: comments.map(c => ({
          id: c.id,
          taskId: c.taskId,
          taskTitle: c.taskTitle,
          content: c.content,
          author: c.author,
          createdAt: c.createdAt
        }))
      };
    }
  );
}
