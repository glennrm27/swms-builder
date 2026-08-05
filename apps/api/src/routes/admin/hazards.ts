import { Router } from "express";
import { prisma } from "@swms/db";
import { controlMeasureInputSchema, hazardInputSchema } from "@swms/shared-types";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateBody } from "../../middleware/validate.js";
import { NotFoundError } from "../../lib/httpError.js";
import { requireParam } from "../../lib/params.js";
import { recordAudit } from "../../services/auditService.js";

export const adminHazardsRouter = Router();
adminHazardsRouter.use(requireAuth, requireRole("ADMIN"));

adminHazardsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.hazard.findMany({
        include: { controlMeasures: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
    );
  }),
);

adminHazardsRouter.post(
  "/",
  validateBody(hazardInputSchema),
  asyncHandler(async (req, res) => {
    const hazard = await prisma.hazard.create({ data: req.body });
    await recordAudit(prisma, {
      action: "HAZARD_LIBRARY_UPDATED",
      entityType: "Hazard",
      entityId: hazard.id,
      userId: req.user!.id,
      metadata: { operation: "create", hazard },
    });
    res.status(201).json(hazard);
  }),
);

adminHazardsRouter.put(
  "/:id",
  validateBody(hazardInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const existing = await prisma.hazard.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Hazard", id);

    const hazard = await prisma.hazard.update({ where: { id }, data: req.body });
    await recordAudit(prisma, {
      action: "HAZARD_LIBRARY_UPDATED",
      entityType: "Hazard",
      entityId: hazard.id,
      userId: req.user!.id,
      metadata: { operation: "update", before: existing, after: hazard },
    });
    res.json(hazard);
  }),
);

adminHazardsRouter.post(
  "/:id/control-measures",
  validateBody(controlMeasureInputSchema.omit({ hazardId: true })),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const hazard = await prisma.hazard.findUnique({ where: { id } });
    if (!hazard) throw new NotFoundError("Hazard", id);

    const controlMeasure = await prisma.controlMeasure.create({
      data: { ...req.body, hazardId: hazard.id },
    });
    await recordAudit(prisma, {
      action: "HAZARD_LIBRARY_UPDATED",
      entityType: "ControlMeasure",
      entityId: controlMeasure.id,
      userId: req.user!.id,
      metadata: { operation: "create", controlMeasure },
    });
    res.status(201).json(controlMeasure);
  }),
);
