import { DependencyType, EntityType } from './enums.js';

/**
 * Dependency - relationship between entities
 */
export interface Dependency {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  dependencyType: DependencyType;
  createdAt: string;
}

/**
 * Input for creating a dependency
 */
export interface CreateDependencyInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  dependencyType?: DependencyType;
}
