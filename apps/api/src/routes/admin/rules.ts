import { Router } from "express";
import { prisma } from "@swms/db";
import { ruleInputSchema } from "@swms/shared-types";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateBody } from "../../middleware/validate.js";
import { NotFoundError } from "../../lib/httpError.js";
import { requireParam } from "../../lib/params.js";
import { recordAudit } from "../../services/auditService.js";

/**
 * Admin CRUD for the rules that drive template selection and mandatory
 * hazards/PPE/permits/sections — this is the screen that lets safety
 * content change without a code deploy. See packages/rules-engine for how
 * these are evaluated.
 */
export const adminRulesRouter = Router();
adminRulesRouter.use(requireAuth, requireRole("ADMIN"));

adminRulesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.rule.findMany({
        include: { addHazards: true, addPpe: true, template: true },
        orderBy: { priority: "asc" },
      }),
    );
  }),
);

adminRulesRouter.post(
  "/",
  validateBody(ruleInputSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as import("@swms/shared-types").RuleInput;
    const rule = await prisma.rule.create({
      data: {
        name: body.name,
        description: body.description,
        priority: body.priority,
        isActive: body.isActive,
        conditions: body.conditions as never,
        conditionLogic: body.conditionLogic,
        templateId: body.templateId,
        requiredSectionKeys: body.requiredSectionKeys,
        addPermitCodes: body.addPermitCodes,
        addHazards: { create: body.addHazardIds.map((hazardId) => ({ hazardId })) },
        addPpe: { create: body.addPpeIds.map((ppeId) => ({ ppeId })) },
      },
      include: { addHazards: true, addPpe: true },
    });

    await recordAudit(prisma, {
      action: "RULE_CREATED",
      entityType: "Rule",
      entityId: rule.id,
      userId: req.user!.id,
      metadata: { rule },
    });

    res.status(201).json(rule);
  }),
);

adminRulesRouter.put(
  "/:id",
  validateBody(ruleInputSchema),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Rule", id);

    const body = req.body as import("@swms/shared-types").RuleInput;

    const rule = await prisma.$transaction(async (tx) => {
      await tx.ruleHazard.deleteMany({ where: { ruleId: id } });
      await tx.rulePpe.deleteMany({ where: { ruleId: id } });
      return tx.rule.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          priority: body.priority,
          isActive: body.isActive,
          conditions: body.conditions as never,
          conditionLogic: body.conditionLogic,
          templateId: body.templateId,
          requiredSectionKeys: body.requiredSectionKeys,
          addPermitCodes: body.addPermitCodes,
          addHazards: { create: body.addHazardIds.map((hazardId) => ({ hazardId })) },
          addPpe: { create: body.addPpeIds.map((ppeId) => ({ ppeId })) },
        },
        include: { addHazards: true, addPpe: true },
      });
    });

    await recordAudit(prisma, {
      action: "RULE_UPDATED",
      entityType: "Rule",
      entityId: rule.id,
      userId: req.user!.id,
      metadata: { before: existing, after: rule },
    });

    res.json(rule);
  }),
);

adminRulesRouter.patch(
  "/:id/toggle-active",
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Rule", id);

    const rule = await prisma.rule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await recordAudit(prisma, {
      action: "RULE_UPDATED",
      entityType: "Rule",
      entityId: rule.id,
      userId: req.user!.id,
      metadata: { operation: "toggle-active", isActive: rule.isActive },
    });

    res.json(rule);
  }),
);
