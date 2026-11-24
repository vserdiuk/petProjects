// Builds the PDF off the main thread, so the page stays responsive.
import { buildPdf, type PdfImage, type PdfProgress } from "./pdf";
import type { Settings, Size } from "./types";

export type WorkerRequest = { images: PdfImage[]; settings: Settings; target: Size | null };
export type WorkerResponse =
  | { type: "progress"; progress: PdfProgress }
  | { type: "done"; bytes: Uint8Array }
  | { type: "error"; message: string };

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { images, settings, target } = e.data;
  try {
    const bytes = await buildPdf(images, settings, target, (progress) => post({ type: "progress", progress }));
    post({ type: "done", bytes }, [bytes.buffer]);
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
