import type { GeneratedDocumentResult, SwmsDocumentData } from "@swms/shared-types";
import { mergeSwmsDocx } from "./docxMerge.js";
import { convertDocxToPdf } from "./pdfConvert.js";
import type { ObjectStorage } from "./storage.js";

export interface GenerateSwmsDocumentInput {
  /** Storage key of the source .docx template, e.g. SWMSTemplate.docxStoragePath */
  templateStoragePath: string;
  data: SwmsDocumentData;
  /** Storage key prefix for the generated output, e.g. `jobs/{jobId}/versions/{n}` */
  outputKeyPrefix: string;
}

/**
 * The single entry point apps/api calls to turn resolved SWMS JSON into
 * stored DOCX + PDF files. Everything above this function is pure/testable
 * in isolation; this function is the only place that touches storage I/O,
 * so it's the one thing that needs a real (or fake) ObjectStorage to test.
 */
export async function generateSwmsDocument(
  storage: ObjectStorage,
  input: GenerateSwmsDocumentInput,
): Promise<GeneratedDocumentResult> {
  const templateBuffer = await storage.get(input.templateStoragePath);
  const docxBuffer = mergeSwmsDocx(templateBuffer, input.data);
  const pdfBuffer = await convertDocxToPdf(docxBuffer);

  const docxStoragePath = `${input.outputKeyPrefix}/swms.docx`;
  const pdfStoragePath = `${input.outputKeyPrefix}/swms.pdf`;

  await storage.put(
    docxStoragePath,
    docxBuffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  await storage.put(pdfStoragePath, pdfBuffer, "application/pdf");

  return {
    docxStoragePath,
    pdfStoragePath,
    docxSizeBytes: docxBuffer.byteLength,
    pdfSizeBytes: pdfBuffer.byteLength,
  };
}
