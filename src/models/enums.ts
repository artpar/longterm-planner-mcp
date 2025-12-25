/**
 * Status enum for Plans
 */
export const PlanStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
} as const;

export type PlanStatus = typeof PlanStatus[keyof typeof PlanStatus];

/**
 * Status enum for Tasks
 */
export const TaskStatus = {
  BACKLOG: 'backlog',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

/**
 * Status enum for Goals
 */
export const GoalStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type GoalStatus = typeof GoalStatus[keyof typeof GoalStatus];

/**
 * Status enum for Milestones
 */
export const MilestoneStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed',
  CANCELLED: 'cancelled'
} as const;

export type MilestoneStatus = typeof MilestoneStatus[keyof typeof MilestoneStatus];

/**
 * Status enum for Objectives
 */
export const ObjectiveStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
} as const;

export type ObjectiveStatus = typeof ObjectiveStatus[keyof typeof ObjectiveStatus];

/**
 * Priority levels
 */
export const Priority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

/**
 * Dependency types between tasks/goals
 */
export const DependencyType = {
  BLOCKS: 'blocks',
  REQUIRED_BY: 'required_by',
  RELATED_TO: 'related_to'
} as const;

export type DependencyType = typeof DependencyType[keyof typeof DependencyType];

/**
 * Blocker severity levels
 */
export const BlockerSeverity = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor'
} as const;

export type BlockerSeverity = typeof BlockerSeverity[keyof typeof BlockerSeverity];

/**
 * Blocker status
 */
export const BlockerStatus = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  WONT_FIX: 'wont_fix'
} as const;

export type BlockerStatus = typeof BlockerStatus[keyof typeof BlockerStatus];

/**
 * Entity types for polymorphic relationships
 */
export const EntityType = {
  PLAN: 'plan',
  GOAL: 'goal',
  OBJECTIVE: 'objective',
  MILESTONE: 'milestone',
  TASK: 'task'
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

/**
 * Progress log action types
 */
export const ProgressAction = {
  UPDATE: 'update',
  MILESTONE: 'milestone',
  CHECKPOINT: 'checkpoint',
  NOTE: 'note',
  STARTED: 'started',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  UNBLOCKED: 'unblocked'
} as const;

export type ProgressAction = typeof ProgressAction[keyof typeof ProgressAction];
