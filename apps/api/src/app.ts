import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { lookupsRouter } from "./routes/lookups.js";
import { jobsRouter } from "./routes/jobs.js";
import { approvalsRouter } from "./routes/approvals.js";
import { auditRouter } from "./routes/audit.js";
import { adminHazardsRouter } from "./routes/admin/hazards.js";
import { adminRulesRouter } from "./routes/admin/rules.js";
import { adminTemplatesRouter } from "./routes/admin/templates.js";
import { adminConfigRouter } from "./routes/admin/config.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRouter);
  app.use("/lookups", lookupsRouter);
  app.use("/jobs", jobsRouter);
  app.use("/jobs/:jobId/approvals", approvalsRouter);
  app.use("/audit", auditRouter);
  app.use("/admin/hazards", adminHazardsRouter);
  app.use("/admin/rules", adminRulesRouter);
  app.use("/admin/templates", adminTemplatesRouter);
  app.use("/admin/config", adminConfigRouter);

  // Must be registered last: Express only routes to error middleware when
  // it's the final handler in the chain.
  app.use(errorHandler);

  return app;
}
