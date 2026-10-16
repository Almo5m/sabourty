import * as fabric from "fabric";

/**
 * مظهر اللوحة (الخلفية + الشبكة).
 *
 * مهم: الخلفية والشبكة بتترسم جوه الكانفا نفسه (مش CSS خلف الكانفا). لو كانت
 * الكانفا شفافة، فيديو التسجيل وصورة التصدير بيطلعوا بخلفية سودا ويختفي الحبر الغامق.
 */

export type CanvasGrid = "auto" | "dots" | "lines" | "none";

export interface CanvasSettings {
  /** لون الخلفية (hex) */
  background: string;
  /**
   * auto  = نقاط خفيفة وهي فاضية بس، وتختفي أول ما تبدأ الرسم
   * dots  = نقاط دايمًا، lines = مربعات دايمًا، none = بدون شبكة
   */
  grid: CanvasGrid;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  background: "#ffffff",
  grid: "auto",
};

export const BACKGROUND_PRESETS: { label: string; value: string }[] = [
  { label: "أبيض", value: "#ffffff" },
  { label: "ورقي", value: "#faf9f5" },
  { label: "رمادي فاتح", value: "#eceae4" },
  { label: "أزرق هادئ", value: "#eaf1f7" },
  { label: "سبورة داكنة", value: "#1f2420" },
];

export const GRID_OPTIONS: { label: string; value: CanvasGrid }[] = [
  { label: "تلقائي", value: "auto" },
  { label: "نقاط", value: "dots" },
  { label: "مربعات", value: "lines" },
  { label: "بدون", value: "none" },
];

const TILE = 24;

/** يقرر لو الخلفية داكنة (لضبط لون الحبر ولون الشبكة تلقائيًا). */
export function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/** مدخل صحيح لـ settings حتى لو البيانات المحفوظة ناقصة أو قديمة. */
export function normalizeSettings(
  raw: Partial<CanvasSettings> | undefined | null
): CanvasSettings {
  const grid = raw?.grid;
  const validGrid: CanvasGrid[] = ["auto", "dots", "lines", "none"];
  return {
    background:
      raw?.background && /^#[0-9a-f]{6}$/i.test(raw.background)
        ? raw.background
        : DEFAULT_CANVAS_SETTINGS.background,
    grid: grid && validGrid.includes(grid) ? grid : DEFAULT_CANVAS_SETTINGS.grid,
  };
}

function buildPattern(
  background: string,
  kind: "dots" | "lines"
): fabric.Pattern | null {
  if (typeof document === "undefined") return null;
  const tile = document.createElement("canvas");
  tile.width = TILE;
  tile.height = TILE;
  const ctx = tile.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, TILE, TILE);

  const dark = isDarkColor(background);
  if (kind === "dots") {
    ctx.fillStyle = dark ? "rgba(255,255,255,0.22)" : "rgba(33,31,26,0.2)";
    ctx.beginPath();
    ctx.arc(TILE / 2, TILE / 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(33,31,26,0.09)";
    ctx.fillRect(0, 0, TILE, 1);
    ctx.fillRect(0, 0, 1, TILE);
  }
  return new fabric.Pattern({ source: tile, repeat: "repeat" });
}

export interface AppearanceContext {
  hasObjects: boolean;
  /** في وضع PDF الخلفية بيضا دايمًا (الصفحة نفسها هي الخلفية) */
  pdf: boolean;
}

type Tracked = fabric.Canvas & { __appearanceKey?: string };

/**
 * يطبّق الخلفية والشبكة على الكانفا. آمن للنداء كتير (بيتجاهل لو مفيش تغيير).
 * لازم يتنادى تاني بعد أي `loadFromJSON` لأنه بيمسح الخلفية.
 */
export function applyCanvasAppearance(
  canvas: fabric.Canvas,
  settings: CanvasSettings,
  ctx: AppearanceContext
) {
  const background = ctx.pdf ? "#ffffff" : settings.background;
  const effectiveGrid: "dots" | "lines" | "none" = ctx.pdf
    ? "none"
    : settings.grid === "auto"
      ? ctx.hasObjects
        ? "none"
        : "dots"
      : settings.grid;

  const key = `${background}|${effectiveGrid}`;
  const tracked = canvas as Tracked;
  if (tracked.__appearanceKey === key && canvas.backgroundColor) return;

  const pattern =
    effectiveGrid === "none" ? null : buildPattern(background, effectiveGrid);
  canvas.backgroundColor = pattern ?? background;
  tracked.__appearanceKey = key;
  canvas.requestRenderAll();
}

/** الخلفية بتتحفظ في إعدادات اللوحة، مش جوه JSON العناصر (حتى ما تتضخم اللقطات). */
export function stripBackground<T extends Record<string, unknown>>(json: T): T {
  const copy = { ...json } as Record<string, unknown>;
  delete copy.background;
  return copy as T;
}
