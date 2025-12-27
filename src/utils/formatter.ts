/**
 * Format tool results for human-readable output
 */

type ResultValue = string | number | boolean | null | undefined | ResultValue[] | { [key: string]: ResultValue };

/**
 * Format a tool result into readable text
 */
export function formatResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result === null || result === undefined) {
    return 'No result';
  }

  if (typeof result !== 'object') {
    return String(result);
  }

  const obj = result as Record<string, ResultValue>;

  // Check for common patterns and format accordingly
  if ('message' in obj && typeof obj.message === 'string') {
    return formatWithMessage(obj);
  }

  if ('plans' in obj && Array.isArray(obj.plans)) {
    return formatPlansList(obj.plans as Record<string, ResultValue>[], obj.count as number);
  }

  if ('tasks' in obj && Array.isArray(obj.tasks)) {
    return formatTasksList(obj.tasks as Record<string, ResultValue>[], obj);
  }

  if ('comments' in obj && Array.isArray(obj.comments)) {
    return formatCommentsList(obj.comments as Record<string, ResultValue>[]);
  }

  if ('templates' in obj && Array.isArray(obj.templates)) {
    return formatTemplatesList(obj.templates as Record<string, ResultValue>[]);
  }

  if ('dependencies' in obj || 'dependsOn' in obj || 'blocks' in obj) {
    return formatDependencies(obj);
  }

  if ('byStatus' in obj || 'byPriority' in obj) {
    return formatSummary(obj);
  }

  // Single entity with id
  if ('id' in obj || 'planId' in obj || 'taskId' in obj) {
    return formatEntity(obj);
  }

  // Fallback to formatted key-value display
  return formatKeyValue(obj);
}

function formatWithMessage(obj: Record<string, ResultValue>): string {
  const lines: string[] = [];
  const message = obj.message as string;

  lines.push(`${message}`);
  lines.push('');

  // Add other relevant fields
  const skipFields = ['message'];
  const entries = Object.entries(obj).filter(([key]) => !skipFields.includes(key));

  if (entries.length > 0) {
    for (const [key, value] of entries) {
      if (value !== null && value !== undefined) {
        lines.push(`  ${formatKey(key)}: ${formatValue(value)}`);
      }
    }
  }

  return lines.join('\n');
}

