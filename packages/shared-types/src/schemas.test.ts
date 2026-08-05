import { describe, expect, it } from "vitest";
import { approvalDecisionInputSchema, jobIntakeSchema, ruleInputSchema } from "./schemas.js";

const validJobIntake = {
  jobName: "Rooftop Solar Install",
  siteAddress: "12 Example St, Brisbane QLD",
  principalContractor: "Acme Electrical Pty Ltd",
  workDescription: "Install rooftop solar panels and connect to switchboard.",
  jobTypeId: "11111111-1111-1111-1111-111111111111",
  equipmentIds: [],
  environment: { workingAtHeight: true },
  tasks: [{ sequence: 1, description: "Erect EWP and access roof", hazardIds: [] }],
  selectedHazardIds: [],
  selectedPpeIds: [],
  plannedStartDate: "2026-08-12",
  plannedEndDate: "2026-08-14",
};

describe("jobIntakeSchema", () => {
  it("accepts a well-formed job intake", () => {
    const result = jobIntakeSchema.safeParse(validJobIntake);
    expect(result.success).toBe(true);
  });

  it("rejects a job with no task steps", () => {
    const result = jobIntakeSchema.safeParse({ ...validJobIntake, tasks: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = jobIntakeSchema.safeParse({
      ...validJobIntake,
      plannedStartDate: "2026-08-14",
      plannedEndDate: "2026-08-12",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("plannedEndDate");
    }
  });

  it("rejects a jobTypeId that is not a UUID", () => {
    const result = jobIntakeSchema.safeParse({ ...validJobIntake, jobTypeId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a work description that is too short", () => {
    const result = jobIntakeSchema.safeParse({ ...validJobIntake, workDescription: "short" });
    expect(result.success).toBe(false);
  });

  it("defaults optional array fields when omitted", () => {
    const { equipmentIds, selectedHazardIds, selectedPpeIds, ...rest } = validJobIntake;
    const result = jobIntakeSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.equipmentIds).toEqual([]);
      expect(result.data.selectedHazardIds).toEqual([]);
    }
  });
});

describe("approvalDecisionInputSchema", () => {
  it("allows APPROVED with no comment", () => {
    const result = approvalDecisionInputSchema.safeParse({ decision: "APPROVED" });
    expect(result.success).toBe(true);
  });

  it("requires a comment when REJECTED", () => {
    const result = approvalDecisionInputSchema.safeParse({ decision: "REJECTED" });
    expect(result.success).toBe(false);
  });

  it("requires a comment when CHANGES_REQUESTED", () => {
    const result = approvalDecisionInputSchema.safeParse({ decision: "CHANGES_REQUESTED", comment: "" });
    expect(result.success).toBe(false);
  });

  it("accepts REJECTED with a non-empty comment", () => {
    const result = approvalDecisionInputSchema.safeParse({
      decision: "REJECTED",
      comment: "Missing isolation procedure for switchboard work.",
    });
    expect(result.success).toBe(true);
  });
});

describe("ruleInputSchema", () => {
  it("accepts a rule with at least one condition", () => {
    const result = ruleInputSchema.safeParse({
      name: "Working at height baseline controls",
      conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a rule with zero conditions", () => {
    const result = ruleInputSchema.safeParse({
      name: "Empty rule",
      conditions: [],
    });
    expect(result.success).toBe(false);
  });

  it("defaults conditionLogic to ALL and priority to 100", () => {
    const result = ruleInputSchema.safeParse({
      name: "Some rule",
      conditions: [{ field: "environment.hotWork", operator: "truthy" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditionLogic).toBe("ALL");
      expect(result.data.priority).toBe(100);
    }
  });

  it("accepts a nested condition group alongside leaf conditions", () => {
    const result = ruleInputSchema.safeParse({
      name: "Nested rule",
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
    });
    expect(result.success).toBe(true);
  });

  it("rejects a nested group with zero conditions", () => {
    const result = ruleInputSchema.safeParse({
      name: "Nested rule",
      conditions: [{ logic: "ANY", conditions: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts groups nested more than one level deep", () => {
    const result = ruleInputSchema.safeParse({
      name: "Deeply nested rule",
      conditions: [
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
    });
    expect(result.success).toBe(true);
  });
});
