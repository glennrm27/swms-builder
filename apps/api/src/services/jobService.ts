import { Prisma, prisma } from "@swms/db";
import { resolveSwms } from "@swms/rules-engine";
import type { JobIntakeInput } from "@swms/shared-types";
import { ConflictError, NotFoundError } from "../lib/httpError.js";
import { buildJobFacts, loadActiveRuleDefinitions } from "./rulesService.js";
import { recordAudit } from "./auditService.js";

export const fullJobInclude = {
  jobType: true,
  createdBy: { include: { role: true } },
  equipment: { include: { equipment: true } },
  tasks: { include: { hazards: { include: { hazard: true } } }, orderBy: { sequence: "asc" } },
  jobHazards: { include: { hazard: true } },
  jobPpe: { include: { ppe: true } },
  versions: { orderBy: { versionNumber: "desc" } },
  approvals: { orderBy: { decidedAt: "desc" }, include: { decidedBy: true } },
} satisfies Prisma.JobInclude;

export type FullJob = Prisma.JobGetPayload<{ include: typeof fullJobInclude }>;

async function resolveJobRules(input: {
  jobTypeId: string;
  equipmentIds: string[];
  environment: Record<string, boolean>;
}) {
  const jobType = await prisma.jobType.findUnique({ where: { id: input.jobTypeId } });
  if (!jobType) throw new NotFoundError("JobType", input.jobTypeId);

  const equipment = await prisma.equipment.findMany({ where: { id: { in: input.equipmentIds } } });

  const rules = await loadActiveRuleDefinitions(prisma);
  const facts = buildJobFacts({
    jobTypeId: jobType.id,
    jobTypeCode: jobType.code,
    equipmentCodes: equipment.map((e) => e.code),
    environment: input.environment,
  });

  return { jobType, equipment, resolution: resolveSwms(facts, rules) };
}

export async function createJob(input: JobIntakeInput, userId: string): Promise<FullJob> {
  const { jobType, equipment, resolution } = await resolveJobRules(input);

  const job = await prisma.job.create({
    data: {
      jobName: input.jobName,
      siteAddress: input.siteAddress,
      principalContractor: input.principalContractor,
      workDescription: input.workDescription,
      jobTypeId: jobType.id,
      environment: input.environment,
      plannedStartDate: input.plannedStartDate,
      plannedEndDate: input.plannedEndDate,
      additionalNotes: input.additionalNotes,
      createdById: userId,
      equipment: { create: equipment.map((e) => ({ equipmentId: e.id })) },
      tasks: {
        create: input.tasks.map((t) => ({
          sequence: t.sequence,
          description: t.description,
          additionalControlNotes: t.additionalControlNotes,
          hazards: { create: t.hazardIds.map((hazardId) => ({ hazardId })) },
        })),
      },
      jobHazards: { create: mergeHazardSources(resolution.hazardIds, input.selectedHazardIds) },
      jobPpe: { create: mergePpeSources(resolution.ppeIds, input.selectedPpeIds) },
    },
    include: fullJobInclude,
  });

  await recordAudit(prisma, {
    action: "JOB_CREATED",
    entityType: "Job",
    entityId: job.id,
    jobId: job.id,
    userId,
    metadata: { matchedRules: resolution.matchedRules },
  });

  return job;
}

export async function updateJob(jobId: string, input: JobIntakeInput, userId: string): Promise<FullJob> {
  const existing = await prisma.job.findUnique({ where: { id: jobId } });
  if (!existing) throw new NotFoundError("Job", jobId);
  if (existing.status !== "DRAFT") {
    throw new ConflictError(`Job cannot be edited while in status ${existing.status}. Only DRAFT jobs can be edited.`);
  }

  const { jobType, equipment, resolution } = await resolveJobRules(input);

  // Replace child rows wholesale — the simplest correct way to reconcile a
  // full form re-submission against join tables without diffing.
  const job = await prisma.$transaction(async (tx) => {
    await tx.jobEquipment.deleteMany({ where: { jobId } });
    await tx.task.deleteMany({ where: { jobId } }); // cascades TaskHazard
    await tx.jobHazard.deleteMany({ where: { jobId } });
    await tx.jobPpe.deleteMany({ where: { jobId } });

    return tx.job.update({
      where: { id: jobId },
      data: {
        jobName: input.jobName,
        siteAddress: input.siteAddress,
        principalContractor: input.principalContractor,
        workDescription: input.workDescription,
        jobTypeId: jobType.id,
        environment: input.environment,
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        additionalNotes: input.additionalNotes,
        equipment: { create: equipment.map((e) => ({ equipmentId: e.id })) },
        tasks: {
          create: input.tasks.map((t) => ({
            sequence: t.sequence,
            description: t.description,
            additionalControlNotes: t.additionalControlNotes,
            hazards: { create: t.hazardIds.map((hazardId) => ({ hazardId })) },
          })),
        },
        jobHazards: { create: mergeHazardSources(resolution.hazardIds, input.selectedHazardIds) },
        jobPpe: { create: mergePpeSources(resolution.ppeIds, input.selectedPpeIds) },
      },
      include: fullJobInclude,
    });
  });

  await recordAudit(prisma, {
    action: "JOB_UPDATED",
    entityType: "Job",
    entityId: job.id,
    jobId: job.id,
    userId,
    metadata: { matchedRules: resolution.matchedRules },
  });

  return job;
}

export async function getJobOrThrow(jobId: string): Promise<FullJob> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: fullJobInclude });
  if (!job) throw new NotFoundError("Job", jobId);
  return job;
}

export async function listJobs(filter: { status?: string } = {}) {
  return prisma.job.findMany({
    where: filter.status ? { status: filter.status as never } : undefined,
    include: { jobType: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

function mergeHazardSources(ruleHazardIds: string[], manualHazardIds: string[]) {
  const ruleSet = new Set(ruleHazardIds);
  return [
    ...ruleHazardIds.map((hazardId) => ({ hazardId, source: "RULE" })),
    ...manualHazardIds.filter((id) => !ruleSet.has(id)).map((hazardId) => ({ hazardId, source: "MANUAL" })),
  ];
}

function mergePpeSources(rulePpeIds: string[], manualPpeIds: string[]) {
  const ruleSet = new Set(rulePpeIds);
  return [
    ...rulePpeIds.map((ppeId) => ({ ppeId, source: "RULE" })),
    ...manualPpeIds.filter((id) => !ruleSet.has(id)).map((ppeId) => ({ ppeId, source: "MANUAL" })),
  ];
}
