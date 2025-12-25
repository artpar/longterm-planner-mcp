import { ToolRegistry } from './types.js';
import { Database } from '../db/Database.js';
import { TaskStatus, Priority, PlanStatus } from '../models/enums.js';

/**
 * Search result for tasks
 */
interface TaskSearchResult {
  id: string;
  planId: string;
  planName?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
}

/**
 * Register search and filter tools
 */
export function registerSearchTools(
  registry: ToolRegistry,
  db: Database
): void {
  // search_tasks
  registry.register(
    'search_tasks',
    {
      description: 'Search for tasks across all plans or within a specific plan. Supports text search and multiple filters.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to search for in task title and description'
          },
          planId: {
            type: 'string',
            description: 'Filter to tasks in a specific plan'
          },
          status: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['backlog', 'ready', 'in_progress', 'review', 'blocked', 'completed', 'cancelled']
            },
            description: 'Filter by task status(es)'
          },
          priority: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low']
            },
            description: 'Filter by priority level(s)'
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee name'
          },
          dueBefore: {
            type: 'string',
            description: 'Filter tasks due before this date (ISO 8601)'
          },
          dueAfter: {
            type: 'string',
            description: 'Filter tasks due after this date (ISO 8601)'
          },
          includeCompleted: {
            type: 'boolean',
            description: 'Include completed/cancelled tasks (default: false)'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags (tasks must have ALL specified tags)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 50)'
          }
        }
      }
    },
    (args) => {
      const query = args.query as string | undefined;
      const planId = args.planId as string | undefined;
      const status = args.status as TaskStatus[] | undefined;
      const priority = args.priority as Priority[] | undefined;
      const assignee = args.assignee as string | undefined;
      const dueBefore = args.dueBefore as string | undefined;
      const dueAfter = args.dueAfter as string | undefined;
      const includeCompleted = args.includeCompleted as boolean ?? false;
      const tags = args.tags as string[] | undefined;
      const limit = Math.min(args.limit as number || 50, 200);

      let sql = 'SELECT t.*, p.name as plan_name FROM tasks t JOIN plans p ON t.plan_id = p.id WHERE 1=1';
      const params: unknown[] = [];

      // Text search
      if (query) {
        sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        const searchPattern = `%${query}%`;
        params.push(searchPattern, searchPattern);
      }

      // Plan filter
      if (planId) {
        sql += ' AND t.plan_id = ?';
        params.push(planId);
      }

      // Status filter
      if (status && status.length > 0) {
        const placeholders = status.map(() => '?').join(', ');
        sql += ` AND t.status IN (${placeholders})`;
        params.push(...status);
      } else if (!includeCompleted) {
        sql += ' AND t.status NOT IN (?, ?)';
        params.push(TaskStatus.COMPLETED, TaskStatus.CANCELLED);
      }

      // Priority filter
      if (priority && priority.length > 0) {
        const placeholders = priority.map(() => '?').join(', ');
        sql += ` AND t.priority IN (${placeholders})`;
        params.push(...priority);
      }

      // Assignee filter
      if (assignee) {
        sql += ' AND t.assignee = ?';
        params.push(assignee);
      }

      // Due date filters
      if (dueBefore) {
        sql += ' AND t.due_date IS NOT NULL AND t.due_date <= ?';
        params.push(dueBefore);
      }

      if (dueAfter) {
        sql += ' AND t.due_date IS NOT NULL AND t.due_date >= ?';
        params.push(dueAfter);
      }

      // Tag filter - tasks must have ALL specified tags
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const normalizedTag = tag.toLowerCase().trim();
          sql += ' AND t.tags LIKE ?';
          params.push(`%"${normalizedTag}"%`);
        }
      }

      sql += ' ORDER BY t.priority = \'critical\' DESC, t.priority = \'high\' DESC, t.due_date ASC NULLS LAST, t.created_at DESC';
      sql += ' LIMIT ?';
      params.push(limit);

      interface TaskWithPlan {
        id: string;
        plan_id: string;
        plan_name: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        assignee: string | null;
        due_date: string | null;
        tags: string;
        created_at: string;
      }

      const rows = db.prepare(sql).all(...params) as TaskWithPlan[];

      const results: TaskSearchResult[] = rows.map(row => {
        let parsedTags: string[] = [];
        try {
          parsedTags = JSON.parse(row.tags || '[]');
        } catch {
          parsedTags = [];
        }
        return {
          id: row.id,
          planId: row.plan_id,
          planName: row.plan_name,
          title: row.title,
          description: row.description,
          status: row.status as TaskStatus,
          priority: row.priority as Priority,
          assignee: row.assignee,
          dueDate: row.due_date,
          tags: parsedTags,
          createdAt: row.created_at
        };
      });

      return {
        count: results.length,
        tasks: results,
        filters: {
          query: query || null,
          planId: planId || null,
          status: status || null,
          priority: priority || null,
          assignee: assignee || null,
          dueBefore: dueBefore || null,
          dueAfter: dueAfter || null,
          tags: tags || null
        }
      };
    }
  );

  // search_plans
  registry.register(
    'search_plans',
    {
      description: 'Search for plans by name, description, or status',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text to search for in plan name and description'
          },
          status: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['draft', 'active', 'completed', 'archived']
            },
            description: 'Filter by plan status(es)'
          },
          projectPath: {
            type: 'string',
            description: 'Filter by project path (partial match)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)'
          }
        }
      }
    },
    (args) => {
      const query = args.query as string | undefined;
      const status = args.status as PlanStatus[] | undefined;
      const projectPath = args.projectPath as string | undefined;
      const limit = Math.min(args.limit as number || 20, 100);

      let sql = 'SELECT * FROM plans WHERE 1=1';
      const params: unknown[] = [];

      if (query) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        const searchPattern = `%${query}%`;
        params.push(searchPattern, searchPattern);
      }

      if (status && status.length > 0) {
        const placeholders = status.map(() => '?').join(', ');
        sql += ` AND status IN (${placeholders})`;
        params.push(...status);
      }

      if (projectPath) {
        sql += ' AND project_path LIKE ?';
        params.push(`%${projectPath}%`);
      }

      sql += ' ORDER BY updated_at DESC LIMIT ?';
      params.push(limit);

      interface PlanRow {
        id: string;
        project_path: string;
        name: string;
        description: string;
        status: string;
        start_date: string | null;
        target_date: string | null;
        created_at: string;
        updated_at: string;
      }

      const rows = db.prepare(sql).all(...params) as PlanRow[];

      const results = rows.map(row => ({
        id: row.id,
        projectPath: row.project_path,
        name: row.name,
        description: row.description,
        status: row.status as PlanStatus,
        startDate: row.start_date,
        targetDate: row.target_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        count: results.length,
        plans: results
      };
    }
  );

  // find_overdue_tasks
  registry.register(
    'find_overdue_tasks',
    {
      description: 'Find all tasks that are past their due date and not yet completed',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Filter to a specific plan'
          }
        }
      }
    },
    (args) => {
      const planId = args.planId as string | undefined;
      const today = new Date().toISOString().split('T')[0];

      let sql = `
        SELECT t.*, p.name as plan_name
        FROM tasks t
        JOIN plans p ON t.plan_id = p.id
        WHERE t.due_date IS NOT NULL
        AND t.due_date < ?
        AND t.status NOT IN (?, ?)
      `;
      const params: unknown[] = [today, TaskStatus.COMPLETED, TaskStatus.CANCELLED];

      if (planId) {
        sql += ' AND t.plan_id = ?';
        params.push(planId);
      }

      sql += ' ORDER BY t.due_date ASC, t.priority = \'critical\' DESC';

      interface TaskWithPlan {
        id: string;
        plan_id: string;
        plan_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string;
        assignee: string | null;
      }

      const rows = db.prepare(sql).all(...params) as TaskWithPlan[];

      const results = rows.map(row => ({
        id: row.id,
        planId: row.plan_id,
        planName: row.plan_name,
        title: row.title,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date,
        assignee: row.assignee,
        daysOverdue: Math.floor((new Date().getTime() - new Date(row.due_date).getTime()) / (1000 * 60 * 60 * 24))
      }));

      return {
        count: results.length,
        overdueTasks: results,
        asOfDate: today
      };
    }
  );

  // find_upcoming_tasks
  registry.register(
    'find_upcoming_tasks',
    {
      description: 'Find tasks due within a specified number of days',
      inputSchema: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look ahead (default: 7)'
          },
          planId: {
            type: 'string',
            description: 'Filter to a specific plan'
          }
        }
      }
    },
    (args) => {
      const days = args.days as number || 7;
      const planId = args.planId as string | undefined;

      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + days);

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      let sql = `
        SELECT t.*, p.name as plan_name
        FROM tasks t
        JOIN plans p ON t.plan_id = p.id
        WHERE t.due_date IS NOT NULL
        AND t.due_date >= ?
        AND t.due_date <= ?
        AND t.status NOT IN (?, ?)
      `;
      const params: unknown[] = [todayStr, futureDateStr, TaskStatus.COMPLETED, TaskStatus.CANCELLED];

      if (planId) {
        sql += ' AND t.plan_id = ?';
        params.push(planId);
      }

      sql += ' ORDER BY t.due_date ASC, t.priority = \'critical\' DESC';

      interface TaskWithPlan {
        id: string;
        plan_id: string;
        plan_name: string;
        title: string;
        status: string;
        priority: string;
        due_date: string;
        assignee: string | null;
      }

      const rows = db.prepare(sql).all(...params) as TaskWithPlan[];

      const results = rows.map(row => ({
        id: row.id,
        planId: row.plan_id,
        planName: row.plan_name,
        title: row.title,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date,
        assignee: row.assignee,
        daysUntilDue: Math.ceil((new Date(row.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }));

      return {
        count: results.length,
        upcomingTasks: results,
        dateRange: {
          from: todayStr,
          to: futureDateStr
        }
      };
    }
  );

  // get_task_summary
  registry.register(
    'get_task_summary',
    {
      description: 'Get a summary of tasks grouped by status and priority',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Get summary for a specific plan (optional, defaults to all plans)'
          }
        }
      }
    },
    (args) => {
      const planId = args.planId as string | undefined;

      // Status counts
      let statusSql = 'SELECT status, COUNT(*) as count FROM tasks';
      const statusParams: unknown[] = [];
      if (planId) {
        statusSql += ' WHERE plan_id = ?';
        statusParams.push(planId);
      }
      statusSql += ' GROUP BY status';

      const statusRows = db.prepare(statusSql).all(...statusParams) as Array<{ status: string; count: number }>;
      const byStatus: Record<string, number> = {};
      for (const row of statusRows) {
        byStatus[row.status] = row.count;
      }

      // Priority counts (excluding completed/cancelled)
      let prioritySql = 'SELECT priority, COUNT(*) as count FROM tasks WHERE status NOT IN (?, ?)';
      const priorityParams: unknown[] = [TaskStatus.COMPLETED, TaskStatus.CANCELLED];
      if (planId) {
        prioritySql += ' AND plan_id = ?';
        priorityParams.push(planId);
      }
      prioritySql += ' GROUP BY priority';

      const priorityRows = db.prepare(prioritySql).all(...priorityParams) as Array<{ priority: string; count: number }>;
      const byPriority: Record<string, number> = {};
      for (const row of priorityRows) {
        byPriority[row.priority] = row.count;
      }

      // Overdue count
      const today = new Date().toISOString().split('T')[0];
      let overdueSql = 'SELECT COUNT(*) as count FROM tasks WHERE due_date < ? AND status NOT IN (?, ?)';
      const overdueParams: unknown[] = [today, TaskStatus.COMPLETED, TaskStatus.CANCELLED];
      if (planId) {
        overdueSql += ' AND plan_id = ?';
        overdueParams.push(planId);
      }
      const overdueResult = db.prepare(overdueSql).get(...overdueParams) as { count: number };

      // Total and active counts
      const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      const completed = (byStatus[TaskStatus.COMPLETED] || 0) + (byStatus[TaskStatus.CANCELLED] || 0);
      const active = total - completed;

      return {
        total,
        active,
        completed,
        overdue: overdueResult.count,
        byStatus,
        byPriority,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    }
  );
}
