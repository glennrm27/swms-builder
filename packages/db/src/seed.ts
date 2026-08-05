import bcrypt from "bcryptjs";
import { prisma } from "./index.js";

/**
 * Minimal seed data — just enough for the app to be usable end to end
 * (login, start a job, see the rules engine pick a template). This is
 * reference/config data (roles, one template, a handful of hazards), not
 * fabricated demo content, and is exactly what a real deployment would
 * need to load before its first job can be created.
 */
async function main() {
  console.log("Seeding roles...");
  const roles = await Promise.all(
    (["ADMIN", "EDITOR", "REVIEWER", "WORKER"] as const).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: `${name.charAt(0)}${name.slice(1).toLowerCase()} role` },
      }),
    ),
  );
  const adminRole = roles.find((r) => r.name === "ADMIN")!;

  console.log("Seeding admin user (admin@example.com / ChangeMe123!)...");
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash,
      name: "System Administrator",
      roleId: adminRole.id,
    },
  });

  console.log("Seeding job types...");
  const [electricalWork, generalConstruction] = await Promise.all([
    prisma.jobType.upsert({
      where: { code: "ELECTRICAL" },
      update: {},
      create: { code: "ELECTRICAL", name: "Electrical Work", description: "Installation, testing or repair of electrical systems" },
    }),
    prisma.jobType.upsert({
      where: { code: "GENERAL_CONSTRUCTION" },
      update: {},
      create: { code: "GENERAL_CONSTRUCTION", name: "General Construction", description: "General building and construction work" },
    }),
  ]);

  console.log("Seeding equipment...");
  const [eleveatedWorkPlatform, powerTools] = await Promise.all([
    prisma.equipment.upsert({
      where: { code: "EWP" },
      update: {},
      create: { code: "EWP", name: "Elevated Work Platform" },
    }),
    prisma.equipment.upsert({
      where: { code: "POWER_TOOLS" },
      update: {},
      create: { code: "POWER_TOOLS", name: "Powered Hand Tools" },
    }),
  ]);
  void powerTools;

  console.log("Seeding hazard library...");
  const fallFromHeight = await prisma.hazard.upsert({
    where: { code: "HAZ-FALL-HEIGHT" },
    update: {},
    create: {
      code: "HAZ-FALL-HEIGHT",
      name: "Fall from height",
      category: "Working at Height",
      description: "Risk of falling from an elevated work surface, platform, or ladder.",
      defaultRiskRating: "HIGH",
    },
  });
  const electricShock = await prisma.hazard.upsert({
    where: { code: "HAZ-ELEC-SHOCK" },
    update: {},
    create: {
      code: "HAZ-ELEC-SHOCK",
      name: "Electric shock / electrocution",
      category: "Electrical",
      description: "Contact with live electrical conductors or faulty equipment.",
      defaultRiskRating: "EXTREME",
    },
  });
  const manualHandling = await prisma.hazard.upsert({
    where: { code: "HAZ-MANUAL-HANDLING" },
    update: {},
    create: {
      code: "HAZ-MANUAL-HANDLING",
      name: "Manual handling injury",
      category: "Manual Handling",
      description: "Musculoskeletal injury from lifting, carrying, or repetitive tasks.",
      defaultRiskRating: "MEDIUM",
    },
  });

  console.log("Seeding control measures...");
  await prisma.controlMeasure.createMany({
    data: [
      {
        hazardId: fallFromHeight.id,
        description: "Use guardrails or edge protection on all elevated work platforms.",
        hierarchy: "ENGINEERING",
        residualRiskRating: "LOW",
      },
      {
        hazardId: fallFromHeight.id,
        description: "Ensure all workers at height are trained and hold a valid Working at Heights ticket.",
        hierarchy: "ADMINISTRATIVE",
        residualRiskRating: "MEDIUM",
      },
      {
        hazardId: electricShock.id,
        description: "Isolate and lock out/tag out electrical supply before work commences.",
        hierarchy: "ISOLATION",
        residualRiskRating: "LOW",
      },
      {
        hazardId: electricShock.id,
        description: "Test circuits are de-energised with an approved voltage tester before touching conductors.",
        hierarchy: "ADMINISTRATIVE",
        residualRiskRating: "LOW",
      },
      {
        hazardId: manualHandling.id,
        description: "Use mechanical lifting aids for loads over 20kg.",
        hierarchy: "ENGINEERING",
        residualRiskRating: "LOW",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding PPE items...");
  const [harness, hardHat, insulatedGloves, safetyGlasses] = await Promise.all([
    prisma.pPEItem.upsert({ where: { code: "PPE-HARNESS" }, update: {}, create: { code: "PPE-HARNESS", name: "Safety Harness" } }),
    prisma.pPEItem.upsert({ where: { code: "PPE-HARDHAT" }, update: {}, create: { code: "PPE-HARDHAT", name: "Hard Hat" } }),
    prisma.pPEItem.upsert({ where: { code: "PPE-INSUL-GLOVES" }, update: {}, create: { code: "PPE-INSUL-GLOVES", name: "Insulated Gloves" } }),
    prisma.pPEItem.upsert({ where: { code: "PPE-SAFETY-GLASSES" }, update: {}, create: { code: "PPE-SAFETY-GLASSES", name: "Safety Glasses" } }),
  ]);

  console.log("Seeding permits...");
  await Promise.all([
    prisma.permit.upsert({ where: { code: "PERMIT-WORKING-AT-HEIGHT" }, update: {}, create: { code: "PERMIT-WORKING-AT-HEIGHT", name: "Working at Height Permit" } }),
    prisma.permit.upsert({ where: { code: "PERMIT-ELECTRICAL-ISOLATION" }, update: {}, create: { code: "PERMIT-ELECTRICAL-ISOLATION", name: "Electrical Isolation Permit" } }),
  ]);

  console.log("Seeding SWMS template + sections...");
  const generalTemplate = await prisma.sWMSTemplate.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "General Construction SWMS",
      description: "Default template covering general construction task-based SWMS structure per Safe Work Australia model clauses.",
      jurisdiction: "AU",
      docxStoragePath: "templates/general-construction-swms.docx",
    },
  });
  await prisma.templateSection.createMany({
    data: [
      { templateId: generalTemplate.id, key: "scope", title: "Scope of Works", sortOrder: 1 },
      { templateId: generalTemplate.id, key: "responsibilities", title: "Roles and Responsibilities", sortOrder: 2 },
      { templateId: generalTemplate.id, key: "task_hazard_control", title: "Task, Hazard and Control Measures", sortOrder: 3 },
      { templateId: generalTemplate.id, key: "ppe", title: "Personal Protective Equipment", sortOrder: 4 },
      { templateId: generalTemplate.id, key: "permits", title: "Permits and Authorisations", sortOrder: 5 },
      { templateId: generalTemplate.id, key: "signoff", title: "Sign-off and Acknowledgement", sortOrder: 6 },
      {
        templateId: generalTemplate.id,
        key: "electrical_isolation",
        title: "Electrical Isolation Procedure",
        isDefault: false, // only included when the electrical-work rule fires
        sortOrder: 7,
      },
    ],
    skipDuplicates: true,
  });

  // Rules don't have a natural unique key to upsert on (unlike everything
  // above), so guard the whole block instead — this keeps `seed` safe to
  // run more than once (e.g. as an idempotent step in a deploy pipeline)
  // without piling up duplicate rules on every run.
  if ((await prisma.rule.count()) > 0) {
    console.log("Rules already seeded, skipping.");
    void electricalWork;
    void generalConstruction;
    void eleveatedWorkPlatform;
    console.log("Seed complete.");
    return;
  }

  console.log("Seeding rules...");
  // Rule 1: any job of type ELECTRICAL, or with environment.electricalWork
  // true, must use the general template, gain the electric-shock hazard +
  // insulated gloves, an isolation permit, and the isolation section.
  await prisma.rule.create({
    data: {
      name: "Electrical work baseline controls",
      description: "Applies mandatory electrical hazard controls whenever electrical work is flagged.",
      priority: 10,
      conditions: [{ field: "environment.electricalWork", operator: "equals", value: true }],
      conditionLogic: "ALL",
      templateId: generalTemplate.id,
      requiredSectionKeys: ["electrical_isolation"],
      addPermitCodes: ["PERMIT-ELECTRICAL-ISOLATION"],
      addHazards: { create: [{ hazardId: electricShock.id }] },
      addPpe: { create: [{ ppeId: insulatedGloves.id }] },
    },
  });

  // Rule 2: working at height flag adds fall hazard, harness + hard hat,
  // and the height permit.
  await prisma.rule.create({
    data: {
      name: "Working at height baseline controls",
      description: "Applies mandatory fall-prevention controls whenever work at height is flagged.",
      priority: 10,
      conditions: [{ field: "environment.workingAtHeight", operator: "equals", value: true }],
      conditionLogic: "ALL",
      templateId: generalTemplate.id,
      addPermitCodes: ["PERMIT-WORKING-AT-HEIGHT"],
      addHazards: { create: [{ hazardId: fallFromHeight.id }] },
      addPpe: { create: [{ ppeId: harness.id }, { ppeId: hardHat.id }] },
    },
  });

  // Rule 3: baseline default — every job gets safety glasses and the
  // general template, lowest priority so more specific rules can add to it.
  await prisma.rule.create({
    data: {
      name: "Baseline PPE for all jobs",
      description: "Every job requires safety glasses and defaults to the general construction template.",
      priority: 1000,
      conditions: [{ field: "jobType.code", operator: "truthy" }],
      conditionLogic: "ALL",
      templateId: generalTemplate.id,
      addPpe: { create: [{ ppeId: safetyGlasses.id }] },
    },
  });

  void electricalWork;
  void generalConstruction;
  void eleveatedWorkPlatform;

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
