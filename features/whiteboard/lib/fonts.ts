import catalog from "../data/google-fonts.json";
import { DEFAULT_FONT_FAMILY } from "../objects/node";

/**
 * خطوط جوجل (1900+ خط). الكتالوج المحلي (data/google-fonts.json) بيحتوي الأسماء
 * بس؛ ملف الخط نفسه بيتحمّل من Google Fonts وقت الاستخدام فقط (مش كلهم مرة واحدة).
 */

export type FontCategory = "sans" | "serif" | "display" | "handwriting" | "mono";

export interface FontInfo {
  family: string;
  category: FontCategory;
  arabic: boolean;
  hasBold: boolean;
  hasItalic: boolean;
}

const CATEGORY: Record<string, FontCategory> = {
  s: "sans",
  f: "serif",
  d: "display",
  h: "handwriting",
  m: "mono",
};

export const FONTS: FontInfo[] = (catalog as [string, string, number][]).map(
  ([family, category, flags]) => ({
    family,
    category: CATEGORY[category] ?? "sans",
    arabic: (flags & 1) !== 0,
    hasBold: (flags & 2) !== 0,
    hasItalic: (flags & 4) !== 0,
  })
);

const BY_FAMILY = new Map(FONTS.map((font) => [font.family, font]));

export const getFontInfo = (family: string) => BY_FAMILY.get(family);

/** الخط الافتراضي للنظام (بيشتغل أوفلاين). */
export const SYSTEM_FONT = { family: DEFAULT_FONT_FAMILY, label: "خط النظام" };

/** أشهر الخطوط العربية في الأول بالترتيب ده، وبعدين باقي الخطوط العربية أبجديًا. */
const ARABIC_FEATURED = [
  "Cairo",
  "Tajawal",
  "Almarai",
  "Amiri",
  "IBM Plex Sans Arabic",
  "Noto Kufi Arabic",
  "Noto Naskh Arabic",
  "Noto Sans Arabic",
  "Readex Pro",
  "El Messiri",
  "Changa",
  "Lalezar",
  "Reem Kufi",
  "Vazirmatn",
  "Harmattan",
  "Markazi Text",
  "Mada",
  "Lateef",
  "Scheherazade New",
  "Aref Ruqaa",
  "Rakkas",
  "Baloo Bhaijaan 2",
  "Lemonada",
  "Marhey",
  "Kufam",
  "Katibeh",
  "Jomhuria",
];

export const ARABIC_FONTS: FontInfo[] = [
  ...ARABIC_FEATURED.map((name) => BY_FAMILY.get(name)).filter(
    (font): font is FontInfo => Boolean(font)
  ),
  ...FONTS.filter((f) => f.arabic && !ARABIC_FEATURED.includes(f.family)),
];

// ─────────── التحميل ───────────

const stylesheetUrl = (family: string, bold: boolean, italic: boolean) => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  let spec = "";
  if (bold && italic) spec = ":ital,wght@0,400;0,700;1,400;1,700";
  else if (bold) spec = ":wght@400;700";
  else if (italic) spec = ":ital@0;1";
  return `https://fonts.googleapis.com/css2?family=${name}${spec}&display=swap`;
};

function injectStylesheet(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const pending = new Map<string, Promise<boolean>>();

/** نص تجريبي بيخلّي المتصفح يحمّل أجزاء الخط العربي واللاتيني الصح. */
const SAMPLE = "أبجد هوز مرحبا Abc 123";

/**
 * يحمّل خط جوجل (لو مش محمّل) ويستنى لحد ما يبقى جاهز للرسم.
 * بيرجّع false لو الخط مش جوجل (مثل خط النظام) أو فشل التحميل (أوفلاين مثلًا).
 */
export function loadFont(family: string): Promise<boolean> {
  const info = BY_FAMILY.get(family);
  if (!info || typeof document === "undefined") return Promise.resolve(false);
  const existing = pending.get(family);
  if (existing) return existing;

  const promise = (async () => {
    try {
      injectStylesheet(
        `gf-${family.replace(/\W+/g, "-")}`,
        stylesheetUrl(family, info.hasBold, info.hasItalic)
      );
      const variants = ["400"];
      if (info.hasBold) variants.push("700");
      await Promise.all(
        variants.flatMap((weight) => [
          document.fonts.load(`${weight} 16px "${family}"`, SAMPLE),
          ...(info.hasItalic
            ? [document.fonts.load(`italic ${weight} 16px "${family}"`, SAMPLE)]
            : []),
        ])
      );
      return document.fonts.check(`16px "${family}"`, SAMPLE);
    } catch {
      pending.delete(family);
      return false;
    }
  })();
  pending.set(family, promise);
  return promise;
}

const previewed = new Set<string>();

/** يحمّل نسخة صغيرة جدًا من الخط (حروف اسمه بس) لعرضه في قائمة الاختيار. */
export function loadFontPreview(family: string) {
  if (typeof document === "undefined" || previewed.has(family)) return;
  previewed.add(family);
  const info = BY_FAMILY.get(family);
  const text = encodeURIComponent(info?.arabic ? `${family} أبجد` : family);
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  injectStylesheet(
    `gfp-${family.replace(/\W+/g, "-")}`,
    `https://fonts.googleapis.com/css2?family=${name}&text=${text}&display=swap`
  );
}

export const CATEGORY_LABELS: Record<FontCategory | "arabic" | "all", string> = {
  all: "الكل",
  arabic: "عربي",
  sans: "سان سيريف",
  serif: "سيريف",
  display: "عناوين",
  handwriting: "خط يد",
  mono: "أحادي",
};
