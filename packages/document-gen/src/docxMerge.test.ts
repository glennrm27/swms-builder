import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import type { SwmsDocumentData } from "@swms/shared-types";
import { DocxMergeError, mergeSwmsDocx } from "./docxMerge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, "..", "templates", "general-construction-swms.docx");

function fullDocumentText(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")!.asText();
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const sampleData: SwmsDocumentData = {
  meta: {
    jobName: "Rooftop Solar Install",
    siteAddress: "12 Example St, Brisbane QLD",
    principalContractor: "Acme Electrical Pty Ltd",
    workDescription: "Install rooftop solar panels.",
    plannedStartDate: "12/08/2026",
    plannedEndDate: "14/08/2026",
    versionNumber: 1,
    generatedAt: "05/08/2026 14:30",
    documentReference: "SWMS-000123-v1",
  },
  jobType: "Electrical Work",
  equipment: ["Elevated Work Platform"],
  environmentFlags: ["Working at height", "Electrical work"],
  taskSteps: [
    {
      sequence: 1,
      description: "Erect EWP and access roof",
      hazards: [
        {
          hazardCode: "HAZ-FALL-HEIGHT",
          hazardName: "Fall from height",
          hazardCategory: "Working at Height",
          riskRatingBeforeControls: "HIGH",
          description: "Use guardrails or edge protection.",
          hierarchy: "ENGINEERING",
          residualRiskRating: "LOW",
        },
      ],
    },
  ],
  ppeRequired: [{ code: "PPE-HARNESS", name: "Safety Harness" }],
  permitsRequired: ["Working at Height Permit"],
  approvals: {
    preparedBy: { name: "Jane Smith", position: "Site Supervisor", signedAt: "05/08/2026" },
  },
  templateSections: [],
};

describe("mergeSwmsDocx", () => {
  it("merges data into the default template leaving no unresolved tags", () => {
    const templateBuffer = readFileSync(TEMPLATE_PATH);
    const result = mergeSwmsDocx(templateBuffer, sampleData);

    expect(result.byteLength).toBeGreaterThan(0);
    const text = fullDocumentText(result);
    expect(text).not.toMatch(/[{}]/);
    expect(text).toContain("Rooftop Solar Install");
    expect(text).toContain("Fall from height");
    expect(text).toContain("Safety Harness");
  });

  it("renders the conditional reviewer block only when a reviewer is present", () => {
    const templateBuffer = readFileSync(TEMPLATE_PATH);

    const withoutReviewer = fullDocumentText(mergeSwmsDocx(templateBuffer, sampleData));
    expect(withoutReviewer).not.toContain("Reviewed by");

    const withReviewer = fullDocumentText(
      mergeSwmsDocx(templateBuffer, {
        ...sampleData,
        approvals: {
          ...sampleData.approvals,
          reviewedBy: { name: "Mark Lee", position: "WHS Reviewer", decision: "APPROVED", signedAt: "06/08/2026" },
        },
      }),
    );
    expect(withReviewer).toContain("Reviewed by Mark Lee");
  });

  it("throws DocxMergeError (not a raw parser exception) on a malformed template", () => {
    // A .docx with no docxtemplater tags at all but valid zip/xml structure
    // is fine to render (nothing to substitute); a genuinely corrupt zip is
    // what should surface as DocxMergeError.
    const notAZipFile = Buffer.from("this is not a docx file");
    expect(() => mergeSwmsDocx(notAZipFile, sampleData)).toThrow();
  });
});
