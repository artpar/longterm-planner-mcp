import { TaskRepository, TaskFilter } from '../db/repositories/TaskRepository.js';
import { Task, CreateTaskInput, UpdateTaskInput } from '../models/Task.js';
import { TaskStatus } from '../models/enums.js';
import { TaskStateMachine } from './StateMachine.js';

/**
 * Result of a task operation
 */
export interface TaskOperationResult {
  success: boolean;
  task?: Task;
  error?: string;
}

/**
 * Completion input for tasks
 */
export interface CompleteTaskInput {
  summary: string;
  actualHours?: number;
  learnings?: string;
}

/**
 * Progress statistics for a plan
 */
export interface ProgressStats {
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  ready: number;
  backlog: number;
  percentComplete: number;
}

/**
 * Service for task management with state machine enforcement
 */
export class TaskService {
  private repo: TaskRepository;
  private stateMachine: TaskStateMachine;

  constructor(repo: TaskRepository) {
    this.repo = repo;
    this.stateMachine = new TaskStateMachine();
  }

  /**
   * Create a new task
   */
  createTask(input: CreateTaskInput): Task {
    return this.repo.create(input);
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | null {
    return this.repo.findById(taskId);
  }

  /**
   * Update a task (non-status fields)
   */
  updateTask(taskId: string, input: Omit<UpdateTaskInput, 'status'>): Task | null {
    return this.repo.update(taskId, input);
  }

  /**
   * Transition task to a new status
   */
  transition(taskId: string, newStatus: TaskStatus): TaskOperationResult {
    const task = this.repo.findById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const result = this.stateMachine.transition(task.status, newStatus);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const updated = this.repo.update(taskId, { status: newStatus });
    return { success: true, task: updated! };
  }

  /**
   * Start a task (move to in_progress)
   * If task is in backlog, first moves to ready, then to in_progress
   */
  startTask(taskId: string, notes?: string): TaskOperationResult {
    const task = this.repo.findById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // If in backlog, first move to ready
    if (task.status === TaskStatus.BACKLOG) {
      const readyResult = this.transition(taskId, TaskStatus.READY);
      if (!readyResult.success) {
        return readyResult;
      }
    }

    // Now transition to in_progress
    const result = this.transition(taskId, TaskStatus.IN_PROGRESS);

    // Add notes if provided
    if (result.success && notes && result.task) {
      const context = { ...result.task.context, notes };
      this.repo.update(taskId, { context });
      return { ...result, task: this.repo.findById(taskId)! };
    }

    return result;
  }

  /**
   * Complete a task with summary
   */
  completeTask(taskId: string, input: CompleteTaskInput): TaskOperationResult {
    const task = this.repo.findById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Must be in review to complete
    if (task.status !== TaskStatus.REVIEW) {
      return { success: false, error: 'Task must be in review to complete' };
    }

    const result = this.transition(taskId, TaskStatus.COMPLETED);

    if (result.success) {
      // Update with completion details
      const updates: UpdateTaskInput = {};
      if (input.actualHours !== undefined) {
        updates.actualHours = input.actualHours;
      }

      const context = {
        ...task.context,
        notes: task.context.notes + '\n\nCompletion: ' + input.summary
      };
      updates.context = context;

      this.repo.update(taskId, updates);
      return { ...result, task: this.repo.findById(taskId)! };
    }

    return result;
  }

  /**
   * Block a task with reason
   */
  blockTask(taskId: string, reason: string): TaskOperationResult {
    const result = this.transition(taskId, TaskStatus.BLOCKED);

    if (result.success && result.task) {
      const context = {
        ...result.task.context,
        notes: result.task.context.notes + '\n\nBlocked: ' + reason
      };
      this.repo.update(taskId, { context });
      return { ...result, task: this.repo.findById(taskId)! };
    }

    return result;
  }

  /**
   * Unblock a task
   */
  unblockTask(taskId: string): TaskOperationResult {
    return this.transition(taskId, TaskStatus.IN_PROGRESS);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): TaskOperationResult {
    return this.transition(taskId, TaskStatus.CANCELLED);
  }

  /**
   * Get all tasks for a plan with optional filters
   */
  getTasksForPlan(planId: string, filter?: TaskFilter): Task[] {
    return this.repo.findByPlanId(planId, filter);
  }

  /**
   * Get subtasks of a parent task
   */
  getSubtasks(parentTaskId: string): Task[] {
    return this.repo.findSubtasks(parentTaskId);
  }

  /**
   * Get blocked tasks for a plan
   */
  getBlockedTasks(planId: string): Task[] {
    return this.repo.findBlocked(planId);
  }

  /**
   * Get ready tasks for a plan
   */
  getReadyTasks(planId: string): Task[] {
    return this.repo.findReady(planId);
  }

  /**
   * Get in-progress tasks for a plan
   */
  getInProgressTasks(planId: string): Task[] {
    return this.repo.findInProgress(planId);
  }

  /**
   * Get progress statistics for a plan
   */
  getProgressStats(planId: string): ProgressStats {
    const counts = this.repo.countByStatus(planId);

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const completed = counts.completed;

    return {
      total,
      completed,
      inProgress: counts.in_progress,
      blocked: counts.blocked,
      ready: counts.ready,
      backlog: counts.backlog,
      percentComplete: total > 0 ? (completed / total) * 100 : 0
    };
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    return this.repo.delete(taskId);
  }

  /**
   * Get available status transitions for a task
   */
  getAvailableTransitions(taskId: string): TaskStatus[] {
    const task = this.repo.findById(taskId);
    if (!task) return [];
    return this.stateMachine.getAvailableTransitions(task.status);
  }
}
