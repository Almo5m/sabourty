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
  backgroundDataUrl?: string;
}

export type BoardMode = "freeform" | "pdf";

export interface BoardData {
  id: string;
  name: string;
  canvasJSON: unknown;
  mode: BoardMode;
  pdfPages: PdfPageState[];
  currentPageIndex: number;
  createdAt: string;
  updatedAt: string;
}
