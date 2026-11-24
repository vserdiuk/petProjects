import type { PdfImage, PdfProgress } from "./pdf";
import type { WorkerRequest, WorkerResponse } from "./pdf.worker";
import type { Settings, Size } from "./types";

/**
 * Runs buildPdf in a fresh Web Worker. Aborting the signal terminates the worker
 * and rejects with an AbortError.
 */
export function buildPdfInWorker(
  images: PdfImage[],
  settings: Settings,
  target: Size | null,
  onProgress: (p: PdfProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException("PDF build cancelled", "AbortError");
    if (signal.aborted) return reject(abortError());

    const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort);

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") onProgress(msg.progress);
      else {
        finish();
        if (msg.type === "done") resolve(msg.bytes);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      finish();
      reject(new Error(e.message || "PDF worker failed"));
    };

    const transfer = images.map((i) => i.bytes).filter((b): b is ArrayBuffer => b instanceof ArrayBuffer);
    worker.postMessage({ images, settings, target } satisfies WorkerRequest, transfer);
  });
}
