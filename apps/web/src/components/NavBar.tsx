"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasRole, useAuth } from "../lib/auth";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/jobs" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-900">SWMS Builder</span>
          <div className="flex gap-1">
            <NavLink href="/jobs">Jobs</NavLink>
            {hasRole(user, "ADMIN") && (
              <>
                <NavLink href="/admin/hazards">Hazard Library</NavLink>
                <NavLink href="/admin/rules">Rules</NavLink>
                <NavLink href="/admin/templates">Templates</NavLink>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            {user.name} <span className="badge bg-slate-100 text-slate-600">{user.role}</span>
          </span>
          <button onClick={logout} className="btn-secondary">
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
