import { ObjectiveStatus } from './enums.js';

/**
 * Objective entity - specific outcome within a goal
 */
export interface Objective {
  id: string;
  goalId: string;
  title: string;
  description: string;
  status: ObjectiveStatus;
  sequenceOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating an objective
 */
export interface CreateObjectiveInput {
  goalId: string;
  title: string;
  description?: string;
}

/**
 * Input for updating an objective
 */
export interface UpdateObjectiveInput {
  title?: string;
  description?: string;
  status?: ObjectiveStatus;
}
