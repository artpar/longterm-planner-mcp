# longterm-planner-mcp

A Model Context Protocol (MCP) server for long-term planning management in Claude Code. Track plans, tasks, goals, and progress across coding sessions with persistent SQLite storage.

## Features

- **Persistent Planning** - SQLite database stores plans and tasks across sessions
- **Task Management** - Full lifecycle: backlog → ready → in_progress → review → completed
- **State Machine** - Enforced status transitions prevent invalid task states
- **Progress Tracking** - Track estimated vs actual hours, completion stats
- **Git Integration** - Link commits to tasks via branch names or commit messages
- **Session Continuity** - Pick up where you left off with context preservation
- **Markdown Export** - Export plans to readable markdown format
- **Backup & Restore** - Automated backups with rotation

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
| `clone_plan` | Clone a plan as a template |

### Task Management

| Tool | Description |
|------|-------------|
| `add_task` | Add a task to a plan |
| `get_task` | Get task details |
| `update_task` | Update task properties |
| `delete_task` | Remove a task |
| `start_task` | Begin working on a task |
| `complete_task` | Mark task as completed |
| `block_task` | Mark task as blocked with reason |
| `unblock_task` | Remove blocker from task |
| `add_subtask` | Create a subtask |
| `reorder_tasks` | Change task sequence |
| `bulk_update_tasks` | Update multiple tasks at once |

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

Plans are stored in SQLite at `~/.claude/planning/plans.db`.

### Schema

- **plans** - Project plans with status, dates, context
- **tasks** - Tasks with status, priority, estimates, assignments
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
| `PLANNING_DB_PATH` | Database file path | `~/.claude/planning/plans.db` |

## Development

```bash
# Clone the repo
git clone https://github.com/youruser/longterm-planner-mcp
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
