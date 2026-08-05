import { Router } from "express";
import { prisma } from "@swms/db";
import { approvalDecisionInputSchema } from "@swms/shared-types";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { ConflictError, NotFoundError } from "../lib/httpError.js";
import { requireParam } from "../lib/params.js";
import { recordAudit } from "../services/auditService.js";

export const approvalsRouter = Router({ mergeParams: true });
approvalsRouter.use(requireAuth);

/**
 * Decision -> job status mapping:
 *  - APPROVED           -> Job.status = APPROVED (ready to publish)
 *  - REJECTED           -> Job.status = REJECTED  (terminal; a new job/version is required)
 *  - CHANGES_REQUESTED  -> Job.status = DRAFT      (kicked back to the editor)
 */
approvalsRouter.post(
  "/",
  requireRole("ADMIN", "REVIEWER"),
  validateBody(approvalDecisionInputSchema),
  asyncHandler(async (req, res) => {
    const jobId = requireParam(req, "jobId");
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!job) throw new NotFoundError("Job", jobId);
    if (job.status !== "IN_REVIEW") {
      throw new ConflictError(`Only jobs IN_REVIEW can be decided (current status: ${job.status})`);
    }
    const latestVersion = job.versions[0];
    if (!latestVersion) throw new ConflictError("Job has no generated SWMS version to review");

    const { decision, comment } = req.body as { decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; comment?: string };

    const nextStatus = decision === "APPROVED" ? "APPROVED" : decision === "REJECTED" ? "REJECTED" : "DRAFT";

    const [approval] = await prisma.$transaction([
      prisma.approval.create({
        data: {
          jobId,
          versionId: latestVersion.id,
          decision,
          comment,
          decidedById: req.user!.id,
        },
      }),
      prisma.job.update({ where: { id: jobId }, data: { status: nextStatus } }),
    ]);

    await recordAudit(prisma, {
      action: "APPROVAL_DECIDED",
      entityType: "Approval",
      entityId: approval.id,
      jobId,
      userId: req.user!.id,
      metadata: { decision, versionId: latestVersion.id },
    });

    res.status(201).json(approval);
  }),
);