function formatPlansList(plans: Record<string, ResultValue>[], count?: number): string {
  const lines: string[] = [];

  lines.push(`Found ${count ?? plans.length} plan(s):`);
  lines.push('');

  for (const plan of plans) {
    const status = formatStatus(plan.status as string);
    lines.push(`  [${plan.id}] ${plan.name}`);
    lines.push(`      Status: ${status}  |  Project: ${plan.projectPath || 'N/A'}`);
    if (plan.createdAt) {
      lines.push(`      Created: ${formatDate(plan.createdAt as string)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatTasksList(tasks: Record<string, ResultValue>[], context: Record<string, ResultValue>): string {
  const lines: string[] = [];

  const total = context.total ?? context.count ?? tasks.length;
  lines.push(`Found ${total} task(s):`);
  lines.push('');

  for (const task of tasks) {
    const status = formatStatus(task.status as string);
    const priority = formatPriority(task.priority as string);
    lines.push(`  [${task.id}] ${task.title}`);
    lines.push(`      ${status}  |  ${priority}`);
    if (task.dueDate) {
      lines.push(`      Due: ${formatDate(task.dueDate as string)}`);
    }
    if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
      lines.push(`      Tags: ${(task.tags as string[]).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatCommentsList(comments: Record<string, ResultValue>[]): string {
  const lines: string[] = [];

  lines.push(`${comments.length} comment(s):`);
  lines.push('');

  for (const comment of comments) {
    const author = comment.author || 'Anonymous';
    const date = formatDate(comment.createdAt as string);
    lines.push(`  [${date}] ${author}:`);
    lines.push(`    ${comment.content}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatTemplatesList(templates: Record<string, ResultValue>[]): string {
  const lines: string[] = [];

  lines.push(`Available templates (${templates.length}):`);
  lines.push('');

  for (const template of templates) {
    lines.push(`  ${template.id}: ${template.name}`);
    if (template.description) {
      lines.push(`    ${template.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatDependencies(obj: Record<string, ResultValue>): string {
  const lines: string[] = [];

  if ('canStart' in obj) {
    lines.push(obj.canStart ? 'Task can be started' : 'Task cannot be started yet');
    lines.push('');
  }

  if ('dependsOn' in obj && Array.isArray(obj.dependsOn)) {
    const deps = obj.dependsOn as Record<string, ResultValue>[];
    if (deps.length > 0) {
      lines.push(`Depends on (${deps.length}):`);
      for (const dep of deps) {
        lines.push(`  - [${dep.id}] ${dep.title || dep.taskId} (${formatStatus(dep.status as string)})`);
      }
      lines.push('');
    }
  }

  if ('blocks' in obj && Array.isArray(obj.blocks)) {
    const blocks = obj.blocks as Record<string, ResultValue>[];
    if (blocks.length > 0) {
      lines.push(`Blocks (${blocks.length}):`);
      for (const block of blocks) {
        lines.push(`  - [${block.id}] ${block.title || block.taskId}`);
      }
      lines.push('');
    }
  }

  if ('pendingDependencies' in obj && Array.isArray(obj.pendingDependencies)) {
    const pending = obj.pendingDependencies as Record<string, ResultValue>[];
    if (pending.length > 0) {
      lines.push(`Waiting on (${pending.length}):`);
      for (const p of pending) {
        lines.push(`  - [${p.id}] ${p.title} (${formatStatus(p.status as string)})`);
      }
    }
  }

  if (lines.length === 0) {
    lines.push('No dependencies');
  }

  return lines.join('\n');
}

function formatSummary(obj: Record<string, ResultValue>): string {
  const lines: string[] = [];

  if ('totalTasks' in obj) {
    lines.push(`Total tasks: ${obj.totalTasks}`);
    lines.push('');
  }

  if ('byStatus' in obj && typeof obj.byStatus === 'object') {
    lines.push('By Status:');
    const byStatus = obj.byStatus as Record<string, number>;
    for (const [status, count] of Object.entries(byStatus)) {
      if (count > 0) {
        lines.push(`  ${formatStatus(status)}: ${count}`);
      }
    }
    lines.push('');
  }

  if ('byPriority' in obj && typeof obj.byPriority === 'object') {
    lines.push('By Priority:');
    const byPriority = obj.byPriority as Record<string, number>;
    for (const [priority, count] of Object.entries(byPriority)) {
      if (count > 0) {
        lines.push(`  ${formatPriority(priority)}: ${count}`);
      }
    }
  }

  return lines.join('\n');
}

function formatEntity(obj: Record<string, ResultValue>): string {
  const lines: string[] = [];

  // Header with ID and name/title
  const id = obj.id || obj.planId || obj.taskId;
  const name = obj.name || obj.title;

  if (name) {
    lines.push(`${name}`);
    lines.push(`ID: ${id}`);
  } else {
    lines.push(`ID: ${id}`);
  }
  lines.push('');

  // Important fields first
  const priorityFields = ['status', 'priority', 'projectPath', 'description'];
  const skipFields = ['id', 'planId', 'taskId', 'name', 'title', 'message', ...priorityFields];

  for (const field of priorityFields) {
    if (field in obj && obj[field] !== null && obj[field] !== undefined && obj[field] !== '') {
      let value = obj[field];
      if (field === 'status') value = formatStatus(value as string);
      if (field === 'priority') value = formatPriority(value as string);
      lines.push(`${formatKey(field)}: ${value}`);
    }
  }

  // Other fields
  const otherFields = Object.entries(obj).filter(
    ([key, value]) => !skipFields.includes(key) && value !== null && value !== undefined && value !== ''
  );

  if (otherFields.length > 0) {
    lines.push('');
    for (const [key, value] of otherFields) {
      lines.push(`${formatKey(key)}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

function formatKeyValue(obj: Record<string, ResultValue>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      lines.push(`${formatKey(key)}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

function formatKey(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatValue(value: ResultValue): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ');
    }
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'backlog': 'Backlog',
    'ready': 'Ready',
    'in_progress': 'In Progress',
    'review': 'In Review',
    'blocked': 'Blocked',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'draft': 'Draft',
    'active': 'Active',
    'archived': 'Archived'
  };
  return statusMap[status] || status;
}

function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  };
  return priorityMap[priority] || priority;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
