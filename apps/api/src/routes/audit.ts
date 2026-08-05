import { Router } from "express";
import { z } from "zod";
import { prisma } from "@swms/db";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateQuery } from "../middleware/validate.js";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("ADMIN", "REVIEWER"));

const auditQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

auditRouter.get(
  "/",
  validateQuery(auditQuerySchema),
  asyncHandler(async (req, res) => {
    const { jobId, entityType, take } = req.query as unknown as z.infer<typeof auditQuerySchema>;
    const entries = await prisma.auditLog.findMany({
      where: { jobId, entityType },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    res.json(entries);
  }),
);
