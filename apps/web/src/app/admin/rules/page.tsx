"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "../../../components/RequireAuth";
import { ConditionGroupEditor } from "../../../components/RuleForm/ConditionGroupEditor";
import { apiRequest, ApiError } from "../../../lib/apiClient";
import { draftToRuleConditions, emptyGroup, type GroupDraft } from "../../../lib/ruleConditionDraft";
import type { HazardDto, PpeDto, RuleDto, SwmsTemplateDto } from "../../../lib/apiTypes";

function emptyRuleDraft() {
  return {
    name: "",
    description: "",
    priority: 100,
    isActive: true,
    rootGroup: emptyGroup("ALL") as GroupDraft,
    templateId: "",
    addHazardIds: [] as string[],
    addPpeIds: [] as string[],
    addPermitCodes: "",
    requiredSectionKeys: "",
  };
}

function RulesAdmin() {
  const [rules, setRules] = useState<RuleDto[]>([]);
  const [templates, setTemplates] = useState<SwmsTemplateDto[]>([]);
  const [hazards, setHazards] = useState<HazardDto[]>([]);
  const [ppeItems, setPpeItems] = useState<PpeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyRuleDraft());

  function load() {
    apiRequest<RuleDto[]>("/admin/rules").then(setRules).catch((err) => setError(err.message));
    apiRequest<SwmsTemplateDto[]>("/admin/templates").then(setTemplates).catch(() => {});
    apiRequest<HazardDto[]>("/admin/hazards").then(setHazards).catch(() => {});
    apiRequest<PpeDto[]>("/admin/config/ppe").then(setPpeItems).catch(() => {});
  }
  useEffect(load, []);

  async function toggleActive(rule: RuleDto) {
    try {
      await apiRequest(`/admin/rules/${rule.id}/toggle-active`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to toggle rule.");
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/admin/rules", {
        method: "POST",
        body: {
          name: draft.name,
          description: draft.description || undefined,
          priority: Number(draft.priority),
          isActive: draft.isActive,
          conditionLogic: draft.rootGroup.logic,
          conditions: draftToRuleConditions(draft.rootGroup.items),
          templateId: draft.templateId || undefined,
          addHazardIds: draft.addHazardIds,
          addPpeIds: draft.addPpeIds,
          addPermitCodes: draft.addPermitCodes.split(",").map((s) => s.trim()).filter(Boolean),
          requiredSectionKeys: draft.requiredSectionKeys.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      setDraft(emptyRuleDraft());
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create rule.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Rules Engine</h1>
      <p className="text-sm text-slate-500">
        Rules map job selections (job type, equipment, environment flags) to a template and mandatory
        hazards/PPE/permits/sections. Lower priority numbers are evaluated — and win template selection — first.
        Conditions can be nested groups (e.g. "electrical work AND (confined space OR hot work)"), not just a
        flat list.
      </p>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-hidden p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{rule.name}</td>
                <td className="px-4 py-2">{rule.priority}</td>
                <td className="px-4 py-2 text-slate-500">{rule.template?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${rule.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button className="text-brand-700 hover:underline" onClick={() => toggleActive(rule)}>
                    {rule.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createRule} className="card space-y-4">
        <p className="font-semibold text-slate-800">New rule</p>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <input className="input" type="number" placeholder="Priority (lower = evaluated first)" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
        </div>
        <textarea className="input" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />

        <div>
          <p className="label mb-2">Conditions</p>
          <ConditionGroupEditor
            group={draft.rootGroup}
            depth={0}
            onChange={(next) => setDraft((d) => ({ ...d, rootGroup: next }))}
          />
        </div>

        <div>
          <label className="label">Template to select when this rule matches</label>
          <select className="input" value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>
            <option value="">(no template — hazards/PPE only)</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="label mb-1">Add hazards</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {hazards.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.addHazardIds.includes(h.id)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        addHazardIds: e.target.checked ? [...d.addHazardIds, h.id] : d.addHazardIds.filter((id) => id !== h.id),
                      }))
                    }
                  />
                  {h.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-1">Add PPE</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {ppeItems.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.addPpeIds.includes(p.id)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        addPpeIds: e.target.checked ? [...d.addPpeIds, p.id] : d.addPpeIds.filter((id) => id !== p.id),
                      }))
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Permit codes (comma-separated)" value={draft.addPermitCodes} onChange={(e) => setDraft({ ...draft, addPermitCodes: e.target.value })} />
          <input className="input" placeholder="Required section keys (comma-separated)" value={draft.requiredSectionKeys} onChange={(e) => setDraft({ ...draft, requiredSectionKeys: e.target.value })} />
        </div>

        <button type="submit" className="btn-primary">Create rule</button>
      </form>
    </div>
  );
}

export default function AdminRulesPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <RulesAdmin />
    </RequireAuth>
  );
}
