export type ToolType =
  | "select"
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

export const PRESET_COLORS = [
  "#0f172a",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ffffff",
];
