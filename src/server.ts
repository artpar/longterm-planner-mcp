import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { Database } from './db/Database.js';
import { MigrationRunner } from './db/migrations/runner.js';
import { initialSchema } from './db/migrations/001-initial-schema.js';
import { taskTags } from './db/migrations/004-task-tags.js';
import { taskComments } from './db/migrations/005-task-comments.js';
import { migrateGlobalToProjectDatabases } from './db/migrations/global-to-project.js';
import { PlanRepository } from './db/repositories/PlanRepository.js';
import { TaskRepository } from './db/repositories/TaskRepository.js';
import { TaskService } from './services/TaskService.js';
import { registerPlanTools } from './tools/plan.tools.js';
import { registerTaskTools } from './tools/task.tools.js';
import { registerExportTools } from './tools/export.tools.js';
import { registerTemplateTools } from './tools/template.tools.js';
import { registerDependencyTools } from './tools/dependency.tools.js';
import { registerSearchTools } from './tools/search.tools.js';
import { registerTagTools } from './tools/tag.tools.js';
import { registerBulkTools } from './tools/bulk.tools.js';
import { registerCommentTools } from './tools/comment.tools.js';
import { registerSessionTools } from './tools/session.tools.js';
import { DependencyRepository } from './db/repositories/DependencyRepository.js';
import { CommentRepository } from './db/repositories/CommentRepository.js';
import { ToolRegistry, ToolDefinition, ToolHandler } from './tools/types.js';
import { getResourceDefinitions, registerResources, ResourceRegistry } from './resources/index.js';
import { ResourceHandler } from './resources/types.js';
import { getPromptDefinitions, registerPrompts, PromptRegistry } from './prompts/index.js';
import { PromptHandler, PromptDefinition } from './prompts/types.js';

import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { formatResult } from './utils/formatter.js';

/**
 * Configuration for the MCP server
 */
export interface ServerConfig {
  dbPath?: string;
  projectPath?: string;
}

/**
 * longterm-planner-mcp Server
 */
export class PlanningServer {
  private server: Server;
  private db: Database;
  private planRepo: PlanRepository;
  private taskRepo: TaskRepository;
  private dependencyRepo: DependencyRepository;
  private commentRepo: CommentRepository;
  private taskService: TaskService;
  private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  private resources: Map<RegExp, ResourceHandler>;
  private prompts: Map<string, { definition: PromptDefinition; handler: PromptHandler }>;

  constructor(config: ServerConfig = {}) {
    // Migrate from global database to per-project databases (one-time migration)
    migrateGlobalToProjectDatabases();

    // Initialize database - use project directory for per-project storage
    const projectPath = config.projectPath ?? process.cwd();
    const dbPath = config.dbPath ?? this.getDefaultDbPath(projectPath);
    this.ensureDbDirectory(dbPath);
    this.db = new Database(dbPath);

    // Run migrations
    const runner = new MigrationRunner(this.db);
    runner.initialize();
    runner.runMigration(initialSchema);
    runner.runMigration(taskTags);
    runner.runMigration(taskComments);

    // Initialize repositories and services
    this.planRepo = new PlanRepository(this.db);
    this.taskRepo = new TaskRepository(this.db);
    this.dependencyRepo = new DependencyRepository(this.db);
    this.commentRepo = new CommentRepository(this.db);
    this.taskService = new TaskService(this.taskRepo);

    // Initialize registries
    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();

    // Create MCP server
    this.server = new Server(
      {
        name: 'longterm-planner-mcp',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    // Register tools, resources, and prompts
    this.registerTools();
    this.registerResources();
    this.registerPrompts();

    // Set up request handlers
    this.setupHandlers();
  }

  private getDefaultDbPath(projectPath: string): string {
    // Store database in project's .claude/planning directory
    const planningDir = join(projectPath, '.claude', 'planning');
    return join(planningDir, 'plans.db');
  }

  private ensureDbDirectory(dbPath: string): void {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private registerTools(): void {
    const registry: ToolRegistry = {
      register: (name: string, definition: ToolDefinition, handler: ToolHandler) => {
        this.tools.set(name, { definition, handler });
      }
    };

    // Register all tool categories
    registerPlanTools(registry, this.planRepo);
    registerTaskTools(registry, this.taskService);
    registerExportTools(registry, this.planRepo, this.taskService);
    registerTemplateTools(registry, this.planRepo, this.taskService);
    registerDependencyTools(registry, this.dependencyRepo, this.taskRepo);
    registerSearchTools(registry, this.db);
    registerTagTools(registry, this.taskRepo);
    registerBulkTools(registry, this.taskRepo);
    registerCommentTools(registry, this.commentRepo, this.taskRepo);
    registerSessionTools(registry, this.planRepo, this.taskService, this.db);
  }

  private registerResources(): void {
    const registry: ResourceRegistry = {
      register: (pattern: RegExp, handler: ResourceHandler) => {
        this.resources.set(pattern, handler);
      }
    };

    registerResources(registry, this.planRepo, this.taskService);
  }

  private registerPrompts(): void {
    const registry: PromptRegistry = {
      register: (name: string, definition: PromptDefinition, handler: PromptHandler) => {
        this.prompts.set(name, { definition, handler });
      }
    };

    registerPrompts(registry, this.planRepo, this.taskService);
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.entries()).map(([name, { definition }]) => ({
        name,
        description: definition.description,
        inputSchema: definition.inputSchema
      }));
      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }

      try {
        const result = await tool.handler(args ?? {});
        return {
          content: [
            {
              type: 'text',
              text: formatResult(result)
            }
          ]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${message}`
            }
          ],
          isError: true
        };
      }
    });

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const definitions = getResourceDefinitions();
      return {
        resources: definitions.map(def => ({
          uri: def.uri,
          name: def.name,
          description: def.description,
          mimeType: def.mimeType ?? 'application/json'
        }))
      };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      // Find matching resource handler
      for (const [pattern, handler] of this.resources.entries()) {
        const match = uri.match(pattern);
        if (match) {
          try {
            const data = handler(uri, match);
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(data, null, 2)
                }
              ]
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new McpError(ErrorCode.InternalError, message);
          }
        }
      }

      throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${uri}`);
    });

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const definitions = getPromptDefinitions();
      return {
        prompts: definitions.map(def => ({
          name: def.name,
          description: def.description,
          arguments: def.arguments
        }))
      };
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const prompt = this.prompts.get(name);
      if (!prompt) {
        throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${name}`);
      }

      try {
        const result = prompt.handler(args ?? {});
        return {
          description: result.description,
          messages: result.messages
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, message);
      }
    });
  }

  /**
   * Start the server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Close the server and database
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the plan repository (for testing)
   */
  getPlanRepository(): PlanRepository {
    return this.planRepo;
  }

  /**
   * Get the task service (for testing)
   */
  getTaskService(): TaskService {
    return this.taskService;
  }
}
