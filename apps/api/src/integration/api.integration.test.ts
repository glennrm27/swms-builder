import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isSofficeAvailable } from "./sofficeAvailable.js";
import { setupIntegrationTestEnvironment, type IntegrationTestContext } from "./setup.js";

/**
 * Real end-to-end coverage: a real Postgres (via testcontainers), the real
 * Express app, real bcrypt/JWT, and the real rules engine + document
 * generator wired together exactly as apps/api/src/app.ts assembles them
 * in production — the unit tests elsewhere in this repo verify each piece
 * in isolation; this file verifies they're actually wired together
 * correctly. Requires Docker. Run via `pnpm --filter @swms/api test:integration`.
 */
describe("API integration", () => {
  let ctx: IntegrationTestContext;
  const PASSWORD = "IntegrationTest123!";
  const sofficeAvailable = isSofficeAvailable();

  beforeAll(async () => {
    ctx = await setupIntegrationTestEnvironment();
    if (!sofficeAvailable) {
      console.warn(
        "[integration] LibreOffice (soffice) not found — document-generation-dependent assertions will exercise the failure path instead of the happy path.",
      );
    }
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(ctx.app).post("/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.token as string;
  }

  describe("auth", () => {
    it("rejects an incorrect password", async () => {
      const res = await request(ctx.app)
        .post("/auth/login")
        .send({ email: "admin@test.local", password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    it("issues a token for correct credentials", async () => {
      const res = await request(ctx.app)
        .post("/auth/login")
        .send({ email: "admin@test.local", password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.role).toBe("ADMIN");
    });
  });

  describe("lookups", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(ctx.app).get("/lookups/job-types");
      expect(res.status).toBe(401);
    });

    it("returns seeded job types for an authenticated user", async () => {
      const token = await loginAs("worker@test.local");
      const res = await request(ctx.app).get("/lookups/job-types").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.some((jt: { code: string }) => jt.code === "ELECTRICAL")).toBe(true);
    });
  });

  describe("job lifecycle", () => {
    let jobId: string;

    it("WORKER cannot create a job", async () => {
      const token = await loginAs("worker@test.local");
      const res = await request(ctx.app)
        .post("/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send(buildJobPayload(ctx));
      expect(res.status).toBe(403);
    });

    it("EDITOR creates a job and the rules engine resolves hazards/PPE from environment flags", async () => {
      const token = await loginAs("editor@test.local");
      const res = await request(ctx.app)
        .post("/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send(buildJobPayload(ctx));

      expect(res.status).toBe(201);
      jobId = res.body.id;

      const hazardIds = res.body.jobHazards.map((jh: { hazard: { id: string } }) => jh.hazard.id);
      expect(hazardIds).toContain(ctx.seed.hazardFallId);
      expect(hazardIds).toContain(ctx.seed.hazardElectricShockId);

      const ppeIds = res.body.jobPpe.map((jp: { ppe: { id: string } }) => jp.ppe.id);
      expect(ppeIds).toContain(ctx.seed.ppeHarnessId); // from the working-at-height rule
      expect(ppeIds).toContain(ctx.seed.ppeGlassesId); // from the baseline rule

      // Every rule-derived hazard/PPE must record where it came from.
      expect(res.body.jobHazards.every((jh: { source: string }) => jh.source === "RULE")).toBe(true);
    });

    it("updating the job re-runs the rules engine against the new answers", async () => {
      const token = await loginAs("editor@test.local");
      const payload = buildJobPayload(ctx);
      payload.environment.electricalWork = false; // turn electrical work off

      const res = await request(ctx.app)
        .put(`/jobs/${jobId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      const hazardIds = res.body.jobHazards.map((jh: { hazard: { id: string } }) => jh.hazard.id);
      expect(hazardIds).not.toContain(ctx.seed.hazardElectricShockId);
      expect(hazardIds).toContain(ctx.seed.hazardFallId); // still working at height
    });

    it("submits the job for review", async () => {
      const token = await loginAs("editor@test.local");
      const res = await request(ctx.app).post(`/jobs/${jobId}/submit`).set("Authorization", `Bearer ${token}`);

      if (sofficeAvailable) {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("IN_REVIEW");
      } else {
        // Document generation fails without LibreOffice — the job must
        // stay DRAFT (re-submittable) rather than getting stuck.
        expect(res.status).toBe(500);
        const job = await ctx.prisma.job.findUniqueOrThrow({ where: { id: jobId } });
        expect(job.status).toBe("DRAFT");
      }
    });

    it.skipIf(!sofficeAvailable)("downloads a non-empty generated DOCX for the submitted job", async () => {
      const token = await loginAs("editor@test.local");
      const jobRes = await request(ctx.app).get(`/jobs/${jobId}`).set("Authorization", `Bearer ${token}`);
      const versionId = jobRes.body.versions[0].id;

      const res = await request(ctx.app)
        .get(`/jobs/${jobId}/versions/${versionId}/download?format=docx`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("wordprocessingml");
      expect(res.body.length).toBeGreaterThan(1000);
    });

    it.skipIf(!sofficeAvailable)("REVIEWER approves and publishes the job", async () => {
      const reviewerToken = await loginAs("reviewer@test.local");

      const approveRes = await request(ctx.app)
        .post(`/jobs/${jobId}/approvals`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({ decision: "APPROVED" });
      expect(approveRes.status).toBe(201);

      const publishRes = await request(ctx.app)
        .post(`/jobs/${jobId}/publish`)
        .set("Authorization", `Bearer ${reviewerToken}`);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body.status).toBe("PUBLISHED");
    });
  });

  describe("admin", () => {
    it("EDITOR cannot create a hazard", async () => {
      const token = await loginAs("editor@test.local");
      const res = await request(ctx.app)
        .post("/admin/hazards")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "HAZ-NOISE", name: "Excessive noise", category: "Noise", defaultRiskRating: "MEDIUM" });
      expect(res.status).toBe(403);
    });

    it("ADMIN creates a hazard and a rule referencing it", async () => {
      const token = await loginAs("admin@test.local");

      const hazardRes = await request(ctx.app)
        .post("/admin/hazards")
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "HAZ-NOISE", name: "Excessive noise", category: "Noise", defaultRiskRating: "MEDIUM" });
      expect(hazardRes.status).toBe(201);

      const ruleRes = await request(ctx.app)
        .post("/admin/rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Hot work noise controls",
          conditions: [{ field: "environment.hotWork", operator: "equals", value: true }],
          addHazardIds: [hazardRes.body.id],
        });
      expect(ruleRes.status).toBe(201);

      const listRes = await request(ctx.app).get("/admin/rules").set("Authorization", `Bearer ${token}`);
      expect(listRes.body.some((r: { id: string }) => r.id === ruleRes.body.id)).toBe(true);
    });
  });

  describe("audit trail", () => {
    it("records a JOB_CREATED entry visible to an admin", async () => {
      const token = await loginAs("admin@test.local");
      const res = await request(ctx.app).get("/audit").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.some((entry: { action: string }) => entry.action === "JOB_CREATED")).toBe(true);
    });
  });
});

function buildJobPayload(ctx: IntegrationTestContext) {
  return {
    jobName: "Rooftop Solar Install",
    siteAddress: "12 Example St, Brisbane QLD",
    principalContractor: "Acme Electrical Pty Ltd",
    workDescription: "Install rooftop solar panels and connect to switchboard.",
    jobTypeId: ctx.seed.jobTypeElectricalId,
    equipmentIds: [ctx.seed.equipmentEwpId],
    environment: {
      workingAtHeight: true,
      electricalWork: true,
      confinedSpace: false,
      hotWork: false,
      excavation: false,
      nearRoadwayOrTraffic: false,
      outdoors: true,
      occupiedSite: false,
      workingAlone: false,
      overheadServices: false,
    },
    tasks: [{ sequence: 1, description: "Erect EWP and access roof", hazardIds: [] }],
    selectedHazardIds: [],
    selectedPpeIds: [],
    plannedStartDate: "2026-08-12",
    plannedEndDate: "2026-08-14",
  };
}
