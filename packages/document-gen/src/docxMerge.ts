import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { SwmsDocumentData } from "@swms/shared-types";
import { mapToTemplateContext } from "./dataMapper.js";

export class DocxMergeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DocxMergeError";
  }
}

/**
 * Merges structured SWMS data into a `.docx` template that uses
 * docxtemplater tag syntax ({tag}, {#loop}...{/loop}). Throws
 * DocxMergeError with the underlying docxtemplater diagnostics on
 * malformed templates or missing tags, rather than a generic parser
 * exception — this is the error an admin sees when they upload a broken
 * template.
 */
export function mergeSwmsDocx(templateBuffer: Buffer, data: SwmsDocumentData): Buffer {
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  try {
    doc.render(mapToTemplateContext(data));
  } catch (error) {
    const details =
      error && typeof error === "object" && "properties" in error
        ? JSON.stringify((error as { properties?: unknown }).properties)
        : String(error);
    throw new DocxMergeError(`Failed to merge SWMS data into template: ${details}`, error);
  }

  return doc.getZip().generate({ type: "nodebuffer" });
}
