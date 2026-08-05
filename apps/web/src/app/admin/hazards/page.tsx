"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../../../components/RequireAuth";
import { apiRequest, ApiError } from "../../../lib/apiClient";
import type { HazardDto } from "../../../lib/apiTypes";
import type { RiskRating } from "@swms/shared-types";

const RISK_RATINGS: RiskRating[] = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
const HIERARCHIES = ["ELIMINATION", "SUBSTITUTION", "ISOLATION", "ENGINEERING", "ADMINISTRATIVE", "PPE"];

function HazardLibrary() {
  const [hazards, setHazards] = useState<HazardDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newHazard, setNewHazard] = useState({ code: "", name: "", category: "", defaultRiskRating: "MEDIUM" as RiskRating, description: "" });
  const [controlDrafts, setControlDrafts] = useState<Record<string, { description: string; hierarchy: string; residualRiskRating: RiskRating }>>({});

  function load() {
    apiRequest<HazardDto[]>("/admin/hazards").then(setHazards).catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function createHazard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/admin/hazards", { method: "POST", body: newHazard });
      setNewHazard({ code: "", name: "", category: "", defaultRiskRating: "MEDIUM", description: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create hazard.");
    }
  }

  async function addControlMeasure(hazardId: string) {
    const draft = controlDrafts[hazardId];
    if (!draft?.description) return;
    try {
      await apiRequest(`/admin/hazards/${hazardId}/control-measures`, { method: "POST", body: draft });
      setControlDrafts((d) => ({ ...d, [hazardId]: { description: "", hierarchy: "ENGINEERING", residualRiskRating: "LOW" } }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add control measure.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Hazard Library</h1>
      <p className="text-sm text-slate-500">
        This is the safety content editors and reviewers draw on, and what the rules engine references by ID —
        adding a hazard here makes it selectable on the guided form immediately, no deploy required.
      </p>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={createHazard} className="card grid grid-cols-2 gap-3">
        <input className="input" placeholder="Code (e.g. HAZ-NOISE)" value={newHazard.code} onChange={(e) => setNewHazard({ ...newHazard, code: e.target.value })} required />
        <input className="input" placeholder="Name" value={newHazard.name} onChange={(e) => setNewHazard({ ...newHazard, name: e.target.value })} required />
        <input className="input" placeholder="Category" value={newHazard.category} onChange={(e) => setNewHazard({ ...newHazard, category: e.target.value })} required />
        <select className="input" value={newHazard.defaultRiskRating} onChange={(e) => setNewHazard({ ...newHazard, defaultRiskRating: e.target.value as RiskRating })}>
          {RISK_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <textarea className="input col-span-2" placeholder="Description" value={newHazard.description} onChange={(e) => setNewHazard({ ...newHazard, description: e.target.value })} />
        <button type="submit" className="btn-primary col-span-2">Add hazard</button>
      </form>

      <div className="space-y-4">
        {hazards.map((hazard) => {
          const draft = controlDrafts[hazard.id] ?? { description: "", hierarchy: "ENGINEERING", residualRiskRating: "LOW" as RiskRating };
          return (
            <div key={hazard.id} className="card">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{hazard.name} <span className="text-xs text-slate-400">{hazard.code}</span></p>
                  <p className="text-xs text-slate-500">{hazard.category}</p>
                </div>
                <span className="badge bg-slate-100 text-slate-600">{hazard.defaultRiskRating}</span>
              </div>
              <ul className="mb-3 space-y-1 text-sm text-slate-700">
                {hazard.controlMeasures?.map((cm) => (
                  <li key={cm.id} className="rounded bg-slate-50 px-2 py-1">
                    <span className="font-medium">{cm.hierarchy}:</span> {cm.description}{" "}
                    <span className="text-xs text-slate-400">(residual: {cm.residualRiskRating})</span>
                  </li>
                ))}
                {(!hazard.controlMeasures || hazard.controlMeasures.length === 0) && (
                  <li className="text-xs text-amber-600">No control measures documented yet.</li>
                )}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="New control measure description"
                  value={draft.description}
                  onChange={(e) => setControlDrafts((d) => ({ ...d, [hazard.id]: { ...draft, description: e.target.value } }))}
                />
                <select
                  className="input w-auto"
                  value={draft.hierarchy}
                  onChange={(e) => setControlDrafts((d) => ({ ...d, [hazard.id]: { ...draft, hierarchy: e.target.value } }))}
                >
                  {HIERARCHIES.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select
                  className="input w-auto"
                  value={draft.residualRiskRating}
                  onChange={(e) => setControlDrafts((d) => ({ ...d, [hazard.id]: { ...draft, residualRiskRating: e.target.value as RiskRating } }))}
                >
                  {RISK_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" className="btn-secondary" onClick={() => addControlMeasure(hazard.id)}>Add</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminHazardsPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <HazardLibrary />
    </RequireAuth>
  );
}
