import { jobEnvironmentSchema, type JobEnvironment } from "@swms/shared-types";

/**
 * Display labels for jobEnvironmentSchema's boolean flags. Keys are
 * derived from the schema itself (not hand-copied) so a new flag added to
 * shared-types shows up here automatically, even if unlabeled — the
 * fallback below turns the raw key into a readable label.
 *
 * NOTE: mirrors apps/api/src/services/documentService.ts#ENVIRONMENT_LABELS
 * for the generated document text. Keep both in sync when adding a flag.
 */
export const ENVIRONMENT_LABELS: Partial<Record<keyof JobEnvironment, string>> = {
  workingAtHeight: "Working at height",
  confinedSpace: "Confined space",
  electricalWork: "Electrical work",
  hotWork: "Hot work",
  excavation: "Excavation",
  nearRoadwayOrTraffic: "Near roadway / traffic",
  outdoors: "Outdoors",
  occupiedSite: "Occupied site",
  workingAlone: "Working alone",
  overheadServices: "Overhead services",
};

export const ENVIRONMENT_KEYS = Object.keys(jobEnvironmentSchema.shape) as (keyof JobEnvironment)[];

export function labelForEnvironmentKey(key: keyof JobEnvironment): string {
  return ENVIRONMENT_LABELS[key] ?? key;
}
