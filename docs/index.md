---
layout: default
title: Home
---

# longterm-planner-mcp

A Model Context Protocol (MCP) server for long-term planning management in Claude Code.

Track plans, tasks, goals, and progress across coding sessions with persistent SQLite storage.

[![npm version](https://badge.fury.io/js/longterm-planner-mcp.svg)](https://www.npmjs.com/package/longterm-planner-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why longterm-planner-mcp?

When working with Claude Code on complex projects, you need a way to:

- **Track progress** across multiple coding sessions
- **Break down** large features into manageable tasks
- **Remember context** when you come back to a project
- **Visualize** what's done, what's blocked, and what's next

This MCP server provides all that and more, integrated directly into Claude Code.

## Key Features

| Feature | Description |
|---------|-------------|
| **Persistent Storage** | SQLite database survives across sessions |
| **Task Dependencies** | Define blocking relationships between tasks |
| **Plan Templates** | 10 built-in templates for common project types |
| **Search & Filter** | Find tasks by text, status, priority, dates |
| **State Machine** | Enforced task status transitions |
| **Export/Import** | JSON and Markdown export support |

## Quick Install

Add to your Claude Code settings (`~/.claude/settings.json`):

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

Restart Claude Code and start planning!

## Quick Example

```
You: Create a plan for implementing user authentication

Claude: I'll create a plan with tasks for the authentication feature.
[Uses create_plan and add_task tools]

Created plan "User Authentication" with 5 tasks:
- Set up auth middleware
- Implement login endpoint
- Implement registration endpoint
- Add password hashing
- Write tests

You: Start working on the login endpoint

Claude: [Uses start_task tool]
Started task "Implement login endpoint"

You: Done with login, tests passing

Claude: [Uses complete_task tool]
Completed "Implement login endpoint" - 2/5 tasks done (40%)
```

## Documentation

- [Getting Started](./getting-started) - Installation and first steps
- [Tools Reference](./tools) - Complete tool documentation
- [Templates](./templates) - Built-in plan templates

## Links

- [GitHub Repository](https://github.com/artpar/longterm-planner-mcp)
- [npm Package](https://www.npmjs.com/package/longterm-planner-mcp)
- [MCP Specification](https://modelcontextprotocol.io/)
