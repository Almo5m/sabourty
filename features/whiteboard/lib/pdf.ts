import { PDFDocument } from "pdf-lib";
import type { PdfPageState } from "@/features/boards/types";

// الحد الأقصى لأطول بُعد في الصورة المُرسّمة لكل صفحة (بالبكسل)، بغض النظر
// عن حجم الصفحة الأصلي، لتفادي استهلاك ذاكرة مفرط على الأجهزة الضعيفة
// (تابلت/موبايل) الذي قد يتسبب في انهيار التبويب بالكامل.
const MAX_RENDER_DIMENSION = 2200;
const MAX_PAGES = 150;
const JPEG_QUALITY = 0.85;

async function getPdfjs() {
  // نستخدم نسخة legacy عمدًا: النسخة العادية تعتمد على دوال جافاسكربت حديثة جدًا
  // (مثل Uint8Array.toHex) مش موجودة في كروم الأقدم/تابلت أندرويد، وبتفشل بخطأ
  // "toHex is not a function". نسخة legacy فيها polyfills لده.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
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
  /** صورة الصفحة (JPEG) كـ Blob — بتتخزن في IndexedDB مش في localStorage. */
  image: Blob;
}

export interface PdfImportOptions {
  onProgress?: (done: number, total: number) => void;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("تعذّر تحويل الصفحة لصورة")),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export class PdfImportError extends Error {}

export async function importPdfPages(
  file: File,
  options: PdfImportOptions = {}
): Promise<ImportedPdfPage[]> {
  let pdfjs: Awaited<ReturnType<typeof getPdfjs>>;
  try {
    pdfjs = await getPdfjs();
  } catch (error) {
    console.error("[pdf] تعذّر تحميل pdfjs", error);
    throw new PdfImportError(
      "تعذّر تحميل أداة قراءة PDF. تأكد من اتصالك بالإنترنت وحاول مجددًا."
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    console.error("[pdf] تعذّرت قراءة الملف", error);
    throw new PdfImportError("تعذّرت قراءة الملف المختار.");
  }

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: buffer }).promise;
  } catch (error) {
    const errorName = (error as Error)?.name;
    console.error("[pdf] getDocument فشل:", errorName, (error as Error)?.message);
    if (errorName === "PasswordException") {
      throw new PdfImportError(
        "الملف محمي بكلمة مرور. أزل الحماية منه أولًا ثم استورده."
      );
    }
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
      if (!ctx) throw new Error("تعذّر إنشاء سطح الرسم");

      await page.render({ canvasContext: ctx, canvas, viewport: renderViewport })
        .promise;

      const image = await canvasToBlob(canvas);
      // نحرّر ذاكرة الكانفا فورًا: على التابلت تجميع كانفاسات مرسومة هو اللي
      // كان بيقفل المتصفح مع الملفات الطويلة.
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      pages.push({
        width: basePoints.width,
        height: basePoints.height,
        image,
      });
      options.onProgress?.(pageNumber, doc.numPages);

      // تنفّس بين كل صفحة وأخرى حتى لا يتجمّد المتصفح أو يعتبر الصفحة
      // متوقفة عن الاستجابة أثناء معالجة ملفات كبيرة.
      await nextFrame();
    } catch (error) {
      console.error(`[pdf] فشلت معالجة الصفحة ${pageNumber}`, error);
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
