import type { JobStatus } from "@swms/shared-types";

const STATUS_STYLES: Record<JobStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  PUBLISHED: "bg-violet-100 text-violet-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{status.replace("_", " ")}</span>;
}
