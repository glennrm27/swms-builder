import { evaluateConditions } from "./conditions.js";
import type { JobFacts, RuleDefinition, SwmsResolution } from "./types.js";
import { TemplateResolutionError } from "./types.js";

/**
 * Resolves which SWMS template applies to a job and which hazards, PPE,
 * permits, and template sections are mandatory — by evaluating every
 * active rule against the job's facts.
 *
 * Selection semantics (deliberately simple and documented, not clever):
 *  - Rules are evaluated in ascending `priority` order (lower runs first).
 *  - Every matching rule contributes its hazards/PPE/permits/sections —
 *    these are unioned, never overridden.
 *  - Template selection: the FIRST matching rule (by priority, then by
 *    array order for stable ties) that specifies a templateId wins. This
 *    means "more specific" rules should be given a lower priority number
 *    than generic/default rules — see the seed data for an example.
 *  - If no active rule matches, or no matching rule specifies a template,
 *    resolution throws TemplateResolutionError rather than silently
 *    picking something — an unresolvable job must not silently produce a
 *    wrong SWMS.
 */
export function resolveSwms(facts: JobFacts, rules: RuleDefinition[]): SwmsResolution {
  const activeRules = rules
    .filter((r) => r.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority);

  const hazardIds = new Set<string>();
  const ppeIds = new Set<string>();
  const permitCodes = new Set<string>();
  const requiredSectionKeys = new Set<string>();
  const matchedRules: SwmsResolution["matchedRules"] = [];
  let templateId: string | null = null;

  for (const rule of activeRules) {
    const matches = evaluateConditions(facts, rule.conditions, rule.conditionLogic);
    if (!matches) continue;

    matchedRules.push({ ruleId: rule.id, ruleName: rule.name, priority: rule.priority });
    rule.addHazardIds.forEach((id) => hazardIds.add(id));
    rule.addPpeIds.forEach((id) => ppeIds.add(id));
    rule.addPermitCodes.forEach((code) => permitCodes.add(code));
    rule.requiredSectionKeys.forEach((key) => requiredSectionKeys.add(key));

    if (templateId === null && rule.templateId) {
      templateId = rule.templateId;
    }
  }

  if (matchedRules.length === 0) {
    throw new TemplateResolutionError(
      "No active rule matched this job's job type, equipment, or environment selections. " +
        "An administrator needs to add a rule that covers this combination before a SWMS can be generated.",
    );
  }

  if (templateId === null) {
    throw new TemplateResolutionError(
      "Rules matched this job, but none of them specify a SWMS template. " +
        "At least one matching rule (typically a low-priority default) must set a templateId.",
    );
  }

  return {
    templateId,
    hazardIds: [...hazardIds],
    ppeIds: [...ppeIds],
    permitCodes: [...permitCodes],
    requiredSectionKeys: [...requiredSectionKeys],
    matchedRules,
  };
}

export type { JobFacts, RuleDefinition, SwmsResolution } from "./types.js";
export { TemplateResolutionError } from "./types.js";
