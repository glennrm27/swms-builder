// Central enums. These mirror the Prisma schema's enum types exactly —
// keep the two in sync by hand, since Prisma enums can't be imported into
// a framework-free package without dragging in the generated client.

export const ROLE = ["ADMIN", "EDITOR", "REVIEWER", "WORKER"] as const;
export type Role = (typeof ROLE)[number];

export const JOB_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const APPROVAL_DECISION = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISION)[number];

export const RISK_RATING = ["LOW", "MEDIUM", "HIGH", "EXTREME"] as const;
export type RiskRating = (typeof RISK_RATING)[number];

// Hierarchy of control per Safe Work Australia model — used to sort/group
// controls in the generated document, most-effective first.
export const CONTROL_HIERARCHY = [
  "ELIMINATION",
  "SUBSTITUTION",
  "ISOLATION",
  "ENGINEERING",
  "ADMINISTRATIVE",
  "PPE",
] as const;
export type ControlHierarchy = (typeof CONTROL_HIERARCHY)[number];

export const AUDIT_ACTION = [
  "JOB_CREATED",
  "JOB_UPDATED",
  "JOB_SUBMITTED",
  "VERSION_GENERATED",
  "APPROVAL_DECIDED",
  "JOB_PUBLISHED",
  "TEMPLATE_CREATED",
  "TEMPLATE_UPDATED",
  "RULE_CREATED",
  "RULE_UPDATED",
  "HAZARD_LIBRARY_UPDATED",
  "USER_LOGIN",
] as const;
export type AuditAction = (typeof AUDIT_ACTION)[number];
