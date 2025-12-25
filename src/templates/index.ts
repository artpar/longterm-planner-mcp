import { Priority } from '../models/enums.js';

/**
 * Template task definition
 */
export interface TemplateTask {
  title: string;
  description?: string;
  priority?: Priority;
  children?: TemplateTask[];
}

/**
 * Plan template definition
 */
export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'general';
  tasks: TemplateTask[];
}

/**
 * Built-in plan templates
 */
export const builtInTemplates: PlanTemplate[] = [
  // Development Templates
  {
    id: 'web-app',
    name: 'Web Application',
    description: 'Frontend web application with modern stack',
    category: 'development',
    tasks: [
      {
        title: 'Project Setup',
        priority: Priority.HIGH,
        children: [
          { title: 'Initialize project structure' },
          { title: 'Configure build tools' },
          { title: 'Set up linting and formatting' },
          { title: 'Configure testing framework' }
        ]
      },
      {
        title: 'Core Features',
        priority: Priority.HIGH,
        children: [
          { title: 'Implement routing' },
          { title: 'Set up state management' },
          { title: 'Create base components' },
          { title: 'Implement authentication flow' }
        ]
      },
      {
        title: 'UI/UX',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Design system setup' },
          { title: 'Responsive layouts' },
          { title: 'Accessibility audit' }
        ]
      },
      {
        title: 'Testing & QA',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Unit tests' },
          { title: 'Integration tests' },
          { title: 'E2E tests' }
        ]
      },
      {
        title: 'Deployment',
        priority: Priority.HIGH,
        children: [
          { title: 'CI/CD pipeline' },
          { title: 'Production deployment' },
          { title: 'Monitoring setup' }
        ]
      }
    ]
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description: 'Backend REST API service',
    category: 'development',
    tasks: [
      {
        title: 'Project Setup',
        priority: Priority.HIGH,
        children: [
          { title: 'Initialize project' },
          { title: 'Configure database connection' },
          { title: 'Set up ORM/query builder' },
          { title: 'Configure environment variables' }
        ]
      },
      {
        title: 'API Design',
        priority: Priority.HIGH,
        children: [
          { title: 'Define resource endpoints' },
          { title: 'Design request/response schemas' },
          { title: 'Document API (OpenAPI/Swagger)' }
        ]
      },
      {
        title: 'Core Implementation',
        priority: Priority.HIGH,
        children: [
          { title: 'Implement CRUD operations' },
          { title: 'Add authentication/authorization' },
          { title: 'Input validation' },
          { title: 'Error handling' }
        ]
      },
      {
        title: 'Testing',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Unit tests' },
          { title: 'API integration tests' },
          { title: 'Load testing' }
        ]
      },
      {
        title: 'Deployment',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Containerization (Docker)' },
          { title: 'CI/CD setup' },
          { title: 'Production deployment' }
        ]
      }
    ]
  },
  {
    id: 'cli-tool',
    name: 'CLI Tool',
    description: 'Command-line interface application',
    category: 'development',
    tasks: [
      {
        title: 'Project Setup',
        priority: Priority.HIGH,
        children: [
          { title: 'Initialize project' },
          { title: 'Configure CLI framework' },
          { title: 'Set up argument parsing' }
        ]
      },
      {
        title: 'Commands',
        priority: Priority.HIGH,
        children: [
          { title: 'Implement main command' },
          { title: 'Add subcommands' },
          { title: 'Help documentation' }
        ]
      },
      {
        title: 'Features',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Configuration file support' },
          { title: 'Interactive prompts' },
          { title: 'Progress indicators' },
          { title: 'Color output' }
        ]
      },
      {
        title: 'Distribution',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Package for npm/pip/cargo' },
          { title: 'Binary releases' },
          { title: 'Installation docs' }
        ]
      }
    ]
  },
  {
    id: 'library',
    name: 'Library/Package',
    description: 'Reusable library or package',
    category: 'development',
    tasks: [
      {
        title: 'Project Setup',
        priority: Priority.HIGH,
        children: [
          { title: 'Initialize project' },
          { title: 'Configure build system' },
          { title: 'Set up TypeScript/types' }
        ]
      },
      {
        title: 'API Design',
        priority: Priority.HIGH,
        children: [
          { title: 'Define public API' },
          { title: 'Write type definitions' },
          { title: 'Design error handling' }
        ]
      },
      {
        title: 'Implementation',
        priority: Priority.HIGH,
        children: [
          { title: 'Core functionality' },
          { title: 'Edge cases' },
          { title: 'Performance optimization' }
        ]
      },
      {
        title: 'Documentation',
        priority: Priority.MEDIUM,
        children: [
          { title: 'README with examples' },
          { title: 'API documentation' },
          { title: 'Migration guide' }
        ]
      },
      {
        title: 'Publishing',
        priority: Priority.MEDIUM,
        children: [
          { title: 'Package configuration' },
          { title: 'Publish to registry' },
          { title: 'Changelog' }
        ]
      }
    ]
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Structured approach to fixing a bug',
    category: 'development',
    tasks: [
      { title: 'Reproduce the bug', priority: Priority.HIGH },
      { title: 'Identify root cause', priority: Priority.HIGH },
      { title: 'Write failing test', priority: Priority.MEDIUM },
      { title: 'Implement fix', priority: Priority.HIGH },
      { title: 'Verify fix resolves issue', priority: Priority.HIGH },
      { title: 'Check for regressions', priority: Priority.MEDIUM },
      { title: 'Update documentation if needed', priority: Priority.LOW },
      { title: 'Create PR and get review', priority: Priority.MEDIUM }
    ]
  },
  {
    id: 'feature',
    name: 'Feature Development',
    description: 'New feature implementation workflow',
    category: 'development',
    tasks: [
      { title: 'Requirements gathering', priority: Priority.HIGH },
      { title: 'Technical design', priority: Priority.HIGH },
      { title: 'Break down into tasks', priority: Priority.MEDIUM },
      {
        title: 'Implementation',
        priority: Priority.HIGH,
        children: [
          { title: 'Core logic' },
          { title: 'UI components (if applicable)' },
          { title: 'API endpoints (if applicable)' },
          { title: 'Database changes (if applicable)' }
        ]
      },
      { title: 'Write tests', priority: Priority.MEDIUM },
      { title: 'Documentation', priority: Priority.LOW },
      { title: 'Code review', priority: Priority.MEDIUM },
      { title: 'QA testing', priority: Priority.MEDIUM },
      { title: 'Deploy to staging', priority: Priority.MEDIUM },
      { title: 'Deploy to production', priority: Priority.HIGH }
    ]
  },

  // General Templates
  {
    id: 'project-kickoff',
    name: 'Project Kickoff',
    description: 'Starting a new project from scratch',
    category: 'general',
    tasks: [
      { title: 'Define project goals and scope', priority: Priority.HIGH },
      { title: 'Identify stakeholders', priority: Priority.HIGH },
      { title: 'Create initial timeline', priority: Priority.MEDIUM },
      { title: 'Set up communication channels', priority: Priority.MEDIUM },
      { title: 'Define success metrics', priority: Priority.MEDIUM },
      { title: 'Risk assessment', priority: Priority.MEDIUM },
      { title: 'Resource allocation', priority: Priority.HIGH },
      { title: 'Kickoff meeting', priority: Priority.HIGH }
    ]
  },
  {
    id: 'sprint',
    name: 'Sprint Planning',
    description: 'Agile sprint cycle',
    category: 'general',
    tasks: [
      { title: 'Review previous sprint', priority: Priority.MEDIUM },
      { title: 'Backlog grooming', priority: Priority.HIGH },
      { title: 'Sprint planning meeting', priority: Priority.HIGH },
      { title: 'Define sprint goal', priority: Priority.HIGH },
      { title: 'Task estimation', priority: Priority.MEDIUM },
      { title: 'Assign tasks', priority: Priority.MEDIUM },
      { title: 'Daily standups', priority: Priority.MEDIUM },
      { title: 'Sprint review', priority: Priority.HIGH },
      { title: 'Sprint retrospective', priority: Priority.MEDIUM }
    ]
  },
  {
    id: 'release',
    name: 'Release Checklist',
    description: 'Software release preparation',
    category: 'general',
    tasks: [
      { title: 'Feature freeze', priority: Priority.HIGH },
      { title: 'Version bump', priority: Priority.HIGH },
      { title: 'Update changelog', priority: Priority.MEDIUM },
      { title: 'Run full test suite', priority: Priority.HIGH },
      { title: 'Security audit', priority: Priority.HIGH },
      { title: 'Performance testing', priority: Priority.MEDIUM },
      { title: 'Update documentation', priority: Priority.MEDIUM },
      { title: 'Create release notes', priority: Priority.MEDIUM },
      { title: 'Deploy to staging', priority: Priority.HIGH },
      { title: 'Stakeholder sign-off', priority: Priority.HIGH },
      { title: 'Production deployment', priority: Priority.CRITICAL },
      { title: 'Post-release monitoring', priority: Priority.HIGH },
      { title: 'Announce release', priority: Priority.LOW }
    ]
  },
  {
    id: 'migration',
    name: 'System Migration',
    description: 'Migrating systems or data',
    category: 'general',
    tasks: [
      { title: 'Assess current system', priority: Priority.HIGH },
      { title: 'Define migration strategy', priority: Priority.HIGH },
      { title: 'Create rollback plan', priority: Priority.CRITICAL },
      { title: 'Set up target environment', priority: Priority.HIGH },
      {
        title: 'Data Migration',
        priority: Priority.HIGH,
        children: [
          { title: 'Map data schemas' },
          { title: 'Write migration scripts' },
          { title: 'Test with sample data' },
          { title: 'Validate data integrity' }
        ]
      },
      { title: 'Dry run migration', priority: Priority.HIGH },
      { title: 'Schedule maintenance window', priority: Priority.MEDIUM },
      { title: 'Execute migration', priority: Priority.CRITICAL },
      { title: 'Verify migration success', priority: Priority.CRITICAL },
      { title: 'Update DNS/routing', priority: Priority.HIGH },
      { title: 'Monitor for issues', priority: Priority.HIGH },
      { title: 'Decommission old system', priority: Priority.LOW }
    ]
  }
];

/**
 * Get all available templates
 */
export function getTemplates(): PlanTemplate[] {
  return builtInTemplates;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PlanTemplate | undefined {
  return builtInTemplates.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: 'development' | 'general'): PlanTemplate[] {
  return builtInTemplates.filter(t => t.category === category);
}
