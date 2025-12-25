import { ToolRegistry } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { PlanStatus } from '../models/enums.js';

/**
 * Register plan management tools
 */
export function registerPlanTools(registry: ToolRegistry, planRepo: PlanRepository): void {
  // create_plan
  registry.register(
    'create_plan',
    {
      description: 'Create a new planning project with goals and timeline',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the plan'
          },
          projectPath: {
            type: 'string',
            description: 'Project directory path (defaults to current directory)'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the plan'
          },
          startDate: {
            type: 'string',
            description: 'Start date (ISO 8601 format)'
          },
          targetDate: {
            type: 'string',
            description: 'Target completion date (ISO 8601 format)'
          }
        },
        required: ['name']
      }
    },
    (args) => {
      const plan = planRepo.create({
        projectPath: (args.projectPath as string) ?? process.cwd(),
        name: args.name as string,
        description: args.description as string,
        startDate: args.startDate as string,
        targetDate: args.targetDate as string
      });
      return {
        planId: plan.id,
        name: plan.name,
        status: plan.status,
        createdAt: plan.createdAt,
        message: `Created plan "${plan.name}"`
      };
    }
  );

  // update_plan
  registry.register(
    'update_plan',
    {
      description: 'Update plan metadata, status, or timeline',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to update'
          },
          name: {
            type: 'string',
            description: 'New name'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          status: {
            type: 'string',
            enum: ['draft', 'active', 'completed', 'archived'],
            description: 'New status'
          },
          startDate: {
            type: 'string',
            description: 'New start date'
          },
          targetDate: {
            type: 'string',
            description: 'New target date'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const updated = planRepo.update(args.planId as string, {
        name: args.name as string,
        description: args.description as string,
        status: args.status as PlanStatus,
        startDate: args.startDate as string,
        targetDate: args.targetDate as string
      });

      if (!updated) {
        throw new Error(`Plan not found: ${args.planId}`);
      }

      return {
        planId: updated.id,
        updated: true,
        plan: updated
      };
    }
  );

  // archive_plan
  registry.register(
    'archive_plan',
    {
      description: 'Archive a plan, preserving it for reference but marking it inactive',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to archive'
          },
          reason: {
            type: 'string',
            description: 'Reason for archiving'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const archived = planRepo.archive(args.planId as string);

      if (!archived) {
        throw new Error(`Plan not found: ${args.planId}`);
      }

      return {
        planId: archived.id,
        archived: true,
        archivedAt: archived.updatedAt,
        message: `Archived plan "${archived.name}"`
      };
    }
  );

  // get_plan
  registry.register(
    'get_plan',
    {
      description: 'Get full details of a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to retrieve'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const plan = planRepo.findById(args.planId as string);

      if (!plan) {
        throw new Error(`Plan not found: ${args.planId}`);
      }

      return plan;
    }
  );

  // list_plans
  registry.register(
    'list_plans',
    {
      description: 'List all plans with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Filter by project path'
          },
          status: {
            type: 'string',
            enum: ['draft', 'active', 'completed', 'archived'],
            description: 'Filter by status'
          }
        }
      }
    },
    (args) => {
      const plans = planRepo.findAll({
        projectPath: args.projectPath as string,
        status: args.status as PlanStatus
      });

      return {
        plans: plans.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          projectPath: p.projectPath,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        count: plans.length
      };
    }
  );

  // activate_plan
  registry.register(
    'activate_plan',
    {
      description: 'Move a plan from draft to active status',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to activate'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const plan = planRepo.findById(args.planId as string);
      if (!plan) {
        throw new Error(`Plan not found: ${args.planId}`);
      }

      if (plan.status !== PlanStatus.DRAFT) {
        throw new Error(`Can only activate plans in draft status. Current status: ${plan.status}`);
      }

      const updated = planRepo.update(args.planId as string, { status: PlanStatus.ACTIVE });
      return {
        planId: updated!.id,
        status: updated!.status,
        message: `Activated plan "${updated!.name}"`
      };
    }
  );
}
