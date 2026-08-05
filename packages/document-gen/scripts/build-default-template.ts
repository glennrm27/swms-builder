/**
 * Generates the default "General Construction SWMS" .docx template using
 * docxtemplater tag syntax ({tag}, {#loop}...{/loop}). This is a code-
 * authored starting template — real deployments would typically have a
 * designer produce a branded .docx and an admin upload it via the Admin
 * > Templates screen (see apps/api routes/templates.ts), but we still
 * need a real, working template to seed local dev / tests with, and a
 * .docx is a binary format Write can't hand-author — so it's generated
 * here from the `docx` package instead.
 *
 * Run with: pnpm --filter @swms/document-gen build-default-template
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "templates", "general-construction-swms.docx");

function text(content: string, opts: { bold?: boolean } = {}) {
  return new TextRun({ text: content, bold: opts.bold });
}

function p(content: string, opts: { bold?: boolean } = {}) {
  return new Paragraph({ children: [text(content, opts)] });
}

function cell(children: Paragraph[], widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children,
  });
}

function labeledRow(label: string, valueTag: string) {
  return new TableRow({
    children: [cell([p(label, { bold: true })], 28), cell([p(valueTag)], 72)],
  });
}

const infoTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    labeledRow("Job Name", "{jobName}"),
    labeledRow("Site Address", "{siteAddress}"),
    labeledRow("Principal Contractor", "{principalContractor}"),
    labeledRow("Job Type", "{jobType}"),
    labeledRow("Planned Dates", "{plannedStartDate} to {plannedEndDate}"),
    labeledRow("Work Description", "{workDescription}"),
  ],
});

const taskHazardTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: [
        cell([p("#", { bold: true })], 8),
        cell([p("Task Description", { bold: true })], 32),
        cell([p("Hazards, Risk Rating and Control Measures", { bold: true })], 60),
      ],
    }),
    // Single-row loop: docxtemplater repeats this whole row once per
    // taskStep because {#taskSteps} is the first content of the row and
    // {/taskSteps} is the last content of the row.
    new TableRow({
      children: [
        cell([new Paragraph({ children: [text("{#taskSteps}"), text("{sequence}")] })], 8),
        cell([p("{description}")], 32),
        cell(
          [
            p("{#hazards}"),
            new Paragraph({
              children: [
                text("{hazardName} ["),
                text("{hazardCategory}"),
                text("] — "),
                text("{description}"),
                text("  (Hierarchy: "),
                text("{hierarchy}"),
                text(", pre-control risk: "),
                text("{riskRatingBeforeControls}"),
                text(", residual risk: "),
                text("{residualRiskRating}"),
                text(")"),
              ],
            }),
            new Paragraph({ children: [text("{/hazards}"), text("{/taskSteps}")] }),
          ],
          60,
        ),
      ],
    }),
  ],
});

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: "Safe Work Method Statement", heading: HeadingLevel.TITLE }),
        new Paragraph({
          children: [
            text("Document Reference: "),
            text("{documentReference}"),
            text("    Version: "),
            text("{versionNumber}"),
            text("    Generated: "),
            text("{generatedAt}"),
          ],
        }),

        new Paragraph({ text: "Scope of Works", heading: HeadingLevel.HEADING_1 }),
        infoTable,

        new Paragraph({ text: "Work Environment", heading: HeadingLevel.HEADING_1 }),
        p("{#environmentFlags}"),
        p("- {.}"),
        p("{/environmentFlags}"),

        new Paragraph({ text: "Task, Hazard and Control Measures", heading: HeadingLevel.HEADING_1 }),
        taskHazardTable,

        new Paragraph({ text: "Personal Protective Equipment (PPE)", heading: HeadingLevel.HEADING_1 }),
        p("{#ppeRequired}"),
        p("- {name}"),
        p("{/ppeRequired}"),

        new Paragraph({ text: "Permits and Authorisations", heading: HeadingLevel.HEADING_1 }),
        p("{#permitsRequired}"),
        p("- {.}"),
        p("{/permitsRequired}"),

        new Paragraph({ text: "Additional Notes", heading: HeadingLevel.HEADING_1 }),
        p("{additionalNotes}"),

        new Paragraph({ text: "Sign-off and Acknowledgement", heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                cell([p("Prepared By", { bold: true })], 25),
                cell([p("{preparedByName}")], 25),
                cell([p("Position", { bold: true })], 15),
                cell([p("{preparedByPosition}")], 15),
                cell([p("Date", { bold: true })], 10),
                cell([p("{preparedBySignedAt}")], 10),
              ],
            }),
          ],
        }),
        p("{#hasReviewer}"),
        new Paragraph({
          children: [
            text("Reviewed by "),
            text("{reviewedByName}"),
            text(" ("),
            text("{reviewedByPosition}"),
            text(") — decision: "),
            text("{reviewedByDecision}"),
            text(" on "),
            text("{reviewedBySignedAt}"),
          ],
        }),
        p("{/hasReviewer}"),
      ],
    },
  ],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, buffer);
  console.log(`Wrote default template to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
