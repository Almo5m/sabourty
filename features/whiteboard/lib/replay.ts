import * as fabric from "fabric";

/** لقطة من جلسة الرسم (بتتسجل مع كل تعديل على اللوحة). */
export interface SessionStep {
  json: unknown;
  t: number;
  pageIndex: number;
  width: number;
  height: number;
}

interface ReplayOptions {
  canvas: fabric.Canvas;
  steps: SessionStep[];
  speed: 1 | 2 | 4;
  isCancelled: () => boolean;
  /** بعد كل تحميل لقطة (loadFromJSON بيمسح الخلفية فلازم نعيد تطبيقها) */
  afterLoad: () => void;
  /** أقصى مدة إجمالية للإعادة */
  maxTotalMs?: number;
  /** قبل تحميل كل لقطة (بتمسح الكانفا لحظيًا) وبعد ما تترسم: لتجميد التسجيل ومنع الوميض */
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
}

type JsonObject = { id?: string; type?: string; path?: unknown };
type Tagged = fabric.Object & { id?: string };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const objectsOf = (json: unknown): JsonObject[] => {
  const objs = (json as { objects?: JsonObject[] } | null)?.objects;
  return Array.isArray(objs) ? objs : [];
};

/** مفتاح العنصر: المعرّف لو موجود، وإلا ترتيبه (للوحات القديمة بدون معرّفات). */
const keyOf = (o: { id?: string }, index: number) => o.id ?? `idx:${index}`;

function pathLength(commands: unknown): number {
  try {
    const info = fabric.util.getPathSegmentsInfo(
      commands as Parameters<typeof fabric.util.getPathSegmentsInfo>[0]
    );
    return info.length ? info[info.length - 1].length : 0;
  } catch {
    return 0;
  }
}

interface PlannedStep {
  step: SessionStep;
  added: Set<string>;
  animMs: number;
  pauseMs: number;
}

function planSteps(steps: SessionStep[]): PlannedStep[] {
  return steps.map((step, i) => {
    const prevKeys = new Set(
      i === 0 ? [] : objectsOf(steps[i - 1].json).map((o, idx) => keyOf(o, idx))
    );
    const added = new Set<string>();
    let longestPath = 0;
    objectsOf(step.json).forEach((o, idx) => {
      const k = keyOf(o, idx);
      if (prevKeys.has(k)) return;
      added.add(k);
      if (o.type?.toLowerCase() === "path") {
        longestPath = Math.max(longestPath, pathLength(o.path));
      }
    });

    // الخط بيترسم بسرعة تتناسب مع طوله، والقوالب (عناصر كتير) بتظهر بالتتابع
    let animMs = 0;
    if (added.size > 1) animMs = clamp(350 + added.size * 25, 500, 1500);
    else if (added.size === 1) animMs = longestPath > 0 ? clamp(longestPath * 1.6, 260, 1400) : 380;

    // وقت التفكير الحقيقي بين الخطوات بيتقصّر جدًا (الإعادة مش لازم تستنى زي ما انت استنيت)
    const delta = i === 0 ? 0 : step.t - steps[i - 1].t;
    const pauseMs = i === 0 ? 450 : clamp(delta * 0.25, 220, 750);
    return { step, added, animMs, pauseMs };
  });
}

function animateIn(
  canvas: fabric.Canvas,
  objs: fabric.Object[],
  totalMs: number,
  isCancelled: () => boolean
): Promise<void> {
  if (objs.length === 0 || totalMs <= 0) return Promise.resolve();

  const n = objs.length;
  const stagger = n > 1 ? (totalMs * 0.6) / n : 0;
  const each = Math.max(n > 1 ? totalMs * 0.4 : totalMs, 120);

  const jobs = objs.map((obj, i) => {
    const isPath = obj.type === "path";
    const target = obj.opacity ?? 1;
    const len = isPath ? pathLength((obj as fabric.Path).path) + 2 : 0;

    // الحالة الابتدائية: مخفي (الخط بيتكشف تدريجيًا بتحريك الشرطة، والباقي بيظهر بالتدرّج)
    if (isPath && len > 2) {
      obj.set({ strokeDashArray: [len, len], strokeDashOffset: len });
    } else {
      obj.set({ opacity: 0 });
    }

    return new Promise<void>((resolve) => {
      const failSafe = setTimeout(resolve, i * stagger + each + 600);
      const finish = () => {
        clearTimeout(failSafe);
        if (isPath && len > 2) obj.set({ strokeDashArray: null, strokeDashOffset: 0 });
        else obj.set({ opacity: target });
        canvas.requestRenderAll();
        resolve();
      };
      setTimeout(() => {
        if (isCancelled()) return finish();
        fabric.util.animate({
          startValue: 0,
          endValue: 1,
          duration: each,
          easing: fabric.util.ease.easeOutQuad,
          onChange: (v) => {
            if (isPath && len > 2) obj.set({ strokeDashOffset: len * (1 - v) });
            else obj.set({ opacity: target * v });
            canvas.requestRenderAll();
          },
          onComplete: finish,
          abort: () => isCancelled(),
        });
      }, i * stagger);
    });
  });

  return Promise.all(jobs).then(() => undefined);
}

/** يعيد تشغيل الجلسة خطوة بخطوة على الكانفا (والتسجيل شغال بيلتقطها). */
export async function playSessionReplay({
  canvas,
  steps,
  speed,
  isCancelled,
  afterLoad,
  maxTotalMs = 120000,
  onLoadStart,
  onLoadEnd,
}: ReplayOptions): Promise<void> {
  const plan = planSteps(steps);

  const raw = plan.reduce((sum, p) => sum + p.animMs + p.pauseMs, 0) / speed;
  const compress = raw > maxTotalMs ? maxTotalMs / raw : 1;
  const k = compress / speed;

  const loadSafely = (json: unknown) =>
    Promise.race([
      canvas.loadFromJSON(json as Record<string, unknown>).then(() => undefined),
      wait(3000), // خطوة واحدة عالقة ما توقفش الإعادة كلها
    ]);

  for (const p of plan) {
    if (isCancelled()) return;

    if (
      canvas.getWidth() !== p.step.width ||
      canvas.getHeight() !== p.step.height
    ) {
      canvas.setDimensions({ width: p.step.width, height: p.step.height });
    }

    let animation: Promise<void> = Promise.resolve();
    onLoadStart?.();
    try {
      await loadSafely(p.step.json);
      afterLoad();

      const live = canvas
        .getObjects()
        .filter((o, idx) => p.added.has(keyOf(o as Tagged, idx)));
      // animateIn بتضبط الحالة الابتدائية (مخفي) فورًا، فنرسم قبل ما نفك التجميد
      animation = animateIn(canvas, live, p.animMs * k, isCancelled);
      canvas.renderAll();
    } finally {
      onLoadEnd?.();
    }

    await animation;
    await wait(p.pauseMs * k);
  }
}
