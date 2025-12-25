import { GoalStatus, Priority } from './enums.js';

/**
 * Key Result for OKR-style goal tracking
 */
export interface KeyResult {
  id: string;
  description: string;
  targetValue: number | null;
  currentValue: number | null;
  completed: boolean;
}

/**
 * Goal entity - high-level objective within a plan
 */
export interface Goal {
  id: string;
  planId: string;
  parentGoalId: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: GoalStatus;
  targetDate: string | null;
  progressPercent: number;
  keyResults: KeyResult[];
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a goal
 */
export interface CreateGoalInput {
  planId: string;
  parentGoalId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  targetDate?: string;
  keyResults?: string[];
}

/**
 * Input for updating a goal
 */
export interface UpdateGoalInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: GoalStatus;
  targetDate?: string | null;
  progressPercent?: number;
  keyResults?: KeyResult[];
}
