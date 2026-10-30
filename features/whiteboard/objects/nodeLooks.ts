import * as fabric from "fabric";

/**
 * مظاهر العقدة. "plain" هو الشكل العادي (تعبئة + حد). الباقي مظاهر ملاحظات:
 * بتتغيّر بضغطة من غير ما النص أو الحجم يتأثروا.
 */
export type NodeLook = "plain" | "sticky" | "card" | "flat" | "outline" | "tape";

export const NOTE_LOOKS: { id: NodeLook; label: string }[] = [
  { id: "sticky", label: "لاصقة" },
  { id: "card", label: "بطاقة" },
  { id: "flat", label: "مسطّحة" },
  { id: "outline", label: "إطار" },
  { id: "tape", label: "بشريط" },
];

/** ألوان الملاحظات: باستيل هادي، كل لون معاه نسخة أغمق للتمييز (الإطار/الشريط). */
export const NOTE_COLORS: { fill: string; accent: string; label: string }[] = [
  { fill: "#fdf0c4", accent: "#e8b229", label: "أصفر" },
  { fill: "#d6efe3", accent: "#1f8a6e", label: "أخضر" },
  { fill: "#d9e7fb", accent: "#2f68d8", label: "أزرق" },
  { fill: "#fbdbe6", accent: "#d1427f", label: "وردي" },
  { fill: "#fde2cc", accent: "#e07a2f", label: "برتقالي" },
  { fill: "#e5dcfa", accent: "#5a4fcf", label: "بنفسجي" },
  { fill: "#ffffff", accent: "#5d6470", label: "أبيض" },
  { fill: "#e9e5d8", accent: "#8a826c", label: "رمادي" },
];

export const NODE_INK = "#211f1a";

export type ElevationLevel = 0 | 1 | 2;

export const ELEVATION_SHADOW: Record<
  ElevationLevel,
  { color: string; blur: number; offsetY: number } | null
> = {
  0: null,
  1: { color: "rgba(33, 31, 26, 0.14)", blur: 8, offsetY: 2 },
  2: { color: "rgba(33, 31, 26, 0.22)", blur: 16, offsetY: 6 },
};

/** الظل الافتراضي لكل مظهر. */
export const LOOK_ELEVATION: Record<NodeLook, ElevationLevel> = {
  plain: 0,
  sticky: 2,
  card: 1,
  flat: 0,
  outline: 0,
  tape: 2,
};

function colorSource(color: string): [number, number, number, number] | null {
  try {
    return new fabric.Color(color).getSource() as [
      number,
      number,
      number,
      number,
    ];
  } catch {
    return null;
  }
}

export function isTransparentColor(color: string | null | undefined): boolean {
  if (!color) return true;
  const source = colorSource(color);
  return !source || source[3] === 0;
}

/** لون نص مقروء فوق خلفية معيّنة (فاتح فوق الغامق، وغامق فوق الفاتح). */
export function contrastText(background: string): string {
  const source = colorSource(background);
  if (!source) return NODE_INK;
  const [r, g, b] = source;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? NODE_INK : "#ffffff";
}

/** يغمّق لون بنسبة معيّنة (0..1). */
export function darken(color: string, amount: number): string {
  const source = colorSource(color);
  if (!source) return color;
  const [r, g, b, a] = source;
  const k = 1 - amount;
  return `rgba(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)}, ${a})`;
}

export function withAlpha(color: string, alpha: number): string {
  const source = colorSource(color);
  if (!source) return color;
  return `rgba(${source[0]}, ${source[1]}, ${source[2]}, ${alpha})`;
}
