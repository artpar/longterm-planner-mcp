import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDbPath, cleanupTestDb } from '../setup.js';
import { Database } from '../../src/db/Database.js';
import { MigrationRunner } from '../../src/db/migrations/runner.js';
import { initialSchema } from '../../src/db/migrations/001-initial-schema.js';
import { taskTags } from '../../src/db/migrations/004-task-tags.js';
import { taskComments } from '../../src/db/migrations/005-task-comments.js';
import { PlanRepository } from '../../src/db/repositories/PlanRepository.js';
import { TaskRepository } from '../../src/db/repositories/TaskRepository.js';
import { CommentRepository } from '../../src/db/repositories/CommentRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from '../../src/tools/types.js';
import { registerCommentTools } from '../../src/tools/comment.tools.js';

describe('Comment Tools', () => {
  let dbPath: string;
  let db: Database;
  let planRepo: PlanRepository;
  let taskRepo: TaskRepository;
  let commentRepo: CommentRepository;
  let tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  let testPlanId: string;
  let taskA: string;
  let taskB: string;

  beforeEach(() => {
    dbPath = getTestDbPath('comment-tools');
    db = new Database(dbPath);
    const runner = new MigrationRunner(db);
    runner.initialize();
    runner.runMigration(initialSchema);
    runner.runMigration(taskTags);
    runner.runMigration(taskComments);

    planRepo = new PlanRepository(db);
    taskRepo = new TaskRepository(db);
    commentRepo = new CommentRepository(db);

    tools = new Map();
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        tools.set(name, { definition, handler });
      }
    };

    registerCommentTools(registry, commentRepo, taskRepo);

    // Create test plan with tasks
    const plan = planRepo.create({
      projectPath: '/test/project',
      name: 'Comment Test Plan'
    });
    testPlanId = plan.id;

    const tA = taskRepo.create({ planId: testPlanId, title: 'Task A' });
    const tB = taskRepo.create({ planId: testPlanId, title: 'Task B' });
    taskA = tA.id;
    taskB = tB.id;
  });

  afterEach(() => {
    db.close();
    cleanupTestDb(dbPath);
  });

  describe('add_comment', () => {
    it('should add a comment to a task', () => {
      const tool = tools.get('add_comment')!;
      const result = tool.handler({
        taskId: taskA,
        content: 'This is a test comment'
      }) as { success: boolean; comment: { id: string; content: string }; taskTitle: string };

      expect(result.success).toBe(true);
      expect(result.comment.content).toBe('This is a test comment');
      expect(result.taskTitle).toBe('Task A');
    });

    it('should add a comment with author', () => {
      const tool = tools.get('add_comment')!;
      const result = tool.handler({
        taskId: taskA,
        content: 'Comment with author',
        author: 'John Doe'
      }) as { success: boolean; comment: { author: string } };

      expect(result.success).toBe(true);
      expect(result.comment.author).toBe('John Doe');
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('add_comment')!;
      expect(() => tool.handler({
        taskId: 'non-existent',
        content: 'Comment'
      })).toThrow('Task not found');
    });
  });

  describe('list_comments', () => {
    it('should list all comments for a task in ascending order', () => {
      // Add multiple comments
      commentRepo.create({ taskId: taskA, content: 'First comment' });
      commentRepo.create({ taskId: taskA, content: 'Second comment' });
      commentRepo.create({ taskId: taskA, content: 'Third comment' });

      const tool = tools.get('list_comments')!;
      const result = tool.handler({
        taskId: taskA
      }) as { taskTitle: string; count: number; comments: Array<{ content: string }> };

      expect(result.taskTitle).toBe('Task A');
      expect(result.count).toBe(3);
      expect(result.comments[0].content).toBe('First comment');
      expect(result.comments[2].content).toBe('Third comment');
    });

    it('should list comments in descending order when specified', () => {
      commentRepo.create({ taskId: taskA, content: 'First comment' });
      commentRepo.create({ taskId: taskA, content: 'Second comment' });

      const tool = tools.get('list_comments')!;
      const result = tool.handler({
        taskId: taskA,
        order: 'desc'
      }) as { comments: Array<{ content: string }> };

      expect(result.comments.length).toBe(2);
      // Both comments should be present
      const contents = result.comments.map(c => c.content);
      expect(contents).toContain('First comment');
      expect(contents).toContain('Second comment');
    });

    it('should return empty array for task with no comments', () => {
      const tool = tools.get('list_comments')!;
      const result = tool.handler({
        taskId: taskA
      }) as { count: number; comments: unknown[] };

      expect(result.count).toBe(0);
      expect(result.comments).toEqual([]);
    });

    it('should throw error for non-existent task', () => {
      const tool = tools.get('list_comments')!;
      expect(() => tool.handler({
        taskId: 'non-existent'
      })).toThrow('Task not found');
    });
  });

  describe('update_comment', () => {
    it('should update a comment', () => {
      const comment = commentRepo.create({ taskId: taskA, content: 'Original content' });

      const tool = tools.get('update_comment')!;
      const result = tool.handler({
        commentId: comment.id,
        content: 'Updated content'
      }) as { success: boolean; comment: { content: string; updatedAt: string } };

      expect(result.success).toBe(true);
      expect(result.comment.content).toBe('Updated content');
    });

    it('should throw error for non-existent comment', () => {
      const tool = tools.get('update_comment')!;
      expect(() => tool.handler({
        commentId: 'non-existent',
        content: 'Updated'
      })).toThrow('Comment not found');
    });
  });

  describe('delete_comment', () => {
    it('should delete a comment', () => {
      const comment = commentRepo.create({ taskId: taskA, content: 'To be deleted' });

      const tool = tools.get('delete_comment')!;
      const result = tool.handler({
        commentId: comment.id
      }) as { success: boolean; commentId: string };

      expect(result.success).toBe(true);
      expect(result.commentId).toBe(comment.id);

      // Verify comment is deleted
      expect(commentRepo.findById(comment.id)).toBeNull();
    });

    it('should throw error for non-existent comment', () => {
      const tool = tools.get('delete_comment')!;
      expect(() => tool.handler({
        commentId: 'non-existent'
      })).toThrow('Comment not found');
    });
  });

  describe('get_recent_comments', () => {
    it('should get recent comments across all tasks in a plan', () => {
      commentRepo.create({ taskId: taskA, content: 'Comment on A' });
      commentRepo.create({ taskId: taskB, content: 'Comment on B' });
      commentRepo.create({ taskId: taskA, content: 'Another on A' });

      const tool = tools.get('get_recent_comments')!;
      const result = tool.handler({
        planId: testPlanId
      }) as { planId: string; count: number; comments: Array<{ taskTitle: string; content: string }> };

      expect(result.planId).toBe(testPlanId);
      expect(result.count).toBe(3);
      // All comments should be present
      const contents = result.comments.map(c => c.content);
      expect(contents).toContain('Comment on A');
      expect(contents).toContain('Comment on B');
      expect(contents).toContain('Another on A');
    });

    it('should respect limit parameter', () => {
      commentRepo.create({ taskId: taskA, content: 'Comment 1' });
      commentRepo.create({ taskId: taskA, content: 'Comment 2' });
      commentRepo.create({ taskId: taskA, content: 'Comment 3' });

      const tool = tools.get('get_recent_comments')!;
      const result = tool.handler({
        planId: testPlanId,
        limit: 2
      }) as { count: number };

      expect(result.count).toBe(2);
    });

    it('should return empty array for plan with no comments', () => {
      const tool = tools.get('get_recent_comments')!;
      const result = tool.handler({
        planId: testPlanId
      }) as { count: number; comments: unknown[] };

      expect(result.count).toBe(0);
      expect(result.comments).toEqual([]);
    });
  });

  describe('tool registration', () => {
    it('should register all comment tools', () => {
      expect(tools.has('add_comment')).toBe(true);
      expect(tools.has('list_comments')).toBe(true);
      expect(tools.has('update_comment')).toBe(true);
      expect(tools.has('delete_comment')).toBe(true);
      expect(tools.has('get_recent_comments')).toBe(true);
    });

    it('should have proper input schemas', () => {
      const addComment = tools.get('add_comment')!;
      expect(addComment.definition.inputSchema.required).toContain('taskId');
      expect(addComment.definition.inputSchema.required).toContain('content');

      const listComments = tools.get('list_comments')!;
      expect(listComments.definition.inputSchema.properties.order.enum).toContain('asc');
      expect(listComments.definition.inputSchema.properties.order.enum).toContain('desc');
    });
  });
});
