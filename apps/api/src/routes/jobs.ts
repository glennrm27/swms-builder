import { Router } from "express";
import { z } from "zod";
import { prisma } from "@swms/db";
import { jobIntakeSchema } from "@swms/shared-types";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { ConflictError, NotFoundError } from "../lib/httpError.js";
import { requireParam } from "../lib/params.js";
import { getStorage } from "../lib/storage.js";
import { createJob, getJobOrThrow, listJobs, updateJob } from "../services/jobService.js";
import { generateVersionForJob } from "../services/documentService.js";
import { recordAudit } from "../services/auditService.js";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const listQuerySchema = z.object({ status: z.string().optional() });

jobsRouter.get(
  "/",
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await listJobs(req.query as z.infer<typeof listQuerySchema>));
  }),
);

jobsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getJobOrThrow(requireParam(req, "id")));
  }),
);

jobsRouter.post(
  "/",
  requireRole("ADMIN", "EDITOR"),
  validateBody(jobIntakeSchema),
  asyncHandler(async (req, res) => {
    const job = await createJob(req.body, req.user!.id);
    res.status(201).json(job);
  }),
);

jobsRouter.put(
  "/:id",
  requireRole("ADMIN", "EDITOR"),
  validateBody(jobIntakeSchema),
  asyncHandler(async (req, res) => {
    const job = await updateJob(requireParam(req, "id"), req.body, req.user!.id);
    res.json(job);
  }),
);

/** Generates a SWMS document version and moves the job into review. */
jobsRouter.post(
  "/:id/submit",
  requireRole("ADMIN", "EDITOR"),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Job", id);
    if (job.status !== "DRAFT") {
      throw new ConflictError(`Only DRAFT jobs can be submitted (current status: ${job.status})`);
    }

    // Generate first, flip status only on success — if document generation
    // fails (e.g. a template error, storage outage), the job must stay
    // DRAFT and re-submittable rather than getting stuck in a SUBMITTED
    // limbo that's neither editable nor reviewable.
    await generateVersionForJob(job.id, req.user!.id);
    const updated = await prisma.job.update({ where: { id: job.id }, data: { status: "IN_REVIEW" } });

    await recordAudit(prisma, {
      action: "JOB_SUBMITTED",
      entityType: "Job",
      entityId: job.id,
      jobId: job.id,
      userId: req.user!.id,
    });

    res.json(updated);
  }),
);

/** Publishes an approved job, making its latest version the official record. */
jobsRouter.post(
  "/:id/publish",
  requireRole("ADMIN", "REVIEWER"),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Job", id);
    if (job.status !== "APPROVED") {
      throw new ConflictError(`Only APPROVED jobs can be published (current status: ${job.status})`);
    }

    const updated = await prisma.job.update({ where: { id: job.id }, data: { status: "PUBLISHED" } });

    await recordAudit(prisma, {
      action: "JOB_PUBLISHED",
      entityType: "Job",
      entityId: job.id,
      jobId: job.id,
      userId: req.user!.id,
    });

    res.json(updated);
  }),
);

jobsRouter.get(
  "/:id/versions/:versionId/download",
  asyncHandler(async (req, res) => {
    const jobId = requireParam(req, "id");
    const versionId = requireParam(req, "versionId");
    const format = req.query.format === "pdf" ? "pdf" : "docx";
    const version = await prisma.sWMSVersion.findUnique({ where: { id: versionId } });
    if (!version || version.jobId !== jobId) {
      throw new NotFoundError("SWMSVersion", versionId);
    }

    const storagePath = format === "pdf" ? version.pdfStoragePath : version.docxStoragePath;
    const buffer = await getStorage().get(storagePath);
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="swms-v${version.versionNumber}.${format}"`);
    res.send(buffer);
  }),
);
