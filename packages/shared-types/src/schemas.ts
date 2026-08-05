import { z } from "zod";
import { CONTROL_HIERARCHY, RISK_RATING } from "./enums.js";

/**
 * These schemas are the single source of truth for "what does a valid SWMS
 * job intake look like". They run unmodified on the client (React Hook Form
 * resolver) and again on the server (API route guard) — see the module
 * README. Job type / equipment / hazard values are NOT enums here: they are
 * foreign keys into DB-managed libraries, so validation checks shape only.
 * Whether a given ID is *legal for this job* is a rules-engine concern, not
 * a schema concern.
 */

export const jobEnvironmentSchema = z.object({
  workingAtHeight: z.boolean().default(false),
  confinedSpace: z.boolean().default(false),
  electricalWork: z.boolean().default(false),
  hotWork: z.boolean().default(false),
  excavation: z.boolean().default(false),
  nearRoadwayOrTraffic: z.boolean().default(false),
  outdoors: z.boolean().default(false),
  occupiedSite: z.boolean().default(false),
  workingAlone: z.boolean().default(false),
  overheadServices: z.boolean().default(false),
});
export type JobEnvironment = z.infer<typeof jobEnvironmentSchema>;

export const taskInputSchema = z.object({
  id: z.string().uuid().optional(), // absent for new tasks
  sequence: z.number().int().min(1),
  description: z.string().min(3, "Describe the task step").max(500),
  hazardIds: z.array(z.string().uuid()).default([]),
  additionalControlNotes: z.string().max(1000).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const jobIntakeSchema = z.object({
  jobName: z.string().min(3).max(200),
  siteAddress: z.string().min(3).max(300),
  principalContractor: z.string().min(2).max(200),
  workDescription: z.string().min(10).max(2000),
  jobTypeId: z.string().uuid({ message: "Select a job type" }),
  equipmentIds: z.array(z.string().uuid()).default([]),
  environment: jobEnvironmentSchema,
  tasks: z.array(taskInputSchema).min(1, "Add at least one task step"),
  selectedHazardIds: z.array(z.string().uuid()).default([]),
  selectedPpeIds: z.array(z.string().uuid()).default([]),
  additionalNotes: z.string().max(2000).optional(),
  plannedStartDate: z.coerce.date(),
  plannedEndDate: z.coerce.date(),
}).refine((data) => data.plannedEndDate >= data.plannedStartDate, {
  message: "End date must be on or after the start date",
  path: ["plannedEndDate"],
});
export type JobIntakeInput = z.infer<typeof jobIntakeSchema>;

export const signoffEntrySchema = z.object({
  name: z.string().min(2).max(150),
  position: z.string().min(2).max(150),
  signedAt: z.coerce.date(),
  signatureDataUrl: z.string().startsWith("data:image/").optional(),
});
export type SignoffEntry = z.infer<typeof signoffEntrySchema>;

export const approvalDecisionInputSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  comment: z.string().max(2000).optional(),
}).refine(
  (data) => data.decision === "APPROVED" || (data.comment && data.comment.trim().length > 0),
  { message: "A comment is required when rejecting or requesting changes", path: ["comment"] },
);
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionInputSchema>;

// --- Admin-facing: hazard / control / PPE library ---

export const hazardInputSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(2).max(100),
  defaultRiskRating: z.enum(RISK_RATING),
});
export type HazardInput = z.infer<typeof hazardInputSchema>;

export const controlMeasureInputSchema = z.object({
  hazardId: z.string().uuid(),
  description: z.string().min(3).max(1000),
  hierarchy: z.enum(CONTROL_HIERARCHY),
  residualRiskRating: z.enum(RISK_RATING),
});
export type ControlMeasureInput = z.infer<typeof controlMeasureInputSchema>;

export const ppeItemInputSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  iconKey: z.string().max(50).optional(),
});
export type PpeItemInput = z.infer<typeof ppeItemInputSchema>;

// --- Admin-facing: rules engine configuration ---
// A Rule says: "if these conditions hold against the job's answers, then
// require this template and/or add these hazards/PPE/permits." Conditions
// are stored as data (JSON), never as code, so safety content changes don't
// require a deploy.

const leafConditionSchema = z.object({
  field: z.string().min(1), // dotted path into the evaluated job facts, e.g. "environment.confinedSpace"
  operator: z.enum(["equals", "notEquals", "in", "notIn", "includes", "truthy", "falsy"]),
  value: z.unknown().optional(),
});
export type LeafCondition = z.infer<typeof leafConditionSchema>;

export interface ConditionGroup {
  logic: "ALL" | "ANY";
  conditions: RuleCondition[];
}

/**
 * A condition is either a leaf test against a fact, or a nested AND/OR
 * group of conditions — recursive, so a rule can express e.g.
 * "(electrical work AND NOT isolated) OR confined space", not just a
 * single flat ALL/ANY list. z.lazy + an explicit z.ZodType<RuleCondition>
 * annotation is required for zod to type a self-referential schema.
 */
export type RuleCondition = LeafCondition | ConditionGroup;

export const ruleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    leafConditionSchema,
    z.object({
      logic: z.enum(["ALL", "ANY"]),
      conditions: z.array(ruleConditionSchema).min(1),
    }),
  ]),
);

export const ruleInputSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
  conditions: z.array(ruleConditionSchema).min(1),
  conditionLogic: z.enum(["ALL", "ANY"]).default("ALL"),
  templateId: z.string().uuid().optional(),
  addHazardIds: z.array(z.string().uuid()).default([]),
  addPpeIds: z.array(z.string().uuid()).default([]),
  addPermitCodes: z.array(z.string()).default([]),
  requiredSectionKeys: z.array(z.string()).default([]),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;
