import { describe, it, expect } from 'vitest';
import { TaskStateMachine, PlanStateMachine } from '../../src/services/StateMachine.js';
import { TaskStatus, PlanStatus } from '../../src/models/enums.js';

describe('TaskStateMachine', () => {
  const machine = new TaskStateMachine();

  describe('canTransition', () => {
    it('should allow backlog to ready', () => {
      expect(machine.canTransition(TaskStatus.BACKLOG, TaskStatus.READY)).toBe(true);
    });

    it('should allow ready to in_progress', () => {
      expect(machine.canTransition(TaskStatus.READY, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow in_progress to review', () => {
      expect(machine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.REVIEW)).toBe(true);
    });

    it('should allow in_progress to blocked', () => {
      expect(machine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)).toBe(true);
    });

    it('should allow blocked to in_progress (unblock)', () => {
      expect(machine.canTransition(TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow blocked to ready (reset)', () => {
      expect(machine.canTransition(TaskStatus.BLOCKED, TaskStatus.READY)).toBe(true);
    });

    it('should allow review to completed', () => {
      expect(machine.canTransition(TaskStatus.REVIEW, TaskStatus.COMPLETED)).toBe(true);
    });

    it('should allow review to in_progress (request changes)', () => {
      expect(machine.canTransition(TaskStatus.REVIEW, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    // Any state can transition to cancelled
    it('should allow any state to cancelled', () => {
      expect(machine.canTransition(TaskStatus.BACKLOG, TaskStatus.CANCELLED)).toBe(true);
      expect(machine.canTransition(TaskStatus.READY, TaskStatus.CANCELLED)).toBe(true);
      expect(machine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED)).toBe(true);
      expect(machine.canTransition(TaskStatus.REVIEW, TaskStatus.CANCELLED)).toBe(true);
      expect(machine.canTransition(TaskStatus.BLOCKED, TaskStatus.CANCELLED)).toBe(true);
    });

    // Invalid transitions
    it('should NOT allow backlog to completed directly', () => {
      expect(machine.canTransition(TaskStatus.BACKLOG, TaskStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow backlog to in_progress directly', () => {
      expect(machine.canTransition(TaskStatus.BACKLOG, TaskStatus.IN_PROGRESS)).toBe(false);
    });

    it('should NOT allow completed to any other state', () => {
      expect(machine.canTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS)).toBe(false);
      expect(machine.canTransition(TaskStatus.COMPLETED, TaskStatus.READY)).toBe(false);
      expect(machine.canTransition(TaskStatus.COMPLETED, TaskStatus.BACKLOG)).toBe(false);
    });

    it('should NOT allow cancelled to any other state', () => {
      expect(machine.canTransition(TaskStatus.CANCELLED, TaskStatus.READY)).toBe(false);
      expect(machine.canTransition(TaskStatus.CANCELLED, TaskStatus.IN_PROGRESS)).toBe(false);
    });

    it('should NOT allow same state transition', () => {
      expect(machine.canTransition(TaskStatus.BACKLOG, TaskStatus.BACKLOG)).toBe(false);
      expect(machine.canTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return valid transitions from backlog', () => {
      const transitions = machine.getAvailableTransitions(TaskStatus.BACKLOG);
      expect(transitions).toContain(TaskStatus.READY);
      expect(transitions).toContain(TaskStatus.CANCELLED);
      expect(transitions).not.toContain(TaskStatus.COMPLETED);
    });

    it('should return valid transitions from in_progress', () => {
      const transitions = machine.getAvailableTransitions(TaskStatus.IN_PROGRESS);
      expect(transitions).toContain(TaskStatus.REVIEW);
      expect(transitions).toContain(TaskStatus.BLOCKED);
      expect(transitions).toContain(TaskStatus.CANCELLED);
    });

    it('should return empty array from completed', () => {
      const transitions = machine.getAvailableTransitions(TaskStatus.COMPLETED);
      expect(transitions).toEqual([]);
    });

    it('should return empty array from cancelled', () => {
      const transitions = machine.getAvailableTransitions(TaskStatus.CANCELLED);
      expect(transitions).toEqual([]);
    });
  });

  describe('transition', () => {
    it('should return new status for valid transition', () => {
      const result = machine.transition(TaskStatus.READY, TaskStatus.IN_PROGRESS);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should return error for invalid transition', () => {
      const result = machine.transition(TaskStatus.BACKLOG, TaskStatus.COMPLETED);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('PlanStateMachine', () => {
  const machine = new PlanStateMachine();

  describe('canTransition', () => {
    it('should allow draft to active', () => {
      expect(machine.canTransition(PlanStatus.DRAFT, PlanStatus.ACTIVE)).toBe(true);
    });

    it('should allow active to completed', () => {
      expect(machine.canTransition(PlanStatus.ACTIVE, PlanStatus.COMPLETED)).toBe(true);
    });

    it('should allow active to archived', () => {
      expect(machine.canTransition(PlanStatus.ACTIVE, PlanStatus.ARCHIVED)).toBe(true);
    });

    it('should allow completed to archived', () => {
      expect(machine.canTransition(PlanStatus.COMPLETED, PlanStatus.ARCHIVED)).toBe(true);
    });

    // Invalid transitions
    it('should NOT allow draft to completed directly', () => {
      expect(machine.canTransition(PlanStatus.DRAFT, PlanStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow archived to any other state', () => {
      expect(machine.canTransition(PlanStatus.ARCHIVED, PlanStatus.ACTIVE)).toBe(false);
      expect(machine.canTransition(PlanStatus.ARCHIVED, PlanStatus.DRAFT)).toBe(false);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return valid transitions from draft', () => {
      const transitions = machine.getAvailableTransitions(PlanStatus.DRAFT);
      expect(transitions).toContain(PlanStatus.ACTIVE);
      expect(transitions).not.toContain(PlanStatus.COMPLETED);
    });

    it('should return valid transitions from active', () => {
      const transitions = machine.getAvailableTransitions(PlanStatus.ACTIVE);
      expect(transitions).toContain(PlanStatus.COMPLETED);
      expect(transitions).toContain(PlanStatus.ARCHIVED);
    });

    it('should return empty array from archived', () => {
      const transitions = machine.getAvailableTransitions(PlanStatus.ARCHIVED);
      expect(transitions).toEqual([]);
    });
  });
});
