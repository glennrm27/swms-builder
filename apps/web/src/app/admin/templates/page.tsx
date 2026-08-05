"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "../../../components/RequireAuth";
import { apiRequest, ApiError } from "../../../lib/apiClient";
import type { SwmsTemplateDto } from "../../../lib/apiTypes";

function TemplatesAdmin() {
  const [templates, setTemplates] = useState<SwmsTemplateDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jurisdiction, setJurisdiction] = useState("AU");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    apiRequest<SwmsTemplateDto[]>("/admin/templates").then(setTemplates).catch((err) => setError(err.message));
  }
  useEffect(load, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .docx file to upload.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("meta", JSON.stringify({ name, description: description || undefined, jurisdiction }));

    setUploading(true);
    try {
      await apiRequest("/admin/templates", { method: "POST", body: formData, isFormData: true });
      setName("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">SWMS Templates</h1>
      <p className="text-sm text-slate-500">
        Templates are .docx files with docxtemplater merge tags. Uploading a new one never overwrites an existing
        template — jobs already generated against an older template stay reproducible.
      </p>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={upload} className="card space-y-3">
        <p className="font-semibold text-slate-800">Upload new template</p>
        <input className="input" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="input w-32" placeholder="Jurisdiction" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
        <input ref={fileInputRef} type="file" accept=".docx" className="text-sm" />
        <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload template"}</button>
      </form>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{t.name} <span className="text-xs text-slate-400">{t.jurisdiction}</span></p>
                {t.description && <p className="text-sm text-slate-500">{t.description}</p>}
              </div>
            </div>
            {t.sections && t.sections.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {t.sections.map((s) => (
                  <li key={s.id} className={`badge ${s.isDefault ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
                    {s.title}{!s.isDefault && " (conditional)"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <RequireAuth roles={["ADMIN"]}>
      <TemplatesAdmin />
    </RequireAuth>
  );
}
