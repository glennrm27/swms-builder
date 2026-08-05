"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import type { JobIntakeInput } from "@swms/shared-types";
import type { HazardDto } from "../../lib/apiTypes";

/**
 * Each task step gets its own hazard checklist. This is where "the form
 * changes based on selections" is most concrete: which hazards are even
 * offered narrows as the hazard library grows, and which ones apply is a
 * per-task decision, not a single job-wide checkbox list.
 */
export function TaskStepsEditor({ hazards }: { hazards: HazardDto[] }) {
  const { control, register, watch, setValue } = useFormContext<JobIntakeInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "tasks" });

  const hazardsByCategory = hazards.reduce<Record<string, HazardDto[]>>((acc, h) => {
    (acc[h.category] ??= []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {fields.map((field, index) => {
        const selectedHazardIds: string[] = watch(`tasks.${index}.hazardIds`) ?? [];

        function toggleHazard(hazardId: string) {
          const current = selectedHazardIds;
          const next = current.includes(hazardId)
            ? current.filter((id) => id !== hazardId)
            : [...current, hazardId];
          setValue(`tasks.${index}.hazardIds`, next, { shouldValidate: true, shouldDirty: true });
        }

        return (
          <div key={field.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Step {index + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-xs text-red-600 hover:underline">
                  Remove step
                </button>
              )}
            </div>

            <input type="hidden" {...register(`tasks.${index}.sequence`, { valueAsNumber: true })} value={index + 1} />

            <label className="label">Task description</label>
            <textarea
              className="input mb-3"
              rows={2}
              placeholder="e.g. Erect elevated work platform and access roof"
              {...register(`tasks.${index}.description`)}
            />

            <label className="label">Hazards that apply to this step</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(hazardsByCategory).map(([category, categoryHazards]) => (
                <div key={category} className="rounded-md bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
                  <div className="space-y-1.5">
                    {categoryHazards.map((hazard) => (
                      <label key={hazard.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedHazardIds.includes(hazard.id)}
                          onChange={() => toggleHazard(hazard.id)}
                        />
                        {hazard.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => append({ sequence: fields.length + 1, description: "", hazardIds: [] })}
        className="btn-secondary"
      >
        + Add task step
      </button>
    </div>
  );
}
