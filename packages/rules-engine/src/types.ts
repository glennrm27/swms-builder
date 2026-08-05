/**
 * The rules engine is intentionally framework-free: it knows nothing about
 * Prisma, HTTP, or React. It consumes plain data (facts + rule
 * definitions) and returns a plain resolution. The API layer is
 * responsible for loading rules from the DB and mapping them into
 * RuleDefinition — see apps/api/src/services/rulesService.ts.
 */

export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "includes"
  | "truthy"
  | "falsy";

export interface LeafCondition {
  /** Dotted path into JobFacts, e.g. "environment.workingAtHeight" or "equipmentCodes" */
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type ConditionLogic = "ALL" | "ANY";

/**
 * A nested AND/OR group: evaluates its own `conditions` under its own
 * `logic`, independent of the group it sits inside. This is what lets a
 * rule express e.g. "(electrical work AND NOT isolated) OR confined
 * space" instead of only a single flat ALL/ANY list.
 */
export interface ConditionGroup {
  logic: ConditionLogic;
  conditions: RuleCondition[];
}

/** A condition is either a leaf test against a fact, or a nested group of conditions. */
export type RuleCondition = LeafCondition | ConditionGroup;

export function isConditionGroup(condition: RuleCondition): condition is ConditionGroup {
  return "conditions" in condition && Array.isArray(condition.conditions);
}

export interface RuleDefinition {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  conditionLogic: ConditionLogic;
  templateId: string | null;
  requiredSectionKeys: string[];
  addPermitCodes: string[];
  addHazardIds: string[];
  addPpeIds: string[];
}

/**
 * The facts a job presents to the engine. This is deliberately a flat,
 * serializable shape — every field a Rule.condition can reference must be
 * reachable here via a dotted path.
 */
export interface JobFacts {
  jobType: { id: string; code: string };
  equipmentCodes: string[];
  environment: Record<string, boolean>;
}

export interface MatchedRuleTrace {
  ruleId: string;
  ruleName: string;
  priority: number;
}

export interface SwmsResolution {
  templateId: string;
  hazardIds: string[];
  ppeIds: string[];
  permitCodes: string[];
  requiredSectionKeys: string[];
  matchedRules: MatchedRuleTrace[];
}

export class TemplateResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateResolutionError";
  }
}
