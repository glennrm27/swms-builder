import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "@swms/db";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateBody } from "../../middleware/validate.js";
import { HttpError, NotFoundError } from "../../lib/httpError.js";
import { requireParam } from "../../lib/params.js";
import { getStorage } from "../../lib/storage.js";
import { recordAudit } from "../../services/auditService.js";

export const adminTemplatesRouter = Router();
adminTemplatesRouter.use(requireAuth, requireRole("ADMIN"));

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB is generous for a text-heavy .docx
  fileFilter: (_req, file, cb) => {
    const isDocx =
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (isDocx) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Only .docx files are accepted for a SWMS template"));
    }
  },
});

adminTemplatesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.sWMSTemplate.findMany({ include: { sections: true }, orderBy: { name: "asc" } }));
  }),
);

const createTemplateMetaSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  jurisdiction: z.string().default("AU"),
});

/**
 * multipart/form-data: `file` is the .docx template, `meta` is a JSON
 * string matching createTemplateMetaSchema. Uploading a new template
 * never overwrites an existing one — templates are versioned rows so
 * jobs generated against an older template stay reproducible.
 */
adminTemplatesRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "A .docx template file is required (field name: file)");

    const meta = createTemplateMetaSchema.parse(JSON.parse(req.body.meta ?? "{}"));
    const storage = getStorage();
    const key = `templates/${Date.now()}-${req.file.originalname}`;
    await storage.put(key, req.file.buffer, req.file.mimetype);

    const template = await prisma.sWMSTemplate.create({
      data: { name: meta.name, description: meta.description, jurisdiction: meta.jurisdiction, docxStoragePath: key },
    });

    await recordAudit(prisma, {
      action: "TEMPLATE_CREATED",
      entityType: "SWMSTemplate",
      entityId: template.id,
      userId: req.user!.id,
      metadata: { name: template.name, docxStoragePath: key },
    });

    res.status(201).json(template);
  }),
);

const sectionInputSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  isDefault: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  bodyMarkdown: z.string().max(5000).optional(),
});

adminTemplatesRouter.post(
  "/:id/sections",
  validateBody(sectionInputSchema),
  asyncHandler(async (req, res) => {
    const id = requireParam(req, "id");
    const template = await prisma.sWMSTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError("SWMSTemplate", id);

    const section = await prisma.templateSection.create({ data: { ...req.body, templateId: template.id } });

    await recordAudit(prisma, {
      action: "TEMPLATE_UPDATED",
      entityType: "TemplateSection",
      entityId: section.id,
      userId: req.user!.id,
      metadata: { templateId: template.id, section },
    });

    res.status(201).json(section);
  }),
);
