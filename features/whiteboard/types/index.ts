export type ToolType =
  | "select"
  | "hand"
  | "pen"
  | "spray"
  | "highlighter"
  | "eraser"
  | "text"
  | "sticky"
  | "voice"
  | "rectangle"
  | "circle"
  | "triangle"
  | "line"
  | "arrow"
  | "star";

export interface ToolSettings {
  color: string;
  size: number;
  opacity: number;
}

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  icon: import("@/features/shared/icons/Icon").IconName;
  visible: boolean;
  locked: boolean;
}

export interface VoiceNoteMeta {
  objectId: string;
  audioNoteId: string;
  name: string;
  durationSeconds: number;
  recordedAt: string;
}

export interface PaletteSwatch {
  value: string;
  label: string;
}

/** ألوان الحبر: مضبوطة على هوية "الورق والحبر" — دافئة، ومفيهاش ألوان نيون. */
export const INK_PALETTE: PaletteSwatch[] = [
  { value: "#1c1b18", label: "حبر" },
  { value: "#5d6470", label: "رصاصي" },
  { value: "#c8432f", label: "طوبي" },
  { value: "#e07a2f", label: "برتقالي" },
  { value: "#e8b229", label: "عنبري" },
  { value: "#7d9a2e", label: "زيتوني" },
  { value: "#1f6f63", label: "زمردي" },
  { value: "#1b8aa0", label: "تركواز" },
  { value: "#2f68d8", label: "أزرق" },
  { value: "#5a4fcf", label: "نيلي" },
  { value: "#a14bb8", label: "بنفسجي" },
  { value: "#d1427f", label: "وردي" },
  { value: "#ffffff", label: "أبيض" },
];

/** ألوان القلم الهايلايتر: فاتحة ومشبعة عشان تبان فوق النص من غير ما تغطيه. */
export const HIGHLIGHT_PALETTE: PaletteSwatch[] = [
  { value: "#ffe14d", label: "أصفر" },
  { value: "#8de35e", label: "أخضر" },
  { value: "#ff7eb6", label: "وردي" },
  { value: "#ffa94d", label: "برتقالي" },
  { value: "#5cd3ff", label: "سماوي" },
  { value: "#c3a1ff", label: "بنفسجي" },
];

export const INK_DEFAULTS: ToolSettings = {
  color: "#1c1b18",
  size: 4,
  opacity: 1,
};

export const HIGHLIGHTER_DEFAULTS: ToolSettings = {
  color: "#ffe14d",
  size: 10,
  opacity: 0.4,
};

/** الهايلايتر ليه إعداداته المستقلة (لون/حجم/شفافية)، وباقي الأدوات بتشارك إعدادات الحبر. */
export type SettingsGroup = "ink" | "highlighter";

export const settingsGroupOf = (tool: ToolType): SettingsGroup =>
  tool === "highlighter" ? "highlighter" : "ink";

export const TOOLS_WITH_PROPERTIES: ToolType[] = [
  "pen",
  "spray",
  "highlighter",
  "text",
  "sticky",
  "rectangle",
  "circle",
  "triangle",
  "line",
  "arrow",
  "star",
];
