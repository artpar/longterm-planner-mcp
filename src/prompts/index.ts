import { PromptRegistry, PromptDefinition, PromptResult } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';

export { PromptRegistry, PromptDefinition, PromptResult } from './types.js';

/**
 * Get all prompt definitions for listing
 */
export function getPromptDefinitions(): PromptDefinition[] {
  return [
    {
      name: 'plan_session',
      description: 'Start an interactive planning session for a new or existing plan',
      arguments: [
        { name: 'planId', description: 'Existing plan ID to work on', required: false },
        { name: 'planName', description: 'Name for new plan', required: false }
      ]
    },
    {
      name: 'daily_standup',
      description: 'Generate a daily standup summary with tasks, blockers, and focus areas',
      arguments: [
        { name: 'planId', description: 'Focus on specific plan', required: false }
      ]
    },
    {
      name: 'weekly_review',
      description: 'Comprehensive weekly review with metrics and planning for next week',
      arguments: [
        { name: 'planId', description: 'Plan to review', required: true }
      ]
    },
    {
      name: 'decompose',
      description: 'Help break down a high-level goal into actionable tasks',
      arguments: [
        { name: 'goal', description: 'Goal or objective to decompose', required: true },
        { name: 'planId', description: 'Plan context', required: false }
      ]
    },
    {
      name: 'retrospective',
      description: 'Facilitate a project retrospective with structured reflection',
      arguments: [
        { name: 'planId', description: 'Plan for retrospective', required: true },
        { name: 'format', description: 'Format: start_stop_continue, 4ls, sailboat', required: false }
      ]
    },
    {
      name: 'unblock',
      description: 'Analyze blockers and suggest resolution strategies',
      arguments: [
        { name: 'planId', description: 'Plan with blockers', required: false },
        { name: 'taskId', description: 'Specific blocked task', required: false }
      ]
    },
    {
      name: 'prioritize',
      description: 'Help prioritize tasks using various frameworks',
      arguments: [
        { name: 'planId', description: 'Plan to prioritize', required: true },
        { name: 'framework', description: 'Framework: eisenhower, moscow, rice, value_effort', required: false }
      ]
    },
    {
      name: 'scope_check',
      description: 'Analyze scope creep and suggest adjustments',
      arguments: [
        { name: 'planId', description: 'Plan to analyze', required: true }
      ]
    }
  ];
}

/**
 * Register all prompts
 */
