import { MilestoneStatus } from './enums.js';

/**
 * Milestone entity - specific deliverable within an objective
 */
export interface Milestone {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a milestone
 */
export interface CreateMilestoneInput {
  objectiveId: string;
  title: string;
  description?: string;
  dueDate?: string;
}

/**
 * Input for updating a milestone
 */
export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  status?: MilestoneStatus;
  dueDate?: string | null;
}
