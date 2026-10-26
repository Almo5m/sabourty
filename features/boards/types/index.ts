export interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail: string | null;
}

export interface PdfPageState {
  width: number;
  height: number;
  json: unknown;
  /**
   * قديم: كانت صورة الصفحة بتتخزن هنا كنص داخل localStorage. دلوقتي بتتخزن في
   * IndexedDB (`pageImageStorage`)، والحقل ده بيتقرأ بس عشان ترحيل اللوحات القديمة.
   */
  backgroundDataUrl?: string;
}

export type BoardMode = "freeform" | "pdf";

/** إعدادات مظهر اللوحة (الخلفية والشبكة) — تخص كل لوحة لوحدها. */
export interface BoardCanvasSettings {
  background: string;
  grid: "auto" | "dots" | "lines" | "none";
}

export interface BoardData {
  id: string;
  name: string;
  canvasJSON: unknown;
  mode: BoardMode;
  pdfPages: PdfPageState[];
  currentPageIndex: number;
  settings?: BoardCanvasSettings;
  createdAt: string;
  updatedAt: string;
}
