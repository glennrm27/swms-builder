import { Router } from "express";
import { z } from "zod";
import { prisma } from "@swms/db";
import { ppeItemInputSchema } from "@swms/shared-types";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateBody } from "../../middleware/validate.js";

/**
 * Lightweight CRUD for the small reference lookups (job types, equipment,
 * PPE, permits) that back the guided form's dropdowns. Kept in one file
 * since each is a handful of routes over a two-or-three-field model — a
 * dedicated file per entity would be needless ceremony at this size.
 */
export const adminConfigRouter = Router();
adminConfigRouter.use(requireAuth, requireRole("ADMIN"));

const codeNameSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

adminConfigRouter.get("/job-types", asyncHandler(async (_req, res) => {
  res.json(await prisma.jobType.findMany({ orderBy: { name: "asc" } }));
}));
adminConfigRouter.post(
  "/job-types",
  validateBody(codeNameSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.jobType.create({ data: req.body }));
  }),
);

adminConfigRouter.get("/equipment", asyncHandler(async (_req, res) => {
  res.json(await prisma.equipment.findMany({ orderBy: { name: "asc" } }));
}));
adminConfigRouter.post(
  "/equipment",
  validateBody(codeNameSchema.omit({ description: true })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.equipment.create({ data: req.body }));
  }),
);

adminConfigRouter.get("/ppe", asyncHandler(async (_req, res) => {
  res.json(await prisma.pPEItem.findMany({ orderBy: { name: "asc" } }));
}));
adminConfigRouter.post(
  "/ppe",
  validateBody(ppeItemInputSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.pPEItem.create({ data: req.body }));
  }),
);

adminConfigRouter.get("/permits", asyncHandler(async (_req, res) => {
  res.json(await prisma.permit.findMany({ orderBy: { name: "asc" } }));
}));
adminConfigRouter.post(
  "/permits",
  validateBody(codeNameSchema.omit({ description: true })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.permit.create({ data: req.body }));
  }),
);
