import { ToolRegistry } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';
import { MarkdownExporter } from '../export/MarkdownExporter.js';
import { Plan } from '../models/Plan.js';
import { Task } from '../models/Task.js';
import { Priority } from '../models/enums.js';

/**
 * Export format for plans
 */
export interface PlanExport {
  version: string;
  exportedAt: string;
  format: 'json' | 'markdown';
  plan: Plan;
  tasks: Task[];
}

/**
 * Register export/import tools
 */
export function registerExportTools(
  registry: ToolRegistry,
  planRepo: PlanRepository,
  taskService: TaskService
): void {
  const markdownExporter = new MarkdownExporter(planRepo, taskService);

  // export_plan
  registry.register(
    'export_plan',
    {
      description: 'Export a plan and its tasks to JSON or markdown format for backup or sharing',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID to export'
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Export format (default: json)'
          }
        },
        required: ['planId']
      }
    },
    (args) => {
      const planId = args.planId as string;
      const format = (args.format as string) || 'json';

      const plan = planRepo.findById(planId);
      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      if (format === 'markdown') {
        return {
          format: 'markdown',
          content: markdownExporter.exportPlan(planId)
        };
      }

      // JSON export
      const tasks = taskService.getTasksForPlan(planId);

      const exportData: PlanExport = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        format: 'json',
        plan,
        tasks
      };

      return {
        format: 'json',
        content: JSON.stringify(exportData, null, 2)
      };
    }
  );

  // import_plan
  registry.register(
    'import_plan',
    {
      description: 'Import a plan from JSON export. Creates a new plan with new IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'JSON string of exported plan data'
          },
          projectPath: {
            type: 'string',
            description: 'Project path for the imported plan (defaults to current directory)'
          },
          newName: {
            type: 'string',
            description: 'Optional new name for the imported plan'
          }
        },
        required: ['data']
      }
    },
    (args) => {
      const data = args.data as string;
      const projectPath = (args.projectPath as string) || process.cwd();
      const newName = args.newName as string | undefined;

      let exportData: PlanExport;
      try {
        exportData = JSON.parse(data);
      } catch {
        throw new Error('Invalid JSON format');
      }

      // Validate export format
      if (!exportData.version || !exportData.plan) {
        throw new Error('Invalid export format: missing version or plan data');
      }

      const sourcePlan = exportData.plan;

      // Create new plan
      const newPlan = planRepo.create({
        projectPath,
        name: newName || `${sourcePlan.name} (imported)`,
        description: sourcePlan.description,
        startDate: sourcePlan.startDate || undefined,
        targetDate: sourcePlan.targetDate || undefined
      });

      // Track old ID -> new ID mapping for parent task references
      const taskIdMap = new Map<string, string>();
      const importedTasks: Task[] = [];

      // Import tasks in order (parents first)
      const tasks = exportData.tasks || [];
      const rootTasks = tasks.filter(t => !t.parentTaskId);
      const childTasks = tasks.filter(t => t.parentTaskId);

      // Import root tasks first
      for (const task of rootTasks) {
        const newTask = taskService.createTask({
          planId: newPlan.id,
          title: task.title,
          description: task.description,
          priority: task.priority as Priority,
          estimatedHours: task.estimatedHours || undefined,
          assignee: task.assignee || undefined,
          dueDate: task.dueDate || undefined
        });
        taskIdMap.set(task.id, newTask.id);
        importedTasks.push(newTask);
      }

      // Import child tasks
      for (const task of childTasks) {
        const newParentId = taskIdMap.get(task.parentTaskId!);
        const newTask = taskService.createTask({
          planId: newPlan.id,
          parentTaskId: newParentId,
          title: task.title,
          description: task.description,
          priority: task.priority as Priority,
          estimatedHours: task.estimatedHours || undefined,
          assignee: task.assignee || undefined,
          dueDate: task.dueDate || undefined
        });
        taskIdMap.set(task.id, newTask.id);
        importedTasks.push(newTask);
      }

      return {
        success: true,
        planId: newPlan.id,
        planName: newPlan.name,
        tasksImported: importedTasks.length,
        message: `Imported plan "${newPlan.name}" with ${importedTasks.length} tasks`
      };
    }
  );
}
