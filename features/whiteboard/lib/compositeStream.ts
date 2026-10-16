import type * as fabric from "fabric";

export interface CompositeStream {
  stream: MediaStream;
  /** الكانفا الوسيط نفسه (بيتستخدم في الاختبارات لفحص المحتوى قبل التشفير) */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** يجمّد التقاط الإطار (الفيديو يكمّل بآخر إطار سليم) — بنستخدمه وقت تحميل لقطة بتمسح الكانفا لحظيًا */
  setPaused: (paused: boolean) => void;
  stop: () => void;
}

interface Options {
  fps?: number;
  /** لون الخلفية الاحتياطي لو في أي شفافية */
  background?: string;
  /** أقصى بُعد للفيديو بالبكسل (لحماية التابلت من ترميز حجم ضخم) */
  maxSide?: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * فابريك بيرسم على كانفاسين فوق بعض:
 *  - السفلي: العناصر المكتملة
 *  - العلوي: الخط وهو لسه بيترسم + مقابض التحديد
 *
 * لو سجّلنا السفلي بس (زي ما كنا بنعمل)، فيديو الرسم الحي بيظهر "شرايح": الخط
 * مبيظهرش غير بعد ما ترفع القلم، وكمان الكانفا مبتتحدّثش كتير فالإطارات قليلة جدًا.
 *
 * الحل: كانفا وسيط بنرسم فيه الاتنين كل إطار، ونسجّله هو بمعدل ثابت.
 */
export function createCompositeStream(
  canvas: fabric.Canvas,
  { fps = 30, background = "#ffffff", maxSide = 1280 }: Options = {}
): CompositeStream {
  const lower = canvas.lowerCanvasEl;
  const upper = canvas.upperCanvasEl;

  const scale = Math.min(1, maxSide / Math.max(lower.width, lower.height));
  const width = even(lower.width * scale);
  const height = even(lower.height * scale);

  const comp = document.createElement("canvas");
  comp.width = width;
  comp.height = height;
  const ctx = comp.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("تعذّر إنشاء كانفا التسجيل");

  let raf = 0;
  let running = true;
  let paused = false;

  const draw = () => {
    if (!running) return;
    if (!paused) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(lower, 0, 0, width, height);
      ctx.drawImage(upper, 0, 0, width, height);
    }
    raf = requestAnimationFrame(draw);
  };
  draw();

  const stream = comp.captureStream(fps);

  return {
    stream,
    canvas: comp,
    width,
    height,
    setPaused: (value) => {
      paused = value;
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
