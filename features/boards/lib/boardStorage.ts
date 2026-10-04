import { BoardData, BoardMode, BoardSummary, PdfPageState } from "../types";

const INDEX_KEY = "sabourty:boards:index";
const boardKey = (id: string) => `sabourty:board:${id}`;

function readIndex(): BoardSummary[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BoardSummary[];
  } catch {
    return [];
  }
}

function writeIndex(index: BoardSummary[]) {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function normalize(board: BoardData): BoardData {
  return {
    ...board,
    mode: board.mode ?? "freeform",
    pdfPages: board.pdfPages ?? [],
    currentPageIndex: board.currentPageIndex ?? 0,
  };
}

export function listBoards(): BoardSummary[] {
  return readIndex().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function createBoard(name: string): BoardData {
  const now = new Date().toISOString();
  const board: BoardData = {
    id: crypto.randomUUID(),
    name,
    canvasJSON: null,
    mode: "freeform",
    pdfPages: [],
    currentPageIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
  const index = readIndex();
  index.push({
    id: board.id,
    name: board.name,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    thumbnail: null,
  });
  writeIndex(index);
  window.localStorage.setItem(boardKey(board.id), JSON.stringify(board));
  return board;
}

export function getBoard(id: string): BoardData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(boardKey(id));
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw) as BoardData);
  } catch {
    return null;
  }
}

export function saveBoard(
  id: string,
  updates: {
    canvasJSON?: unknown;
    mode?: BoardMode;
    pdfPages?: PdfPageState[];
    currentPageIndex?: number;
  },
  thumbnail: string | null
) {
  const board = getBoard(id);
  if (!board) return;
  const now = new Date().toISOString();
  const updated: BoardData = { ...board, ...updates, updatedAt: now };
  window.localStorage.setItem(boardKey(id), JSON.stringify(updated));

  const index = readIndex();
  const entry = index.find((b) => b.id === id);
  if (entry) {
    entry.updatedAt = now;
    entry.thumbnail = thumbnail;
    writeIndex(index);
  }
}

export function renameBoard(id: string, name: string) {
  const board = getBoard(id);
  if (!board) return;
  const now = new Date().toISOString();
  window.localStorage.setItem(
    boardKey(id),
    JSON.stringify({ ...board, name, updatedAt: now })
  );
  const index = readIndex();
  const entry = index.find((b) => b.id === id);
  if (entry) {
    entry.name = name;
    entry.updatedAt = now;
    writeIndex(index);
  }
}

export function duplicateBoard(id: string): BoardData | null {
  const board = getBoard(id);
  if (!board) return null;
  const now = new Date().toISOString();
  const copy: BoardData = {
    ...board,
    id: crypto.randomUUID(),
    name: `${board.name} (نسخة)`,
    createdAt: now,
    updatedAt: now,
  };
  const index = readIndex();
  index.push({
    id: copy.id,
    name: copy.name,
    createdAt: copy.createdAt,
    updatedAt: copy.updatedAt,
    thumbnail: null,
  });
  writeIndex(index);
  window.localStorage.setItem(boardKey(copy.id), JSON.stringify(copy));
  return copy;
}

export function deleteBoard(id: string) {
  window.localStorage.removeItem(boardKey(id));
  writeIndex(readIndex().filter((b) => b.id !== id));
}

export function getBoardThumbnail(id: string): string | null {
  const entry = readIndex().find((b) => b.id === id);
  return entry?.thumbnail ?? null;
}

/** Writes a board coming from the cloud into local storage, creating or
 * overwriting the local copy and its index entry. Used by the sync layer. */
export function upsertLocalBoardFromRemote(
  board: BoardData,
  thumbnail: string | null
) {
  window.localStorage.setItem(boardKey(board.id), JSON.stringify(board));
  const index = readIndex();
  const entry = index.find((b) => b.id === board.id);
  if (entry) {
    entry.name = board.name;
    entry.updatedAt = board.updatedAt;
    entry.thumbnail = thumbnail;
  } else {
    index.push({
      id: board.id,
      name: board.name,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      thumbnail,
    });
  }
  writeIndex(index);
}
