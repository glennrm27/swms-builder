import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class PdfConversionError extends Error {
  constructor(message: string, public readonly stderr?: string) {
    super(message);
    this.name = "PdfConversionError";
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Converts a DOCX buffer to PDF using a headless LibreOffice binary.
 * This is the standard server-side approach for pixel-faithful DOCX->PDF
 * (vs. re-implementing DOCX layout in a pure-JS PDF library): LibreOffice
 * renders the same DOCX layout engine used to author the template.
 *
 * Requires `soffice` (LibreOffice) on PATH, or SOFFICE_PATH pointing at
 * the binary. The Azure deployment notes in the README cover installing
 * this in the container image.
 */
export async function convertDocxToPdf(
  docxBuffer: Buffer,
  options: { sofficePath?: string; timeoutMs?: number } = {},
): Promise<Buffer> {
  const sofficePath = options.sofficePath ?? process.env.SOFFICE_PATH ?? "soffice";
  const workDir = await mkdtemp(join(tmpdir(), "swms-docgen-"));

  try {
    const docxPath = join(workDir, "input.docx");
    await writeFile(docxPath, docxBuffer);

    // LibreOffice locks its user profile while running. Without an
    // isolated profile per invocation, two conversions running at the
    // same time (two people submitting SWMS jobs concurrently) contend
    // for the same lock and one hangs indefinitely instead of failing
    // fast — this bit us in local testing. `-env:UserInstallation`
    // gives every call its own throwaway profile.
    const profileDir = join(workDir, "profile");
    await runSoffice(
      sofficePath,
      [
        `-env:UserInstallation=${toFileUrl(profileDir)}`,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        docxPath,
      ],
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    const pdfPath = join(workDir, "input.pdf");
    return await readFile(pdfPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function toFileUrl(path: string): string {
  return `file:///${path.replace(/\\/g, "/")}`;
}

function runSoffice(sofficePath: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(sofficePath, args, { windowsHide: true });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        new PdfConversionError(
          `LibreOffice did not finish converting within ${timeoutMs}ms — killed the process. This usually means a stuck/orphaned soffice instance is holding a profile lock.`,
        ),
      );
    }, timeoutMs);

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new PdfConversionError(
          `Could not start LibreOffice ("${sofficePath}"). Ensure it is installed and on PATH, or set SOFFICE_PATH. Original error: ${err.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new PdfConversionError(`LibreOffice exited with code ${code}`, stderr));
      }
    });
  });
}
