/**
 * Lightweight response shapes for what the UI renders. These intentionally
 * don't try to mirror the full Prisma models — just the fields the
 * screens in this app actually use.
 */
import type { JobStatus, RiskRating, RuleCondition } from "@swms/shared-types";

export interface JobTypeDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface EquipmentDto {
  id: string;
  code: string;
  name: string;
}

export interface HazardDto {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  defaultRiskRating: RiskRating;
  controlMeasures?: ControlMeasureDto[];
}

export interface ControlMeasureDto {
  id: string;
  hazardId: string;
  description: string;
  hierarchy: string;
  residualRiskRating: RiskRating;
}

export interface PpeDto {
  id: string;
  code: string;
  name: string;
}

export interface PermitDto {
  id: string;
  code: string;
  name: string;
}

export interface SwmsTemplateDto {
  id: string;
  name: string;
  description?: string | null;
  jurisdiction: string;
  sections?: { id: string; key: string; title: string; isDefault: boolean }[];
}

export interface RuleDto {
  id: string;
  name: string;
  description?: string | null;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  conditionLogic: "ALL" | "ANY";
  templateId?: string | null;
  template?: { id: string; name: string } | null;
  requiredSectionKeys: string[];
  addPermitCodes: string[];
  addHazards: { hazardId: string }[];
  addPpe: { ppeId: string }[];
}

export interface JobListItemDto {
  id: string;
  jobName: string;
  siteAddress: string;
  status: JobStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  jobType: JobTypeDto;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface JobDetailDto {
  id: string;
  jobName: string;
  siteAddress: string;
  principalContractor: string;
  workDescription: string;
  status: JobStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  additionalNotes?: string | null;
  environment: Record<string, boolean>;
  jobType: JobTypeDto;
  createdBy: { id: string; name: string; email: string };
  equipment: { equipment: EquipmentDto }[];
  tasks: { id: string; sequence: number; description: string; hazards: { hazard: HazardDto }[] }[];
  jobHazards: { hazard: HazardDto; source: string }[];
  jobPpe: { ppe: PpeDto; source: string }[];
  versions: SwmsVersionDto[];
  approvals: ApprovalDto[];
}

export interface SwmsVersionDto {
  id: string;
  versionNumber: number;
  templateId: string;
  generatedAt: string;
}

export interface ApprovalDto {
  id: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  comment?: string | null;
  decidedBy: { id: string; name: string };
  decidedAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user: { id: string; name: string; email: string };
  metadata?: unknown;
  createdAt: string;
}
