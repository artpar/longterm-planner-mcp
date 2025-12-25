/**
 * Session - represents a Claude Code session working on a plan
 */
export interface Session {
  id: string;
  planId: string;
  startedAt: string;
  endedAt: string | null;
  contextSummary: string;
  continuationHints: string[];
  activeTaskId: string | null;
  environmentSnapshot: EnvironmentSnapshot;
}

/**
 * Environment state snapshot at session end
 */
export interface EnvironmentSnapshot {
  gitBranch: string | null;
  uncommittedChanges: boolean;
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  workingDirectory: string;
}

/**
 * Input for creating a session
 */
export interface CreateSessionInput {
  planId: string;
  environmentSnapshot?: Partial<EnvironmentSnapshot>;
}

/**
 * Input for ending a session
 */
export interface EndSessionInput {
  contextSummary: string;
  continuationHints?: string[];
  activeTaskId?: string;
  environmentSnapshot?: EnvironmentSnapshot;
}

/**
 * Default environment snapshot
 */
export function createEmptyEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    gitBranch: null,
    uncommittedChanges: false,
    lastCommitSha: null,
    lastCommitMessage: null,
    workingDirectory: ''
  };
}
