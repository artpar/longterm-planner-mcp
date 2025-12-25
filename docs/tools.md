---
layout: default
title: Tools Reference
---

# Tools Reference

Complete reference for all MCP tools provided by longterm-planner-mcp.

## Plan Management

### create_plan

Create a new plan for a project.

**Parameters:**
- `name` (required) - Plan name
- `description` - Detailed description
- `projectPath` - Project directory path (defaults to current)
- `startDate` - Start date (ISO 8601)
- `targetDate` - Target completion date (ISO 8601)

### get_plan

Get plan details by ID.

**Parameters:**
- `planId` (required) - Plan ID

### update_plan

Update plan metadata.

**Parameters:**
- `planId` (required) - Plan ID
- `name` - New name
- `description` - New description
- `status` - New status (draft, active, completed, archived)
- `startDate` - New start date
- `targetDate` - New target date

### list_plans

List all plans.

**Parameters:**
- `projectPath` - Filter by project path
- `status` - Filter by status

### archive_plan

Archive a completed plan.

**Parameters:**
- `planId` (required) - Plan ID
- `reason` - Reason for archiving

### activate_plan

Move a plan from draft to active status.

**Parameters:**
- `planId` (required) - Plan ID

---

## Task Management

### add_task

Add a task to a plan.

**Parameters:**
- `planId` (required) - Plan ID
- `title` (required) - Task title
- `description` - Detailed description
- `priority` - critical, high, medium, low (default: medium)
- `estimatedHours` - Estimated hours
- `dueDate` - Due date (ISO 8601)
- `parentTaskId` - Parent task for subtasks

### update_task

Update task properties.

**Parameters:**
- `taskId` (required) - Task ID
- `title` - New title
- `description` - New description
- `priority` - New priority
- `estimatedHours` - New estimate
- `actualHours` - Actual hours spent
- `assignee` - Assign to someone
- `dueDate` - New due date

### start_task

Begin working on a task (moves to in_progress).

**Parameters:**
- `taskId` (required) - Task ID
- `notes` - Notes about approach

### complete_task

Mark a task as completed.

**Parameters:**
- `taskId` (required) - Task ID
- `summary` (required) - Summary of what was accomplished
- `actualHours` - Actual hours spent

### block_task

Mark a task as blocked.

**Parameters:**
- `taskId` (required) - Task ID
- `reason` (required) - Reason for blocking

### unblock_task

Remove blocker from a task.

**Parameters:**
- `taskId` (required) - Task ID

### submit_for_review

Submit an in-progress task for review.

**Parameters:**
- `taskId` (required) - Task ID

### find_tasks

Find tasks in a plan with filters.

**Parameters:**
- `planId` (required) - Plan ID
- `status` - Filter by status(es)
- `priority` - Filter by priority(ies)

### get_blocked

Get all blocked tasks.

**Parameters:**
- `planId` (required) - Plan ID

### get_progress

Get plan progress statistics.

**Parameters:**
- `planId` (required) - Plan ID

### delete_task

Delete a task.

**Parameters:**
- `taskId` (required) - Task ID

---

## Templates

### list_templates

List available plan templates.

**Parameters:**
- `category` - Filter by category (development, general, all)

### create_from_template

Create a plan from a template.

**Parameters:**
- `templateId` (required) - Template ID
- `name` - Custom plan name
- `description` - Custom description
- `projectPath` - Project path

---

## Dependencies

### add_dependency

Add a dependency between tasks.

**Parameters:**
- `taskId` (required) - Task that will be blocked
- `dependsOnTaskId` (required) - Task that blocks
- `dependencyType` - blocks, required_by, related_to (default: blocks)

### remove_dependency

Remove a dependency.

**Parameters:**
- `taskId` (required) - Blocked task
- `dependsOnTaskId` (required) - Blocking task

### get_dependencies

Get all dependencies for a task.

**Parameters:**
- `taskId` (required) - Task ID

