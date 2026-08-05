"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobIntakeSchema, type JobIntakeInput } from "@swms/shared-types";
import { RequireAuth } from "../../../components/RequireAuth";
import { TaskStepsEditor } from "../../../components/JobForm/TaskStepsEditor";
import { apiRequest, ApiError } from "../../../lib/apiClient";
import { ENVIRONMENT_KEYS, labelForEnvironmentKey } from "../../../lib/environmentLabels";
import type { EquipmentDto, HazardDto, JobTypeDto, PpeDto } from "../../../lib/apiTypes";

const STEPS = ["Job Details", "Environment & Equipment", "Task Steps", "PPE & Review"] as const;

const DEFAULT_VALUES: JobIntakeInput = {
  jobName: "",
  siteAddress: "",
  principalContractor: "",
  workDescription: "",
  jobTypeId: "",
  equipmentIds: [],
  environment: Object.fromEntries(ENVIRONMENT_KEYS.map((k) => [k, false])) as JobIntakeInput["environment"],
  tasks: [{ sequence: 1, description: "", hazardIds: [] }],
  selectedHazardIds: [],
  selectedPpeIds: [],
  plannedStartDate: new Date(),
  plannedEndDate: new Date(),
};

function NewJobWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [jobTypes, setJobTypes] = useState<JobTypeDto[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDto[]>([]);
  const [hazards, setHazards] = useState<HazardDto[]>([]);
  const [ppeItems, setPpeItems] = useState<PpeDto[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<JobIntakeInput>({
    resolver: zodResolver(jobIntakeSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });
  const { register, handleSubmit, watch, setValue, formState } = form;

  useEffect(() => {
    Promise.all([
      apiRequest<JobTypeDto[]>("/lookups/job-types"),
      apiRequest<EquipmentDto[]>("/lookups/equipment"),
      apiRequest<HazardDto[]>("/lookups/hazards"),
      apiRequest<PpeDto[]>("/lookups/ppe"),
    ]).then(([jt, eq, hz, ppe]) => {
      setJobTypes(jt);
      setEquipment(eq);
      setHazards(hz);
      setPpeItems(ppe);
    });
  }, []);

  const environment = watch("environment");
  const equipmentIds = watch("equipmentIds");
  const selectedPpeIds = watch("selectedPpeIds");
  const tasks = watch("tasks");

  function toggleArrayValue(name: "equipmentIds" | "selectedPpeIds", id: string) {
    const current = watch(name) ?? [];
    setValue(name, current.includes(id) ? current.filter((x) => x !== id) : [...current, id], {
      shouldDirty: true,
    });
  }

  async function onSubmit(data: JobIntakeInput) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const job = await apiRequest<{ id: string }>("/jobs", { method: "POST", body: data });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to create job.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <FormProvider {...form}>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">New SWMS</h1>
        <p className="mb-6 text-sm text-slate-500">
          Answer the questions below — the safety content required (hazards, controls, PPE, permits) is
          determined automatically from your selections when you submit.
        </p>

        <ol className="mb-6 flex gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-md px-2 py-1.5 text-center font-medium ${
                i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Job name</label>
                <input className="input" {...register("jobName")} />
                {formState.errors.jobName && <p className="field-error">{formState.errors.jobName.message}</p>}
              </div>
              <div>
                <label className="label">Site address</label>
                <input className="input" {...register("siteAddress")} />
                {formState.errors.siteAddress && <p className="field-error">{formState.errors.siteAddress.message}</p>}
              </div>
              <div>
                <label className="label">Principal contractor</label>
                <input className="input" {...register("principalContractor")} />
              </div>
              <div>
                <label className="label">Work description</label>
                <textarea className="input" rows={3} {...register("workDescription")} />
                {formState.errors.workDescription && (
                  <p className="field-error">{formState.errors.workDescription.message}</p>
                )}
              </div>
              <div>
                <label className="label">Job type</label>
                <select className="input" {...register("jobTypeId")}>
                  <option value="">Select a job type…</option>
                  {jobTypes.map((jt) => (
                    <option key={jt.id} value={jt.id}>{jt.name}</option>
                  ))}
                </select>
                {formState.errors.jobTypeId && <p className="field-error">{formState.errors.jobTypeId.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Planned start date</label>
                  <input type="date" className="input" {...register("plannedStartDate", { valueAsDate: true })} />
                </div>
                <div>
                  <label className="label">Planned end date</label>
                  <input type="date" className="input" {...register("plannedEndDate", { valueAsDate: true })} />
                  {formState.errors.plannedEndDate && (
                    <p className="field-error">{formState.errors.plannedEndDate.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="label mb-2">Work environment (select everything that applies)</p>
                <p className="mb-3 text-xs text-slate-500">
                  These selections drive which hazards, PPE, and permits get added to the SWMS automatically.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ENVIRONMENT_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm">
                      <input type="checkbox" {...register(`environment.${key}`)} checked={!!environment?.[key]} onChange={(e) => setValue(`environment.${key}`, e.target.checked)} />
                      {labelForEnvironmentKey(key)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="label mb-2">Equipment used</p>
                <div className="grid grid-cols-2 gap-2">
                  {equipment.map((eq) => (
                    <label key={eq.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={equipmentIds?.includes(eq.id) ?? false}
                        onChange={() => toggleArrayValue("equipmentIds", eq.id)}
                      />
                      {eq.name}
                    </label>
                  ))}
                  {equipment.length === 0 && <p className="text-sm text-slate-400">No equipment configured yet.</p>}
                </div>
              </div>
            </div>
          )}

          {step === 2 && <TaskStepsEditor hazards={hazards} />}
          {formState.errors.tasks && typeof formState.errors.tasks.message === "string" && (
            <p className="field-error">{formState.errors.tasks.message}</p>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="label mb-2">Additional PPE (beyond what your selections already require)</p>
                <div className="grid grid-cols-2 gap-2">
                  {ppeItems.map((ppe) => (
                    <label key={ppe.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPpeIds?.includes(ppe.id) ?? false}
                        onChange={() => toggleArrayValue("selectedPpeIds", ppe.id)}
                      />
                      {ppe.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Additional notes</label>
                <textarea className="input" rows={2} {...register("additionalNotes")} />
              </div>

              <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-700">
                <p className="mb-2 font-semibold">Summary</p>
                <p>{tasks?.length ?? 0} task step(s) defined.</p>
                <p>
                  Environment: {ENVIRONMENT_KEYS.filter((k) => environment?.[k]).map(labelForEnvironmentKey).join(", ") || "None selected"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  On submit, the rules engine will select the correct template and add any mandatory hazards, PPE,
                  and permits based on your answers — you'll see the full resolved SWMS on the next screen.
                </p>
              </div>
            </div>
          )}

          {submitError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>}

          <div className="flex justify-between border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            {!isLastStep && (
              <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </button>
            )}
            {isLastStep && (
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create SWMS (Draft)"}
              </button>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

export default function NewJobPage() {
  return (
    <RequireAuth roles={["ADMIN", "EDITOR"]}>
      <NewJobWizard />
    </RequireAuth>
  );
}
