/**
 * JSON Schema type for tool input validation
 */
export interface InputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
    default?: unknown;
  }>;
  required?: string[];
}

/**
 * Tool definition with metadata
 */
export interface ToolDefinition {
  description: string;
  inputSchema: InputSchema;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Tool registry for registering tools
 */
export interface ToolRegistry {
  register(name: string, definition: ToolDefinition, handler: ToolHandler): void;
}
