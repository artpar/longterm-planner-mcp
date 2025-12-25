import { BaseRepository } from './BaseRepository.js';
import { Database } from '../Database.js';
import {
  Decision,
  DecisionOption,
  CreateDecisionInput,
  RecordDecisionOutcomeInput
} from '../../models/Decision.js';
import { EntityType } from '../../models/enums.js';

/**
 * Database row type for decisions
 */
interface DecisionRow {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description: string;
  options: string;
  outcome: string | null;
  rationale: string | null;
  decided_at: string | null;
  created_at: string;
}

/**
 * Filter options for finding decisions
 */
export interface DecisionFilter {
  hasOutcome?: boolean;
}

/**
 * Repository for Decision entities
 */
export class DecisionRepository extends BaseRepository<Decision> {
  protected tableName = 'decisions';

  constructor(db: Database) {
    super(db);
  }

  protected mapRowToEntity(row: unknown): Decision {
    const r = row as DecisionRow;
    return {
      id: r.id,
      entityType: r.entity_type as EntityType,
      entityId: r.entity_id,
      title: r.title,
      description: r.description,
      options: this.parseJson<DecisionOption[]>(r.options),
      outcome: r.outcome,
      rationale: r.rationale,
      decidedAt: r.decided_at,
      createdAt: r.created_at
    };
  }

  /**
   * Create a new decision record
   */
  create(input: CreateDecisionInput): Decision {
    const id = this.generateId();
    const timestamp = this.now();

    // Convert input options to full DecisionOption objects
    const options: DecisionOption[] = (input.options ?? []).map(opt => ({
      id: this.generateId(),
      description: opt.description,
      pros: opt.pros ?? [],
      cons: opt.cons ?? []
    }));

    this.db
      .prepare(`
        INSERT INTO decisions (
          id, entity_type, entity_id, title, description,
          options, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.entityType,
        input.entityId,
        input.title,
        input.description ?? '',
        this.toJson(options),
        timestamp
      );

    return this.findById(id)!;
  }

  /**
   * Find decisions by entity with optional filters
   */
  findByEntity(entityType: EntityType, entityId: string, filter?: DecisionFilter): Decision[] {
    let sql = 'SELECT * FROM decisions WHERE entity_type = ? AND entity_id = ?';
    const params: unknown[] = [entityType, entityId];

    if (filter?.hasOutcome !== undefined) {
      if (filter.hasOutcome) {
        sql += ' AND outcome IS NOT NULL';
      } else {
        sql += ' AND outcome IS NULL';
      }
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as DecisionRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find pending decisions (no outcome yet)
   */
  findPending(entityType?: EntityType, entityId?: string): Decision[] {
    let sql = 'SELECT * FROM decisions WHERE outcome IS NULL';
    const params: unknown[] = [];

    if (entityType && entityId) {
      sql += ' AND entity_type = ? AND entity_id = ?';
      params.push(entityType, entityId);
    } else if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as DecisionRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find decided (has outcome)
   */
  findDecided(entityType?: EntityType, entityId?: string): Decision[] {
    let sql = 'SELECT * FROM decisions WHERE outcome IS NOT NULL';
    const params: unknown[] = [];

    if (entityType && entityId) {
      sql += ' AND entity_type = ? AND entity_id = ?';
      params.push(entityType, entityId);
    } else if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }

    sql += ' ORDER BY decided_at DESC';

    const rows = this.db.prepare(sql).all(...params) as DecisionRow[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Record a decision outcome
   */
  recordOutcome(id: string, input: RecordDecisionOutcomeInput): Decision | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const timestamp = this.now();

    this.db
      .prepare(`
        UPDATE decisions
        SET outcome = ?, rationale = ?, decided_at = ?
        WHERE id = ?
      `)
      .run(input.outcome, input.rationale ?? null, timestamp, id);

    return this.findById(id);
  }

  /**
   * Add an option to a decision
   */
  addOption(decisionId: string, option: { description: string; pros?: string[]; cons?: string[] }): Decision | null {
    const decision = this.findById(decisionId);
    if (!decision) return null;

    const newOption: DecisionOption = {
      id: this.generateId(),
      description: option.description,
      pros: option.pros ?? [],
      cons: option.cons ?? []
    };

    const options = [...decision.options, newOption];

    this.db
      .prepare('UPDATE decisions SET options = ? WHERE id = ?')
      .run(this.toJson(options), decisionId);

    return this.findById(decisionId);
  }

  /**
   * Update an option
   */
  updateOption(
    decisionId: string,
    optionId: string,
    updates: { description?: string; pros?: string[]; cons?: string[] }
  ): Decision | null {
    const decision = this.findById(decisionId);
    if (!decision) return null;

    const options = decision.options.map(opt => {
      if (opt.id === optionId) {
        return {
          ...opt,
          description: updates.description ?? opt.description,
          pros: updates.pros ?? opt.pros,
          cons: updates.cons ?? opt.cons
        };
      }
      return opt;
    });

    this.db
      .prepare('UPDATE decisions SET options = ? WHERE id = ?')
      .run(this.toJson(options), decisionId);

    return this.findById(decisionId);
  }

  /**
   * Remove an option from a decision
   */
  removeOption(decisionId: string, optionId: string): Decision | null {
    const decision = this.findById(decisionId);
    if (!decision) return null;

    const options = decision.options.filter(opt => opt.id !== optionId);

    this.db
      .prepare('UPDATE decisions SET options = ? WHERE id = ?')
      .run(this.toJson(options), decisionId);

    return this.findById(decisionId);
  }

  /**
   * Add a pro to an option
   */
  addPro(decisionId: string, optionId: string, pro: string): Decision | null {
    const decision = this.findById(decisionId);
    if (!decision) return null;

    const options = decision.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, pros: [...opt.pros, pro] };
      }
      return opt;
    });

    this.db
      .prepare('UPDATE decisions SET options = ? WHERE id = ?')
      .run(this.toJson(options), decisionId);

    return this.findById(decisionId);
  }

  /**
   * Add a con to an option
   */
  addCon(decisionId: string, optionId: string, con: string): Decision | null {
    const decision = this.findById(decisionId);
    if (!decision) return null;

    const options = decision.options.map(opt => {
      if (opt.id === optionId) {
        return { ...opt, cons: [...opt.cons, con] };
      }
      return opt;
    });

    this.db
      .prepare('UPDATE decisions SET options = ? WHERE id = ?')
      .run(this.toJson(options), decisionId);

    return this.findById(decisionId);
  }

  /**
   * Count pending decisions for an entity
   */
  countPending(entityType: EntityType, entityId: string): number {
    const result = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM decisions
        WHERE entity_type = ? AND entity_id = ?
        AND outcome IS NULL
      `)
      .get(entityType, entityId) as { count: number };

    return result.count;
  }

  /**
   * Get recent decisions
   */
  getRecent(limit = 10): Decision[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM decisions
        WHERE outcome IS NOT NULL
        ORDER BY decided_at DESC
        LIMIT ?
      `)
      .all(limit) as DecisionRow[];

    return rows.map(row => this.mapRowToEntity(row));
  }
}
