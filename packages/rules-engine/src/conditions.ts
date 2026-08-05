import { isConditionGroup, type JobFacts, type LeafCondition, type RuleCondition } from "./types.js";

/** Resolves a dotted path (e.g. "environment.workingAtHeight") against facts. */
function getByPath(facts: JobFacts, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, facts);
}

function evaluateLeaf(facts: JobFacts, condition: LeafCondition): boolean {
  const actual = getByPath(facts, condition.field);

  switch (condition.operator) {
    case "equals":
      return actual === condition.value;
    case "notEquals":
      return actual !== condition.value;
    case "truthy":
      return Boolean(actual);
    case "falsy":
      return !actual;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(actual);
    case "notIn":
      return Array.isArray(condition.value) && !condition.value.includes(actual);
    case "includes":
      return Array.isArray(actual) && actual.includes(condition.value);
    default: {
      // Exhaustiveness guard: if a new operator is added to the union
      // without a case here, this is a compile error, not a silent no-op.
      const _exhaustive: never = condition.operator;
      throw new Error(`Unhandled condition operator: ${_exhaustive}`);
    }
  }
}

/** A condition is either a leaf test, or a nested group evaluated recursively under its own ALL/ANY logic. */
export function evaluateCondition(facts: JobFacts, condition: RuleCondition): boolean {
  if (isConditionGroup(condition)) {
    return evaluateConditions(facts, condition.conditions, condition.logic);
  }
  return evaluateLeaf(facts, condition);
}

export function evaluateConditions(
  facts: JobFacts,
  conditions: RuleCondition[],
  logic: "ALL" | "ANY",
): boolean {
  if (conditions.length === 0) return false;
  return logic === "ALL"
    ? conditions.every((c) => evaluateCondition(facts, c))
    : conditions.some((c) => evaluateCondition(facts, c));
}
