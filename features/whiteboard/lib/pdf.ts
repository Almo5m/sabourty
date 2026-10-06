import { PDFDocument } from "pdf-lib";
import type { PdfPageState } from "@/features/boards/types";

// الحد الأقصى لأطول بُعد في الصورة المُرسّمة لكل صفحة (بالبكسل)، بغض النظر
// عن حجم الصفحة الأصلي، لتفادي استهلاك ذاكرة مفرط على الأجهزة الضعيفة
// (تابلت/موبايل) الذي قد يتسبب في انهيار التبويب بالكامل.
const MAX_RENDER_DIMENSION = 1600;
const MAX_PAGES = 80;
const JPEG_QUALITY = 0.82;

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export interface ImportedPdfPage {
  width: number;
  height: number;
  backgroundDataUrl: string;
}

export class PdfImportError extends Error {}

export async function importPdfPages(file: File): Promise<ImportedPdfPage[]> {
  let pdfjs: Awaited<ReturnType<typeof getPdfjs>>;
  try {
    pdfjs = await getPdfjs();
  } catch {
    throw new PdfImportError(
      "تعذّر تحميل أداة قراءة PDF. تأكد من اتصالك بالإنترنت وحاول مجددًا."
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new PdfImportError("تعذّرت قراءة الملف المختار.");
  }

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: buffer }).promise;
  } catch {
    throw new PdfImportError("هذا الملف ليس PDF صالحًا أو تالف.");
  }

  if (doc.numPages > MAX_PAGES) {
    throw new PdfImportError(
      `الملف فيه ${doc.numPages} صفحة، والحد الأقصى المدعوم حاليًا ${MAX_PAGES} صفحة لحماية الجهاز من نفاد الذاكرة.`
    );
  }

  const pages: ImportedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    try {
      const page = await doc.getPage(pageNumber);
      const basePoints = page.getViewport({ scale: 1 });

      const longestSide = Math.max(basePoints.width, basePoints.height);
      const scale = Math.min(2, MAX_RENDER_DIMENSION / longestSide) || 1;
      const renderViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(renderViewport.width);
      canvas.height = Math.round(renderViewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, canvas, viewport: renderViewport })
        .promise;

      pages.push({
        width: basePoints.width,
        height: basePoints.height,
        backgroundDataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      });

      // تنفّس بين كل صفحة وأخرى حتى لا يتجمّد المتصفح أو يعتبر الصفحة
      // متوقفة عن الاستجابة أثناء معالجة ملفات كبيرة.
      await nextFrame();
    } catch {
      throw new PdfImportError(
        `حدث خطأ أثناء معالجة الصفحة ${pageNumber}. جرّب ملفًا آخر أو قسّم الملف لأجزاء أصغر.`
      );
    }
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
    const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const image = dataUrl.startsWith("data:image/jpeg")
      ? await pdfDoc.embedJpg(bytes)
      : await pdfDoc.embedPng(bytes);
    const pdfPage = pdfDoc.addPage([page.width, page.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
    await nextFrame();
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
