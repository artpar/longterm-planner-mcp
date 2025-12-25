import { PlanStatus } from './enums.js';

/**
 * Context preserved across sessions for a plan
 */
export interface PlanContext {
  summary: string;
  keyDecisions: string[];
  assumptions: string[];
  constraints: string[];
  risks: string[];
  lastSessionNotes: string;
}

/**
 * Plan entity - top-level container for planning
 */
export interface Plan {
  id: string;
  projectPath: string;
  name: string;
  description: string;
  status: PlanStatus;
  startDate: string | null;
  targetDate: string | null;
  context: PlanContext;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new plan
 */
export interface CreatePlanInput {
  projectPath: string;
  name: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
}

/**
 * Input for updating a plan
 */
export interface UpdatePlanInput {
  name?: string;
  description?: string;
  status?: PlanStatus;
  startDate?: string | null;
  targetDate?: string | null;
  context?: Partial<PlanContext>;
}

/**
 * Default empty context
 */
export function createEmptyContext(): PlanContext {
  return {
    summary: '',
    keyDecisions: [],
    assumptions: [],
    constraints: [],
    risks: [],
    lastSessionNotes: ''
  };
}
