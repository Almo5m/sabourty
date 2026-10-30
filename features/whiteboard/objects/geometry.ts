/** دوال هندسية صغيرة مشتركة بين العقد والروابط. بدون أي اعتماد على فابريك. */

export interface Pt {
  x: number;
  y: number;
}

export type Side = "top" | "right" | "bottom" | "left";

export const SIDES: Side[] = ["top", "right", "bottom", "left"];

/** اتجاه الخروج الطبيعي من كل ضلع (متجه وحدة). */
export const SIDE_NORMAL: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });

export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });

export const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** أقرب محور (أحد الاتجاهات الأربعة) لمتجه معيّن. */
export function nearestAxis(v: Pt): Pt {
  if (Math.abs(v.x) >= Math.abs(v.y)) return { x: Math.sign(v.x) || 1, y: 0 };
  return { x: 0, y: Math.sign(v.y) || 1 };
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function boundsOf(points: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** يزيل النقاط المتكررة والنقاط الواقعة على استقامة واحدة من مسار متعدد الخطوط. */
export function simplifyPolyline(points: Pt[]): Pt[] {
  const unique = points.filter(
    (p, i) => i === 0 || distance(p, points[i - 1]) > 0.5
  );
  return unique.filter((p, i) => {
    if (i === 0 || i === unique.length - 1) return true;
    const a = unique[i - 1];
    const b = unique[i + 1];
    const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x);
    return Math.abs(cross) > 0.01;
  });
}
