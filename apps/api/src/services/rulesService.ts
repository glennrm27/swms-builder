import type { PrismaClient } from "@swms/db";
import type { JobFacts, RuleCondition, RuleDefinition } from "@swms/rules-engine";

/** Loads every active Rule from the DB and maps it into the framework-free shape the rules engine expects. */
export async function loadActiveRuleDefinitions(prisma: PrismaClient): Promise<RuleDefinition[]> {
  const rules = await prisma.rule.findMany({
    where: { isActive: true },
    include: { addHazards: true, addPpe: true },
  });

  return rules.map((rule): RuleDefinition => ({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    isActive: rule.isActive,
    // Rule.conditions is stored as Json; it is written exclusively through
    // the admin rules API, which validates it against
    // shared-types#ruleConditionSchema before it ever reaches the DB.
    conditions: rule.conditions as unknown as RuleCondition[],
    conditionLogic: rule.conditionLogic,
    templateId: rule.templateId,
    requiredSectionKeys: rule.requiredSectionKeys,
    addPermitCodes: rule.addPermitCodes,
    addHazardIds: rule.addHazards.map((h) => h.hazardId),
    addPpeIds: rule.addPpe.map((p) => p.ppeId),
  }));
}

interface JobFactsInput {
  jobTypeId: string;
  jobTypeCode: string;
  equipmentCodes: string[];
  environment: Record<string, boolean>;
}

export function buildJobFacts(input: JobFactsInput): JobFacts {
  return {
    jobType: { id: input.jobTypeId, code: input.jobTypeCode },
    equipmentCodes: input.equipmentCodes,
    environment: input.environment,
  };
}
