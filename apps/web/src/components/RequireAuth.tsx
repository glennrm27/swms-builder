"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@swms/shared-types";
import { hasRole, useAuth } from "../lib/auth";

/**
 * Client-side gate for pages that require a signed-in user (and,
 * optionally, a specific role). This is a UX convenience — the API
 * enforces the real authorization on every request regardless of what
 * this component allows through.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!user) return null;

  if (roles && !hasRole(user, ...roles)) {
    return (
      <div className="p-8">
        <div className="card border-amber-200 bg-amber-50 text-amber-800">
          You do not have permission to view this page. This section requires one of: {roles.join(", ")}.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
