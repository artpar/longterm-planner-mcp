import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Plan,
  PlanContext,
  CreatePlanInput,
  UpdatePlanInput,
  createEmptyContext
} from '../../models/Plan.js';
import { PlanStatus } from '../../models/enums.js';

/**
 * Database row type for plans
 */
interface PlanRow {
  id: string;
  project_path: string;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  context: string;
  created_at: string;
  updated_at: string;
}

/**
 * Filter options for finding plans
 */
export interface PlanFilter {
  status?: PlanStatus;
  projectPath?: string;
}

/**
 * Repository for Plan entities
 */
export class PlanRepository extends BaseRepository<Plan> {
  protected tableName = 'plans';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Plan {
    const r = row as PlanRow;
    return {
      id: r.id,
      projectPath: r.project_path,
      name: r.name,
      description: r.description,
      status: r.status as PlanStatus,
      startDate: r.start_date,
      targetDate: r.target_date,
      context: this.parseJson<PlanContext>(r.context),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Create a new plan
   */
  create(input: CreatePlanInput): Plan {
    const id = this.generateId();
    const timestamp = this.now();
    const context = createEmptyContext();

    this.db
      .prepare(`
        INSERT INTO plans (id, project_path, name, description, start_date, target_date, context, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.projectPath,
        input.name,
        input.description ?? '',
        input.startDate ?? null,
        input.targetDate ?? null,
        this.toJson(context),
        timestamp,
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find plans by project path
   */
  findByProjectPath(projectPath: string): Plan[] {
    const rows = this.db
      .prepare('SELECT * FROM plans WHERE project_path = ? ORDER BY created_at DESC')
      .all(projectPath) as PlanRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all plans with optional filters
   */
  findAll(filter?: PlanFilter): Plan[] {
    let sql = 'SELECT * FROM plans WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.projectPath) {
      sql += ' AND project_path = ?';
      params.push(filter.projectPath);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as PlanRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update a plan
   */
  update(id: string, input: UpdatePlanInput): Plan | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    // Merge context if provided
    let context = existing.context;
    if (input.context) {
      context = { ...existing.context, ...input.context };
    }

    this.db
      .prepare(`
        UPDATE plans
        SET name = ?,
            description = ?,
            status = ?,
            start_date = ?,
            target_date = ?,
            context = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.name ?? existing.name,
        input.description ?? existing.description,
        input.status ?? existing.status,
        input.startDate !== undefined ? input.startDate : existing.startDate,
        input.targetDate !== undefined ? input.targetDate : existing.targetDate,
        this.toJson(context),
        timestamp,
        id
      );

    return this.findById(id);
  }

  /**
   * Archive a plan
   */
  archive(id: string): Plan | null {
    return this.update(id, { status: PlanStatus.ARCHIVED });
  }

  /**
   * Find active plans
   */
  findActive(): Plan[] {
    return this.findAll({ status: PlanStatus.ACTIVE });
  }

  /**
   * Check if plan exists
   */
  exists(id: string): boolean {
    const result = this.db
      .prepare('SELECT 1 FROM plans WHERE id = ?')
      .get(id);
    return result !== undefined;
  }
}
