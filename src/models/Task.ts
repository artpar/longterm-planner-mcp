import { TaskStatus, Priority } from './enums.js';

/**
 * Context preserved for a task
 */
export interface TaskContext {
  acceptanceCriteria: string[];
  notes: string;
  filesInvolved: string[];
  sessionHistory: SessionNote[];
}

/**
 * Session note entry
 */
export interface SessionNote {
  timestamp: string;
  summary: string;
  changesMade: string[];
}

/**
 * Task entity - actionable work item
 */
export interface Task {
  id: string;
  planId: string;
  goalId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  estimatedHours: number | null;
  actualHours: number | null;
  assignee: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  context: TaskContext;
  tags: string[];
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a task
 */
export interface CreateTaskInput {
  planId: string;
  goalId?: string;
  milestoneId?: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  estimatedHours?: number;
  assignee?: string;
  dueDate?: string;
}

/**
 * Input for updating a task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  estimatedHours?: number | null;
  actualHours?: number | null;
  assignee?: string | null;
  dueDate?: string | null;
  context?: Partial<TaskContext>;
}

/**
 * Default empty task context
 */
export function createEmptyTaskContext(): TaskContext {
  return {
    acceptanceCriteria: [],
    notes: '',
    filesInvolved: [],
    sessionHistory: []
  };
}
