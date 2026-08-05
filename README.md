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
pnpm -r test                                    # unit tests, no Docker needed
pnpm --filter @swms/api test:integration        # HTTP integration tests, needs Docker
```

`pnpm -r test` runs unit tests for the rules engine (condition evaluation including nested AND/OR groups,
template resolution, priority tie-breaking), document generation (DOCX merge against the real generated
template, verifying no unresolved tags remain), shared Zod schemas (the client/server validation contract),
and API middleware/lib code (JWT, password hashing, error mapping, request validation) — all without
needing a live database.

`test:integration` (`apps/api/src/integration/`) spins up a real Postgres in a Docker container via
[testcontainers](https://node.testcontainers.org/), runs the real migrations against it, and exercises the
real Express app over HTTP with supertest — auth, role enforcement, job creation with live rules-engine
resolution, job editing re-running the rules engine, admin CRUD, and the audit trail. Submit/approve/publish
assertions additionally require LibreOffice on the runner (`SOFFICE_PATH` env var); if it's not present they
skip to asserting the failure path instead (job stays `DRAFT`) rather than failing outright, so the suite
still runs meaningfully in environments without LibreOffice installed.

> Note from developing this on Windows: the full suite (11/13, 2 correctly skipped) passed reliably without
> LibreOffice. With `SOFFICE_PATH` set, the run intermittently hung on this particular sandboxed dev
> machine — while the same `convertDocxToPdf` call, run standalone (not under testcontainers/vitest) and
> inside the actual Docker container, both completed correctly and quickly every time. That strongly points
> to a Windows-specific interaction between concurrent Docker Desktop containers, the spawned `vitest`
> process tree, and LibreOffice rather than a bug in the conversion code — worth a closer look if it recurs
> in CI, but not something to block on for a Linux-based CI runner.

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

## Live demo deployment (Render)

`render.yaml` is a ready-to-use [Render Blueprint](https://render.com/docs/blueprint-spec) that stands up a
throwaway test instance — a managed Postgres, the API (Docker, with LibreOffice baked in), and the web app
(Docker) — so someone can try the app at a URL without installing anything locally. Both Dockerfiles are
verified working end to end (built, run, logged in, created a job, and generated a real DOCX+PDF, all
inside Linux containers) before being wired into this blueprint.

1. Push this repo to your own GitHub account (already done if you're reading this on GitHub).
2. In the Render dashboard: **New > Blueprint**, connect the repo, and Render will read `render.yaml` and
   propose the `swms-postgres` database plus the `swms-api` and `swms-web` services. Apply it.
3. First deploy will fail to *fully* wire up until you fix the chicken-and-egg URL problem: Render doesn't
   know either service's public URL until after it's created.
   - Once both services are up, copy `swms-api`'s actual URL (Dashboard → swms-api → the URL at the top)
     and set it as `swms-web`'s `NEXT_PUBLIC_API_URL` env var, then **Manual Deploy** swms-web (this is a
     Next.js build-time value, so it needs a rebuild, not just a restart).
   - Copy `swms-web`'s actual URL and set it as `swms-api`'s `WEB_ORIGIN` env var (this one just needs a
     restart — CORS config is read at boot, not build time).
4. Seed reference data once, via Render's Shell tab on `swms-api`: `cd /app/packages/db && pnpm seed`.
   (Migrations and the default template run automatically on every boot — see
   `apps/api/docker-entrypoint.sh` — but seeding rules/hazards/PPE is a deliberate one-time step; rerunning
   it is safe and a no-op if rules already exist, but there's no reason to run it more than once.)
5. Visit `swms-web`'s URL and sign in with the seeded admin account.

**Free-tier caveats** (see comments in `render.yaml`): free web services spin down after ~15 min idle (first
request after that takes 30-60s to wake up), free Postgres is time-limited, and there's no persistent disk
on the free plan — generated documents live on the container's ephemeral filesystem and are lost on
redeploy/restart. Fine for someone to try the guided form and download a SWMS in one sitting; upgrade the
`swms-api` plan and add a `disk:` block in `render.yaml` if documents need to survive restarts.

## Deploying to Azure (production target)

Render above is for quick test access; this is the intended production path:

- **apps/web** → Azure Static Web Apps or an Azure App Service (Node) running `next start`
- **apps/api** → Azure App Service or Container Apps, using `apps/api/Dockerfile` as-is (it already
  installs LibreOffice and has been verified to run correctly in a Linux container).
- **Database** → Azure Database for PostgreSQL – Flexible Server. Run `prisma migrate deploy` (not
  `migrate dev`) as a release step — `apps/api/docker-entrypoint.sh` already does this on every boot.
- **File storage** → Azure Blob Storage. Set `STORAGE_DRIVER=azure`, `AZURE_STORAGE_CONNECTION_STRING`,
  `AZURE_STORAGE_CONTAINER` — `packages/document-gen/src/storage.ts` already implements this driver
  (`@azure/storage-blob` is an optional dependency, loaded dynamically so local dev never needs it
  installed).
- **Secrets** → Azure Key Vault for `JWT_SECRET` and the storage connection string, referenced via App
  Service's Key Vault references rather than plain app settings.

## Known limitations / natural next steps

- **Concurrent PDF conversions need an isolated LibreOffice profile per call** — without this, two people
  submitting SWMS jobs at the same moment would contend for one shared profile lock and one request could
  hang instead of failing fast. `packages/document-gen/src/pdfConvert.ts` already does this
  (`-env:UserInstallation` per invocation) plus a hard timeout, found and fixed during testing in this repo.
- **Single role per user.** Simpler than a many-to-many role model and matches the four roles requested;
  revisit if a user genuinely needs to act as more than one role.
- **Admin screens are functional but minimal.** The rule condition builder supports nested AND/OR groups
  (see `apps/web/src/components/RuleForm/ConditionGroupEditor.tsx`), but there's no template-section editor
  UI yet (sections are seeded/managed via the API directly) and no bulk hazard-library import/export.
- **No CI pipeline configured** — `pnpm -r test` (fast, no Docker) and
  `pnpm --filter @swms/api test:integration` (needs Docker) both run cleanly locally; wiring them into
  GitHub Actions on push/PR is the natural next step before treating `main` as protected.
