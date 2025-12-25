/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

/**
 * Prompt definition with metadata
 */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

/**
 * Message content type
 */
export interface MessageContent {
  type: 'text' | 'resource';
  text?: string;
  resource?: {
    uri: string;
    mimeType: string;
    text: string;
  };
}

/**
 * Prompt message
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

/**
 * Prompt result
 */
export interface PromptResult {
  description: string;
  messages: PromptMessage[];
}

/**
 * Prompt handler function type
 */
export type PromptHandler = (args: Record<string, unknown>) => PromptResult;

/**
 * Prompt registry for registering prompts
 */
export interface PromptRegistry {
  register(name: string, definition: PromptDefinition, handler: PromptHandler): void;
}
