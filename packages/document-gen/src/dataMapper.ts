import type { SwmsDocumentData } from "@swms/shared-types";

/**
 * Flattens SwmsDocumentData into the context object handed to
 * docxtemplater. Kept as a pure, separately-testable function: the
 * "what does the template consume" contract lives here, not scattered
 * across docxMerge.ts.
 *
 * Template tag reference (see scripts/build-default-template.ts):
 *   {jobName} {siteAddress} {principalContractor} {workDescription}
 *   {plannedStartDate} {plannedEndDate} {versionNumber} {generatedAt}
 *   {documentReference} {jobType} {additionalNotes}
 *   {#environmentFlags}{.}{/environmentFlags}
 *   {#taskSteps}{sequence} {description}
 *     {#hazards}{hazardName} {description} {hierarchy} {residualRiskRating}{/hazards}
 *   {/taskSteps}
 *   {#ppeRequired}{name}{/ppeRequired}
 *   {#permitsRequired}{.}{/permitsRequired}
 *   {preparedByName} {preparedByPosition} {preparedBySignedAt}
 *   {hasReviewer} {reviewedByName} {reviewedByPosition} {reviewedBySignedAt} {reviewedByDecision}
 */
export function mapToTemplateContext(data: SwmsDocumentData): Record<string, unknown> {
  return {
    jobName: data.meta.jobName,
    siteAddress: data.meta.siteAddress,
    principalContractor: data.meta.principalContractor,
    workDescription: data.meta.workDescription,
    plannedStartDate: data.meta.plannedStartDate,
    plannedEndDate: data.meta.plannedEndDate,
    versionNumber: data.meta.versionNumber,
    generatedAt: data.meta.generatedAt,
    documentReference: data.meta.documentReference,
    jobType: data.jobType,
    additionalNotes: data.additionalNotes ?? "None",
    environmentFlags: data.environmentFlags,
    taskSteps: data.taskSteps.map((step) => ({
      sequence: step.sequence,
      description: step.description,
      hazards: step.hazards.map((h) => ({
        hazardName: h.hazardName,
        hazardCategory: h.hazardCategory,
        riskRatingBeforeControls: h.riskRatingBeforeControls,
        description: h.description,
        hierarchy: h.hierarchy,
        residualRiskRating: h.residualRiskRating,
      })),
    })),
    ppeRequired: data.ppeRequired,
    permitsRequired: data.permitsRequired.length > 0 ? data.permitsRequired : ["None required"],
    preparedByName: data.approvals.preparedBy.name,
    preparedByPosition: data.approvals.preparedBy.position,
    preparedBySignedAt: data.approvals.preparedBy.signedAt,
    hasReviewer: Boolean(data.approvals.reviewedBy),
    reviewedByName: data.approvals.reviewedBy?.name ?? "",
    reviewedByPosition: data.approvals.reviewedBy?.position ?? "",
    reviewedBySignedAt: data.approvals.reviewedBy?.signedAt ?? "",
    reviewedByDecision: data.approvals.reviewedBy?.decision ?? "",
    templateSections: data.templateSections,
  };
}
