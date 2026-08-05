import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { TemplateResolutionError } from "@swms/rules-engine";
import { DocxMergeError } from "@swms/document-gen";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/httpError.js";
import { errorHandler } from "./errorHandler.js";

function buildApp(thrown: unknown) {
  const app = express();
  app.get("/boom", () => {
    throw thrown;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("maps NotFoundError to 404", async () => {
    const res = await request(buildApp(new NotFoundError("Job", "abc"))).get("/boom");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Job abc not found");
  });

  it("maps ForbiddenError to 403", async () => {
    const res = await request(buildApp(new ForbiddenError())).get("/boom");
    expect(res.status).toBe(403);
  });

  it("maps ConflictError to 409", async () => {
    const res = await request(buildApp(new ConflictError("already published"))).get("/boom");
    expect(res.status).toBe(409);
  });

  it("maps TemplateResolutionError to 422 with a stable error code", async () => {
    const res = await request(buildApp(new TemplateResolutionError("no rule matched"))).get("/boom");
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("TEMPLATE_RESOLUTION_FAILED");
  });

  it("maps DocxMergeError to 500 with a generic message (no internal detail leak in the top-level error)", async () => {
    const res = await request(buildApp(new DocxMergeError("bad template"))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Document generation failed");
  });

  it("falls back to 500 for unrecognized errors", async () => {
    const res = await request(buildApp(new Error("something unexpected"))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});
