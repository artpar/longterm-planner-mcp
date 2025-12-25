import { EntityType } from './enums.js';

/**
 * Decision option with pros/cons
 */
export interface DecisionOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
}

/**
 * Decision - recorded decision for an entity
 */
export interface Decision {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  description: string;
  options: DecisionOption[];
  outcome: string | null;
  rationale: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/**
 * Input for creating a decision record
 */
export interface CreateDecisionInput {
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
  options?: Array<{
    description: string;
    pros?: string[];
    cons?: string[];
  }>;
}

/**
 * Input for recording a decision outcome
 */
export interface RecordDecisionOutcomeInput {
  outcome: string;
  rationale?: string;
}
