import { spawnSync } from "node:child_process";

let cached: boolean | undefined;

/** Used to skip (not fail) the document-generation tests when LibreOffice isn't installed on the runner. */
export function isSofficeAvailable(): boolean {
  if (cached !== undefined) return cached;
  const sofficePath = process.env.SOFFICE_PATH ?? "soffice";
  const result = spawnSync(sofficePath, ["--version"], { windowsHide: true });
  cached = result.status === 0;
  return cached;
}
