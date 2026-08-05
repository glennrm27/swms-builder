"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "../../../components/RequireAuth";
import { StatusBadge } from "../../../components/StatusBadge";
import { apiRequest, apiDownload, ApiError } from "../../../lib/apiClient";
import { hasRole, useAuth } from "../../../lib/auth";
import { labelForEnvironmentKey } from "../../../lib/environmentLabels";
import type { JobDetailDto } from "../../../lib/apiTypes";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function JobDetail({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");

  const load = useCallback(() => {
    apiRequest<JobDetailDto>(`/jobs/${jobId}`).then(setJob).catch((err) => setError(err.message));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      // Always reload, success or failure — the action may have partially
      // changed server state (or none at all), and the UI must reflect
      // what actually happened rather than what was optimistically assumed.
      load();
      setBusy(false);
    }
  }

  async function handleDownload(versionId: string, format: "docx" | "pdf") {
    try {
      const blob = await apiDownload(`/jobs/${jobId}/versions/${versionId}/download?format=${format}`);
      downloadBlob(blob, `swms.${format}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Download failed.");
    }
  }

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!job) return <p className="text-slate-500">Loading…</p>;

  const latestVersion = job.versions[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{job.jobName}</h1>
          <p className="text-sm text-slate-500">{job.siteAddress}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {actionError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

      {/* Actions */}
      <div className="card flex flex-wrap gap-3">
        {job.status === "DRAFT" && hasRole(user, "ADMIN", "EDITOR") && (
          <button className="btn-primary" disabled={busy} onClick={() => runAction(() => apiRequest(`/jobs/${jobId}/submit`, { method: "POST" }))}>
            Submit for Review
          </button>
        )}
        {job.status === "APPROVED" && hasRole(user, "ADMIN", "REVIEWER") && (
          <button className="btn-primary" disabled={busy} onClick={() => runAction(() => apiRequest(`/jobs/${jobId}/publish`, { method: "POST" }))}>
            Publish
          </button>
        )}
        {latestVersion && (
          <>
            <button className="btn-secondary" onClick={() => handleDownload(latestVersion.id, "docx")}>
              Download DOCX (v{latestVersion.versionNumber})
            </button>
            <button className="btn-secondary" onClick={() => handleDownload(latestVersion.id, "pdf")}>
              Download PDF (v{latestVersion.versionNumber})
            </button>
          </>
        )}
      </div>

      {job.status === "IN_REVIEW" && hasRole(user, "ADMIN", "REVIEWER") && (
        <div className="card">
          <p className="mb-3 font-semibold text-slate-800">Review decision</p>
          <textarea
            className="input mb-3"
            rows={2}
            placeholder="Comment (required for rejection or changes requested)"
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  apiRequest(`/jobs/${jobId}/approvals`, { method: "POST", body: { decision: "APPROVED" } }),
                )
              }
            >
              Approve
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  apiRequest(`/jobs/${jobId}/approvals`, {
                    method: "POST",
                    body: { decision: "CHANGES_REQUESTED", comment: decisionComment },
                  }),
                )
              }
            >
              Request Changes
            </button>
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  apiRequest(`/jobs/${jobId}/approvals`, {
                    method: "POST",
                    body: { decision: "REJECTED", comment: decisionComment },
                  }),
                )
              }
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Job details */}
      <div className="card grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-slate-500">Job type:</span> {job.jobType.name}</div>
        <div><span className="text-slate-500">Principal contractor:</span> {job.principalContractor}</div>
        <div><span className="text-slate-500">Planned dates:</span> {new Date(job.plannedStartDate).toLocaleDateString("en-AU")} – {new Date(job.plannedEndDate).toLocaleDateString("en-AU")}</div>
        <div><span className="text-slate-500">Created by:</span> {job.createdBy.name}</div>
        <div className="col-span-2"><span className="text-slate-500">Work description:</span> {job.workDescription}</div>
        <div className="col-span-2">
          <span className="text-slate-500">Environment:</span>{" "}
          {Object.entries(job.environment)
            .filter(([, v]) => v)
            .map(([k]) => labelForEnvironmentKey(k as never))
            .join(", ") || "None"}
        </div>
      </div>

      {/* Task steps */}
      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">Task Steps</h2>
        <div className="space-y-3">
          {job.tasks.map((task) => (
            <div key={task.id} className="rounded-md border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{task.sequence}. {task.description}</p>
              {task.hazards.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                  {task.hazards.map((h) => <li key={h.hazard.id}>{h.hazard.name}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resolved hazards / PPE (rule-derived + manual) */}
      <div className="card grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-2 font-semibold text-slate-800">Hazards on this job</h2>
          <ul className="space-y-1 text-sm">
            {job.jobHazards.map((jh) => (
              <li key={jh.hazard.id} className="flex items-center justify-between">
                <span>{jh.hazard.name}</span>
                <span className="badge bg-slate-100 text-slate-500">{jh.source}</span>
              </li>
            ))}
            {job.jobHazards.length === 0 && <li className="text-slate-400">None yet</li>}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-slate-800">PPE required</h2>
          <ul className="space-y-1 text-sm">
            {job.jobPpe.map((jp) => (
              <li key={jp.ppe.id} className="flex items-center justify-between">
                <span>{jp.ppe.name}</span>
                <span className="badge bg-slate-100 text-slate-500">{jp.source}</span>
              </li>
            ))}
            {job.jobPpe.length === 0 && <li className="text-slate-400">None yet</li>}
          </ul>
        </div>
      </div>

      {/* Version history */}
      {job.versions.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold text-slate-800">Version History</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {job.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2">
                <span>Version {v.versionNumber} — generated {new Date(v.generatedAt).toLocaleString("en-AU")}</span>
                <div className="flex gap-2">
                  <button className="text-brand-700 hover:underline" onClick={() => handleDownload(v.id, "docx")}>DOCX</button>
                  <button className="text-brand-700 hover:underline" onClick={() => handleDownload(v.id, "pdf")}>PDF</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approval history */}
      {job.approvals.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold text-slate-800">Approval History</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {job.approvals.map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.decision.replace("_", " ")}</span>
                  <span className="text-slate-500">{a.decidedBy.name} — {new Date(a.decidedAt).toLocaleString("en-AU")}</span>
                </div>
                {a.comment && <p className="mt-1 text-slate-600">{a.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <JobDetail jobId={params.id} />
    </RequireAuth>
  );
}
