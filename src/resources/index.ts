import { ResourceRegistry, ResourceDefinition } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';
import { TaskStatus } from '../models/enums.js';

export { ResourceRegistry, ResourceDefinition } from './types.js';

/**
 * Get all resource definitions for listing
 */
export function getResourceDefinitions(): ResourceDefinition[] {
  return [
    {
      uri: 'plan://overview',
      name: 'Plan Overview',
      description: 'Overview of all active plans with task statistics'
    },
    {
      uri: 'plan://kanban/{planId}',
      name: 'Kanban Board',
      description: 'Kanban board view of tasks for a plan'
    },
    {
      uri: 'plan://progress/{planId}',
      name: 'Progress',
      description: 'Progress statistics for a plan'
    },
    {
      uri: 'plan://blockers',
      name: 'Blockers',
      description: 'All blocked tasks across plans'
    },
    {
      uri: 'plan://blockers/{planId}',
      name: 'Plan Blockers',
      description: 'Blocked tasks for a specific plan'
    },
    {
      uri: 'plan://today',
      name: 'Today Focus',
      description: "Today's tasks - in progress, blocked, and ready"
    }
  ];
}

/**
 * Register all resources
 */
export function registerResources(
  registry: ResourceRegistry,
  planRepo: PlanRepository,
  taskService: TaskService
): void {
  // plan://overview
  registry.register(
    /^plan:\/\/overview$/,
    () => {
      const plans = planRepo.findAll();

      const planData = plans.map(plan => {
        const stats = taskService.getProgressStats(plan.id);
        return {
          id: plan.id,
          name: plan.name,
          status: plan.status,
          projectPath: plan.projectPath,
          tasksTotal: stats.total,
          tasksCompleted: stats.completed,
          tasksInProgress: stats.inProgress,
          tasksBlocked: stats.blocked,
          percentComplete: stats.percentComplete,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt
        };
      });

      return {
        plans: planData,
        summary: {
          totalPlans: plans.length,
          activePlans: plans.filter(p => p.status === 'active').length,
          completedPlans: plans.filter(p => p.status === 'completed').length
        }
      };
    }
  );

  // plan://kanban/{planId}
  registry.register(
    /^plan:\/\/kanban\/(.+)$/,
    (_uri, match) => {
      const planId = match[1];
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const allStatuses: TaskStatus[] = [
        TaskStatus.BACKLOG,
        TaskStatus.READY,
        TaskStatus.IN_PROGRESS,
        TaskStatus.REVIEW,
        TaskStatus.BLOCKED,
        TaskStatus.COMPLETED
      ];

      const columns = allStatuses.map(status => {
        const tasks = taskService.getTasksForPlan(planId, { status: [status] });
        return {
          status,
          title: formatStatusTitle(status),
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            assignee: t.assignee,
            dueDate: t.dueDate
          })),
          taskCount: tasks.length
        };
      });

      return {
        planId,
        planName: plan.name,
        columns
      };
    }
  );

  // plan://progress/{planId}
  registry.register(
    /^plan:\/\/progress\/(.+)$/,
    (_uri, match) => {
      const planId = match[1];
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const stats = taskService.getProgressStats(planId);

      return {
        planId,
        planName: plan.name,
        ...stats,
        percentComplete: Math.round(stats.percentComplete * 100) / 100
      };
    }
  );

  // plan://blockers (all plans)
  registry.register(
    /^plan:\/\/blockers$/,
    () => {
      const plans = planRepo.findAll();
      const allBlocked: Array<{
        taskId: string;
        title: string;
        planId: string;
        planName: string;
        priority: string;
      }> = [];

      for (const plan of plans) {
        const blocked = taskService.getBlockedTasks(plan.id);
        for (const task of blocked) {
          allBlocked.push({
            taskId: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name,
            priority: task.priority
          });
        }
      }

      return {
        blockedTasks: allBlocked,
        count: allBlocked.length
      };
    }
  );

  // plan://blockers/{planId}
  registry.register(
    /^plan:\/\/blockers\/(.+)$/,
    (_uri, match) => {
      const planId = match[1];
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const blocked = taskService.getBlockedTasks(planId);

      return {
        planId,
        planName: plan.name,
        blockedTasks: blocked.map(t => ({
          taskId: t.id,
          title: t.title,
          priority: t.priority
        })),
        count: blocked.length
      };
    }
  );

  // plan://today
  registry.register(
    /^plan:\/\/today$/,
    () => {
      const plans = planRepo.findAll({ status: 'active' as any });

      const inProgress: Array<{ id: string; title: string; planId: string; planName: string }> = [];
      const blocked: Array<{ id: string; title: string; planId: string; planName: string }> = [];
      const ready: Array<{ id: string; title: string; planId: string; planName: string }> = [];

      for (const plan of plans) {
        const inProgressTasks = taskService.getInProgressTasks(plan.id);
        const blockedTasks = taskService.getBlockedTasks(plan.id);
        const readyTasks = taskService.getReadyTasks(plan.id);

        for (const task of inProgressTasks) {
          inProgress.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }

        for (const task of blockedTasks) {
          blocked.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }

        for (const task of readyTasks) {
          ready.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }
      }

      // Also include draft plans for today view
      const draftPlans = planRepo.findAll({ status: 'draft' as any });
      for (const plan of draftPlans) {
        const inProgressTasks = taskService.getInProgressTasks(plan.id);
        const blockedTasks = taskService.getBlockedTasks(plan.id);
        const readyTasks = taskService.getReadyTasks(plan.id);

        for (const task of inProgressTasks) {
          inProgress.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }

        for (const task of blockedTasks) {
          blocked.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }

        for (const task of readyTasks) {
          ready.push({
            id: task.id,
            title: task.title,
            planId: plan.id,
            planName: plan.name
          });
        }
      }

      const today = new Date().toISOString().split('T')[0];

      return {
        date: today,
        inProgress,
        blocked,
        ready,
        summary: `${inProgress.length} in progress, ${blocked.length} blocked, ${ready.length} ready to start`
      };
    }
  );
}

function formatStatusTitle(status: TaskStatus): string {
  const titles: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: 'Backlog',
    [TaskStatus.READY]: 'Ready',
    [TaskStatus.IN_PROGRESS]: 'In Progress',
    [TaskStatus.REVIEW]: 'Review',
    [TaskStatus.BLOCKED]: 'Blocked',
    [TaskStatus.COMPLETED]: 'Completed',
    [TaskStatus.CANCELLED]: 'Cancelled'
  };
  return titles[status] || status;
}
