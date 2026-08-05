import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody, validateQuery } from "./validate.js";

function buildApp() {
  const app = express();
  app.use(express.json());

  const bodySchema = z.object({ name: z.string().min(3) });
  app.post("/echo", validateBody(bodySchema), (req, res) => res.json(req.body));

  const querySchema = z.object({ take: z.coerce.number().int().min(1).default(10) });
  app.get("/list", validateQuery(querySchema), (req, res) => res.json(req.query));

  // Minimal error handler mirroring the shape asserted below.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ error: e.message });
  });

  return app;
}

describe("validateBody", () => {
  it("passes valid bodies through unchanged", async () => {
    const res = await request(buildApp()).post("/echo").send({ name: "Jane Smith" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Jane Smith" });
  });

  it("rejects invalid bodies with 400", async () => {
    const res = await request(buildApp()).post("/echo").send({ name: "Jo" });
    expect(res.status).toBe(400);
  });
});

describe("validateQuery", () => {
  it("coerces and defaults query params", async () => {
    const res = await request(buildApp()).get("/list");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ take: 10 });
  });

  it("rejects an out-of-range query param", async () => {
    const res = await request(buildApp()).get("/list").query({ take: 0 });
    expect(res.status).toBe(400);
  });
});
