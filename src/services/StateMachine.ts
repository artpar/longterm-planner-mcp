import { TaskStatus, PlanStatus } from '../models/enums.js';

/**
 * Result of a state transition attempt
 */
export interface TransitionResult<S> {
  success: boolean;
  newStatus?: S;
  error?: string;
}

/**
 * Base state machine interface
 */
interface StateMachine<S extends string> {
  canTransition(from: S, to: S): boolean;
  getAvailableTransitions(from: S): S[];
  transition(from: S, to: S): TransitionResult<S>;
}

/**
 * Task state machine implementation
 *
 * Valid transitions:
 * BACKLOG → READY → IN_PROGRESS → REVIEW → COMPLETED
 *                        ↓            ↑
 *                     BLOCKED ────────┘
 *
 * Any state can → CANCELLED (except COMPLETED and CANCELLED)
 */
export class TaskStateMachine implements StateMachine<TaskStatus> {
  private readonly transitions: Map<TaskStatus, Set<TaskStatus>>;

  constructor() {
    this.transitions = new Map([
      [TaskStatus.BACKLOG, new Set([TaskStatus.READY, TaskStatus.CANCELLED])],
      [TaskStatus.READY, new Set([TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED])],
      [TaskStatus.IN_PROGRESS, new Set([
        TaskStatus.REVIEW,
        TaskStatus.BLOCKED,
        TaskStatus.CANCELLED
      ])],
      [TaskStatus.REVIEW, new Set([
        TaskStatus.COMPLETED,
        TaskStatus.IN_PROGRESS,
        TaskStatus.CANCELLED
      ])],
      [TaskStatus.BLOCKED, new Set([
        TaskStatus.IN_PROGRESS,
        TaskStatus.READY,
        TaskStatus.CANCELLED
      ])],
      [TaskStatus.COMPLETED, new Set()],
      [TaskStatus.CANCELLED, new Set()]
    ]);
  }

  canTransition(from: TaskStatus, to: TaskStatus): boolean {
    if (from === to) return false;
    const validTargets = this.transitions.get(from);
    return validTargets?.has(to) ?? false;
  }

  getAvailableTransitions(from: TaskStatus): TaskStatus[] {
    const validTargets = this.transitions.get(from);
    return validTargets ? Array.from(validTargets) : [];
  }

  transition(from: TaskStatus, to: TaskStatus): TransitionResult<TaskStatus> {
    if (this.canTransition(from, to)) {
      return { success: true, newStatus: to };
    }
    return {
      success: false,
      error: `Invalid transition from ${from} to ${to}`
    };
  }

  /**
   * Get trigger name for a transition (for logging/audit)
   */
  getTriggerName(from: TaskStatus, to: TaskStatus): string | null {
    const triggers: Record<string, string> = {
      [`${TaskStatus.BACKLOG}->${TaskStatus.READY}`]: 'prioritize',
      [`${TaskStatus.READY}->${TaskStatus.IN_PROGRESS}`]: 'start',
      [`${TaskStatus.IN_PROGRESS}->${TaskStatus.REVIEW}`]: 'submit',
      [`${TaskStatus.IN_PROGRESS}->${TaskStatus.BLOCKED}`]: 'block',
      [`${TaskStatus.BLOCKED}->${TaskStatus.IN_PROGRESS}`]: 'unblock',
      [`${TaskStatus.BLOCKED}->${TaskStatus.READY}`]: 'reset',
      [`${TaskStatus.REVIEW}->${TaskStatus.COMPLETED}`]: 'approve',
      [`${TaskStatus.REVIEW}->${TaskStatus.IN_PROGRESS}`]: 'request_changes'
    };

    return triggers[`${from}->${to}`] ?? (to === TaskStatus.CANCELLED ? 'cancel' : null);
  }
}

/**
 * Plan state machine implementation
 *
 * Valid transitions:
 * DRAFT → ACTIVE → COMPLETED
 *           ↓          ↓
 *        ARCHIVED ←────┘
 */
export class PlanStateMachine implements StateMachine<PlanStatus> {
  private readonly transitions: Map<PlanStatus, Set<PlanStatus>>;

  constructor() {
    this.transitions = new Map([
      [PlanStatus.DRAFT, new Set([PlanStatus.ACTIVE])],
      [PlanStatus.ACTIVE, new Set([PlanStatus.COMPLETED, PlanStatus.ARCHIVED])],
      [PlanStatus.COMPLETED, new Set([PlanStatus.ARCHIVED])],
      [PlanStatus.ARCHIVED, new Set()]
    ]);
  }

  canTransition(from: PlanStatus, to: PlanStatus): boolean {
    if (from === to) return false;
    const validTargets = this.transitions.get(from);
    return validTargets?.has(to) ?? false;
  }

  getAvailableTransitions(from: PlanStatus): PlanStatus[] {
    const validTargets = this.transitions.get(from);
    return validTargets ? Array.from(validTargets) : [];
  }

  transition(from: PlanStatus, to: PlanStatus): TransitionResult<PlanStatus> {
    if (this.canTransition(from, to)) {
      return { success: true, newStatus: to };
    }
    return {
      success: false,
      error: `Invalid transition from ${from} to ${to}`
    };
  }

  /**
   * Get trigger name for a transition
   */
  getTriggerName(from: PlanStatus, to: PlanStatus): string | null {
    const triggers: Record<string, string> = {
      [`${PlanStatus.DRAFT}->${PlanStatus.ACTIVE}`]: 'activate',
      [`${PlanStatus.ACTIVE}->${PlanStatus.COMPLETED}`]: 'complete',
      [`${PlanStatus.ACTIVE}->${PlanStatus.ARCHIVED}`]: 'archive',
      [`${PlanStatus.COMPLETED}->${PlanStatus.ARCHIVED}`]: 'archive'
    };

    return triggers[`${from}->${to}`] ?? null;
  }
}
