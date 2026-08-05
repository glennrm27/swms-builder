import { Router } from "express";
import { prisma } from "@swms/db";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

/**
 * Read-only reference data the guided form needs to render its dropdowns
 * and conditional sections. All of it is DB-driven so adding a new job
 * type, equipment item, hazard, or PPE item never requires a code change.
 */
export const lookupsRouter = Router();
lookupsRouter.use(requireAuth);

lookupsRouter.get("/job-types", asyncHandler(async (_req, res) => {
  res.json(await prisma.jobType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}));

lookupsRouter.get("/equipment", asyncHandler(async (_req, res) => {
  res.json(await prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}));

lookupsRouter.get("/hazards", asyncHandler(async (_req, res) => {
  res.json(await prisma.hazard.findMany({ where: { isActive: true }, orderBy: { category: "asc" } }));
}));

lookupsRouter.get("/ppe", asyncHandler(async (_req, res) => {
  res.json(await prisma.pPEItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}));

lookupsRouter.get("/permits", asyncHandler(async (_req, res) => {
  res.json(await prisma.permit.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }));
}));
