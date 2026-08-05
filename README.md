# SWMS Builder

A guided web application for creating Safe Work Method Statements (SWMS). Users answer questions about
a job (type, equipment, environment); a data-driven rules engine resolves the correct template plus
mandatory hazards, controls, PPE, and permits; the system generates a DOCX and PDF, and tracks approval
and audit history through to publication.

> **Compliance note:** the hazard/control/template content shipped here follows the general structure used
> in Safe Work Australia's model SWMS guidance (task → hazard → hierarchy-of-control → residual risk →
> sign-off) as a starting point. It is **not** certified or legally reviewed content. Before using this in a
> real workplace, have the hazard library, control measures, and templates reviewed by a qualified WHS
> professional for your industry and jurisdiction.

## Architecture

```
swms-builder/
├── apps/
│   ├── web/            Next.js 14 (App Router) — guided form, review/approval UI, admin screens
│   └── api/             Express + TypeScript — REST API, auth, orchestrates rules-engine + document-gen
├── packages/
│   ├── db/               Prisma schema, migrations, seed data
│   ├── rules-engine/     Pure TS, zero framework deps — job facts -> template + hazards/PPE/permits
│   ├── document-gen/     DOCX merge (docxtemplater) + PDF export (LibreOffice) + storage abstraction
│   └── shared-types/     Zod schemas + TS types shared by web, api, and rules-engine
├── docker-compose.yml    Local Postgres for development
└── .env.example
```

**Why this split matters in practice:** `rules-engine` and `document-gen` have no dependency on Express,
React, or Prisma — they take plain data in and return plain data out. That's what makes them independently
unit-testable (see their `*.test.ts` files) and swappable — `apps/web` could be deleted entirely and the
rest of the system still works. `apps/api` is the only layer that touches HTTP, the database, and auth; it
composes the other packages rather than containing business logic itself.

Safety content — `Hazard`, `ControlMeasure`, `PPEItem`, `SWMSTemplate`, `TemplateSection`, `Rule` — lives
in the database, editable through the Admin screens. A `Rule` is data (JSON conditions evaluated against a
job's job type / equipment / environment answers), not a branch in application code — adding a new
condition, hazard, or template does not require a deploy.

## Prerequisites

- Node.js 20+ (developed/tested against Node 18.18 as a fallback; some tooling warns below 20)
- pnpm 8+ (`corepack enable && corepack prepare pnpm@8 --activate`, or `npm i -g pnpm`)
- Docker (for local Postgres — or point `DATABASE_URL` at any Postgres 14+ instance)
- **LibreOffice** installed and on `PATH` (or `SOFFICE_PATH` set) — required for DOCX → PDF conversion.
  Without it, DOCX generation still works but PDF export fails with a clear error.

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres
docker compose up -d

# 3. Configure environment
cp .env.example .env
# edit .env if you changed the Postgres credentials above

# 4. Create the schema and seed reference data (roles, admin user, sample
#    hazards/PPE/permits, one SWMS template, three example rules)
pnpm --filter @swms/db migrate
pnpm --filter @swms/db seed

# 5. Generate the default DOCX template (only needed once, or after
#    editing scripts/build-default-template.ts)
pnpm --filter @swms/document-gen build-default-template
cp packages/document-gen/templates/general-construction-swms.docx apps/api/storage/templates/

# 6. Run the API and web app (separate terminals)
pnpm dev:api   # http://localhost:4000
pnpm dev:web   # http://localhost:3000
```

Sign in with the seeded admin account: **admin@example.com / ChangeMe123!** (change this in any real
deployment — it's seed data, not a default you should ship).

## Testing

```bash
pnpm -r test
```

Runs unit tests for the rules engine (condition evaluation, template resolution, priority tie-breaking),
document generation (DOCX merge against the real generated template, verifying no unresolved tags remain),
shared Zod schemas (client/server validation contract), and API middleware/lib code (JWT, password hashing,
error mapping, request validation) — all without needing a live database. Full HTTP-integration tests
against a real Postgres instance are a natural next addition (e.g. via `testcontainers`) but are not
included here.

## Roles

| Role       | Can do |
|------------|--------|
| `ADMIN`    | Everything below, plus manage templates, hazard library, and rules |
| `EDITOR`   | Create/edit jobs (while DRAFT), submit for review |
| `REVIEWER` | Approve/reject/request changes on submitted jobs, publish approved jobs |
| `WORKER`   | View jobs and published SWMS documents |

Enforcement is server-side (`requireRole` middleware on every mutating route) — the UI's role gating is a
convenience, not the security boundary.

## Job lifecycle

`DRAFT → (submit, generates a SWMS version) → IN_REVIEW → APPROVED → PUBLISHED`, with `REJECTED` and a
"changes requested" path back to `DRAFT`. Every transition, plus template/rule/hazard-library edits, writes
an `AuditLog` row (`apps/api/src/services/auditService.ts`) — action, entity, actor, and structured
metadata, not just a free-text note.

Document generation re-runs the rules engine at submit time against the job's current facts, rather than
trusting whatever was resolved at intake — if hazards or rules changed between intake and submission, the
generated document reflects current safety content, and if generation fails partway (e.g. PDF conversion
error), the job stays `DRAFT` and is safely re-submittable rather than getting stuck in an in-between state.

## Deploying to Azure

This is designed to map directly onto:

- **apps/web** → Azure Static Web Apps or an Azure App Service (Node) running `next start`
- **apps/api** → Azure App Service or Container Apps (Node). Build a container image based on a Node image
  with LibreOffice installed (e.g. `apt-get install -y libreoffice --no-install-recommends`) so PDF
  conversion works in production the same way it does in dev.
- **Database** → Azure Database for PostgreSQL – Flexible Server. Run `prisma migrate deploy` (not
  `migrate dev`) as a release step.
- **File storage** → Azure Blob Storage. Set `STORAGE_DRIVER=azure`, `AZURE_STORAGE_CONNECTION_STRING`,
  `AZURE_STORAGE_CONTAINER` — `packages/document-gen/src/storage.ts` already implements this driver
  (`@azure/storage-blob` is an optional dependency, loaded dynamically so local dev never needs it
  installed).
- **Secrets** → Azure Key Vault for `JWT_SECRET` and the storage connection string, referenced via App
  Service's Key Vault references rather than plain app settings.

## Known limitations / natural next steps

- **PDF conversion requires LibreOffice** on the host or container. This was deliberately not simulated in
  this environment beyond confirming the failure path degrades safely (job stays `DRAFT`, clear error
  surfaced) — see `packages/document-gen/src/pdfConvert.ts`.
- **Single role per user.** Simpler than a many-to-many role model and matches the four roles requested;
  revisit if a user genuinely needs to act as more than one role.
- **No HTTP-level integration tests against a live database** yet (unit tests cover the business logic in
  isolation instead) — recommended next addition via `testcontainers` in CI.
- **Admin screens are functional but minimal** (e.g. the rule condition builder is a flat list of
  field/operator/value rows, not a nested condition tree) — sufficient for the conditions in the seed data;
  extend `apps/web/src/app/admin/rules/page.tsx` if nested AND/OR groups are needed later.
