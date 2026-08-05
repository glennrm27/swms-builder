import type { PrismaClient } from "@swms/db";
import type { AuditAction } from "@swms/shared-types";

export interface AuditEntryInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  jobId?: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Every mutating action in the system is expected to call this. Kept as a
 * single narrow function (rather than scattering `prisma.auditLog.create`
 * calls) so "does this action get audited" is answerable by grepping one
 * call site per route, and so the shape of an audit entry can't drift.
 */
export async function recordAudit(prisma: PrismaClient, entry: AuditEntryInput) {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      jobId: entry.jobId,
      userId: entry.userId,
      metadata: entry.metadata as never,
    },
  });
}
