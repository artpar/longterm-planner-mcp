/**
 * Format tool results - compact, scannable output for logs
 */

type Val = string | number | boolean | null | undefined | Val[] | { [key: string]: Val };

export function formatResult(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result === null || result === undefined) return 'Done';
  if (typeof result !== 'object') return String(result);

  const obj = result as Record<string, Val>;

  // Message-based results
  if ('message' in obj) {
    const id = obj.planId || obj.taskId || obj.id;
    return id ? `${obj.message} (${id})` : String(obj.message);
  }

  // Lists
  if ('plans' in obj && Array.isArray(obj.plans)) {
    return formatPlans(obj.plans as Record<string, Val>[]);
  }
  if ('tasks' in obj && Array.isArray(obj.tasks)) {
    return formatTasks(obj.tasks as Record<string, Val>[]);
  }
  if ('comments' in obj && Array.isArray(obj.comments)) {
    return formatComments(obj.comments as Record<string, Val>[]);
  }
  if ('templates' in obj && Array.isArray(obj.templates)) {
    return formatTemplates(obj.templates as Record<string, Val>[]);
  }

  // Dependencies
  if ('canStart' in obj) {
    return formatCanStart(obj);
  }
  if ('dependsOn' in obj || 'blocks' in obj) {
    return formatDeps(obj);
  }

  // Summary stats
  if ('byStatus' in obj || 'byPriority' in obj) {
    return formatStats(obj);
  }

  // Progress
  if ('completed' in obj && 'total' in obj) {
    return `${obj.completed}/${obj.total} completed (${obj.percentComplete || 0}%)`;
  }

  // Single entity
  if ('id' in obj || 'planId' in obj || 'taskId' in obj) {
    return formatEntity(obj);
  }

  // Generic object - one line per key
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${fmt(v)}`)
    .join(' | ');
}

function formatPlans(plans: Record<string, Val>[]): string {
  if (plans.length === 0) return 'No plans';
  return plans.map(p => `${p.id}: ${p.name} [${status(p.status)}]`).join('\n');
}

function formatTasks(tasks: Record<string, Val>[]): string {
  if (tasks.length === 0) return 'No tasks';
  return tasks.map(t => {
    const parts = [`${t.id}: ${t.title}`, status(t.status)];
    if (t.priority && t.priority !== 'medium') parts.push(priority(t.priority as string));
    if (t.dueDate) parts.push(`due ${shortDate(t.dueDate as string)}`);
    return parts.join(' | ');
  }).join('\n');
}

function formatComments(comments: Record<string, Val>[]): string {
  if (comments.length === 0) return 'No comments';
  return comments.map(c =>
    `${shortDate(c.createdAt as string)} ${c.author || 'anon'}: ${c.content}`
  ).join('\n');
}

function formatTemplates(templates: Record<string, Val>[]): string {
  return templates.map(t => `${t.id}: ${t.name}`).join('\n');
}

function formatCanStart(obj: Record<string, Val>): string {
  if (obj.canStart) return 'Ready to start';
  const pending = obj.pendingDependencies as Record<string, Val>[] | undefined;
  if (pending?.length) {
    return `Blocked by: ${pending.map(p => p.title || p.id).join(', ')}`;
  }
  return 'Cannot start yet';
}

function formatDeps(obj: Record<string, Val>): string {
  const parts: string[] = [];
  const deps = obj.dependsOn as Record<string, Val>[] | undefined;
  const blocks = obj.blocks as Record<string, Val>[] | undefined;
  if (deps?.length) parts.push(`depends on: ${deps.map(d => d.title || d.id).join(', ')}`);
  if (blocks?.length) parts.push(`blocks: ${blocks.map(b => b.title || b.id).join(', ')}`);
  return parts.join(' | ') || 'No dependencies';
}

function formatStats(obj: Record<string, Val>): string {
  const parts: string[] = [];
  if (obj.totalTasks) parts.push(`${obj.totalTasks} tasks`);
  const byStatus = obj.byStatus as Record<string, number> | undefined;
  if (byStatus) {
    const active = (byStatus.in_progress || 0) + (byStatus.review || 0);
    const done = byStatus.completed || 0;
    const blocked = byStatus.blocked || 0;
    if (active) parts.push(`${active} active`);
    if (done) parts.push(`${done} done`);
    if (blocked) parts.push(`${blocked} blocked`);
  }
  return parts.join(', ') || 'No stats';
}

function formatEntity(obj: Record<string, Val>): string {
  const id = obj.id || obj.planId || obj.taskId;
  const name = obj.name || obj.title;
  const parts: string[] = [];

  if (name) parts.push(String(name));
  if (id) parts.push(`(${id})`);
  if (obj.status) parts.push(`[${status(obj.status)}]`);
  if (obj.priority && obj.priority !== 'medium') parts.push(priority(obj.priority as string));

  return parts.join(' ') || String(id);
}

function status(s: Val): string {
  const map: Record<string, string> = {
    backlog: 'backlog', ready: 'ready', in_progress: 'active',
    review: 'review', blocked: 'BLOCKED', completed: 'done',
    cancelled: 'cancelled', draft: 'draft', active: 'active', archived: 'archived'
  };
  return map[String(s)] || String(s);
}

function priority(p: string): string {
  const map: Record<string, string> = { critical: 'CRIT', high: 'HIGH', medium: '', low: 'low' };
  return map[p] || p;
}

function shortDate(d: string): string {
  try {
    const date = new Date(d);
    const m = date.getMonth() + 1;
    const day = date.getDate();
    return `${m}/${day}`;
  } catch { return d; }
}

function fmt(v: Val): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