export function registerPrompts(
  registry: PromptRegistry,
  planRepo: PlanRepository,
  taskService: TaskService
): void {
  const definitions = getPromptDefinitions();

  // plan_session
  registry.register(
    'plan_session',
    definitions.find(d => d.name === 'plan_session')!,
    (args): PromptResult => {
      const planId = args.planId as string | undefined;
      const planName = args.planName as string | undefined;

      let contextText = '';
      if (planId) {
        const plan = planRepo.findById(planId);
        if (plan) {
          const stats = taskService.getProgressStats(planId);
          contextText = `
## Current Plan: ${plan.name}
- Status: ${plan.status}
- Progress: ${stats.completed}/${stats.total} tasks (${Math.round(stats.percentComplete)}%)
- In Progress: ${stats.inProgress}
- Blocked: ${stats.blocked}
`;
        }
      }

      return {
        description: 'Interactive planning session',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to start a planning session${planId ? ` for plan "${planName || 'existing plan'}"` : planName ? ` for a new plan called "${planName}"` : ' for a new initiative'}.
${contextText}
Please help me:
1. ${planId ? 'Review current status and progress' : 'Define clear goals and success criteria'}
2. Break down objectives into actionable tasks
3. Identify dependencies and potential blockers
4. Set realistic timelines
5. Establish checkpoints and milestones

Let's begin by ${planId ? 'reviewing what has been accomplished and what is next' : 'understanding the scope and objectives'}.`
            }
          }
        ]
      };
    }
  );

  // daily_standup
  registry.register(
    'daily_standup',
    definitions.find(d => d.name === 'daily_standup')!,
    (args): PromptResult => {
      const planId = args.planId as string | undefined;

      let taskSummary = '';
      if (planId) {
        const plan = planRepo.findById(planId);
        if (plan) {
          const inProgress = taskService.getInProgressTasks(planId);
          const blocked = taskService.getBlockedTasks(planId);
          const ready = taskService.getReadyTasks(planId);

          taskSummary = `
## Plan: ${plan.name}

**In Progress (${inProgress.length})**
${inProgress.map(t => `- ${t.title}`).join('\n') || '- None'}

**Blocked (${blocked.length})**
${blocked.map(t => `- ${t.title}`).join('\n') || '- None'}

**Ready to Start (${ready.length})**
${ready.map(t => `- ${t.title}`).join('\n') || '- None'}
`;
        }
      } else {
        // Get all active plans
        const plans = planRepo.findAll();
        const allInProgress: string[] = [];
        const allBlocked: string[] = [];

        for (const plan of plans) {
          const inProgress = taskService.getInProgressTasks(plan.id);
          const blocked = taskService.getBlockedTasks(plan.id);

          for (const t of inProgress) {
            allInProgress.push(`- [${plan.name}] ${t.title}`);
          }
          for (const t of blocked) {
            allBlocked.push(`- [${plan.name}] ${t.title}`);
          }
        }

        taskSummary = `
**In Progress (${allInProgress.length})**
${allInProgress.join('\n') || '- None'}

**Blocked (${allBlocked.length})**
${allBlocked.join('\n') || '- None'}
`;
      }

      return {
        description: 'Daily standup summary',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate a daily standup summary:
${taskSummary}
Please provide:

**Yesterday**
- What was completed
- Progress made on ongoing tasks

**Today**
- Priority tasks to focus on
- Any dependencies to be aware of

**Blockers**
- Current blockers needing attention
- Risks that might become blockers

Format as a brief, actionable standup update.`
            }
          }
        ]
      };
    }
  );

  // weekly_review
  registry.register(
    'weekly_review',
    definitions.find(d => d.name === 'weekly_review')!,
    (args): PromptResult => {
      const planId = args.planId as string;
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const stats = taskService.getProgressStats(planId);

      return {
        description: 'Weekly plan review',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Conduct a comprehensive weekly review for plan "${plan.name}":

## Current Status
- Total Tasks: ${stats.total}
- Completed: ${stats.completed}
- In Progress: ${stats.inProgress}
- Blocked: ${stats.blocked}
- Progress: ${Math.round(stats.percentComplete)}%

Please analyze and provide:

**Accomplishments**
- Tasks completed this week
- Goals progressed
- Decisions made

**Metrics**
- Progress toward milestones
- Velocity assessment

**Challenges**
- Blockers encountered
- Tasks that slipped
- Scope changes

**Next Week**
- Priority tasks
- Upcoming deadlines
- Resources needed

**Recommendations**
- Process improvements
- Risk mitigation
- Adjustments to plan`
            }
          }
        ]
      };
    }
  );

  // decompose
  registry.register(
    'decompose',
    definitions.find(d => d.name === 'decompose')!,
    (args): PromptResult => {
      const goal = args.goal as string;
      const planId = args.planId as string | undefined;

      let context = '';
      if (planId) {
        const plan = planRepo.findById(planId);
        if (plan) {
          context = `\n\n**Plan Context**: Working within "${plan.name}"`;
        }
      }

      return {
        description: 'Goal decomposition assistant',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me decompose this goal into actionable tasks:

**Goal**: ${goal}${context}

Please:
1. Identify the key milestones or checkpoints
2. Break down into specific, actionable tasks
3. Estimate effort for each task (hours)
4. Identify dependencies between tasks
5. Suggest a logical sequence/timeline
6. Flag potential risks or blockers

For each task, provide:
- Clear title and description
- Acceptance criteria
- Estimated effort
- Dependencies
- Priority level (critical/high/medium/low)

Provide detailed decomposition with subtasks where appropriate.`
            }
          }
        ]
      };
    }
  );

  // retrospective
  registry.register(
    'retrospective',
    definitions.find(d => d.name === 'retrospective')!,
    (args): PromptResult => {
      const planId = args.planId as string;
      const format = (args.format as string) || 'start_stop_continue';
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const stats = taskService.getProgressStats(planId);

      let formatGuide = '';
      switch (format) {
        case '4ls':
          formatGuide = `
**Liked** - What went well?
**Learned** - What did we learn?
**Lacked** - What was missing?
**Longed For** - What do we wish we had?`;
          break;
        case 'sailboat':
          formatGuide = `
**Wind (Helpers)** - What pushed us forward?
**Anchors (Blockers)** - What held us back?
**Rocks (Risks)** - What risks did we face?
**Island (Goal)** - Did we reach our destination?`;
          break;
        default:
          formatGuide = `
**Start** - What should we begin doing?
**Stop** - What should we stop doing?
**Continue** - What is working well to keep doing?`;
      }

      return {
        description: 'Project retrospective',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Facilitate a retrospective for plan "${plan.name}" using the ${format} format.

## Plan Statistics
- Total Tasks: ${stats.total}
- Completed: ${stats.completed}
- Progress: ${Math.round(stats.percentComplete)}%

## Format Guide
${formatGuide}

For each insight:
1. Provide specific examples from the project
2. Suggest concrete action items
3. Prioritize improvements

End with a summary of top 3 improvements to implement.`
            }
          }
        ]
      };
    }
  );

  // unblock
  registry.register(
    'unblock',
    definitions.find(d => d.name === 'unblock')!,
    (args): PromptResult => {
      const planId = args.planId as string | undefined;
      const taskId = args.taskId as string | undefined;

      let blockerInfo = '';

      if (taskId) {
        const task = taskService.getTask(taskId);
        if (task) {
          blockerInfo = `
## Blocked Task
- Title: ${task.title}
- Priority: ${task.priority}
- Description: ${task.description || 'No description'}
`;
        }
      } else if (planId) {
        const blocked = taskService.getBlockedTasks(planId);
        blockerInfo = `
## Blocked Tasks (${blocked.length})
${blocked.map(t => `- **${t.title}** (${t.priority})`).join('\n') || 'No blocked tasks'}
`;
      } else {
        const plans = planRepo.findAll();
        const allBlocked: string[] = [];
        for (const plan of plans) {
          const blocked = taskService.getBlockedTasks(plan.id);
          for (const t of blocked) {
            allBlocked.push(`- **${t.title}** [${plan.name}] (${t.priority})`);
          }
        }
        blockerInfo = `
## All Blocked Tasks (${allBlocked.length})
${allBlocked.join('\n') || 'No blocked tasks'}
`;
      }

      return {
        description: 'Blocker resolution assistant',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze these blockers and help develop resolution strategies:
${blockerInfo}
For each blocker:
1. **Root Cause Analysis** - What is really causing this?
2. **Impact Assessment** - What is the downstream impact?
3. **Resolution Options** - What are possible solutions?
4. **Recommended Action** - Best path forward
5. **Escalation Need** - Does this need escalation?
6. **Prevention** - How to prevent similar blockers?

Prioritize by severity of impact and provide specific, actionable next steps.`
            }
          }
        ]
      };
    }
  );

  // prioritize
  registry.register(
    'prioritize',
    definitions.find(d => d.name === 'prioritize')!,
    (args): PromptResult => {
      const planId = args.planId as string;
      const framework = (args.framework as string) || 'eisenhower';
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const tasks = taskService.getTasksForPlan(planId);
      const taskList = tasks
        .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
        .map(t => `- ${t.title} (${t.priority}, ${t.status})`)
        .join('\n');

      let frameworkGuide = '';
      switch (framework) {
        case 'moscow':
          frameworkGuide = `
**MoSCoW Method**:
- **Must Have** - Critical, non-negotiable
- **Should Have** - Important but not vital
- **Could Have** - Nice to have
- **Won't Have** - Out of scope for now`;
          break;
        case 'rice':
          frameworkGuide = `
**RICE Scoring**:
- **Reach** - How many users/tasks affected?
- **Impact** - How much impact? (3=massive, 0.25=minimal)
- **Confidence** - How sure are we? (100%=high, 50%=low)
- **Effort** - Person-weeks needed

Score = (Reach * Impact * Confidence) / Effort`;
          break;
        case 'value_effort':
          frameworkGuide = `
**Value/Effort Matrix**:
- **Quick Wins** - High value, low effort
- **Major Projects** - High value, high effort
- **Fill-Ins** - Low value, low effort
- **Avoid** - Low value, high effort`;
          break;
        default:
          frameworkGuide = `
**Eisenhower Matrix**:
- **Urgent + Important** (Do First)
- **Important, Not Urgent** (Schedule)
- **Urgent, Not Important** (Delegate)
- **Neither** (Eliminate)`;
      }

      return {
        description: 'Task prioritization assistant',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me prioritize these tasks using the ${framework} framework:

## Plan: ${plan.name}

## Tasks
${taskList || 'No pending tasks'}
${frameworkGuide}

For each task:
1. Explain your reasoning for the categorization
2. Suggest any that should be reconsidered or removed

Provide the final prioritized list with action recommendations.`
            }
          }
        ]
      };
    }
  );

  // scope_check
  registry.register(
    'scope_check',
    definitions.find(d => d.name === 'scope_check')!,
    (args): PromptResult => {
      const planId = args.planId as string;
      const plan = planRepo.findById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const stats = taskService.getProgressStats(planId);

      return {
        description: 'Scope analysis and adjustment',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze plan "${plan.name}" for scope creep and health:

## Current Status
- Total Tasks: ${stats.total}
- Completed: ${stats.completed}
- In Progress: ${stats.inProgress}
- Blocked: ${stats.blocked}
- Backlog: ${stats.backlog}
- Progress: ${Math.round(stats.percentComplete)}%

Please analyze:

**Scope Analysis**
1. Are there too many tasks in backlog?
2. Is the work-in-progress sustainable?
3. Signs of scope creep

**Health Check**
1. Progress vs expected progress
2. Blocked items ratio
3. Risk indicators

**Recommendations**
1. Tasks to descope or defer
2. Adjustments needed
3. Resource recommendations

Provide specific, data-driven recommendations for bringing the plan on track.`
            }
          }
        ]
      };
    }
  );
}
