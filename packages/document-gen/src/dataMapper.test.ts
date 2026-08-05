import { describe, expect, it } from "vitest";
import { mapToTemplateContext } from "./dataMapper.js";
import type { SwmsDocumentData } from "@swms/shared-types";

function sampleData(overrides: Partial<SwmsDocumentData> = {}): SwmsDocumentData {
  return {
    meta: {
      jobName: "Test Job",
      siteAddress: "1 Test St",
      principalContractor: "Test Pty Ltd",
      workDescription: "Do the test work.",
      plannedStartDate: "01/01/2026",
      plannedEndDate: "02/01/2026",
      versionNumber: 1,
      generatedAt: "01/01/2026 09:00",
      documentReference: "SWMS-000001-v1",
    },
    jobType: "General Construction",
    equipment: [],
    environmentFlags: [],
    taskSteps: [],
    ppeRequired: [],
    permitsRequired: [],
    approvals: {
      preparedBy: { name: "Prep Person", position: "Supervisor", signedAt: "01/01/2026" },
    },
    templateSections: [],
    ...overrides,
  };
}

describe("mapToTemplateContext", () => {
  it("flattens meta fields to the top level for docxtemplater", () => {
    const ctx = mapToTemplateContext(sampleData());
    expect(ctx.jobName).toBe("Test Job");
    expect(ctx.documentReference).toBe("SWMS-000001-v1");
  });

  it("defaults additionalNotes to 'None' when absent", () => {
    const ctx = mapToTemplateContext(sampleData());
    expect(ctx.additionalNotes).toBe("None");
  });

  it("defaults permitsRequired to a placeholder list when empty", () => {
    const ctx = mapToTemplateContext(sampleData({ permitsRequired: [] }));
    expect(ctx.permitsRequired).toEqual(["None required"]);
  });

  it("passes through a non-empty permitsRequired list unchanged", () => {
    const ctx = mapToTemplateContext(sampleData({ permitsRequired: ["Permit A"] }));
    expect(ctx.permitsRequired).toEqual(["Permit A"]);
  });

  it("sets hasReviewer false and blank reviewer fields when no reviewer is present", () => {
    const ctx = mapToTemplateContext(sampleData());
    expect(ctx.hasReviewer).toBe(false);
    expect(ctx.reviewedByName).toBe("");
  });

  it("sets hasReviewer true and populates reviewer fields when present", () => {
    const ctx = mapToTemplateContext(
      sampleData({
        approvals: {
          preparedBy: { name: "Prep Person", position: "Supervisor", signedAt: "01/01/2026" },
          reviewedBy: { name: "Reviewer Name", position: "WHS Lead", signedAt: "02/01/2026", decision: "APPROVED" },
        },
      }),
    );
    expect(ctx.hasReviewer).toBe(true);
    expect(ctx.reviewedByName).toBe("Reviewer Name");
    expect(ctx.reviewedByDecision).toBe("APPROVED");
  });

  it("maps nested taskSteps and their hazards without losing fields", () => {
    const ctx = mapToTemplateContext(
      sampleData({
        taskSteps: [
          {
            sequence: 1,
            description: "Step one",
            hazards: [
              {
                hazardCode: "HAZ-1",
                hazardName: "Test Hazard",
                hazardCategory: "General",
                riskRatingBeforeControls: "HIGH",
                description: "Control description",
                hierarchy: "ENGINEERING",
                residualRiskRating: "LOW",
              },
            ],
          },
        ],
      }),
    );
    const taskSteps = ctx.taskSteps as any[];
    expect(taskSteps).toHaveLength(1);
    expect(taskSteps[0].hazards[0].hazardName).toBe("Test Hazard");
    expect(taskSteps[0].hazards[0].residualRiskRating).toBe("LOW");
  });
});
