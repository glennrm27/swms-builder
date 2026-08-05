import type { NextFunction, Request, Response } from "express";
import { TemplateResolutionError } from "@swms/rules-engine";
import { DocxMergeError, PdfConversionError } from "@swms/document-gen";
import { HttpError } from "../lib/httpError.js";

interface ValidationLikeError extends Error {
  statusCode?: number;
  issues?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof TemplateResolutionError) {
    return res.status(422).json({ error: err.message, code: "TEMPLATE_RESOLUTION_FAILED" });
  }

  if (err instanceof DocxMergeError || err instanceof PdfConversionError) {
    return res.status(500).json({ error: "Document generation failed", detail: err.message });
  }

  const maybeValidation = err as ValidationLikeError;
  if (maybeValidation?.name === "ValidationError" && maybeValidation.statusCode === 400) {
    return res.status(400).json({ error: maybeValidation.message, issues: maybeValidation.issues });
  }

  console.error("Unhandled API error:", err);
  return res.status(500).json({ error: "Internal server error" });
}
