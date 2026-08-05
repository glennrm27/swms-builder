import type { Request } from "express";
import { HttpError } from "./httpError.js";

/**
 * With `noUncheckedIndexedAccess` on, `req.params.x` types as
 * `string | undefined` even for params Express guarantees are present for
 * a matched route. This narrows it in one place instead of scattering
 * non-null assertions across every handler.
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw new HttpError(400, `Missing required route parameter: ${name}`);
  return value;
}
