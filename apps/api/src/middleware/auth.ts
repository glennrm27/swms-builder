import type { NextFunction, Request, Response } from "express";
import type { Role } from "@swms/shared-types";
import { verifyAccessToken } from "../lib/jwt.js";
import { ForbiddenError, UnauthorizedError } from "../lib/httpError.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; email: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/** Usage: router.post("/", requireAuth, requireRole("ADMIN", "EDITOR"), handler) */
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenError(`This action requires one of the following roles: ${allowed.join(", ")}`);
    }
    next();
  };
}
