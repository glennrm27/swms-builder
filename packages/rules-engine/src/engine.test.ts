import { describe, expect, it } from "vitest";
import { resolveSwms } from "./engine.js";
import { TemplateResolutionError } from "./types.js";
import type { JobFacts, RuleDefinition } from "./types.js";

const GENERAL_TEMPLATE = "template-general";
const CONFINED_SPACE_TEMPLATE = "template-confined-space";

function baseFacts(overrides: Partial<JobFacts["environment"]> = {}): JobFacts {
  return {
    jobType: { id: "jt-1", code: "GENERAL_CONSTRUCTION" },
    equipmentCodes: [],
    environment: {
      workingAtHeight: false,
      confinedSpace: false,
      electricalWork: false,
      ...overrides,
    },
  };
}

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    id: "rule-default",
    name: "unnamed rule",
    priority: 100,
    isActive: true,
    conditions: [],
    conditionLogic: "ALL",
    templateId: null,
    requiredSectionKeys: [],
    addPermitCodes: [],
    addHazardIds: [],
    addPpeIds: [],
    ...overrides,
  };
}

describe("resolveSwms", () => {
  it("throws TemplateResolutionError when no rule matches", () => {
    const facts = baseFacts();
    expect(() => resolveSwms(facts, [])).toThrow(TemplateResolutionError);
  });

  it("throws TemplateResolutionError when matching rules never set a template", () => {
    const facts = baseFacts({ workingAtHeight: true });
    const rules: RuleDefinition[] = [
      rule({
        id: "r1",
        conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
        addHazardIds: ["haz-fall"],
      }),
    ];
    expect(() => resolveSwms(facts, rules)).toThrow(/none of them specify a SWMS template/);
  });

  it("resolves the default template when only the baseline rule matches", () => {
    const facts = baseFacts();
    const rules: RuleDefinition[] = [
      rule({
        id: "baseline",
        priority: 1000,
        conditions: [{ field: "jobType.code", operator: "truthy" }],
        templateId: GENERAL_TEMPLATE,
        addPpeIds: ["ppe-glasses"],
      }),
    ];

    const result = resolveSwms(facts, rules);

    expect(result.templateId).toBe(GENERAL_TEMPLATE);
    expect(result.ppeIds).toEqual(["ppe-glasses"]);
    expect(result.matchedRules).toHaveLength(1);
  });

  it("unions hazards/PPE/permits/sections across every matching rule", () => {
    const facts = baseFacts({ workingAtHeight: true, electricalWork: true });
    const rules: RuleDefinition[] = [
      rule({
        id: "electrical",
        priority: 10,
        conditions: [{ field: "environment.electricalWork", operator: "equals", value: true }],
        templateId: GENERAL_TEMPLATE,
        addHazardIds: ["haz-electric-shock"],
        addPpeIds: ["ppe-insulated-gloves"],
        addPermitCodes: ["PERMIT-ELECTRICAL-ISOLATION"],
        requiredSectionKeys: ["electrical_isolation"],
      }),
      rule({
        id: "height",
        priority: 10,
        conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
        addHazardIds: ["haz-fall"],
        addPpeIds: ["ppe-harness"],
        addPermitCodes: ["PERMIT-WORKING-AT-HEIGHT"],
      }),
      rule({
        id: "baseline",
        priority: 1000,
        conditions: [{ field: "jobType.code", operator: "truthy" }],
        templateId: GENERAL_TEMPLATE,
        addPpeIds: ["ppe-glasses"],
      }),
    ];

    const result = resolveSwms(facts, rules);

    expect(result.hazardIds.sort()).toEqual(["haz-electric-shock", "haz-fall"].sort());
    expect(result.ppeIds.sort()).toEqual(
      ["ppe-insulated-gloves", "ppe-harness", "ppe-glasses"].sort(),
    );
    expect(result.permitCodes.sort()).toEqual(
      ["PERMIT-ELECTRICAL-ISOLATION", "PERMIT-WORKING-AT-HEIGHT"].sort(),
    );
    expect(result.requiredSectionKeys).toEqual(["electrical_isolation"]);
    expect(result.matchedRules.map((m) => m.ruleId).sort()).toEqual(
      ["baseline", "electrical", "height"].sort(),
    );
  });

  it("a lower-priority rule's template wins over a higher-priority number rule", () => {
    const facts = baseFacts({ confinedSpace: true });
    const rules: RuleDefinition[] = [
      rule({
        id: "confined-space-specific",
        priority: 5,
        conditions: [{ field: "environment.confinedSpace", operator: "equals", value: true }],
        templateId: CONFINED_SPACE_TEMPLATE,
      }),
      rule({
        id: "baseline",
        priority: 1000,
        conditions: [{ field: "jobType.code", operator: "truthy" }],
        templateId: GENERAL_TEMPLATE,
      }),
    ];

    const result = resolveSwms(facts, rules);

    expect(result.templateId).toBe(CONFINED_SPACE_TEMPLATE);
  });

  it("ignores inactive rules even when their conditions match", () => {
    const facts = baseFacts({ workingAtHeight: true });
    const rules: RuleDefinition[] = [
      rule({
        id: "disabled-height-rule",
        isActive: false,
        conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
        templateId: GENERAL_TEMPLATE,
        addHazardIds: ["haz-fall"],
      }),
      rule({
        id: "baseline",
        priority: 1000,
        conditions: [{ field: "jobType.code", operator: "truthy" }],
        templateId: GENERAL_TEMPLATE,
      }),
    ];

    const result = resolveSwms(facts, rules);

    expect(result.hazardIds).toEqual([]);
    expect(result.matchedRules.map((m) => m.ruleId)).toEqual(["baseline"]);
  });

  it("supports ANY condition logic", () => {
    const facts = baseFacts({ confinedSpace: true });
    const rules: RuleDefinition[] = [
      rule({
        id: "any-hazardous-env",
        conditionLogic: "ANY",
        conditions: [
          { field: "environment.workingAtHeight", operator: "equals", value: true },
          { field: "environment.confinedSpace", operator: "equals", value: true },
        ],
        templateId: GENERAL_TEMPLATE,
        addHazardIds: ["haz-confined-space-atmosphere"],
      }),
    ];

    const result = resolveSwms(facts, rules);

    expect(result.hazardIds).toEqual(["haz-confined-space-atmosphere"]);
  });

  describe("evaluateCondition operators", () => {
    it("supports in / notIn / includes against equipmentCodes and environment", () => {
      const facts: JobFacts = {
        jobType: { id: "jt-1", code: "ELECTRICAL" },
        equipmentCodes: ["EWP", "POWER_TOOLS"],
        environment: {},
      };
      const rules: RuleDefinition[] = [
        rule({
          id: "in-jobtype",
          conditions: [{ field: "jobType.code", operator: "in", value: ["ELECTRICAL", "PLUMBING"] }],
          templateId: GENERAL_TEMPLATE,
        }),
        rule({
          id: "includes-equipment",
          conditions: [{ field: "equipmentCodes", operator: "includes", value: "EWP" }],
          addHazardIds: ["haz-fall"],
        }),
        rule({
          id: "notin-jobtype-should-not-match",
          conditions: [{ field: "jobType.code", operator: "notIn", value: ["ELECTRICAL"] }],
          addHazardIds: ["haz-should-not-appear"],
        }),
      ];

      const result = resolveSwms(facts, rules);

      expect(result.templateId).toBe(GENERAL_TEMPLATE);
      expect(result.hazardIds).toEqual(["haz-fall"]);
    });
  });

  describe("nested condition groups", () => {
    it("evaluates a nested ANY group inside a top-level ALL", () => {
      // (jobType is truthy) AND (workingAtHeight OR confinedSpace)
      const facts = baseFacts({ confinedSpace: true });
      const rules: RuleDefinition[] = [
        rule({
          id: "height-or-confined",
          conditionLogic: "ALL",
          conditions: [
            { field: "jobType.code", operator: "truthy" },
            {
              logic: "ANY",
              conditions: [
                { field: "environment.workingAtHeight", operator: "equals", value: true },
                { field: "environment.confinedSpace", operator: "equals", value: true },
              ],
            },
          ],
          templateId: GENERAL_TEMPLATE,
          addHazardIds: ["haz-confined-space-atmosphere"],
        }),
      ];

      const result = resolveSwms(facts, rules);

      expect(result.hazardIds).toEqual(["haz-confined-space-atmosphere"]);
    });

    it("does not match when the nested group's condition fails", () => {
      const facts = baseFacts(); // neither workingAtHeight nor confinedSpace
      const rules: RuleDefinition[] = [
        rule({
          id: "height-or-confined",
          conditions: [
            { field: "jobType.code", operator: "truthy" },
            {
              logic: "ANY",
              conditions: [
                { field: "environment.workingAtHeight", operator: "equals", value: true },
                { field: "environment.confinedSpace", operator: "equals", value: true },
              ],
            },
          ],
          templateId: GENERAL_TEMPLATE,
        }),
        rule({
          id: "baseline",
          priority: 1000,
          conditions: [{ field: "jobType.code", operator: "truthy" }],
          templateId: GENERAL_TEMPLATE,
        }),
      ];

      const result = resolveSwms(facts, rules);

      expect(result.matchedRules.map((m) => m.ruleId)).toEqual(["baseline"]);
    });

    it("supports groups nested more than one level deep", () => {
      // ANY( electricalWork, ALL( workingAtHeight, ANY(confinedSpace, hotWork) ) )
      const facts = baseFacts({ workingAtHeight: true, hotWork: true });
      const rules: RuleDefinition[] = [
        rule({
          id: "deep-nesting",
          conditionLogic: "ANY",
          conditions: [
            { field: "environment.electricalWork", operator: "equals", value: true },
            {
              logic: "ALL",
              conditions: [
                { field: "environment.workingAtHeight", operator: "equals", value: true },
                {
                  logic: "ANY",
                  conditions: [
                    { field: "environment.confinedSpace", operator: "equals", value: true },
                    { field: "environment.hotWork", operator: "equals", value: true },
                  ],
                },
              ],
            },
          ],
          templateId: GENERAL_TEMPLATE,
          addHazardIds: ["haz-deep-match"],
        }),
      ];

      const result = resolveSwms(facts, rules);

      expect(result.hazardIds).toEqual(["haz-deep-match"]);
    });
  });
});
