import { PlanRepository } from '../db/repositories/PlanRepository.js';
import { TaskService } from '../services/TaskService.js';
import { Task } from '../models/Task.js';
import { TaskStatus, Priority } from '../models/enums.js';

export interface ParsedTask {
  title: string;
  completed: boolean;
  priority?: string;
  section?: string;
}

export interface ParsedMarkdown {
  title?: string;
  description?: string;
  tasks: ParsedTask[];
}

/**
 * Export plans and tasks to markdown format
 */
export class MarkdownExporter {
  constructor(
    private planRepo: PlanRepository,
    private taskService: TaskService
  ) {}

  /**
   * Export a plan to full markdown
   */
  exportPlan(planId: string): string {
    const plan = this.planRepo.findById(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const stats = this.taskService.getProgressStats(planId);
    const tasks = this.taskService.getTasksForPlan(planId);

    const lines: string[] = [];

    // Header
    lines.push(`# ${plan.name}`);
    lines.push('');

    // Description
    if (plan.description) {
      lines.push(plan.description);
      lines.push('');
    }

    // Status and progress
    lines.push('## Overview');
    lines.push('');
    lines.push(`**Status:** ${plan.status}`);
    lines.push(`**Progress:** ${stats.completed}/${stats.total} tasks (${Math.round(stats.percentComplete)}%)`);
    if (plan.startDate) {
      lines.push(`**Started:** ${plan.startDate}`);
    }
    if (plan.targetDate) {
      lines.push(`**Target:** ${plan.targetDate}`);
    }
    lines.push('');

    // Group tasks by status
    const statusGroups = this.groupTasksByStatus(tasks);

    for (const [status, statusTasks] of Object.entries(statusGroups)) {
      if (statusTasks.length === 0) continue;

      lines.push(`## ${this.formatStatusTitle(status as TaskStatus)}`);
      lines.push('');

      for (const task of statusTasks) {
        lines.push(this.formatTaskLine(task));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export a concise plan summary
   */
  exportPlanSummary(planId: string): string {
    const plan = this.planRepo.findById(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const stats = this.taskService.getProgressStats(planId);

    const lines: string[] = [];
    lines.push(`## ${plan.name}`);
    lines.push('');
    lines.push(`- **Status:** ${plan.status}`);
    lines.push(`- **Total Tasks:** ${stats.total}`);
    lines.push(`- **Completed:** ${stats.completed}`);
    lines.push(`- **In Progress:** ${stats.inProgress}`);
    lines.push(`- **Blocked:** ${stats.blocked}`);
    lines.push(`- **Progress:** ${Math.round(stats.percentComplete)}%`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Export all plans
   */
  exportAllPlans(): string {
    const plans = this.planRepo.findAll();

    const lines: string[] = [];
    lines.push('# Planning Overview');
    lines.push('');
    lines.push(`*Generated: ${new Date().toISOString()}*`);
    lines.push('');

    // Summary table
    lines.push('| Plan | Status | Progress |');
    lines.push('|------|--------|----------|');

    for (const plan of plans) {
      const stats = this.taskService.getProgressStats(plan.id);
      lines.push(`| ${plan.name} | ${plan.status} | ${Math.round(stats.percentComplete)}% |`);
    }
    lines.push('');

    // Individual plans
    for (const plan of plans) {
      lines.push('---');
      lines.push('');
      lines.push(this.exportPlanSummary(plan.id));
    }

    return lines.join('\n');
  }

  /**
   * Export detailed task information
   */
  exportTaskDetails(taskId: string): string {
    const task = this.taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const lines: string[] = [];

    // Header
    lines.push(`# ${task.title}`);
    lines.push('');

    // Metadata
    lines.push('## Details');
    lines.push('');
    lines.push(`- **Status:** ${task.status}`);
    lines.push(`- **Priority:** ${task.priority}`);

    if (task.estimatedHours) {
      lines.push(`- **Estimated Hours:** ${task.estimatedHours}`);
    }
    if (task.actualHours) {
      lines.push(`- **Actual Hours:** ${task.actualHours}`);
    }
    if (task.assignee) {
      lines.push(`- **Assignee:** ${task.assignee}`);
    }
    if (task.dueDate) {
      lines.push(`- **Due Date:** ${task.dueDate}`);
    }
    lines.push('');

    // Description
    if (task.description) {
      lines.push('## Description');
      lines.push('');
      lines.push(task.description);
      lines.push('');
    }

    // Subtasks
    const subtasks = this.taskService.getSubtasks(taskId);
    if (subtasks.length > 0) {
      lines.push('## Subtasks');
      lines.push('');
      for (const subtask of subtasks) {
        lines.push(this.formatTaskLine(subtask));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Parse markdown back to structured data
   */
  parseMarkdown(markdown: string): ParsedMarkdown {
    const lines = markdown.split('\n');
    const result: ParsedMarkdown = {
      tasks: []
    };

    let currentSection = '';

    for (const line of lines) {
      // Parse title
      const titleMatch = line.match(/^# (.+)$/);
      if (titleMatch) {
        result.title = titleMatch[1];
        continue;
      }

      // Parse section headers
      const sectionMatch = line.match(/^## (.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        continue;
      }

      // Parse task checkboxes
      const taskMatch = line.match(/^- \[([ x])\] (?:\[(\w+)\] )?(.+)$/);
      if (taskMatch) {
        const completed = taskMatch[1] === 'x';
        const priority = taskMatch[2]?.toLowerCase();
        const title = taskMatch[3].trim();

        result.tasks.push({
          title,
          completed,
          priority,
          section: currentSection
        });
      }
    }

    return result;
  }

  /**
   * Group tasks by status
   */
  private groupTasksByStatus(tasks: Task[]): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {
      [TaskStatus.BACKLOG]: [],
      [TaskStatus.READY]: [],
      [TaskStatus.IN_PROGRESS]: [],
      [TaskStatus.REVIEW]: [],
      [TaskStatus.BLOCKED]: [],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.CANCELLED]: []
    };

    for (const task of tasks) {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    }

    return groups;
  }

  /**
   * Format a task as a markdown checkbox line
   */
  private formatTaskLine(task: Task): string {
    const checkbox = task.status === TaskStatus.COMPLETED ? '[x]' : '[ ]';
    const priority = task.priority !== Priority.MEDIUM ? ` [${task.priority}]` : '';

    return `- ${checkbox}${priority} ${task.title}`;
  }

  /**
   * Format status as readable title
   */
  private formatStatusTitle(status: TaskStatus): string {
    const titles: Record<TaskStatus, string> = {
      [TaskStatus.BACKLOG]: 'Backlog',
      [TaskStatus.READY]: 'Ready',
      [TaskStatus.IN_PROGRESS]: 'In Progress',
      [TaskStatus.REVIEW]: 'In Review',
      [TaskStatus.BLOCKED]: 'Blocked',
      [TaskStatus.COMPLETED]: 'Completed',
      [TaskStatus.CANCELLED]: 'Cancelled'
    };
    return titles[status] || status;
  }
}
