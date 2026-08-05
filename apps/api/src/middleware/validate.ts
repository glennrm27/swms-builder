import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Re-runs the same shared-types Zod schema the web client uses. The
 * client-side check is for UX (instant feedback); this is the one that
 * actually protects data integrity, since a client can always be bypassed.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(Object.assign(new Error("Validation failed"), {
        statusCode: 400,
        name: "ValidationError",
        issues: result.error.issues,
      }));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(Object.assign(new Error("Validation failed"), {
        statusCode: 400,
        name: "ValidationError",
        issues: result.error.issues,
      }));
    }
    req.query = result.data as never;
    next();
  };
}
