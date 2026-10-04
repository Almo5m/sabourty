import { PDFDocument } from "pdf-lib";
import type { PdfPageState } from "@/features/boards/types";

const RENDER_SCALE = 2;

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

export interface ImportedPdfPage {
  width: number;
  height: number;
  backgroundDataUrl: string;
}

export async function importPdfPages(file: File): Promise<ImportedPdfPage[]> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: ImportedPdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const basePoints = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, canvas, viewport: renderViewport })
      .promise;

    pages.push({
      width: basePoints.width,
      height: basePoints.height,
      backgroundDataUrl: canvas.toDataURL("image/png"),
    });
  }
  return pages;
}

export async function exportPagesAsPdf(
  pages: PdfPageState[],
  renderPageToPng: (index: number) => Promise<string>
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const dataUrl = await renderPageToPng(i);
    const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const image = await pdfDoc.embedPng(pngBytes);
    const pdfPage = pdfDoc.addPage([page.width, page.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
