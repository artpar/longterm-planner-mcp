import { ToolRegistry } from './types.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';
import { getTemplates, getTemplateById, getTemplatesByCategory, PlanTemplate, TemplateTask } from '../templates/index.js';
import { Priority } from '../models/enums.js';

/**
 * Register template-related tools
 */
export function registerTemplateTools(
  registry: ToolRegistry,
  planRepo: PlanRepository,
  taskService: TaskService
): void {
  // list_templates
  registry.register(
    'list_templates',
    {
      description: 'List available plan templates for common project types',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['development', 'general', 'all'],
            description: 'Filter templates by category (default: all)'
          }
        }
      }
    },
    (args) => {
      const category = (args.category as string) || 'all';

      let templates: PlanTemplate[];
      if (category === 'all') {
        templates = getTemplates();
      } else {
        templates = getTemplatesByCategory(category as 'development' | 'general');
      }

      return {
        count: templates.length,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          taskCount: countTasks(t.tasks)
        }))
      };
    }
  );

  // create_from_template
  registry.register(
    'create_from_template',
    {
      description: 'Create a new plan from a template with predefined tasks',
      inputSchema: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            description: 'Template ID to use (use list_templates to see available templates)'
          },
          name: {
            type: 'string',
            description: 'Name for the new plan (optional, defaults to template name)'
          },
          description: {
            type: 'string',
            description: 'Description for the new plan (optional, defaults to template description)'
          },
          projectPath: {
            type: 'string',
            description: 'Project path for the plan (defaults to current directory)'
          }
        },
        required: ['templateId']
      }
    },
    (args) => {
      const templateId = args.templateId as string;
      const projectPath = (args.projectPath as string) || process.cwd();

      const template = getTemplateById(templateId);
      if (!template) {
        const available = getTemplates().map(t => t.id).join(', ');
        throw new Error(`Template not found: ${templateId}. Available templates: ${available}`);
      }

      // Create the plan
      const plan = planRepo.create({
        projectPath,
        name: (args.name as string) || template.name,
        description: (args.description as string) || template.description
      });

      // Create tasks from template
      const createdTasks = createTasksFromTemplate(
        taskService,
        plan.id,
        template.tasks,
        null
      );

      return {
        success: true,
        planId: plan.id,
        planName: plan.name,
        templateUsed: template.name,
        tasksCreated: createdTasks,
        message: `Created plan "${plan.name}" from template "${template.name}" with ${createdTasks} tasks`
      };
    }
  );
}

/**
 * Count total tasks including nested children
 */
function countTasks(tasks: TemplateTask[]): number {
  let count = 0;
  for (const task of tasks) {
    count++;
    if (task.children) {
      count += countTasks(task.children);
    }
  }
  return count;
}

/**
 * Recursively create tasks from template
 */
function createTasksFromTemplate(
  taskService: TaskService,
  planId: string,
  tasks: TemplateTask[],
  parentTaskId: string | null
): number {
  let count = 0;

  for (const templateTask of tasks) {
    const task = taskService.createTask({
      planId,
      parentTaskId: parentTaskId || undefined,
      title: templateTask.title,
      description: templateTask.description,
      priority: templateTask.priority || Priority.MEDIUM
    });
    count++;

    // Create children if any
    if (templateTask.children && templateTask.children.length > 0) {
      count += createTasksFromTemplate(
        taskService,
        planId,
        templateTask.children,
        task.id
      );
    }
  }

  return count;
}
