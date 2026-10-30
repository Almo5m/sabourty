import { Pt, Side } from "./geometry";

/**
 * أشكال العقد. العقدة الواحدة (شكل / ملاحظة / عقدة خريطة ذهنية) ليها هندسة
 * (`shape`) ومظهر (`look`) منفصلين: تقدر تغيّر شكل الملاحظة أو مظهر الشكل
 * من غير ما تمس النص.
 */
export type NodeShape =
  | "rect"
  | "rounded"
  | "pill"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "parallelogram"
  | "star";

export const NODE_SHAPES: { id: NodeShape; label: string }[] = [
  { id: "rect", label: "مستطيل" },
  { id: "rounded", label: "مستطيل مدوّر" },
  { id: "pill", label: "كبسولة" },
  { id: "ellipse", label: "دائرة / بيضاوي" },
  { id: "diamond", label: "معيّن" },
  { id: "triangle", label: "مثلث" },
  { id: "hexagon", label: "سداسي" },
  { id: "parallelogram", label: "متوازي أضلاع" },
  { id: "star", label: "نجمة" },
];

const SKEW = 0.2;

/** نقاط الشكل كنسب (0..1) من عرض وارتفاع الإطار، للأشكال متعددة الأضلاع. */
function polygonRatios(shape: NodeShape): Pt[] | null {
  switch (shape) {
    case "diamond":
      return [
        { x: 0.5, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 0, y: 0.5 },
      ];
    case "triangle":
      return [
        { x: 0.5, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
    case "hexagon":
      return [
        { x: 0.25, y: 0 },
        { x: 0.75, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.75, y: 1 },
        { x: 0.25, y: 1 },
        { x: 0, y: 0.5 },
      ];
    case "parallelogram":
      return [
        { x: SKEW, y: 0 },
        { x: 1, y: 0 },
        { x: 1 - SKEW, y: 1 },
        { x: 0, y: 1 },
      ];
    case "star": {
      const points: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 0.5 : 0.21;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push({
          x: 0.5 + radius * Math.cos(angle) * 1,
          y: 0.5 + radius * Math.sin(angle) * 1,
        });
      }
      return points;
    }
    default:
      return null;
  }
}

/** يرسم مسار الشكل (بدون تعبئة أو حد) داخل المستطيل x,y,w,h. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  w: number,
  h: number,
  cornerRadius: number
) {
  ctx.beginPath();

  if (shape === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  if (shape === "rect" || shape === "rounded" || shape === "pill") {
    const maxRadius = Math.min(w, h) / 2;
    const radius =
      shape === "pill" ? maxRadius : Math.min(Math.max(cornerRadius, 0), maxRadius);
    if (radius <= 0) {
      ctx.rect(x, y, w, h);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
    }
    ctx.closePath();
    return;
  }

  const ratios = polygonRatios(shape);
  if (!ratios) return;
  ratios.forEach((p, i) => {
    const px = x + p.x * w;
    const py = y + p.y * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

/** المنطقة الداخلية الآمنة للنص (كنسب من الإطار) حتى ما يطلعش برّه حدود الشكل. */
export function textArea(shape: NodeShape): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (shape) {
    case "ellipse":
      return { x: 0.14, y: 0.14, w: 0.72, h: 0.72 };
    case "diamond":
      return { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    case "triangle":
      return { x: 0.2, y: 0.36, w: 0.6, h: 0.56 };
    case "hexagon":
      return { x: 0.14, y: 0.06, w: 0.72, h: 0.88 };
    case "parallelogram":
      return { x: 0.2, y: 0.04, w: 0.6, h: 0.92 };
    case "star":
      return { x: 0.22, y: 0.32, w: 0.56, h: 0.42 };
    case "pill":
      return { x: 0.06, y: 0, w: 0.88, h: 1 };
    default:
      return { x: 0, y: 0, w: 1, h: 1 };
  }
}

/**
 * نقطة الربط على كل ضلع (إحداثيات محلية من مركز الشكل) — بتقع دايمًا على حدود
 * الشكل الفعلية، مش على إطاره، عشان الرابط يلمس الشكل مش الهوا اللي حواليه.
 */
export function sideAnchor(
  shape: NodeShape,
  side: Side,
  w: number,
  h: number
): Pt {
  const hw = w / 2;
  const hh = h / 2;
  const frame: Record<Side, Pt> = {
    top: { x: 0, y: -hh },
    right: { x: hw, y: 0 },
    bottom: { x: 0, y: hh },
    left: { x: -hw, y: 0 },
  };

  if (shape === "triangle") {
    if (side === "left") return { x: -w / 4, y: 0 };
    if (side === "right") return { x: w / 4, y: 0 };
  }
  if (shape === "parallelogram") {
    const skew = SKEW * w;
    if (side === "top") return { x: skew / 2, y: -hh };
    if (side === "bottom") return { x: -skew / 2, y: hh };
    if (side === "left") return { x: -hw + skew / 2, y: 0 };
    if (side === "right") return { x: hw - skew / 2, y: 0 };
  }
  if (shape === "star") {
    if (side === "bottom") return { x: 0, y: hh * 0.62 };
    if (side === "left") return { x: -hw * 0.9, y: -hh * 0.1 };
    if (side === "right") return { x: hw * 0.9, y: -hh * 0.1 };
  }
  return frame[side];
}
