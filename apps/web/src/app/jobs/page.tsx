"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "../../components/RequireAuth";
import { StatusBadge } from "../../components/StatusBadge";
import { apiRequest } from "../../lib/apiClient";
import { hasRole, useAuth } from "../../lib/auth";
import type { JobListItemDto } from "../../lib/apiTypes";

function JobsList() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<JobListItemDto[]>("/jobs")
      .then(setJobs)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Jobs</h1>
        {hasRole(user, "ADMIN", "EDITOR") && (
          <Link href="/jobs/new" className="btn-primary">
            + New SWMS
          </Link>
        )}
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!jobs && !error && <p className="text-slate-500">Loading jobs…</p>}

      {jobs && jobs.length === 0 && (
        <div className="card text-center text-slate-500">No jobs yet. Create the first SWMS to get started.</div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Job Name</th>
                <th className="px-4 py-3">Job Type</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-medium text-brand-700 hover:underline">
                      {job.jobName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{job.jobType.name}</td>
                  <td className="px-4 py-3 text-slate-600">{job.siteAddress}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{job.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <RequireAuth>
      <JobsList />
    </RequireAuth>
  );
}
