#!/usr/bin/env node

/**
 * longterm-planner-mcp - MCP Server for Long-term Planning Management
 *
 * This is the entry point for the MCP server that provides
 * planning tools, resources, and prompts for Claude Code.
 */

import { PlanningServer } from './server.js';

// Re-export models
export * from './models/index.js';

// Re-export database
export * from './db/index.js';

// Re-export services
export * from './services/index.js';

// Re-export integrations
export { GitIntegration } from './integrations/GitIntegration.js';
export { HookHandlers } from './integrations/HookHandlers.js';

// Re-export export utilities
export { MarkdownExporter } from './export/MarkdownExporter.js';

// Re-export backup
export { BackupManager } from './backup/BackupManager.js';

// Re-export server
export { PlanningServer } from './server.js';

// Start server if run directly
async function main() {
  const server = new PlanningServer();

  // Handle shutdown
  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });

  await server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
