import { EntityType } from './enums.js';

/**
 * Operation types for change log
 */
export const ChangeOperation = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
} as const;

export type ChangeOperation = typeof ChangeOperation[keyof typeof ChangeOperation];

/**
 * ChangeLog entry - records a change to an entity
 */
export interface ChangeLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: ChangeOperation;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  sessionId: string | null;
  createdAt: string;
  undone: boolean;
}

/**
 * Input for creating a change log entry
 */
export interface CreateChangeLogInput {
  entityType: EntityType;
  entityId: string;
  operation: ChangeOperation;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  sessionId?: string;
}
