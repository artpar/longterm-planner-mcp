# longterm-planner-mcp

[![npm version](https://badge.fury.io/js/longterm-planner-mcp.svg)](https://www.npmjs.com/package/longterm-planner-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for long-term planning management in Claude Code. Track plans, tasks, goals, and progress across coding sessions with persistent SQLite storage.

## Features

- **Persistent Planning** - SQLite database stores plans and tasks across sessions
- **Task Management** - Full lifecycle: backlog → ready → in_progress → review → completed
- **State Machine** - Enforced status transitions prevent invalid task states
- **Task Dependencies** - Define blocking relationships with circular dependency detection
- **Plan Templates** - 10 built-in templates for common project types (web apps, APIs, etc.)
- **Search & Filter** - Find tasks across plans by text, status, priority, dates, tags, assignee
- **Task Tags** - Categorize tasks with custom labels for organization
- **Task Comments** - Add timestamped notes and updates to tasks
- **Bulk Operations** - Update status, priority, tags, or delete multiple tasks at once
- **Progress Tracking** - Track estimated vs actual hours, completion stats
- **Git Integration** - Link commits to tasks via branch names or commit messages
- **Export/Import** - Export plans to JSON or Markdown, import from JSON
- **Session Continuity** - Pick up where you left off with context preservation
- **Backup & Restore** - Automated backups with rotation

## When to Use

**Worth it for:**
- Multi-session projects where context is lost between conversations
- Team handoffs - persisted state others can pick up
- Complex features with many task dependencies
- Audit trail of decisions and progress

**Overhead for:**
- Single-session tasks (Claude Code's built-in TodoWrite is lighter)
- Solo work where you remember context
- Simple bug fixes or quick features

## Roadmap

- [x] Auto-summarize progress when starting a new session
- [ ] Deeper git integration (auto-link commits to tasks)
- [ ] Session continuity prompts ("Last time you were working on X...")
- [ ] Time tracking and estimates vs actuals reporting

## Installation

### For Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "planning": {
      "command": "npx",
      "args": ["-y", "longterm-planner-mcp"]
    }
  }
}
```

Restart Claude Code to load the server.

### Standalone

```bash
npx longterm-planner-mcp
```

Or install globally:

```bash
npm install -g longterm-planner-mcp
longterm-planner-mcp
```

## Usage

Once installed, Claude Code gains access to planning tools, resources, and prompts.

### Quick Start

```
Create a plan for my current project with tasks for the authentication feature
```

Claude will use the MCP tools to:
1. Create a plan linked to your project
2. Add tasks for the feature
3. Track progress as you work

### Example Workflow

```
# Start a planning session
> Let's plan the user authentication feature

# Claude creates plan and tasks via MCP tools

# Start working on a task
> I'm starting work on the login form task

# Claude marks task as in_progress

# Complete the task
> The login form is done, tests passing

# Claude moves task to completed, logs progress
```

## Tools

### Plan Management

| Tool | Description |
|------|-------------|
| `create_plan` | Create a new plan for a project |
| `get_plan` | Get plan details by ID |
| `update_plan` | Update plan name, description, dates |
| `list_plans` | List all plans, optionally filter by project |
| `archive_plan` | Archive a completed plan |
| `activate_plan` | Activate a draft plan |

### Task Management

| Tool | Description |
|------|-------------|
| `add_task` | Add a task to a plan |
| `update_task` | Update task properties |
| `start_task` | Begin working on a task |
| `complete_task` | Mark task as completed |
| `block_task` | Mark task as blocked with reason |
| `unblock_task` | Remove blocker from task |
| `submit_for_review` | Submit task for review |
| `find_tasks` | Find tasks in a plan with filters |
| `get_blocked` | Get all blocked tasks |
| `get_progress` | Get plan progress statistics |
| `delete_task` | Remove a task |

### Templates

| Tool | Description |
|------|-------------|
| `list_templates` | List available plan templates |
| `create_from_template` | Create a plan from a template |

Built-in templates: `web-app`, `rest-api`, `cli-tool`, `library`, `bug-fix`, `feature`, `project-kickoff`, `sprint`, `release`, `migration`

### Dependencies

| Tool | Description |
|------|-------------|
| `add_dependency` | Add a dependency between tasks |
| `remove_dependency` | Remove a dependency |
| `get_dependencies` | Get task dependencies |
| `get_dependency_chain` | Get full dependency chain |
| `check_can_start` | Check if task can start |

### Search & Filter

| Tool | Description |
|------|-------------|
| `search_tasks` | Search tasks with text and filters |
| `search_plans` | Search plans by name/status |
| `find_overdue_tasks` | Find tasks past due date |
| `find_upcoming_tasks` | Find tasks due within N days |
| `get_task_summary` | Get task statistics |

### Export/Import

| Tool | Description |
|------|-------------|
| `export_plan` | Export plan to JSON or Markdown |
| `import_plan` | Import plan from JSON |

### Tags

| Tool | Description |
|------|-------------|
| `add_tag` | Add a tag to a task |
| `remove_tag` | Remove a tag from a task |
| `set_tags` | Set all tags for a task |
| `get_tags` | Get all unique tags in a plan |
| `find_by_tag` | Find tasks by tag |

### Bulk Operations

| Tool | Description |
|------|-------------|
| `bulk_update_status` | Update status for multiple tasks |
| `bulk_update_priority` | Update priority for multiple tasks |
| `bulk_set_assignee` | Set assignee for multiple tasks |
| `bulk_add_tag` | Add tag to multiple tasks |
| `bulk_remove_tag` | Remove tag from multiple tasks |
| `bulk_delete` | Delete multiple tasks |

### Comments

| Tool | Description |
|------|-------------|
| `add_comment` | Add a comment to a task |
| `list_comments` | List comments for a task |
| `update_comment` | Update a comment |
| `delete_comment` | Delete a comment |
| `get_recent_comments` | Get recent comments in a plan |

### Session

| Tool | Description |
|------|-------------|
| `get_session_summary` | Get project planning context at session start |

**Example output:**
```
Last session: 2d ago
Auth System: 5/12 (42%)
  active: Login form, OAuth setup
  blocked: DB migration
  ready: 3 task(s)
