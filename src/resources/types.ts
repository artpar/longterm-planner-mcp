/**
 * Resource handler function type
 */
export type ResourceHandler = (uri: string, match: RegExpMatchArray) => unknown;

/**
 * Resource definition
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

/**
 * Resource registry for registering resources
 */
export interface ResourceRegistry {
  register(pattern: RegExp, handler: ResourceHandler): void;
}
