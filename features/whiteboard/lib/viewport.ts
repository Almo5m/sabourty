import * as fabric from "fabric";

/**
 * التحكم في عرض الكانفا (تكبير/تصغير/تحريك).
 *
 * في وضع PDF الكانفا بتملى الشاشة كلها، والصفحة مستطيل في إحداثيات المشهد
 * (0,0 → عرض,ارتفاع). "ملاءمة الصفحة" = ضبط viewportTransform بحيث الصفحة كلها
 * تظهر في المساحة الفاضية بين الأشرطة.
 */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export interface SceneRect {
  width: number;
  height: number;
}

export interface ViewInsets {
  top: number;
  bottom: number;
  side: number;
}

export const clampZoom = (zoom: number) =>
  Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

/** يحسب أنسب تكبير بحيث الصفحة كلها تظهر داخل الحواف المحددة. */
export function computeFitZoom(
  canvasSize: SceneRect,
  page: SceneRect,
  insets: ViewInsets
): number {
  const availableWidth = Math.max(canvasSize.width - insets.side * 2, 80);
  const availableHeight = Math.max(
    canvasSize.height - insets.top - insets.bottom,
    80
  );
  return clampZoom(
    Math.min(availableWidth / page.width, availableHeight / page.height)
  );
}

/** يضبط الصفحة في منتصف المساحة المتاحة بأكبر حجم يسمح بظهورها كاملة. */
export function fitPageToCanvas(
  canvas: fabric.Canvas,
  page: SceneRect,
  insets: ViewInsets
): number {
  const size = { width: canvas.getWidth(), height: canvas.getHeight() };
  const zoom = computeFitZoom(size, page, insets);
  const left = (size.width - page.width * zoom) / 2;
  const top =
    insets.top + (size.height - insets.top - insets.bottom - page.height * zoom) / 2;
  canvas.setViewportTransform([zoom, 0, 0, zoom, left, top]);
  canvas.requestRenderAll();
  return zoom;
}

/**
 * يمنع الصفحة من الضياع خارج الشاشة: لو الصفحة أصغر من الشاشة بتتثبّت في
 * النص، ولو أكبر (مكبّرة) تقدر تتحرك جواها بس مع هامش صغير.
 */
export function constrainViewportToPage(
  canvas: fabric.Canvas,
  page: SceneRect,
  insets: ViewInsets,
  margin = 40
) {
  const vpt = canvas.viewportTransform;
  const zoom = vpt[0];
  const pageW = page.width * zoom;
  const pageH = page.height * zoom;
  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();

  const clampAxis = (
    position: number,
    pageSize: number,
    canvasSize: number,
    startInset: number,
    endInset: number
  ) => {
    const free = canvasSize - startInset - endInset;
    if (pageSize <= free) return startInset + (free - pageSize) / 2;
    const max = startInset + margin;
    const min = canvasSize - endInset - pageSize - margin;
    return Math.min(Math.max(position, min), max);
  };

  const next = [...vpt] as fabric.TMat2D;
  next[4] = clampAxis(vpt[4], pageW, canvasW, insets.side, insets.side);
  next[5] = clampAxis(vpt[5], pageH, canvasH, insets.top, insets.bottom);
  if (next[4] !== vpt[4] || next[5] !== vpt[5]) {
    canvas.setViewportTransform(next);
  }
}

/** يصدّر منطقة من المشهد (مثلًا الصفحة كلها) بغض النظر عن التكبير الحالي. */
export function exportSceneRect(
  canvas: fabric.Canvas,
  rect: SceneRect,
  options: { format: "png" | "jpeg"; multiplier: number; quality?: number }
): string {
  const saved = [...canvas.viewportTransform] as fabric.TMat2D;
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  try {
    return canvas.toDataURL({
      format: options.format,
      quality: options.quality,
      multiplier: options.multiplier,
      left: 0,
      top: 0,
      width: rect.width,
      height: rect.height,
    });
  } finally {
    canvas.setViewportTransform(saved);
    canvas.requestRenderAll();
  }
}
