import { ToolRegistry } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';
import { Database } from '../db/Database.js';
import { PlanStatus } from '../models/enums.js';

interface ProgressLog {
  action: string;
  message: string;
  created_at: string;
  entity_type: string;
}

interface Session {
  started_at: string;
  ended_at: string | null;
}

/**
 * Register session tools
 */
export function registerSessionTools(
  registry: ToolRegistry,
  planRepo: PlanRepository,
  taskService: TaskService,
  db: Database
): void {
  registry.register(
    'get_session_summary',
    {
      description: 'Get a summary of current project planning state. Call this at session start to see context.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Project path (defaults to current directory)'
          }
        }
      }
    },
    (args) => {
      const projectPath = (args.projectPath as string) ?? process.cwd();
      return generateSessionSummary(planRepo, taskService, db, projectPath);
    }
  );
}

function generateSessionSummary(
  planRepo: PlanRepository,
  taskService: TaskService,
  db: Database,
  projectPath: string
): string {
  const lines: string[] = [];

  // Get active plans for this project
  const plans = planRepo.findAll({ projectPath, status: PlanStatus.ACTIVE });

  if (plans.length === 0) {
    // Check for draft plans
    const draftPlans = planRepo.findAll({ projectPath, status: PlanStatus.DRAFT });
    if (draftPlans.length > 0) {
      return `${draftPlans.length} draft plan(s), none active. Use activate_plan to start.`;
    }
    return 'No active plans for this project.';
  }

  // Get last session time
  const lastSession = getLastSession(db, projectPath);
  if (lastSession) {
    const ago = timeAgo(lastSession.ended_at || lastSession.started_at);
    lines.push(`Last session: ${ago}`);
  }

  // Summarize each active plan
  for (const plan of plans) {
    const stats = taskService.getProgressStats(plan.id);
    const pct = Math.round(stats.percentComplete);

    lines.push(`${plan.name}: ${stats.completed}/${stats.total} (${pct}%)`);

    // In progress tasks
    if (stats.inProgress > 0) {
      const inProgress = taskService.getInProgressTasks(plan.id);
      const titles = inProgress.slice(0, 3).map(t => t.title);
      const more = inProgress.length > 3 ? ` +${inProgress.length - 3} more` : '';
      lines.push(`  active: ${titles.join(', ')}${more}`);
    }

    // Blocked tasks
    if (stats.blocked > 0) {
      const blocked = taskService.getBlockedTasks(plan.id);
      const titles = blocked.slice(0, 2).map(t => t.title);
      lines.push(`  blocked: ${titles.join(', ')}`);
    }

    // Ready to start
    if (stats.ready > 0) {
      lines.push(`  ready: ${stats.ready} task(s)`);
    }
  }

  // Last activity
  const lastActivity = getLastActivity(db, projectPath);
  if (lastActivity) {
    lines.push(`Last: ${lastActivity}`);
  }

  return lines.join('\n');
}

function getLastSession(db: Database, projectPath: string): Session | null {
  try {
    // Get plan IDs for this project
    const plans = db.prepare<{ id: string }>(
      'SELECT id FROM plans WHERE project_path = ?'
    ).all(projectPath);

    if (plans.length === 0) return null;

    const planIds = plans.map(p => p.id);
    const placeholders = planIds.map(() => '?').join(',');

    const session = db.prepare<Session>(
      `SELECT started_at, ended_at FROM sessions
       WHERE plan_id IN (${placeholders})
       ORDER BY started_at DESC LIMIT 1`
    ).get(...planIds);

    return session || null;
  } catch {
    return null;
  }
}

function getLastActivity(db: Database, projectPath: string): string | null {
  try {
    // Get recent progress log
    const log = db.prepare<ProgressLog>(
      `SELECT pl.action, pl.message, pl.created_at, pl.entity_type
       FROM progress_logs pl
       JOIN tasks t ON pl.entity_id = t.id AND pl.entity_type = 'task'
       JOIN plans p ON t.plan_id = p.id
       WHERE p.project_path = ?
       ORDER BY pl.created_at DESC LIMIT 1`
    ).get(projectPath);

    if (log) {
      const ago = timeAgo(log.created_at);
      return `${log.message} (${ago})`;
    }
    return null;
  } catch {
    return null;
  }
}

function timeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  } catch {
    return dateStr;
  }
}
