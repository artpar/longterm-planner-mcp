---
layout: default
title: Getting Started
---

# Getting Started

## Installation

### For Claude Code (Recommended)

Add the server to your Claude Code configuration:

**macOS/Linux:** `~/.claude/settings.json`
**Windows:** `%APPDATA%\claude\settings.json`

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

Run directly with npx:

```bash
npx longterm-planner-mcp
```

Or install globally:

```bash
npm install -g longterm-planner-mcp
longterm-planner-mcp
```

## Your First Plan

Once installed, ask Claude to create a plan:

```
Create a plan for my current project
```

Claude will:
1. Create a plan linked to your project directory
2. Ask what features or tasks you want to track
3. Add tasks with appropriate priorities

## Creating Tasks

Add tasks to your plan:

```
Add these tasks to the plan:
- Set up project structure
- Implement core API
- Write tests
- Deploy to staging
```

## Working on Tasks

Start a task when you begin work:

```
I'm starting work on "Set up project structure"
```

Claude marks the task as `in_progress`.

## Completing Tasks

When done:

```
The project structure is set up, ready for next task
```

Claude marks it `completed` and shows progress.

## Using Templates

Create plans from built-in templates:

```
Create a plan from the web-app template for my new project
```

Available templates:
- `web-app` - Frontend web application
- `rest-api` - Backend REST API
- `cli-tool` - Command-line application
- `library` - Reusable library/package
- `bug-fix` - Bug fix workflow
- `feature` - Feature development
- `project-kickoff` - New project setup
- `sprint` - Agile sprint cycle
- `release` - Release checklist
- `migration` - System migration

## Task Dependencies

Define dependencies between tasks:

```
The "Deploy" task depends on "Write tests" being completed
```

Claude will:
- Prevent starting blocked tasks
- Show dependency chains
- Warn about circular dependencies

## Searching Tasks

Find tasks across all plans:

```
Find all high priority tasks that are overdue
```

```
Search for tasks related to "authentication"
```

## Exporting Plans

Export for backup or sharing:

```
Export my current plan to markdown
```

## Next Steps

- [Tools Reference](./tools) - See all available tools
- [Templates](./templates) - Explore built-in templates
