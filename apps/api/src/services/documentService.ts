import { prisma } from "@swms/db";
import { resolveSwms } from "@swms/rules-engine";
import { generateSwmsDocument } from "@swms/document-gen";
import type { ResolvedControl, ResolvedTaskStep, SwmsDocumentData } from "@swms/shared-types";
import { NotFoundError } from "../lib/httpError.js";
import { getStorage } from "../lib/storage.js";
import { buildJobFacts, loadActiveRuleDefinitions } from "./rulesService.js";
import { recordAudit } from "./auditService.js";
import { fullJobInclude, type FullJob } from "./jobService.js";

const ENVIRONMENT_LABELS: Record<string, string> = {
  workingAtHeight: "Working at height",
  confinedSpace: "Confined space",
  electricalWork: "Electrical work",
  hotWork: "Hot work",
  excavation: "Excavation",
  nearRoadwayOrTraffic: "Near roadway / traffic",
  outdoors: "Outdoors",
  occupiedSite: "Occupied site",
  workingAlone: "Working alone",
  overheadServices: "Overhead services",
};

function formatEnvironmentFlags(environment: Record<string, boolean>): string[] {
  return Object.entries(environment)
    .filter(([, value]) => value)
    .map(([key]) => ENVIRONMENT_LABELS[key] ?? key);
}

function formatAuDate(date: Date): string {
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Builds the resolved, task-by-task hazard/control data for the document
 * from the job's current TaskHazard links plus the hazard library's
 * active control measures. If a linked hazard currently has no active
 * control measures configured, it still appears (with an empty control
 * list) rather than being silently dropped — a hazard with no documented
 * control is a data-quality problem admins need to see, not hide.
 */
async function buildTaskSteps(job: FullJob): Promise<ResolvedTaskStep[]> {
  const allHazardIds = [...new Set(job.tasks.flatMap((t) => t.hazards.map((h) => h.hazardId)))];
  const controlMeasures = await prisma.controlMeasure.findMany({
    where: { hazardId: { in: allHazardIds }, isActive: true },
  });
  const controlsByHazard = new Map<string, typeof controlMeasures>();
  for (const cm of controlMeasures) {
    const list = controlsByHazard.get(cm.hazardId) ?? [];
    list.push(cm);
    controlsByHazard.set(cm.hazardId, list);
  }

  return job.tasks.map((task) => {
    const hazards: ResolvedControl[] = task.hazards.flatMap((taskHazard) => {
      const hazard = taskHazard.hazard;
      const controls = controlsByHazard.get(hazard.id) ?? [];
      if (controls.length === 0) {
        return [
          {
            hazardCode: hazard.code,
            hazardName: hazard.name,
            hazardCategory: hazard.category,
            riskRatingBeforeControls: hazard.defaultRiskRating,
            description: "No control measure has been documented for this hazard yet.",
            hierarchy: "ADMINISTRATIVE",
            residualRiskRating: hazard.defaultRiskRating,
          },
        ];
      }
      return controls.map((control) => ({
        hazardCode: hazard.code,
        hazardName: hazard.name,
        hazardCategory: hazard.category,
        riskRatingBeforeControls: hazard.defaultRiskRating,
        description: control.description,
        hierarchy: control.hierarchy,
        residualRiskRating: control.residualRiskRating,
      }));
    });

    return { sequence: task.sequence, description: task.description, hazards };
  });
}

/**
 * The one place that turns a Job into a rendered, stored SWMS document.
 * Re-runs the rules engine (rather than trusting whatever was resolved at
 * intake time) so that if hazards/rules/templates changed between intake
 * and submission, the generated document reflects current safety content.
 */
export async function generateVersionForJob(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: fullJobInclude });
  if (!job) throw new NotFoundError("Job", jobId);

  const rules = await loadActiveRuleDefinitions(prisma);
  const facts = buildJobFacts({
    jobTypeId: job.jobType.id,
    jobTypeCode: job.jobType.code,
    equipmentCodes: job.equipment.map((e) => e.equipment.code),
    environment: job.environment as Record<string, boolean>,
  });
  const resolution = resolveSwms(facts, rules);

  const template = await prisma.sWMSTemplate.findUnique({
    where: { id: resolution.templateId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new NotFoundError("SWMSTemplate", resolution.templateId);

  const permits = await prisma.permit.findMany({ where: { code: { in: resolution.permitCodes } } });
  const sections = template.sections.filter(
    (s) => s.isDefault || resolution.requiredSectionKeys.includes(s.key),
  );

  const versionNumber = (await prisma.sWMSVersion.count({ where: { jobId } })) + 1;
  const documentReference = `SWMS-${job.id.slice(0, 8).toUpperCase()}-v${versionNumber}`;

  const taskSteps = await buildTaskSteps(job);

  const latestApproval = job.approvals[0];

  const data: SwmsDocumentData = {
    meta: {
      jobName: job.jobName,
      siteAddress: job.siteAddress,
      principalContractor: job.principalContractor,
      workDescription: job.workDescription,
      plannedStartDate: formatAuDate(job.plannedStartDate),
      plannedEndDate: formatAuDate(job.plannedEndDate),
      versionNumber,
      generatedAt: formatAuDate(new Date()),
      documentReference,
    },
    jobType: job.jobType.name,
    equipment: job.equipment.map((e) => e.equipment.name),
    environmentFlags: formatEnvironmentFlags(job.environment as Record<string, boolean>),
    taskSteps,
    ppeRequired: job.jobPpe.map((jp) => ({ code: jp.ppe.code, name: jp.ppe.name })),
    permitsRequired: permits.map((p) => p.name),
    additionalNotes: job.additionalNotes ?? undefined,
    approvals: {
      preparedBy: {
        name: job.createdBy.name,
        position: job.createdBy.role.name,
        signedAt: formatAuDate(job.createdAt),
      },
      reviewedBy: latestApproval
        ? {
            name: latestApproval.decidedBy.name,
            position: "Reviewer",
            signedAt: formatAuDate(latestApproval.decidedAt),
            decision: latestApproval.decision,
          }
        : undefined,
    },
    templateSections: sections.map((s) => ({ key: s.key, title: s.title, bodyMarkdown: s.bodyMarkdown ?? undefined })),
  };

  const result = await generateSwmsDocument(getStorage(), {
    templateStoragePath: template.docxStoragePath,
    data,
    outputKeyPrefix: `jobs/${job.id}/versions/${versionNumber}`,
  });

  const version = await prisma.sWMSVersion.create({
    data: {
      jobId: job.id,
      versionNumber,
      templateId: template.id,
      resolvedDataJson: data as never,
      docxStoragePath: result.docxStoragePath,
      pdfStoragePath: result.pdfStoragePath,
      generatedById: userId,
    },
  });

  await recordAudit(prisma, {
    action: "VERSION_GENERATED",
    entityType: "SWMSVersion",
    entityId: version.id,
    jobId: job.id,
    userId,
    metadata: { versionNumber, templateId: template.id, matchedRules: resolution.matchedRules },
  });

  return version;
}