### get_dependency_chain

Get full transitive dependency chain.

**Parameters:**
- `taskId` (required) - Task ID
- `direction` - upstream or downstream (default: upstream)

### check_can_start

Check if a task can be started based on dependencies.

**Parameters:**
- `taskId` (required) - Task ID

---

## Search & Filter

### search_tasks

Search tasks with text and filters.

**Parameters:**
- `query` - Text search in title/description
- `planId` - Filter to specific plan
- `status` - Filter by status(es)
- `priority` - Filter by priority(ies)
- `assignee` - Filter by assignee
- `tags` - Filter by tags (tasks must have ALL specified tags)
- `dueBefore` - Tasks due before date
- `dueAfter` - Tasks due after date
- `includeCompleted` - Include completed tasks (default: false)
- `limit` - Max results (default: 50)

### search_plans

Search plans by name/status.

**Parameters:**
- `query` - Text search in name/description
- `status` - Filter by status(es)
- `projectPath` - Filter by project path
- `limit` - Max results (default: 20)

### find_overdue_tasks

Find tasks past their due date.

**Parameters:**
- `planId` - Filter to specific plan

### find_upcoming_tasks

Find tasks due within N days.

**Parameters:**
- `days` - Days to look ahead (default: 7)
- `planId` - Filter to specific plan

### get_task_summary

Get task statistics.

**Parameters:**
- `planId` - Get summary for specific plan (optional)

---

## Export/Import

### export_plan

Export a plan to JSON or Markdown.

**Parameters:**
- `planId` (required) - Plan ID
- `format` - json or markdown (default: json)

### import_plan

Import a plan from JSON export.

**Parameters:**
- `data` (required) - JSON string of exported plan
- `projectPath` - Project path for imported plan
- `newName` - New name for imported plan

---

## Tags

### add_tag

Add a tag to a task for categorization.

**Parameters:**
- `taskId` (required) - Task ID
- `tag` (required) - Tag to add (normalized to lowercase)

### remove_tag

Remove a tag from a task.

**Parameters:**
- `taskId` (required) - Task ID
- `tag` (required) - Tag to remove

### set_tags

Set all tags for a task (replaces existing).

**Parameters:**
- `taskId` (required) - Task ID
- `tags` (required) - Array of tags to set

### get_tags

Get all unique tags used in a plan.

**Parameters:**
- `planId` (required) - Plan ID

### find_by_tag

Find all tasks with a specific tag.

**Parameters:**
- `planId` (required) - Plan ID
- `tag` (required) - Tag to search for

---

## Bulk Operations

### bulk_update_status

Update status for multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs
- `status` (required) - New status for all tasks

### bulk_update_priority

Update priority for multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs
- `priority` (required) - New priority for all tasks

### bulk_set_assignee

Set assignee for multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs
- `assignee` - Assignee name (omit to unassign)

### bulk_add_tag

Add a tag to multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs
- `tag` (required) - Tag to add

### bulk_remove_tag

Remove a tag from multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs
- `tag` (required) - Tag to remove

### bulk_delete

Delete multiple tasks at once.

**Parameters:**
- `taskIds` (required) - Array of task IDs

---

## Comments

### add_comment

Add a comment or note to a task.

**Parameters:**
- `taskId` (required) - Task ID
- `content` (required) - Comment content
- `author` - Author name (optional)

### list_comments

List all comments for a task.

**Parameters:**
- `taskId` (required) - Task ID
- `order` - Order by creation time: asc or desc (default: asc)

### update_comment

Update an existing comment.

**Parameters:**
- `commentId` (required) - Comment ID
- `content` (required) - New content

### delete_comment

Delete a comment.

**Parameters:**
- `commentId` (required) - Comment ID

### get_recent_comments

Get recent comments across all tasks in a plan.

**Parameters:**
- `planId` (required) - Plan ID
- `limit` - Max comments to return (default: 10)
