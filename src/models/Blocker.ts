import { BlockerSeverity, BlockerStatus, EntityType } from './enums.js';

/**
 * Blocker - impediment affecting an entity
 */
export interface Blocker {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  description: string;
  severity: BlockerSeverity;
  status: BlockerStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * Input for creating a blocker
 */
export interface CreateBlockerInput {
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
  severity?: BlockerSeverity;
}

/**
 * Input for resolving a blocker
 */
export interface ResolveBlockerInput {
  resolution: string;
}
