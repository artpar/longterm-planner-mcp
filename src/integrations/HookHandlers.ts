import { v4 as uuidv4 } from 'uuid';
import { Database } from '../db/Database.js';
import { TaskService } from '../services/TaskService.js';
import { PlanRepository } from '../db/repositories/PlanRepository.js';

export interface SessionStartInput {
  planId?: string;
  context?: Record<string, unknown>;
}

export interface SessionStartResult {
  sessionId: string;
  success: boolean;
}

export interface SessionEndInput {
  sessionId: string;
  summary?: string;
  continuationHints?: string[];
}

export interface SessionEndResult {
  success: boolean;
  error?: string;
}

export interface PreToolUseInput {
  toolName: string;
  input: Record<string, unknown>;
  activeTaskId?: string;
}

export interface PreToolUseResult {
  allowed: boolean;
  reason?: string;
}

export interface PostToolUseInput {
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  activeTaskId?: string;
}

export interface PostToolUseResult {
  logged: boolean;
}

export interface StopInput {
  sessionId?: string;
  activeTaskId?: string;
  summary?: string;
}

export interface StopResult {
  success: boolean;
  contextSaved: boolean;
}

export interface NotificationInput {
  type: 'info' | 'warning' | 'error' | 'reminder';
  message: string;
  taskId?: string;
  planId?: string;
}

export interface NotificationResult {
  acknowledged: boolean;
}

export interface UserPromptSubmitInput {
  prompt: string;
}

export interface UserPromptSubmitResult {
  detectedTasks: string[];
  detectedActions: string[];
}

export interface SessionInfo {
  id: string;
  planId: string | null;
  startedAt: string;
  activeTaskId: string | null;
}

interface SessionRow {
  id: string;
  plan_id: string | null;
  started_at: string;
  ended_at: string | null;
  context_summary: string;
  continuation_hints: string;
  active_task_id: string | null;
  environment_snapshot: string;
}

/**
 * Hook handlers for Claude Code integration
 */
export class HookHandlers {
  constructor(
    private db: Database,
    private taskService: TaskService,
    _planRepo?: PlanRepository // Reserved for future use
  ) {}

  /**
   * Handle session start event
   */
  handleSessionStart(input: SessionStartInput): SessionStartResult {
    const sessionId = uuidv4();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (id, plan_id, started_at, environment_snapshot)
        VALUES (?, ?, datetime('now'), ?)
      `);

      stmt.run(
        sessionId,
        input.planId ?? null,
        JSON.stringify(input.context ?? {})
      );

      return { sessionId, success: true };
    } catch {
      return { sessionId, success: false };
    }
  }

  /**
   * Handle session end event
   */
  handleSessionEnd(input: SessionEndInput): SessionEndResult {
    try {
      const stmt = this.db.prepare(`
        UPDATE sessions
        SET ended_at = datetime('now'),
            context_summary = ?,
            continuation_hints = ?
        WHERE id = ? AND ended_at IS NULL
      `);

      const result = stmt.run(
        input.summary ?? '',
        JSON.stringify(input.continuationHints ?? []),
        input.sessionId
      );

      if (result.changes === 0) {
        return { success: false, error: 'Session not found or already ended' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Handle pre-tool-use event
   * Can block dangerous operations or log tool usage
   */
  handlePreToolUse(input: PreToolUseInput): PreToolUseResult {
    // Log the tool usage intent
    if (input.activeTaskId) {
      this.logProgress({
        entityType: 'task',
        entityId: input.activeTaskId,
        action: 'tool_start',
        message: `Starting ${input.toolName}`,
        metadata: { tool: input.toolName, input: input.input }
      });
    }

    // By default, allow all tools
    // Could implement restrictions here if needed
    return { allowed: true };
  }

  /**
   * Handle post-tool-use event
   * Logs tool completion and updates task progress
   */
  handlePostToolUse(input: PostToolUseInput): PostToolUseResult {
    if (input.activeTaskId) {
      const action = input.error ? 'tool_error' : 'tool_complete';
      const message = input.error
        ? `${input.toolName} failed: ${input.error}`
        : `${input.toolName} completed`;

      this.logProgress({
        entityType: 'task',
        entityId: input.activeTaskId,
        action,
        message,
        metadata: {
          tool: input.toolName,
          hasError: !!input.error
        }
      });
    }

    return { logged: true };
  }

  /**
   * Handle stop event (session ending, possibly unexpectedly)
   * Saves context for continuation
   */
  handleStop(input: StopInput): StopResult {
    let contextSaved = false;

    // Save session context
    if (input.sessionId) {
      const endResult = this.handleSessionEnd({
        sessionId: input.sessionId,
        summary: input.summary
      });
      contextSaved = endResult.success;
    }

    // Update active task with continuation context
    if (input.activeTaskId) {
      const task = this.taskService.getTask(input.activeTaskId);
      if (task) {
        const context = typeof task.context === 'string'
          ? JSON.parse(task.context || '{}')
          : (task.context ?? {});

        context.lastStopReason = input.summary ?? 'Session ended';
        context.lastStopTime = new Date().toISOString();

        this.taskService.updateTask(input.activeTaskId, {
          context: context as Record<string, unknown>
        });

        contextSaved = true;
      }
    }

    return { success: true, contextSaved };
  }

  /**
   * Handle notification event
   */
  handleNotification(input: NotificationInput): NotificationResult {
    // Log notification
    if (input.taskId) {
      this.logProgress({
        entityType: 'task',
        entityId: input.taskId,
        action: 'notification',
        message: `[${input.type}] ${input.message}`,
        metadata: { notificationType: input.type }
      });
    } else if (input.planId) {
      this.logProgress({
        entityType: 'plan',
        entityId: input.planId,
        action: 'notification',
        message: `[${input.type}] ${input.message}`,
        metadata: { notificationType: input.type }
      });
    }

    return { acknowledged: true };
  }

  /**
   * Handle user prompt submit
   * Extracts task references and suggested actions from user input
   */
  handleUserPromptSubmit(input: UserPromptSubmitInput): UserPromptSubmitResult {
    const detectedTasks: string[] = [];
    const detectedActions: string[] = [];

    // Parse task references
    const taskPattern = /#?task-([a-zA-Z0-9-]+)/g;
    let match;
    while ((match = taskPattern.exec(input.prompt)) !== null) {
      detectedTasks.push(match[1]);
    }

    // Detect common action keywords
    const actionPatterns = [
      { pattern: /\b(complete|finish|done)\b/i, action: 'complete' },
      { pattern: /\b(start|begin|work on)\b/i, action: 'start' },
      { pattern: /\b(block|blocked|stuck)\b/i, action: 'block' },
      { pattern: /\b(review|check)\b/i, action: 'review' }
    ];

    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(input.prompt)) {
        detectedActions.push(action);
      }
    }

    return {
      detectedTasks: [...new Set(detectedTasks)],
      detectedActions: [...new Set(detectedActions)]
    };
  }

  /**
   * Get active session for a plan
   */
  getActiveSession(planId: string): SessionInfo | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE plan_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);

    const row = stmt.get(planId) as SessionRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      planId: row.plan_id,
      startedAt: row.started_at,
      activeTaskId: row.active_task_id
    };
  }

  /**
   * Log progress entry
   */
  private logProgress(entry: {
    entityType: string;
    entityId: string;
    action: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): void {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO progress_logs (id, entity_type, entity_id, action, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.message,
      JSON.stringify(entry.metadata ?? {})
    );
  }
}
