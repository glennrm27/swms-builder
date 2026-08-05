/**
 * The structured JSON contract between the API and the document-gen
 * package. This is the ONLY thing document-gen knows about — it has no
 * awareness of Prisma, HTTP, or the web app. Keeping this a plain
 * interface (not a class, not DB rows) is what makes doc-gen independently
 * testable and independently deployable.
 */

export interface ResolvedControl {
  hazardCode: string;
  hazardName: string;
  hazardCategory: string;
  riskRatingBeforeControls: string;
  description: string;
  hierarchy: string;
  residualRiskRating: string;
}

export interface ResolvedTaskStep {
  sequence: number;
  description: string;
  hazards: ResolvedControl[];
}

export interface SwmsDocumentData {
  meta: {
    jobName: string;
    siteAddress: string;
    principalContractor: string;
    workDescription: string;
    plannedStartDate: string; // ISO date, pre-formatted for the template locale
    plannedEndDate: string;
    versionNumber: number;
    generatedAt: string;
    documentReference: string; // e.g. SWMS-000123-v3
  };
  jobType: string;
  equipment: string[];
  environmentFlags: string[]; // human-readable, e.g. ["Working at height", "Confined space"]
  taskSteps: ResolvedTaskStep[];
  ppeRequired: { code: string; name: string }[];
  permitsRequired: string[];
  additionalNotes?: string;
  approvals: {
    preparedBy: { name: string; position: string; signedAt: string };
    reviewedBy?: { name: string; position: string; signedAt: string; decision: string };
  };
  templateSections: { key: string; title: string; bodyMarkdown?: string }[];
}

export interface GeneratedDocumentResult {
  docxStoragePath: string;
  pdfStoragePath: string;
  docxSizeBytes: number;
  pdfSizeBytes: number;
}
