import { EntityType, ProgressAction } from './enums.js';

/**
 * Progress log entry
 */
export interface ProgressLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  sessionId: string | null;
  action: ProgressAction;
  message: string;
  progressDelta: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Input for logging progress
 */
export interface CreateProgressLogInput {
  entityType: EntityType;
  entityId: string;
  sessionId?: string;
  action: ProgressAction;
  message: string;
  progressDelta?: number;
  metadata?: Record<string, unknown>;
}
