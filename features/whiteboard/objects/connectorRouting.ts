import {
  Pt,
  Side,
  SIDES,
  SIDE_NORMAL,
  add,
  boundsOf,
  distance,
  lerp,
  nearestAxis,
  scale,
  simplifyPolyline,
} from "./geometry";

export type RouteKind = "straight" | "elbow" | "curve";
export type HeadKind = "none" | "arrow" | "triangle" | "dot" | "diamond" | "bar";

export interface RouteEnd {
  point: Pt;
  /** اتجاه الخروج من العقدة (متجه وحدة) أو null لو الطرف حر */
  normal: Pt | null;
}

export interface RoutedPath {
  kind: "poly" | "bezier";
  /** poly: نقاط الخط المنكسر. bezier: [بداية, تحكم1, تحكم2, نهاية] */
  points: Pt[];
  /** نقاط كثيفة على المسار (للاختيار بالنقر والحدود) */
  samples: Pt[];
  /** اتجاه المسار عند البداية (بيبعد عنها) وعند النهاية (بيدخل فيها) */
  startDir: Pt;
  endDir: Pt;
}

const STUB = 24;

const normalize = (v: Pt): Pt => {
  const length = Math.hypot(v.x, v.y);
  return length < 1e-6 ? { x: 1, y: 0 } : { x: v.x / length, y: v.y / length };
};

/** أنسب ضلع في عقدة بيواجه نقطة معيّنة. */
export function bestSide(
  normals: Record<Side, Pt>,
  center: Pt,
  toward: Pt
): Side {
  const direction = normalize({ x: toward.x - center.x, y: toward.y - center.y });
  let best: Side = "right";
  let bestDot = -Infinity;
  for (const side of SIDES) {
    const n = normals[side];
    const dot = n.x * direction.x + n.y * direction.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = side;
    }
  }
  return best;
}

function bezierPoint(p: Pt[], t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
}

function polyline(points: Pt[]): RoutedPath {
  const clean = simplifyPolyline(points);
  const first = clean[0];
  const second = clean[1] ?? clean[0];
  const last = clean[clean.length - 1];
  const beforeLast = clean[clean.length - 2] ?? clean[clean.length - 1];
  return {
    kind: "poly",
    points: clean,
    samples: clean,
    startDir: normalize({ x: second.x - first.x, y: second.y - first.y }),
    endDir: normalize({ x: last.x - beforeLast.x, y: last.y - beforeLast.y }),
  };
}

function elbow(a: RouteEnd, b: RouteEnd): RoutedPath {
  const dx = b.point.x - a.point.x;
  const dy = b.point.y - a.point.y;
  const na = a.normal ? nearestAxis(a.normal) : nearestAxis({ x: dx, y: dy });
  // الطرف الحر بيدخل في اتجاه معاكس لمحور الطرف الأول عشان الشكل يطلع طبيعي
  const nb = b.normal ? nearestAxis(b.normal) : { x: -na.x, y: -na.y };

  const start = a.point;
  const end = b.point;
  const s = a.normal ? add(start, scale(na, STUB)) : start;
  const e = b.normal ? add(end, scale(nb, STUB)) : end;

  const horizontalA = na.x !== 0;
  const horizontalB = nb.x !== 0;
  const mid: Pt[] = [];

  if (horizontalA && horizontalB) {
    const mx = (s.x + e.x) / 2;
    mid.push({ x: mx, y: s.y }, { x: mx, y: e.y });
  } else if (!horizontalA && !horizontalB) {
    const my = (s.y + e.y) / 2;
    mid.push({ x: s.x, y: my }, { x: e.x, y: my });
  } else if (horizontalA) {
    mid.push({ x: e.x, y: s.y });
  } else {
    mid.push({ x: s.x, y: e.y });
  }

  const points = [start];
  if (a.normal) points.push(s);
  points.push(...mid);
  if (b.normal) points.push(e);
  points.push(end);
  return polyline(points);
}

function curve(a: RouteEnd, b: RouteEnd): RoutedPath {
  const span = distance(a.point, b.point);
  const reach = Math.max(36, span * 0.42);
  const toB = normalize({ x: b.point.x - a.point.x, y: b.point.y - a.point.y });
  const out = a.normal ?? toB;
  const into = b.normal ?? { x: -toB.x, y: -toB.y };
  const c1 = add(a.point, scale(out, reach));
  const c2 = add(b.point, scale(into, reach));
  const points = [a.point, c1, c2, b.point];
  const samples: Pt[] = [];
  for (let i = 0; i <= 28; i++) samples.push(bezierPoint(points, i / 28));
  return {
    kind: "bezier",
    points,
    samples,
    startDir: normalize({ x: c1.x - a.point.x, y: c1.y - a.point.y }),
    endDir: normalize({ x: b.point.x - c2.x, y: b.point.y - c2.y }),
  };
}

export function routeConnector(a: RouteEnd, b: RouteEnd, kind: RouteKind): RoutedPath {
  if (kind === "elbow") return elbow(a, b);
  if (kind === "curve") return curve(a, b);
  return polyline([a.point, b.point]);
}

export function headSize(strokeWidth: number): number {
  return Math.max(11, strokeWidth * 4.2);
}

/** الرؤوس المصمتة بتقصّر الخط عشان طرفه ما يبرزش من الرأس. */
export function headRetraction(kind: HeadKind, strokeWidth: number): number {
  if (kind === "triangle" || kind === "diamond") return headSize(strokeWidth) * 0.9;
  if (kind === "dot") return headSize(strokeWidth) * 0.5;
  return 0;
}

/** يرسم رأس السهم. dir = اتجاه الحركة داخل الرأس (من الخط ناحية الطرف). */
export function drawHead(
  ctx: CanvasRenderingContext2D,
  kind: HeadKind,
  tip: Pt,
  dir: Pt,
  strokeWidth: number,
  color: string
) {
  if (kind === "none") return;
  const size = headSize(strokeWidth);
  const normal = { x: -dir.y, y: dir.x };
  const back = (k: number) => add(tip, scale(dir, -k));
  const side = (p: Pt, k: number) => add(p, scale(normal, k));

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  if (kind === "arrow") {
    const base = back(size);
    ctx.moveTo(side(base, size * 0.55).x, side(base, size * 0.55).y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(side(base, -size * 0.55).x, side(base, -size * 0.55).y);
    ctx.stroke();
  } else if (kind === "triangle") {
    const base = back(size);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(side(base, size * 0.5).x, side(base, size * 0.5).y);
    ctx.lineTo(side(base, -size * 0.5).x, side(base, -size * 0.5).y);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "diamond") {
    const mid = back(size * 0.55);
    const tail = back(size * 1.1);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(side(mid, size * 0.4).x, side(mid, size * 0.4).y);
    ctx.lineTo(tail.x, tail.y);
    ctx.lineTo(side(mid, -size * 0.4).x, side(mid, -size * 0.4).y);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "dot") {
    const center = back(size * 0.4);
    ctx.arc(center.x, center.y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "bar") {
    const a = side(tip, size * 0.55);
    const b = side(tip, -size * 0.55);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** الحدود التقريبية لمسار + رؤوسه. */
export function routedBounds(path: RoutedPath, pad: number) {
  const b = boundsOf(path.samples);
  return {
    minX: b.minX - pad,
    minY: b.minY - pad,
    maxX: b.maxX + pad,
    maxY: b.maxY + pad,
  };
}

export { SIDE_NORMAL, lerp };
