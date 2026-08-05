import { execFileSync } from "node:child_process";
import { mkdtemp, cp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", ".."); // apps/api/src/integration -> swms-builder
const DB_PACKAGE_DIR = join(REPO_ROOT, "packages", "db");
const TEMPLATE_SOURCE = join(REPO_ROOT, "packages", "document-gen", "templates", "general-construction-swms.docx");
const TEMPLATE_STORAGE_KEY = "templates/general-construction-swms.docx";

export interface IntegrationTestContext {
  app: import("express").Express;
  prisma: typeof import("@swms/db").prisma;
  seed: {
    jobTypeElectricalId: string;
    equipmentEwpId: string;
    hazardFallId: string;
    hazardElectricShockId: string;
    ppeHarnessId: string;
    ppeGlassesId: string;
    templateId: string;
  };
  teardown: () => Promise<void>;
}

/**
 * Boots a real, empty Postgres in a container, runs the real migrations
 * against it, seeds the minimum reference data needed to exercise the
 * guided-form -> rules-engine -> document-generation path, and returns a
 * ready-to-use Express app wired to that database. This is deliberately
 * NOT the same seed script as packages/db/src/seed.ts (that script is an
 * operational tool with side effects like printing to stdout) — it's a
 * narrower, purpose-built fixture for these tests.
 */
export async function setupIntegrationTestEnvironment(): Promise<IntegrationTestContext> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("swms_test")
    .withUsername("swms_test")
    .withPassword("swms_test")
    .start();

  const databaseUrl = container.getConnectionUri();
  const storageDir = await mkdtemp(join(tmpdir(), "swms-integration-storage-"));

  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "integration-test-secret-not-for-prod";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = storageDir;
  process.env.WEB_ORIGIN = "http://localhost:3000";

  execFileSync(
    "npx",
    ["prisma", "migrate", "deploy", "--schema", join(DB_PACKAGE_DIR, "prisma", "schema.prisma")],
    { cwd: DB_PACKAGE_DIR, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe", shell: true },
  );

  await mkdir(join(storageDir, "templates"), { recursive: true });
  await cp(TEMPLATE_SOURCE, join(storageDir, TEMPLATE_STORAGE_KEY));

  // Import everything that reads env vars at module-load time only AFTER
  // the env vars above are set.
  const { prisma } = await import("@swms/db");
  const { createApp } = await import("../app.js");

  const seed = await seedMinimalReferenceData(prisma);
  const app = createApp();

  return {
    app,
    prisma,
    seed,
    teardown: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}

async function seedMinimalReferenceData(prisma: typeof import("@swms/db").prisma) {
  const bcrypt = await import("bcryptjs");

  const [adminRole, editorRole, reviewerRole, workerRole] = await Promise.all([
    prisma.role.create({ data: { name: "ADMIN" } }),
    prisma.role.create({ data: { name: "EDITOR" } }),
    prisma.role.create({ data: { name: "REVIEWER" } }),
    prisma.role.create({ data: { name: "WORKER" } }),
  ] as const);

  const passwordHash = await bcrypt.hash("IntegrationTest123!", 4); // low cost factor — tests, not prod
  await Promise.all([
    prisma.user.create({ data: { email: "admin@test.local", name: "Test Admin", passwordHash, roleId: adminRole.id } }),
    prisma.user.create({ data: { email: "editor@test.local", name: "Test Editor", passwordHash, roleId: editorRole.id } }),
    prisma.user.create({ data: { email: "reviewer@test.local", name: "Test Reviewer", passwordHash, roleId: reviewerRole.id } }),
    prisma.user.create({ data: { email: "worker@test.local", name: "Test Worker", passwordHash, roleId: workerRole.id } }),
  ]);

  const jobTypeElectrical = await prisma.jobType.create({ data: { code: "ELECTRICAL", name: "Electrical Work" } });
  const equipmentEwp = await prisma.equipment.create({ data: { code: "EWP", name: "Elevated Work Platform" } });

  const hazardFall = await prisma.hazard.create({
    data: { code: "HAZ-FALL-HEIGHT", name: "Fall from height", category: "Working at Height", defaultRiskRating: "HIGH" },
  });
  const hazardElectricShock = await prisma.hazard.create({
    data: { code: "HAZ-ELEC-SHOCK", name: "Electric shock", category: "Electrical", defaultRiskRating: "EXTREME" },
  });
  await prisma.controlMeasure.createMany({
    data: [
      { hazardId: hazardFall.id, description: "Use guardrails.", hierarchy: "ENGINEERING", residualRiskRating: "LOW" },
      { hazardId: hazardElectricShock.id, description: "Isolate supply.", hierarchy: "ISOLATION", residualRiskRating: "LOW" },
    ],
  });

  const ppeHarness = await prisma.pPEItem.create({ data: { code: "PPE-HARNESS", name: "Safety Harness" } });
  const ppeGlasses = await prisma.pPEItem.create({ data: { code: "PPE-GLASSES", name: "Safety Glasses" } });
  await prisma.permit.create({ data: { code: "PERMIT-HEIGHT", name: "Working at Height Permit" } });

  const template = await prisma.sWMSTemplate.create({
    data: { name: "General Construction SWMS", docxStoragePath: TEMPLATE_STORAGE_KEY },
  });
  await prisma.templateSection.createMany({
    data: [
      { templateId: template.id, key: "scope", title: "Scope of Works", sortOrder: 1 },
      { templateId: template.id, key: "task_hazard_control", title: "Task, Hazard and Control Measures", sortOrder: 2 },
      { templateId: template.id, key: "signoff", title: "Sign-off", sortOrder: 3 },
    ],
  });

  await prisma.rule.create({
    data: {
      name: "Working at height baseline controls",
      priority: 10,
      conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
      conditionLogic: "ALL",
      templateId: template.id,
      addPermitCodes: ["PERMIT-HEIGHT"],
      addHazards: { create: [{ hazardId: hazardFall.id }] },
      addPpe: { create: [{ ppeId: ppeHarness.id }] },
    },
  });
  await prisma.rule.create({
    data: {
      name: "Electrical work baseline controls",
      priority: 10,
      conditions: [{ field: "environment.electricalWork", operator: "equals", value: true }],
      conditionLogic: "ALL",
      templateId: template.id,
      addHazards: { create: [{ hazardId: hazardElectricShock.id }] },
    },
  });
  await prisma.rule.create({
    data: {
      name: "Baseline PPE for all jobs",
      priority: 1000,
      conditions: [{ field: "jobType.code", operator: "truthy" }],
      conditionLogic: "ALL",
      templateId: template.id,
      addPpe: { create: [{ ppeId: ppeGlasses.id }] },
    },
  });

  return {
    jobTypeElectricalId: jobTypeElectrical.id,
    equipmentEwpId: equipmentEwp.id,
    hazardFallId: hazardFall.id,
    hazardElectricShockId: hazardElectricShock.id,
    ppeHarnessId: ppeHarness.id,
    ppeGlassesId: ppeGlasses.id,
    templateId: template.id,
  };
}
