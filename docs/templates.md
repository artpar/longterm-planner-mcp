---
layout: default
title: Templates
---

# Plan Templates

longterm-planner-mcp includes 10 built-in templates for common project types.

## Development Templates

### web-app

Frontend web application with modern stack.

**Tasks included:**
- Project Setup (initialize, build tools, linting, testing)
- Core Features (routing, state management, components, auth)
- UI/UX (design system, responsive layouts, accessibility)
- Testing & QA (unit, integration, E2E tests)
- Deployment (CI/CD, production, monitoring)

### rest-api

Backend REST API service.

**Tasks included:**
- Project Setup (initialize, database, ORM, environment)
- API Design (endpoints, schemas, documentation)
- Core Implementation (CRUD, auth, validation, errors)
- Testing (unit, integration, load tests)
- Deployment (Docker, CI/CD, production)

### cli-tool

Command-line interface application.

**Tasks included:**
- Project Setup (initialize, CLI framework, argument parsing)
- Commands (main command, subcommands, help docs)
- Features (config files, prompts, progress, colors)
- Distribution (package, binaries, installation docs)

### library

Reusable library or package.

**Tasks included:**
- Project Setup (initialize, build, TypeScript)
- API Design (public API, types, error handling)
- Implementation (core, edge cases, performance)
- Documentation (README, API docs, migration guide)
- Publishing (config, registry, changelog)

### bug-fix

Structured approach to fixing a bug.

**Tasks included:**
1. Reproduce the bug
2. Identify root cause
3. Write failing test
4. Implement fix
5. Verify fix resolves issue
6. Check for regressions
7. Update documentation
8. Create PR and get review

### feature

New feature implementation workflow.

**Tasks included:**
- Requirements gathering
- Technical design
- Break down into tasks
- Implementation (logic, UI, API, database)
- Write tests
- Documentation
- Code review
- QA testing
- Deploy to staging
- Deploy to production

---

## General Templates

### project-kickoff

Starting a new project from scratch.

**Tasks included:**
- Define project goals and scope
- Identify stakeholders
- Create initial timeline
- Set up communication channels
- Define success metrics
- Risk assessment
- Resource allocation
- Kickoff meeting

### sprint

Agile sprint cycle.

**Tasks included:**
- Review previous sprint
- Backlog grooming
- Sprint planning meeting
- Define sprint goal
- Task estimation
- Assign tasks
- Daily standups
- Sprint review
- Sprint retrospective

### release

Software release preparation.

**Tasks included:**
- Feature freeze
- Version bump
- Update changelog
- Run full test suite
- Security audit
- Performance testing
- Update documentation
- Create release notes
- Deploy to staging
- Stakeholder sign-off
- Production deployment
- Post-release monitoring
- Announce release

### migration

Migrating systems or data.

**Tasks included:**
- Assess current system
- Define migration strategy
- Create rollback plan (critical)
- Set up target environment
- Data Migration (map schemas, scripts, test, validate)
- Dry run migration
- Schedule maintenance window
- Execute migration (critical)
- Verify migration success (critical)
- Update DNS/routing
- Monitor for issues
- Decommission old system

---

## Using Templates

### List Available Templates

```
List available plan templates
```

### Create from Template

```
Create a plan from the rest-api template for my new API project
```

### Customize Template

You can provide a custom name and description:

```
Create a plan from the web-app template called "E-commerce Frontend"
with description "Customer-facing shopping experience"
```

### Filter by Category

```
Show me only development templates
```

```
Show me general project templates
```