Last: Completed login validation (2d ago)
```

## Resources

Access plan data via MCP resources:

| URI | Description |
|-----|-------------|
| `plan://overview` | Summary of all active plans |
| `plan://kanban/{planId}` | Kanban board view of tasks |
| `plan://progress/{planId}` | Progress statistics |
| `plan://blockers` | All blocked tasks across plans |
| `plan://blockers/{planId}` | Blocked tasks for a specific plan |
| `plan://today` | Tasks to focus on today |

## Prompts

Pre-built prompts for common planning scenarios:

| Prompt | Description |
|--------|-------------|
| `plan_session` | Start a focused planning session |
| `daily_standup` | Review yesterday's progress, plan today |
| `weekly_review` | Weekly progress review and planning |
| `decompose` | Break down a large task into subtasks |
| `retrospective` | Reflect on completed work |
| `unblock` | Strategize solutions for blocked tasks |
| `prioritize` | Re-prioritize backlog tasks |
| `scope_check` | Evaluate if plan scope is realistic |

## Data Storage

Plans are stored in SQLite at `.claude/planning/plans.db` **within each project directory**. This keeps planning data isolated per project and version-controllable if desired.

### Upgrading from v0.2.9 or earlier

Previous versions stored all plans in a global database at `~/.claude/planning/plans.db`. Version 0.2.10+ automatically migrates your data:

1. **Update the package**: Just restart Claude Code - it uses `npx -y` which fetches the latest version
2. **Migration runs automatically**: On first startup, existing plans are copied to their respective project directories
3. **Global database archived**: The old database is renamed to `plans.db.migrated` as a backup

No action required - the migration is seamless and preserves all your data.

### Schema

- **plans** - Project plans with status, dates, context
- **tasks** - Tasks with status, priority, estimates, tags, assignments
- **task_comments** - Timestamped comments on tasks
- **goals** - High-level goals (hierarchical)
- **objectives** - Measurable objectives under goals
- **milestones** - Time-bound checkpoints
- **dependencies** - Task/goal dependencies
- **blockers** - Issues blocking progress
- **progress_logs** - Activity history
- **sessions** - Planning session tracking

## Task States

Tasks follow a defined state machine:

```
                    ┌──────────┐
                    │ CANCELLED│
                    └──────────┘
                         ↑
┌────────┐    ┌───────┐  │  ┌─────────────┐    ┌────────┐    ┌───────────┐
│BACKLOG │ →  │ READY │ ─┼→ │ IN_PROGRESS │ →  │ REVIEW │ →  │ COMPLETED │
└────────┘    └───────┘  │  └─────────────┘    └────────┘    └───────────┘
                         │         ↓ ↑
                         │    ┌─────────┐
                         └────│ BLOCKED │
                              └─────────┘
```

Valid transitions:
- `backlog` → `ready`, `cancelled`
- `ready` → `in_progress`, `backlog`, `cancelled`
- `in_progress` → `review`, `blocked`, `cancelled`
- `blocked` → `in_progress`, `cancelled`
- `review` → `completed`, `in_progress`, `cancelled`

## Git Integration

Link commits to tasks automatically:

### Via Commit Message
```bash
git commit -m "Add login validation #task-abc123"
```

### Via Branch Name
```bash
git checkout -b feature/task-abc123-login-form
```

The server parses task references and links commits for traceability.

## Programmatic Usage

```typescript
import {
  PlanningServer,
  Database,
  PlanRepository,
  TaskService
} from 'longterm-planner-mcp';

// Use the server
const server = new PlanningServer({
  dbPath: './my-plans.db'
});
await server.start();

// Or use components directly
const db = new Database('./plans.db');
const planRepo = new PlanRepository(db);
const plan = planRepo.create({
  projectPath: '/my/project',
  name: 'My Plan'
});
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PLANNING_DB_PATH` | Database file path | `.claude/planning/plans.db` (in project dir) |

## Development

```bash
# Clone the repo
git clone https://github.com/artpar/longterm-planner-mcp
cd longterm-planner-mcp

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run locally
npm start
```

### Testing

```bash
# Run all tests
npm run test:run

# Watch mode
npm test

# Coverage
npm run test:coverage
```

## Requirements

- Node.js >= 18.0.0
- Claude Code (for MCP integration)

## License

MIT

## Contributing

Contributions welcome! Please read the contributing guidelines and submit PRs.

## Related

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Claude Code](https://claude.com/claude-code) - AI coding assistant
